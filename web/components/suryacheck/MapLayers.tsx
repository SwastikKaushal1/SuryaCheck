import { useRef } from 'react'
import { toPoints } from '@/lib/geometry'
import { neighbourBlock } from '@/lib/neighbours'
import type { Neighbour, Obstacle, Point } from '@/lib/mockData'
import { GEO_MPU } from '@/lib/geo'
import { presetFor } from '@/lib/obstacles'
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
        const rise = Math.max(3, (o.heightM / GEO_MPU) * 0.4)
        const x0 = o.x - o.w / 2
        const y0 = o.y - o.h / 2
        const fs = 11 / scale
        const text = `${preset.short} · ${o.heightM} m`
        const topY = y0 - rise
        return (
          <g key={o.id}>
            {o.kind === 'tank' ? (
              <>
                <ellipse cx={o.x} cy={o.y} rx={o.w / 2} ry={o.h / 2} fill={preset.color} />
                <rect x={x0} y={o.y - rise} width={o.w} height={rise} fill={preset.color} />
                <rect x={x0} y={o.y - rise} width={o.w} height={rise} fill="url(#sc-wall)" />
                <ellipse cx={o.x} cy={o.y - rise} rx={o.w / 2} ry={o.h / 2} fill="#9ad3ee" stroke="#fff" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
                <ellipse cx={o.x - o.w * 0.12} cy={o.y - rise - o.h * 0.1} rx={o.w * 0.22} ry={o.h * 0.16} fill="#fff" opacity="0.55" />
                <circle cx={o.x} cy={o.y - rise} r={Math.max(1.2, o.w * 0.08)} fill="#3b82a8" />
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
                <rect x={-34 / scale} y={-9 / scale} width={68 / scale} height={18 / scale} rx={9 / scale} fill="#1f2937" opacity="0.88" />
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
