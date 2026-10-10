'use client'

import { Layers, Minus, Plus } from 'lucide-react'
import type { Map as LeafletMap, TileLayer } from 'leaflet'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ANCHOR, GEO_MPU, lngLatToUnits, pxPerUnit, unitsToLngLat, type GeoFrame, type LngLat } from '@/lib/geo'
import { polygonBounds, type Rect } from '@/lib/geometry'
import type { Point } from '@/lib/mockData'
import { cn } from '@/lib/utils'

/** Esri World Imagery needs no API key. Override with NEXT_PUBLIC_TILE_URL (+ _ATTRIBUTION, _MAX_ZOOM). */
const TILE_URL =
  process.env.NEXT_PUBLIC_TILE_URL ||
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_TILE_ATTRIBUTION || 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
const MAX_NATIVE_ZOOM = Number(process.env.NEXT_PUBLIC_TILE_MAX_ZOOM) || 19
const MIN_ZOOM = 14

/** Plain street map, for places where the satellite pictures are old, blank or too coarse. */
const STREET_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const STREET_ATTRIBUTION = '&copy; OpenStreetMap contributors'
const STREET_MAX_NATIVE_ZOOM = 19

export type BaseLayer = 'satellite' | 'street'
const LAYER_KEY = 'suryacheck.baseLayer'
const readLayer = (): BaseLayer => {
  try {
    return localStorage.getItem(LAYER_KEY) === 'street' ? 'street' : 'satellite'
  } catch {
    return 'satellite'
  }
}
const saveLayer = (l: BaseLayer) => {
  try {
    localStorage.setItem(LAYER_KEY, l)
  } catch {
    /* private mode: the choice just lasts for this screen */
  }
}
/** Past the provider's real picture detail the image is just enlarged (blurry), so we stop early. */
const MAX_ZOOM = MAX_NATIVE_ZOOM + 2
const FIT_MAX_ZOOM = MAX_NATIVE_ZOOM + 1

interface MapView {
  /** Screen pixels per overlay unit. Divide sizes by this to keep them constant on screen. */
  scale: number
  clientToUnits: (clientX: number, clientY: number) => Point
}
const MapViewContext = createContext<MapView>({ scale: 1, clientToUnits: () => ({ x: ANCHOR.x, y: ANCHOR.y }) })
export const useMapView = () => useContext(MapViewContext)

/** A rectangle around some points, grown by a fraction of its size, for the `fit` prop. */
export function fitRectFor(points: Point[], margin = 0.18): Rect {
  const b = polygonBounds(points)
  const mx = Math.max(b.w * margin, 12)
  const my = Math.max(b.h * margin, 12)
  return { x: b.minX - mx, y: b.minY - my, w: b.w + 2 * mx, h: b.h + 2 * my }
}
/** About 26 m x 20 m around the pin. */
export const DEFAULT_FIT: Rect = { x: 0, y: 0, w: 400, h: 300 }

/** A ruler that stays true as the map zooms, so people can judge sizes on the roof. */
export function ScaleBar({ metres = 5 }: { metres?: number }) {
  const { scale } = useMapView()
  const px = (metres / GEO_MPU) * scale
  if (!Number.isFinite(px) || px < 24 || px > 260) return null
  return (
    <div className="pointer-events-none absolute bottom-[3.4rem] left-2 z-[600] flex flex-col items-start gap-0.5 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-bold text-ink shadow-md">
      <span>{metres} m</span>
      <span className="block h-1.5 border-x-2 border-b-2 border-ink" style={{ width: px }} />
    </div>
  )
}

export function SatelliteMap({
  frame,
  fit,
  fitKey = 'fit',
  interactive = false,
  onTap,
  onMoveEnd,
  centerPin = false,
  initialZoom = 19,
  fitMaxZoom = FIT_MAX_ZOOM,
  className,
  ariaLabel,
  children,
  notice,
}: {
  frame: GeoFrame
  fit?: Rect | null
  fitKey?: string | number
  /** Allow dragging and zooming. Off when the page should scroll under a finger. */
  interactive?: boolean
  onTap?: (point: Point) => void
  /** Called when the map stops moving, with the point under the centre. */
  onMoveEnd?: (center: LngLat) => void
  centerPin?: boolean
  initialZoom?: number
  /** How far zooming to `fit` may go. Higher shows small things bigger but the picture gets softer. */
  fitMaxZoom?: number
  className?: string
  ariaLabel: string
  children?: ReactNode
  notice?: ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const tf = useRef({ ox: 0, oy: 0, s: 1 })
  const fitted = useRef(false)
  const raf = useRef(0)
  const [scale, setScale] = useState(1)
  const [tilesFailed, setTilesFailed] = useState(false)
  const [layer, setLayer] = useState<BaseLayer>('satellite')
  const tileRef = useRef<TileLayer | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const layerRef = useRef<BaseLayer>('satellite')

  const latest = useRef({ frame, fit, interactive, onTap, onMoveEnd, initialZoom, fitMaxZoom })
  latest.current = { frame, fit, interactive, onTap, onMoveEnd, initialZoom, fitMaxZoom }

  const sync = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const f = latest.current.frame
    const s = pxPerUnit(map.getZoom(), f.lat)
    const o = map.latLngToContainerPoint([f.lat, f.lng])
    tf.current = { ox: o.x, oy: o.y, s }
    gRef.current?.setAttribute('transform', `translate(${o.x - ANCHOR.x * s} ${o.y - ANCHOR.y * s}) scale(${s})`)
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => setScale((prev) => (Math.abs(prev - s) / s > 0.002 ? s : prev)))
  }, [])

  const fitNow = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const size = map.getSize()
    if (!size.x || !size.y) return
    const { frame: f, fit: rect, initialZoom: z, fitMaxZoom: maxFit } = latest.current
    if (rect) {
      const sw = unitsToLngLat(f, { x: rect.x, y: rect.y + rect.h })
      const ne = unitsToLngLat(f, { x: rect.x + rect.w, y: rect.y })
      map.fitBounds([[sw.lat, sw.lng], [ne.lat, ne.lng]], { animate: false, padding: [12, 12], maxZoom: maxFit })
    } else {
      map.setView([f.lat, f.lng], z, { animate: false })
    }
    fitted.current = true
    sync()
  }, [sync])

  /** (Re)creates the picture layer for the chosen base layer. */
  const mountTiles = useCallback(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return
    tileRef.current?.remove()
    const street = layerRef.current === 'street'
    let loaded = 0
    let errored = 0
    setTilesFailed(false)
    const tiles = L.tileLayer(street ? STREET_URL : TILE_URL, {
      maxNativeZoom: street ? STREET_MAX_NATIVE_ZOOM : MAX_NATIVE_ZOOM,
      maxZoom: MAX_ZOOM,
      attribution: street ? STREET_ATTRIBUTION : TILE_ATTRIBUTION,
    })
    tiles.on('tileload', () => {
      loaded++
      setTilesFailed(false)
    })
    tiles.on('tileerror', () => {
      errored++
      if (loaded === 0 && errored >= 4) setTilesFailed(true)
    })
    tiles.addTo(map)
    tileRef.current = tiles
  }, [])

  const chooseLayer = (next: BaseLayer) => {
    if (next === layerRef.current) return
    layerRef.current = next
    setLayer(next)
    saveLayer(next)
    mountTiles()
  }

  useEffect(() => {
    let cancelled = false
    let ro: ResizeObserver | null = null
    let map: LeafletMap | null = null
    ;(async () => {
      const mod = await import('leaflet')
      const L = (mod as unknown as { default?: typeof import('leaflet') }).default ?? mod
      if (cancelled || !hostRef.current) return
      const on = latest.current.interactive
      map = L.map(hostRef.current, {
        zoomControl: false,
        zoomSnap: 0,
        zoomAnimation: false, // overlay is positioned from the live zoom, so no tweening
        fadeAnimation: false,
        markerZoomAnimation: false,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        dragging: on,
        touchZoom: on,
        scrollWheelZoom: on,
        doubleClickZoom: on,
        keyboard: on,
        boxZoom: false,
      })
      mapRef.current = map
      map.attributionControl.setPrefix(false)
      leafletRef.current = L
      layerRef.current = readLayer()
      setLayer(layerRef.current)
      mountTiles()
      map.on('move zoom resize', sync)
      map.on('moveend', () => {
        const c = map!.getCenter()
        latest.current.onMoveEnd?.({ lat: c.lat, lng: c.lng })
      })
      map.on('click', (e) => {
        const { onTap: tap, frame: f } = latest.current
        tap?.(lngLatToUnits(f, { lng: e.latlng.lng, lat: e.latlng.lat }))
      })
      ro = new ResizeObserver(() => {
        if (!map) return
        map.invalidateSize({ animate: false })
        if (!fitted.current || !latest.current.interactive) fitNow()
        else sync()
      })
      ro.observe(wrapRef.current!)
      fitNow()
    })()
    return () => {
      cancelled = true
      ro?.disconnect()
      cancelAnimationFrame(raf.current)
      map?.remove()
      mapRef.current = null
      fitted.current = false
    }
  }, [fitNow, sync, mountTiles])

  useEffect(() => {
    fitNow()
  }, [fitKey, fitNow])
  useEffect(() => {
    sync()
  }, [frame.lat, frame.lng, sync])
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const act = interactive ? 'enable' : 'disable'
    map.dragging[act]()
    map.touchZoom[act]()
    map.scrollWheelZoom[act]()
    map.doubleClickZoom[act]()
    map.keyboard[act]()
  }, [interactive])

  const clientToUnits = useCallback((clientX: number, clientY: number): Point => {
    const r = wrapRef.current?.getBoundingClientRect()
    const { ox, oy, s } = tf.current
    if (!r || !s) return { x: ANCHOR.x, y: ANCHOR.y }
    return { x: ANCHOR.x + (clientX - r.left - ox) / s, y: ANCHOR.y + (clientY - r.top - oy) / s }
  }, [])
  const view = useMemo(() => ({ scale, clientToUnits }), [scale, clientToUnits])
  const zoomBy = (d: number) => {
    const map = mapRef.current
    if (map) map.setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, map.getZoom() + d)))
  }

  return (
    <MapViewContext.Provider value={view}>
      <div
        ref={wrapRef}
        role="group"
        aria-label={ariaLabel}
        className={cn(
          'relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#1d2a22] shadow-[0_8px_24px_-8px_rgba(20,40,30,0.6)] ring-1 ring-black/10',
          onTap && 'cursor-crosshair',
          className,
        )}
      >
        <div ref={hostRef} className="absolute inset-0 z-0" />
        <svg className="pointer-events-none absolute inset-0 z-[500] size-full overflow-visible">
          <g ref={gRef}>{children}</g>
        </svg>

        {centerPin && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[550] -translate-x-1/2 -translate-y-full">
            <svg width="44" height="58" viewBox="-22 -44 44 58" aria-hidden="true">
              <ellipse cx="0" cy="2" rx="14" ry="5" fill="#000" opacity="0.4" />
              <circle className="pin-pulse" cx="0" cy="-16" r="14" fill="#F59E0B" />
              <path d="M0 0 C-11 -12 -15 -18 -15 -26 A15 15 0 0 1 15 -26 C15 -18 11 -12 0 0 Z" fill="#F59E0B" stroke="#fff" strokeWidth="2.5" />
              <circle cx="0" cy="-26" r="5.5" fill="#fff" />
            </svg>
          </div>
        )}

        {interactive && (
          <div className="absolute right-2 top-2 z-[600] flex flex-col gap-1.5">
            {[
              { d: 1, label: 'Zoom in', Icon: Plus },
              { d: -1, label: 'Zoom out', Icon: Minus },
            ].map(({ d, label, Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => zoomBy(d)}
                aria-label={label}
                className="flex size-11 items-center justify-center rounded-xl bg-white/95 text-ink shadow-md hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40"
              >
                <Icon className="size-5" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <div
          role="group"
          aria-label="Map style"
          className="absolute bottom-2 left-2 z-[600] flex items-center gap-0.5 rounded-xl bg-white/95 p-1 text-sm font-bold shadow-md"
        >
          <Layers className="mx-1.5 size-4 text-ink/60" aria-hidden="true" />
          {([
            ['satellite', 'Satellite'],
            ['street', 'Map'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={layer === id}
              onClick={() => chooseLayer(id)}
              className={cn(
                'min-h-9 rounded-lg px-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40',
                layer === id ? 'bg-ink text-white' : 'text-ink hover:bg-black/5',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tilesFailed && (
          <p role="alert" className="absolute inset-x-3 top-3 z-[600] rounded-xl bg-white/95 px-3 py-2 text-center text-sm font-semibold text-red-800 shadow-md">
            {layer === 'satellite' ? (
              <>
                Satellite pictures could not load here.{' '}
                <button type="button" onClick={() => chooseLayer('street')} className="underline">
                  Use the plain map
                </button>
              </>
            ) : (
              'The map could not load. Check your connection and try again.'
            )}
          </p>
        )}
        {notice}
      </div>
    </MapViewContext.Provider>
  )
}
