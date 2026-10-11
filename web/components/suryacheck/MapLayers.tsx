import { useRef, useState } from 'react'
import { convexHull, pointInPolygon, polygonBounds, toPoints } from '@/lib/geometry'
import { neighbourBlock } from '@/lib/neighbours'
import type { Neighbour, Obstacle, Point } from '@/lib/mockData'
import { GEO_MPU } from '@/lib/geo'
import { isRound, obstacleFootprint, presetFor, rotateAround } from '@/lib/obstacles'
import { useMapView } from './SatelliteMap'

export function RoofOutline({ points, fillOpacity = 0.28, dashed = false }: { points: Point[]; fillOpacity?: number; dashed?: boolean }) {
  return (
    <g pointerEvents="none">
      <polygon points={toPoints(points)} fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <polygon
        points={toPoints(points)}
        fill="#F59E0B"
        fillOpacity={fillOpacity}
        stroke="#FBBF24"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '6 4' : undefined}
      />
    </g>
  )
}

/**
 * The length of every side of an outline, in metres, so a wrong outline is easy to spot
 * ("my house is not 33 m wide"). Sides too short on screen to label are skipped.
 */
export function EdgeLengths({ points, mpu = GEO_MPU, closed = true }: { points: Point[]; mpu?: number; closed?: boolean }) {
  const { scale } = useMapView()
  if (points.length < 2) return null
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length
  const edges = (closed && points.length > 2 ? points : points.slice(0, -1)).map((a, i) => {
    const b = points[(i + 1) % points.length]
    return { a, b, len: Math.hypot(b.x - a.x, b.y - a.y) }
  })
  return (
    <g pointerEvents="none">
      {edges.map(({ a, b, len }, i) => {
        if (len * scale < 46) return null
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        // Nudge the label outwards, away from the middle of the shape, so it sits beside the edge.
        let nx = -(b.y - a.y) / len
        let ny = (b.x - a.x) / len
        if ((mx - cx) * nx + (my - cy) * ny < 0) {
          nx = -nx
          ny = -ny
        }
        const off = points.length > 2 ? 14 / scale : 0
        const text = `${(len * mpu).toFixed(1)} m`
        const w = (text.length * 6.6 + 12) / scale
        return (
          <g key={i} transform={`translate(${mx + nx * off} ${my + ny * off})`}>
            <rect x={-w / 2} y={-9 / scale} width={w} height={18 / scale} rx={9 / scale} fill="#1f2937" opacity="0.88" />
            <text y={4 / scale} textAnchor="middle" fontSize={11 / scale} fontWeight="700" fill="#fff">
              {text}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** Soft shadows cast by tanks, rooms and tall neighbours. */
/** Skyline heights below this are open sky (the scan's baseline). */
const OPEN_SKY_DEG = 3.5

/**
 * The scanned surroundings drawn around the roof: in each direction a band whose thickness and colour
 * show how high the buildings and trees rise there. A scan gives direction and height, not distance,
 * so this is a compass of the skyline, not building outlines.
 */
export function SkylineRing({ horizon, roof, mpu = GEO_MPU }: { horizon: number[]; roof: Point[]; mpu?: number }) {
  const { scale } = useMapView()
  if (!horizon.some((h) => h > OPEN_SKY_DEG)) return null
  const c = { x: roof.reduce((s, p) => s + p.x, 0) / roof.length, y: roof.reduce((s, p) => s + p.y, 0) / roof.length }
  const r0 = Math.max(...roof.map((p) => Math.hypot(p.x - c.x, p.y - c.y))) + 2 / mpu
  const perDeg = 0.3 / mpu // band grows 0.3 m per degree of skyline height
  const at = (bearing: number, r: number) => ({ x: c.x + Math.sin((bearing * Math.PI) / 180) * r, y: c.y - Math.cos((bearing * Math.PI) / 180) * r })
  const tallest = horizon.reduce((best, h, i) => (h > horizon[best] ? i : best), 0)
  const labelAt = at(tallest * 10, r0 + horizon[tallest] * perDeg + 4 / mpu)
  return (
    <g pointerEvents="none">
      {horizon.map((h, i) => {
        if (h <= OPEN_SKY_DEG) return null
        const a = i * 10 - 5
        const b = i * 10 + 5
        const r1 = r0 + h * perDeg
        const pts = [at(a, r0), at(b, r0), at(b, r1), at(a, r1)]
        const strength = Math.min(1, h / 35)
        return (
          <polygon
            key={i}
            points={toPoints(pts)}
            fill={`rgba(15, 92, 94, ${0.25 + 0.55 * strength})`}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
      <g transform={`translate(${labelAt.x} ${labelAt.y})`}>
        <text textAnchor="middle" fontSize={11 / scale} fontWeight="800" fill="#fff" stroke="#0b3d3f" strokeWidth={3 / scale} paintOrder="stroke">
          tallest {Math.round(horizon[tallest])}°
        </text>
      </g>
    </g>
  )
}

/**
 * Where the sun is right now, drawn just outside the skyline ring with a dashed line to the roof,
 * so the person can watch it pass behind the surroundings while the day plays. Red when hidden.
 */
export function SunMarker({ roof, azimuth, elevation, hidden, mpu = GEO_MPU }: { roof: Point[]; azimuth: number; elevation: number; hidden: boolean; mpu?: number }) {
  const { scale } = useMapView()
  if (elevation <= 0) return null
  const c = { x: roof.reduce((s, p) => s + p.x, 0) / roof.length, y: roof.reduce((s, p) => s + p.y, 0) / roof.length }
  const r = Math.max(...roof.map((p) => Math.hypot(p.x - c.x, p.y - c.y))) + 2 / mpu + 45 * (0.3 / mpu) + 3 / mpu // beyond the tallest ring band
  const a = (azimuth * Math.PI) / 180
  const s = { x: c.x + Math.sin(a) * r, y: c.y - Math.cos(a) * r }
  const colour = hidden ? '#DC2626' : '#F59E0B'
  return (
    <g pointerEvents="none">
      <line x1={c.x} y1={c.y} x2={s.x} y2={s.y} stroke={colour} strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" opacity="0.9" />
      <circle cx={s.x} cy={s.y} r={14 / scale} fill={colour} fillOpacity="0.25" />
      <circle cx={s.x} cy={s.y} r={8 / scale} fill={colour} stroke="#fff" strokeWidth={2 / scale} />
    </g>
  )
}

/** Dims the whole roof while the sun is behind the scanned surroundings (far buildings shade all of it at once). */
export function SkylineShade({ roof, active }: { roof: Point[]; active: boolean }) {
  if (!active) return null
  return <polygon points={toPoints(roof)} fill="#0b1a12" fillOpacity="0.45" pointerEvents="none" className="sc-fade-in" />
}

export function ShadowLayer({ shadows }: { shadows: Point[][] }) {
  return (
    <g pointerEvents="none">
      <defs>
        <filter id="sc-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <g filter="url(#sc-soft)" opacity="0.58">
        {shadows.map((poly, i) => (
          <polygon key={i} points={toPoints(poly)} fill="#050a14" />
        ))}
      </g>
    </g>
  )
}

/** Solar panels as they look on a roof: dark glass, silver frame, cell lines. */
/**
 * A 1.7 m person standing beside a 5 m ruler, drawn in the same units as the roof so the size
 * is honest. Used in the PDF report. `x`,`y` is where the person's feet are. `fs` is label size in map units.
 */
export function ScaleReference({ x, y, mpu = GEO_MPU, fs, metres = 5 }: { x: number; y: number; mpu?: number; fs: number; metres?: number }) {
  const k = 1 / mpu // map units per metre
  const f = fs * mpu // label size, in metres, inside the scaled group
  const ink = '#0F5C5E'
  return (
    <g pointerEvents="none" transform={`translate(${x} ${y}) scale(${k})`}>
      <g fill={ink}>
        <circle cx="0" cy="-1.6" r="0.11" />
        <rect x="-0.22" y="-1.46" width="0.44" height="0.72" rx="0.14" />
        <rect x="-0.19" y="-0.78" width="0.16" height="0.78" rx="0.05" />
        <rect x="0.03" y="-0.78" width="0.16" height="0.78" rx="0.05" />
      </g>
      <g stroke={ink} strokeWidth="1.2" fill="none">
        <line x1="0.5" y1="-1.7" x2="0.5" y2="0" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <line x1="0.4" y1="-1.7" x2="0.6" y2="-1.7" vectorEffect="non-scaling-stroke" />
        <line x1="0.4" y1="0" x2="0.6" y2="0" vectorEffect="non-scaling-stroke" />
      </g>
      <text x="0.72" y={-0.85 + f * 0.35} fontSize={f} fontWeight="700" fill={ink}>1.7 m person</text>
      <g stroke={ink} strokeWidth="1.6" fill="none">
        <line x1="0" y1={f * 1.6} x2={metres} y2={f * 1.6} vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={f * 1.6 - f * 0.4} x2="0" y2={f * 1.6 + f * 0.4} vectorEffect="non-scaling-stroke" />
        <line x1={metres} y1={f * 1.6 - f * 0.4} x2={metres} y2={f * 1.6 + f * 0.4} vectorEffect="non-scaling-stroke" />
      </g>
      <text x={metres + 0.25} y={f * 1.6 + f * 0.35} fontSize={f} fontWeight="700" fill={ink}>{metres} m</text>
    </g>
  )
}

/** A dimension line above the panel block saying how big it really is, so people can judge it against the roof. */
export function PanelDimension({ panels, mpu = GEO_MPU }: { panels: { x: number; y: number; w: number; h: number }[]; mpu?: number }) {
  const { scale } = useMapView()
  if (!panels.length) return null
  const minX = Math.min(...panels.map((p) => p.x))
  const maxX = Math.max(...panels.map((p) => p.x + p.w))
  const minY = Math.min(...panels.map((p) => p.y))
  const maxY = Math.max(...panels.map((p) => p.y + p.h))
  const wM = ((maxX - minX) * mpu).toFixed(1)
  const hM = ((maxY - minY) * mpu).toFixed(1)
  const y = minY - 14 / scale
  const text = `${panels.length} panels · about ${wM} × ${hM} m`
  const pillW = (text.length * 6.3 + 18) / scale
  const ink = '#ffffff'
  return (
    <g pointerEvents="none">
      <g stroke="#000" strokeOpacity="0.55" strokeWidth="3.4" fill="none">
        <line x1={minX} y1={y} x2={maxX} y2={y} vectorEffect="non-scaling-stroke" />
      </g>
      <g stroke={ink} strokeWidth="1.6" fill="none">
        <line x1={minX} y1={y} x2={maxX} y2={y} vectorEffect="non-scaling-stroke" />
        <line x1={minX} y1={y - 4 / scale} x2={minX} y2={y + 4 / scale} vectorEffect="non-scaling-stroke" />
        <line x1={maxX} y1={y - 4 / scale} x2={maxX} y2={y + 4 / scale} vectorEffect="non-scaling-stroke" />
      </g>
      <g transform={`translate(${(minX + maxX) / 2} ${y - 13 / scale})`}>
        <rect x={-pillW / 2} y={-9 / scale} width={pillW} height={18 / scale} rx={9 / scale} fill="#1f2937" opacity="0.9" />
        <text y={4 / scale} textAnchor="middle" fontSize={11 / scale} fontWeight="700" fill="#fff">{text}</text>
      </g>
    </g>
  )
}

export function PanelLayer({ panels }: { panels: { x: number; y: number; w: number; h: number; angle?: number }[] }) {
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id="sc-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6bd8" />
          <stop offset="1" stopColor="#14307a" />
        </linearGradient>
      </defs>
      {panels.map((p, i) => {
        const cols = 4
        const rows = 6
        return (
          <g key={i} transform={p.angle ? `rotate(${p.angle} ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined}>
            <rect x={p.x + 0.8} y={p.y + 1.6} width={p.w} height={p.h} rx="1.5" fill="#000" opacity="0.38" />
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="1.5" fill="url(#sc-glass)" stroke="#e2e8f0" strokeWidth="1.1" />
            {Array.from({ length: cols - 1 }, (_, c) => (
              <line key={`c${c}`} x1={p.x + ((c + 1) * p.w) / cols} y1={p.y + 1} x2={p.x + ((c + 1) * p.w) / cols} y2={p.y + p.h - 1} stroke="#93c5fd" strokeWidth="0.35" opacity="0.55" />
            ))}
            {Array.from({ length: rows - 1 }, (_, r) => (
              <line key={`r${r}`} x1={p.x + 1} y1={p.y + ((r + 1) * p.h) / rows} x2={p.x + p.w - 1} y2={p.y + ((r + 1) * p.h) / rows} stroke="#93c5fd" strokeWidth="0.35" opacity="0.55" />
            ))}
            {/* high (north) edge catches more light; low (south) edge carries the support rail */}
            <rect x={p.x + 1} y={p.y + 0.6} width={p.w - 2} height={Math.max(1, p.h * 0.05)} fill="#fff" opacity="0.5" />
            <rect x={p.x} y={p.y + p.h - Math.max(1.2, p.h * 0.07)} width={p.w} height={Math.max(1.2, p.h * 0.07)} fill="#cbd5e1" />
          </g>
        )
      })}
    </g>
  )
}

/** Draggable corner marker: constant size on screen at any zoom, thumb-sized hit area. */
export function CornerHandle({ point, label, onMove, ariaLabel }: { point: Point; label?: string; onMove: (p: Point) => void; ariaLabel?: string }) {
  const { scale, clientToUnits } = useMapView()
  const dragging = useRef(false)
  const r = 13 / scale
  return (
    <g
      transform={`translate(${point.x} ${point.y})`}
      pointerEvents="auto"
      role="button"
      aria-label={ariaLabel}
      style={{ touchAction: 'none', cursor: 'grab' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        dragging.current = true
      }}
      onPointerMove={(e) => {
        if (dragging.current) onMove(clientToUnits(e.clientX, e.clientY))
      }}
      onPointerUp={(e) => {
        dragging.current = false
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={() => {
        dragging.current = false
      }}
    >
      <circle r={22 / scale} fill="transparent" />
      <circle r={r} fill="#fff" stroke="#D97706" strokeWidth={3.5 / scale} />
      {label && (
        <text y={4.5 / scale} textAnchor="middle" fontSize={13 / scale} fontWeight="800" fill="#2b2118" pointerEvents="none">
          {label}
        </text>
      )}
    </g>
  )
}

/** Small "+" on an edge's midpoint. Tapping it adds a corner there. */
export function EdgeAdder({ at, onAdd, ariaLabel }: { at: Point; onAdd: () => void; ariaLabel: string }) {
  const { scale } = useMapView()
  const r = 9 / scale
  const a = 4 / scale
  return (
    <g
      transform={`translate(${at.x} ${at.y})`}
      pointerEvents="auto"
      role="button"
      aria-label={ariaLabel}
      style={{ touchAction: 'none', cursor: 'copy' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onAdd()
      }}
    >
      <circle r={20 / scale} fill="transparent" />
      <circle r={r} fill="rgba(255,255,255,0.75)" stroke="#D97706" strokeWidth={2 / scale} />
      <path d={`M${-a} 0H${a}M0 ${-a}V${a}`} stroke="#D97706" strokeWidth={2 / scale} strokeLinecap="round" />
    </g>
  )
}

/** How far an item's top is drawn above its foot, in map units, so tall things look tall. */
export const obstacleRise = (o: Pick<Obstacle, 'kind' | 'heightM'>) => (o.kind === 'clear' ? 0 : Math.max(3, (o.heightM / GEO_MPU) * 0.25))

/** Walls of a standing item: its foot outline pulled straight up the screen. */
const wallOutline = (foot: Point[], rise: number): Point[] =>
  convexHull([...foot, ...foot.map((p) => ({ x: p.x, y: p.y - rise }))])

/** Tanks, rooms and the like, drawn as small standing objects. Pass `labels` to name them. */
export function ObstacleLayer({ obstacles, labels = false }: { obstacles: Obstacle[]; labels?: boolean }) {
  const { scale } = useMapView()
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id="sc-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {obstacles.map((o) => {
        const preset = presetFor(o.kind)
        const rise = obstacleRise(o)
        const x0 = o.x - o.w / 2
        const y0 = o.y - o.h / 2
        const fs = 11 / scale
        const clear = o.kind === 'clear'
        const round = isRound(o)
        const angle = o.angle ?? 0
        const spin = angle ? `rotate(${angle} ${o.x} ${o.y})` : undefined
        const name = (o.name?.trim() || preset.short).slice(0, 18)
        const wM = +(o.w * GEO_MPU).toFixed(1)
        const lM = +(o.h * GEO_MPU).toFixed(1)
        const dims = round ? `${wM} m wide` : `${wM} × ${lM} m`
        const text = clear ? `${name} · ${dims}` : `${name} · ${o.heightM} m tall · ${dims}`
        const labelW = Math.max(68, text.length * 6.1 + 18)
        const foot = obstacleFootprint(o)
        const bb = polygonBounds(foot)
        return (
          <g key={o.id}>
            {clear ? (
              <g transform={spin}>
                <rect x={x0} y={y0} width={o.w} height={o.h} rx="2" fill={preset.color} opacity="0.28" />
                <rect x={x0} y={y0} width={o.w} height={o.h} rx="2" fill="none" stroke="#b45309" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                <line x1={x0} y1={y0} x2={x0 + o.w} y2={y0 + o.h} stroke="#b45309" strokeWidth="1" opacity="0.55" vectorEffect="non-scaling-stroke" />
                <line x1={x0 + o.w} y1={y0} x2={x0} y2={y0 + o.h} stroke="#b45309" strokeWidth="1" opacity="0.55" vectorEffect="non-scaling-stroke" />
              </g>
            ) : (
              <>
                {/* walls: the foot outline dragged up to the roof of the item */}
                <polygon points={toPoints(wallOutline(foot, rise))} fill={preset.color} />
                <polygon points={toPoints(wallOutline(foot, rise))} fill="url(#sc-wall)" stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                {o.kind === 'stairs' && !angle && (
                  <g>
                    <rect x={o.x - o.w * 0.1} y={y0 + o.h - rise * 0.7} width={o.w * 0.2} height={rise * 0.7} rx="1" fill="#3b2f25" opacity="0.8" />
                    <rect x={x0 + o.w * 0.12} y={y0 + o.h - rise * 0.72} width={o.w * 0.14} height={rise * 0.26} fill="#bfe3f5" opacity="0.8" />
                    <rect x={x0 + o.w * 0.74} y={y0 + o.h - rise * 0.72} width={o.w * 0.14} height={rise * 0.26} fill="#bfe3f5" opacity="0.8" />
                  </g>
                )}
                {/* the top of the item */}
                <g transform={`translate(0 ${-rise})${spin ? ` ${spin}` : ''}`}>
                  {round ? (
                    <>
                      <ellipse cx={o.x} cy={o.y} rx={o.w / 2} ry={o.h / 2} fill={o.kind === 'tank' ? '#9ad3ee' : preset.color} stroke="#fff" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
                      <ellipse cx={o.x - o.w * 0.12} cy={o.y - o.h * 0.1} rx={o.w * 0.22} ry={o.h * 0.16} fill="#fff" opacity="0.55" />
                      {o.kind === 'tank' && <circle cx={o.x} cy={o.y} r={Math.max(1.2, o.w * 0.08)} fill="#3b82a8" />}
                    </>
                  ) : (
                    <>
                      <rect x={x0} y={y0} width={o.w} height={o.h} rx="1.5" fill={preset.color} stroke="#fff" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                      <rect x={x0} y={y0} width={o.w} height={o.h} rx="1.5" fill="#fff" opacity="0.16" />
                      <rect x={x0 + o.w * 0.07} y={y0 + o.h * 0.1} width={o.w * 0.86} height={o.h * 0.8} fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                    </>
                  )}
                </g>
              </>
            )}
            {labels && (
              <g transform={`translate(${o.x} ${bb.minY - rise - 12 / scale})`}>
                <rect x={-labelW / 2 / scale} y={-9 / scale} width={labelW / scale} height={18 / scale} rx={9 / scale} fill="#1f2937" opacity="0.88" />
                <text y={4 / scale} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff">
                  {text}
                </text>
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}

/** How high a neighbour's wall is drawn, in screen pixels. */
export const neighbourRisePx = (floors: number) => Math.min(14 + floors * 7, 64)

/** Tall neighbours drawn as standing buildings (top face plus walls rising toward the viewer), with the shadow they cast. */
export function NeighbourLayer({
  neighbours,
  roof,
  mpu,
  houseFloors = 0,
  shadows = [],
}: {
  neighbours: Neighbour[]
  roof: Point[]
  mpu: number
  houseFloors?: number
  /** Shadow polygons to draw under the buildings. */
  shadows?: Point[][]
}) {
  const { scale } = useMapView()
  return (
    <g pointerEvents="none">
      <ShadowLayer shadows={shadows} />
      {neighbours.map((n) => {
        const o = neighbourBlock(n, roof, mpu, houseFloors)
        const rise = neighbourRisePx(n.floors) / scale
        const fs = 12 / scale
        const lower = n.floors <= houseFloors
        const label = `${n.floors} ${n.floors === 1 ? 'floor' : 'floors'}`
        const foot = obstacleFootprint(o)
        const angle = o.angle ?? 0
        return (
          <g key={n.id} opacity={lower ? 0.55 : 1}>
            <polygon points={toPoints(wallOutline(foot, rise))} fill="#0A3F40" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <g transform={`translate(0 ${-rise})${angle ? ` rotate(${angle} ${o.x} ${o.y})` : ''}`}>
              <rect x={o.x - o.w / 2} y={o.y - o.h / 2} width={o.w} height={o.h} fill="#0F5C5E" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" rx={2 / scale} />
            </g>
            <text x={o.x} y={o.y - rise + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight="800" fill="#fff">
              {label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** Something on the map that can be dragged, resized and turned. Sizes are in map units, centre-based. */
export interface EditItem {
  id: string
  x: number
  y: number
  w: number
  h: number
  angle?: number
  round?: boolean
  /** How far its top is drawn above its foot: map units plus screen pixels. */
  lift: { units: number; px: number }
  /** Only allow moving it while its centre stays on the roof. */
  keepOnRoof?: boolean
}
type EditPatch = { x: number; y: number; w: number; h: number; angle: number }

/**
 * Photoshop-style editing. Press an item to select it and drag to move it. A selected item shows
 * corner handles to resize and a round handle on a stem to turn it.
 */
export function ObstacleEditor({
  items,
  selectedId,
  onSelect,
  onChange,
  roof,
  minUnits,
  maxUnits,
}: {
  items: EditItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (id: string, patch: EditPatch) => void
  roof: Point[]
  minUnits: number
  maxUnits: number
}) {
  const { scale, clientToUnits } = useMapView()
  const drag = useRef<{ id: string; mode: 'move' | 'rotate' | 'size'; dx: number; dy: number; sx: number; sy: number; fixed: Point } | null>(null)
  const [turning, setTurning] = useState(false)
  const liftOf = (it: EditItem) => it.lift.units + it.lift.px / scale
  const baseAt = (e: React.PointerEvent, it: EditItem): Point => {
    const p = clientToUnits(e.clientX, e.clientY)
    return { x: p.x, y: p.y + liftOf(it) }
  }
  const full = (it: EditItem, over: Partial<EditPatch>): EditPatch => ({ x: it.x, y: it.y, w: it.w, h: it.h, angle: it.angle ?? 0, ...over })

  const start = (e: React.PointerEvent, it: EditItem, mode: 'move' | 'rotate' | 'size', sx = 0, sy = 0) => {
    e.stopPropagation()
    e.preventDefault() // stops the browser starting a text or image drag, which would cancel ours
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = baseAt(e, it)
    const c = { x: it.x, y: it.y }
    const fixed = mode === 'size' ? rotateAround({ x: c.x - (sx * it.w) / 2, y: c.y - (sy * it.h) / 2 }, c, it.angle ?? 0) : c
    drag.current = { id: it.id, mode, dx: c.x - p.x, dy: c.y - p.y, sx, sy, fixed }
    if (mode === 'rotate') setTurning(true)
    if (mode === 'move') onSelect(it.id)
  }
  const move = (e: React.PointerEvent, it: EditItem) => {
    const d = drag.current
    if (!d || d.id !== it.id) return
    const p = baseAt(e, it)
    if (d.mode === 'move') {
      const np = { x: p.x + d.dx, y: p.y + d.dy }
      if (it.keepOnRoof && !pointInPolygon(np, roof)) return
      onChange(it.id, full(it, np))
    } else if (d.mode === 'rotate') {
      let a = (Math.atan2(p.y - it.y, p.x - it.x) * 180) / Math.PI + 90
      a = ((Math.round(a) % 360) + 360) % 360
      for (const snap of [0, 45, 90, 135, 180, 225, 270, 315, 360]) if (Math.abs(a - snap) <= 4) a = snap % 360
      onChange(it.id, full(it, { angle: a }))
    } else {
      const angle = it.angle ?? 0
      const v = rotateAround(p, d.fixed, -angle)
      let w = Math.min(maxUnits, Math.max(minUnits, d.sx * (v.x - d.fixed.x)))
      let h = Math.min(maxUnits, Math.max(minUnits, d.sy * (v.y - d.fixed.y)))
      if (it.round) w = h = Math.max(w, h)
      const centre = rotateAround({ x: d.fixed.x + (d.sx * w) / 2, y: d.fixed.y + (d.sy * h) / 2 }, d.fixed, angle)
      onChange(it.id, full(it, { x: centre.x, y: centre.y, w, h }))
    }
  }
  const end = (e: React.PointerEvent) => {
    drag.current = null
    setTurning(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const handlers = (it: EditItem, mode: 'move' | 'rotate' | 'size', sx = 0, sy = 0) => ({
    onPointerDown: (e: React.PointerEvent) => start(e, it, mode, sx, sy),
    onPointerMove: (e: React.PointerEvent) => move(e, it),
    onPointerUp: end,
    onPointerCancel: end,
  })

  return (
    <g>
      {items.map((it) => {
        const lift = liftOf(it)
        const top = obstacleFootprint({ kind: 'custom', shape: it.round ? 'round' : 'box', x: it.x, y: it.y - lift, w: it.w, h: it.h, angle: it.angle })
        const selected = it.id === selectedId
        const angle = it.angle ?? 0
        const hs = 8 / scale
        return (
          <g key={it.id}>
            <polygon points={toPoints(top)} fill="transparent" pointerEvents="auto" style={{ touchAction: 'none', cursor: selected ? 'move' : 'pointer' }} {...handlers(it, 'move')} />
            {selected && (
              <g transform={`translate(${it.x} ${it.y - lift}) rotate(${angle})`}>
                <rect x={-it.w / 2} y={-it.h / 2} width={it.w} height={it.h} fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
                <rect x={-it.w / 2} y={-it.h / 2} width={it.w} height={it.h} fill="none" stroke="#0F5C5E" strokeWidth="1" strokeDasharray="5 4" strokeDashoffset="4.5" vectorEffect="non-scaling-stroke" pointerEvents="none" />
                <line x1={0} y1={-it.h / 2} x2={0} y2={-it.h / 2 - 26 / scale} stroke="#fff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" pointerEvents="none" />
                {[
                  [-1, -1],
                  [1, -1],
                  [1, 1],
                  [-1, 1],
                ].map(([sx, sy]) => (
                  <g key={`${sx}${sy}`} transform={`translate(${(sx * it.w) / 2} ${(sy * it.h) / 2})`} pointerEvents="auto" role="button" aria-label="Drag to resize" style={{ touchAction: 'none', cursor: (sx === sy ? 'nwse' : 'nesw') + '-resize' }} {...handlers(it, 'size', sx, sy)}>
                    <circle r={20 / scale} fill="transparent" />
                    <rect x={-hs} y={-hs} width={hs * 2} height={hs * 2} rx={2 / scale} fill="#fff" stroke="#0F5C5E" strokeWidth={2.4 / scale} />
                  </g>
                ))}
                <g transform={`translate(0 ${-it.h / 2 - 26 / scale})`} pointerEvents="auto" role="button" aria-label="Drag to turn" style={{ touchAction: 'none', cursor: 'grab' }} {...handlers(it, 'rotate')}>
                  <circle r={22 / scale} fill="transparent" />
                  <circle r={10 / scale} fill="#fff" stroke="#0F5C5E" strokeWidth={2.4 / scale} />
                  <path d={`M${-4.5 / scale} ${1 / scale}A${4.5 / scale} ${4.5 / scale} 0 1 1 ${0.5 / scale} ${4.4 / scale}M${-4.5 / scale} ${-2.4 / scale}V${1 / scale}H${-1.2 / scale}`} fill="none" stroke="#0F5C5E" strokeWidth={1.8 / scale} strokeLinecap="round" strokeLinejoin="round" />
                  {(turning || angle !== 0) && (
                    <g transform={`translate(${24 / scale} 0) rotate(${-angle})`} pointerEvents="none" style={{ userSelect: 'none' }}>
                      <rect x={-17 / scale} y={-9 / scale} width={34 / scale} height={18 / scale} rx={9 / scale} fill="#1f2937" opacity="0.9" />
                      <text y={4 / scale} textAnchor="middle" fontSize={11 / scale} fontWeight="700" fill="#fff">{Math.round(angle)}°</text>
                    </g>
                  )}
                </g>
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}

/**
 * Drag on the roof to draw an item's rectangle (or circle), like a selection tool. A plain tap, or any
 * touch, just drops one at its usual size. Needs a map that is not itself being dragged.
 */
export function DrawLayer({
  round,
  mpu,
  onDraw,
  onTap,
}: {
  round: boolean
  mpu: number
  onDraw: (r: { x: number; y: number; w: number; h: number }) => void
  onTap: (p: Point) => void
}) {
  const { scale, clientToUnits } = useMapView()
  const st = useRef<{ from: Point; cx: number; cy: number; moved: boolean; touch: boolean } | null>(null)
  const [cur, setCur] = useState<Point | null>(null)
  const shape = (a: Point, b: Point) => {
    let w = Math.abs(b.x - a.x)
    let h = Math.abs(b.y - a.y)
    if (round) w = h = Math.max(w, h)
    const sx = b.x >= a.x ? 1 : -1
    const sy = b.y >= a.y ? 1 : -1
    return { x: a.x + (sx * w) / 2, y: a.y + (sy * h) / 2, w, h }
  }
  const draft = st.current?.moved && cur ? shape(st.current.from, cur) : null
  const end = (e: React.PointerEvent, cancelled: boolean) => {
    const s = st.current
    st.current = null
    setCur(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!s || cancelled) return
    const p = clientToUnits(e.clientX, e.clientY)
    if (s.moved) onDraw(shape(s.from, p))
    else onTap(s.from)
  }
  const pill = draft ? `${(draft.w * mpu).toFixed(1)} × ${(draft.h * mpu).toFixed(1)} m` : ''
  return (
    <g>
      <rect
        x={-20000}
        y={-20000}
        width={40000}
        height={40000}
        fill="transparent"
        pointerEvents="auto"
        style={{ cursor: 'crosshair', touchAction: 'pan-y pinch-zoom' }}
        onPointerDown={(e) => {
          const touch = e.pointerType === 'touch'
          if (!touch) {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          st.current = { from: clientToUnits(e.clientX, e.clientY), cx: e.clientX, cy: e.clientY, moved: false, touch }
        }}
        onPointerMove={(e) => {
          const s = st.current
          if (!s || s.touch) return
          if (!s.moved && Math.hypot(e.clientX - s.cx, e.clientY - s.cy) > 6) s.moved = true
          if (s.moved) setCur(clientToUnits(e.clientX, e.clientY))
        }}
        onPointerUp={(e) => end(e, false)}
        onPointerCancel={(e) => end(e, true)}
      />
      {draft && (
        <g pointerEvents="none">
          {round ? (
            <ellipse cx={draft.x} cy={draft.y} rx={draft.w / 2} ry={draft.h / 2} fill="#fff" fillOpacity="0.2" stroke="#fff" strokeWidth="2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          ) : (
            <rect x={draft.x - draft.w / 2} y={draft.y - draft.h / 2} width={draft.w} height={draft.h} fill="#fff" fillOpacity="0.2" stroke="#fff" strokeWidth="2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          )}
          <g transform={`translate(${draft.x} ${draft.y - draft.h / 2 - 14 / scale})`} style={{ userSelect: 'none' }}>
            <rect x={-(pill.length * 3.4 + 9) / scale} y={-9 / scale} width={(pill.length * 6.8 + 18) / scale} height={18 / scale} rx={9 / scale} fill="#1f2937" opacity="0.9" />
            <text y={4 / scale} textAnchor="middle" fontSize={11 / scale} fontWeight="700" fill="#fff">{pill}</text>
          </g>
        </g>
      )}
    </g>
  )
}
