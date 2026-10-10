import { useRef } from 'react'
import { toPoints } from '@/lib/geometry'
import { neighbourBlock } from '@/lib/neighbours'
import type { Neighbour, Obstacle, Point } from '@/lib/mockData'
import { GEO_MPU } from '@/lib/geo'
import { isRound, presetFor } from '@/lib/obstacles'
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

/** Soft shadows cast by tanks, rooms and tall neighbours. */
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
        const rise = Math.max(3, (o.heightM / GEO_MPU) * 0.25)
        const x0 = o.x - o.w / 2
        const y0 = o.y - o.h / 2
        const fs = 11 / scale
        const clear = o.kind === 'clear'
        const round = isRound(o)
        const name = (o.name?.trim() || preset.short).slice(0, 18)
        const wM = +(o.w * GEO_MPU).toFixed(1)
        const lM = +(o.h * GEO_MPU).toFixed(1)
        const dims = round ? `${wM} m wide` : `${wM} × ${lM} m`
        const text = clear ? `${name} · ${dims}` : `${name} · ${o.heightM} m tall · ${dims}`
        const labelW = Math.max(68, text.length * 6.1 + 18)
        const topY = clear ? y0 : y0 - rise
        return (
          <g key={o.id}>
            {clear ? (
              <>
                <rect x={x0} y={y0} width={o.w} height={o.h} rx="2" fill={preset.color} opacity="0.28" />
                <rect x={x0} y={y0} width={o.w} height={o.h} rx="2" fill="none" stroke="#b45309" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                <line x1={x0} y1={y0} x2={x0 + o.w} y2={y0 + o.h} stroke="#b45309" strokeWidth="1" opacity="0.55" vectorEffect="non-scaling-stroke" />
                <line x1={x0 + o.w} y1={y0} x2={x0} y2={y0 + o.h} stroke="#b45309" strokeWidth="1" opacity="0.55" vectorEffect="non-scaling-stroke" />
              </>
            ) : round ? (
              <>
                <ellipse cx={o.x} cy={o.y} rx={o.w / 2} ry={o.h / 2} fill={preset.color} />
                <rect x={x0} y={o.y - rise} width={o.w} height={rise} fill={preset.color} />
                <rect x={x0} y={o.y - rise} width={o.w} height={rise} fill="url(#sc-wall)" />
                <ellipse cx={o.x} cy={o.y - rise} rx={o.w / 2} ry={o.h / 2} fill={o.kind === 'tank' ? '#9ad3ee' : preset.color} stroke="#fff" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
                <ellipse cx={o.x - o.w * 0.12} cy={o.y - rise - o.h * 0.1} rx={o.w * 0.22} ry={o.h * 0.16} fill="#fff" opacity="0.55" />
                {o.kind === 'tank' && <circle cx={o.x} cy={o.y - rise} r={Math.max(1.2, o.w * 0.08)} fill="#3b82a8" />}
              </>
            ) : (
              <>
                {/* front wall, running from the foot of the room up to its flat roof */}
                <rect x={x0} y={topY + o.h} width={o.w} height={rise} fill={preset.color} />
                <rect x={x0} y={topY + o.h} width={o.w} height={rise} fill="url(#sc-wall)" stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                {o.kind === 'stairs' && (
                  <g>
                    <rect x={o.x - o.w * 0.1} y={topY + o.h + rise * 0.3} width={o.w * 0.2} height={rise * 0.7} rx="1" fill="#3b2f25" opacity="0.8" />
                    <rect x={x0 + o.w * 0.12} y={topY + o.h + rise * 0.28} width={o.w * 0.14} height={rise * 0.26} fill="#bfe3f5" opacity="0.8" />
                    <rect x={x0 + o.w * 0.74} y={topY + o.h + rise * 0.28} width={o.w * 0.14} height={rise * 0.26} fill="#bfe3f5" opacity="0.8" />
                  </g>
                )}
                {/* flat roof of the room, with a lip around it */}
                <rect x={x0} y={topY} width={o.w} height={o.h} rx="1.5" fill={preset.color} stroke="#fff" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                <rect x={x0} y={topY} width={o.w} height={o.h} rx="1.5" fill="#fff" opacity="0.16" />
                <rect x={x0 + o.w * 0.07} y={topY + o.h * 0.1} width={o.w * 0.86} height={o.h * 0.8} fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
              </>
            )}
            {labels && (
              <g transform={`translate(${o.x} ${topY - o.h / 2 - 8 / scale})`}>
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

/**
 * Tall neighbours drawn as standing buildings (top face plus a wall rising toward the viewer), with the
 * shadow they cast. When `onChange` is given, drag the building to where it really is and drag the
 * round corner handle to match its footprint.
 */
export function NeighbourLayer({
  neighbours,
  roof,
  mpu,
  houseFloors = 0,
  shadows = [],
  onChange,
}: {
  neighbours: Neighbour[]
  roof: Point[]
  mpu: number
  houseFloors?: number
  /** Shadow polygons to draw under the buildings. */
  shadows?: Point[][]
  onChange?: (id: string, rect: NonNullable<Neighbour['rect']>) => void
}) {
  const { scale, clientToUnits } = useMapView()
  const drag = useRef<{ id: string; mode: 'move' | 'size'; dx: number; dy: number } | null>(null)
  return (
    <g>
      <ShadowLayer shadows={shadows} />
      {neighbours.map((n) => {
        const o = neighbourBlock(n, roof, mpu, houseFloors)
        const rise = Math.min(14 + n.floors * 7, 64) / scale // how far the wall climbs on screen
        const x0 = o.x - o.w / 2
        const y0 = o.y - o.h / 2
        const lower = n.floors <= houseFloors
        const fs = 12 / scale
        const label = `${n.floors} ${n.floors === 1 ? 'floor' : 'floors'}`
        const move = (e: React.PointerEvent, mode: 'move' | 'size') => {
          if (!onChange) return
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          const p = clientToUnits(e.clientX, e.clientY)
          drag.current = { id: n.id, mode, dx: mode === 'move' ? o.x - p.x : 0, dy: mode === 'move' ? o.y - p.y : 0 }
        }
        const onMove = (e: React.PointerEvent) => {
          const d = drag.current
          if (!d || d.id !== n.id || !onChange) return
          const p = clientToUnits(e.clientX, e.clientY)
          if (d.mode === 'move') onChange(n.id, { x: p.x + d.dx, y: p.y + d.dy, w: o.w, h: o.h })
          else {
            const w = Math.max(30, (p.x - x0) )
            const h = Math.max(30, (p.y - y0))
            onChange(n.id, { x: x0 + w / 2, y: y0 + h / 2, w, h })
          }
        }
        const end = (e: React.PointerEvent) => {
          drag.current = null
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
        }
        return (
          <g key={n.id} opacity={lower ? 0.55 : 1}>
            {/* walls: the footprint dragged upward on screen */}
            <polygon
              points={toPoints([
                { x: x0, y: y0 + o.h },
                { x: x0 + o.w, y: y0 + o.h },
                { x: x0 + o.w, y: y0 - rise },
                { x: x0 + o.w, y: y0 - rise + 0 },
                { x: x0, y: y0 - rise },
              ])}
              fill="#0A3F40"
              stroke="#fff"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            {/* top face */}
            <g
              pointerEvents={onChange ? 'auto' : 'none'}
              style={{ touchAction: 'none', cursor: onChange ? 'grab' : undefined }}
              onPointerDown={(e) => move(e, 'move')}
              onPointerMove={onMove}
              onPointerUp={end}
              onPointerCancel={end}
            >
              <rect x={x0} y={y0 - rise} width={o.w} height={o.h} fill="#0F5C5E" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" rx={2 / scale} />
              <rect x={x0} y={y0 - rise} width={o.w} height={o.h} fill="transparent" />
              <text x={x0 + o.w / 2} y={y0 - rise + o.h / 2 + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight="800" fill="#fff" pointerEvents="none">
                {label}
              </text>
            </g>
            {onChange && (
              <g
                transform={`translate(${x0 + o.w} ${y0 - rise + o.h})`}
                pointerEvents="auto"
                style={{ touchAction: 'none', cursor: 'nwse-resize' }}
                onPointerDown={(e) => move(e, 'size')}
                onPointerMove={onMove}
                onPointerUp={end}
                onPointerCancel={end}
              >
                <circle r={20 / scale} fill="transparent" />
                <circle r={9 / scale} fill="#fff" stroke="#0F5C5E" strokeWidth={3 / scale} />
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}
