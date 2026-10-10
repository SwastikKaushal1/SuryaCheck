import { useId, type ReactNode, type Ref } from 'react'
import { MAP_H, MAP_W, clientToMap } from '@/lib/geometry'
import type { Point } from '@/lib/mockData'
import { cn } from '@/lib/utils'

const NEIGHBOUR_BLOCKS = [
  { x: 12, y: 8, w: 76, h: 24 },
  { x: 200, y: 6, w: 90, h: 24 },
  { x: 300, y: 8, w: 84, h: 22 },
  { x: 12, y: 96, w: 68, h: 52 },
  { x: 12, y: 160, w: 68, h: 62 },
  { x: 328, y: 92, w: 60, h: 62 },
  { x: 328, y: 168, w: 60, h: 52 },
  { x: 14, y: 250, w: 62, h: 40 },
]

const TREES = [
  [88, 60],
  [312, 58],
  [60, 238],
  [348, 242],
  [92, 160],
  [322, 160],
  [160, 62],
  [350, 70],
]

/**
 * Stand-in for a satellite map. Swap this component for a real map later;
 * overlays are plain SVG children drawn in a 400 x 300 coordinate space.
 */
export function MapPlaceholder({
  children,
  svgRef,
  onMapClick,
  label = 'Placeholder map, not real imagery',
  ariaLabel = 'Placeholder satellite map of your street, north is up',
  className,
}: {
  children?: ReactNode
  svgRef?: Ref<SVGSVGElement>
  onMapClick?: (point: Point) => void
  label?: string
  ariaLabel?: string
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  return (
    <div
      className={cn(
        'relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#2e4636] shadow-[0_8px_24px_-8px_rgba(20,40,30,0.6)] ring-1 ring-black/10',
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={`${uid}-base`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b5a45" />
            <stop offset="1" stopColor="#2a3f32" />
          </linearGradient>
          <filter id={`${uid}-noise`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.5  0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0.55 -0.12"
            />
          </filter>
        </defs>
        <rect width={MAP_W} height={MAP_H} fill={`url(#${uid}-base)`} />
        <ellipse cx="60" cy="190" rx="70" ry="30" fill="#4c6b4a" opacity="0.35" />
        <ellipse cx="350" cy="130" rx="50" ry="36" fill="#56764f" opacity="0.3" />
        <rect y="38" width={MAP_W} height="14" fill="#5a5e5d" />
        <line
          x1="0"
          y1="45"
          x2={MAP_W}
          y2="45"
          stroke="#d9d4c3"
          strokeWidth="1.5"
          strokeDasharray="10 8"
          opacity="0.7"
        />
        <rect x="90" y="246" width="232" height="48" fill="#000" opacity="0.28" transform="translate(5 5)" />
        <rect x="90" y="246" width="232" height="48" fill="#a9a597" />
        <rect x="90" y="246" width="232" height="6" fill="#c3bfb0" />
        {NEIGHBOUR_BLOCKS.map((b, i) => (
          <g key={i}>
            <rect {...b} fill="#000" opacity="0.25" transform="translate(3 3)" />
            <rect {...b} fill={i % 2 ? '#9a9688' : '#a9a597'} stroke="#c3bfb0" strokeWidth="1" />
          </g>
        ))}
        {TREES.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="8" fill="#1f3a2a" opacity="0.9" />
        ))}
        <rect width={MAP_W} height={MAP_H} filter={`url(#${uid}-noise)`} opacity="0.5" />
        <g transform="translate(378 22)" opacity="0.9">
          <circle r="12" fill="#000" opacity="0.4" />
          <path d="M0 -8 L4 3 L0 1 L-4 3 Z" fill="#fff" />
          <text y="12" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">
            N
          </text>
        </g>
      </svg>

      <svg
        ref={svgRef}
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid slice"
        className={cn(
          'absolute inset-0 h-full w-full touch-none select-none',
          onMapClick && 'cursor-crosshair',
        )}
        onPointerDown={
          onMapClick
            ? (e) => {
                if (e.target !== e.currentTarget && !(e.target as Element).hasAttribute('data-map-hit')) return
                onMapClick(clientToMap(e.currentTarget, e.clientX, e.clientY))
              }
            : undefined
        }
      >
        {children}
      </svg>

      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
        {label}
      </span>
    </div>
  )
}
