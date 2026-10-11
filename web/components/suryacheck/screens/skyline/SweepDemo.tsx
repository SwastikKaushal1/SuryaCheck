import { useEffect, useState } from 'react'

/**
 * A looping how-to for the skyline sweep: the crosshair travels along the top edge of a street
 * from east to west (up over the building, up the tower, over the tree, down to the horizon where
 * it is open) and the traced outline appears behind it, like the real scan screen.
 */

// Top edge of the skyline, east (left) to west (right). The crosshair follows exactly this line.
const EDGE =
  'M12 112 L44 112 L44 88 L78 88 L78 104 L96 104 L96 46 L104 46 L104 104 L120 104 ' +
  'C120 74 160 70 164 104 L190 112 L204 112 L204 66 L238 66 L238 106 L308 106'
const GROUND = 120
const LOOP_S = 7

export function SweepDemo({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  // Respect "reduce motion": show the finished picture instead of the loop.
  const [still, setStill] = useState(false)
  useEffect(() => {
    try {
      setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    } catch {}
  }, [])
  const sky = dark ? '#0b2f3a' : '#E0F2FE'
  const ink = dark ? 'rgba(255,255,255,0.85)' : '#2b2118'
  return (
    <figure className={className}>
      <svg viewBox="0 0 320 150" className="w-full" role="img" aria-label="How to scan: keep the crosshair on the top edge of the buildings and trees while you turn from east to west">
        <rect x="0" y="0" width="320" height="150" rx="14" fill={sky} />
        {/* the street: silhouettes under the edge line */}
        <path d={`${EDGE} L308 ${GROUND} L12 ${GROUND} Z`} fill={dark ? '#1f3d45' : '#94A3B8'} />
        {/* windows, so the shapes read as buildings */}
        {[52, 62].map((x) => [94, 100].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="5" height="3" fill={dark ? '#355b63' : '#CBD5E1'} />))}
        {[211, 220, 229].map((x) => [74, 86, 96].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="5" height="4" fill={dark ? '#355b63' : '#CBD5E1'} />))}
        <rect x="99" y="38" width="2" height="8" fill={dark ? '#cbd5e1' : '#475569'} />
        <line x1="12" x2="308" y1={GROUND} y2={GROUND} stroke={dark ? 'rgba(255,255,255,0.4)' : '#64748B'} strokeWidth="1.5" />

        {/* the traced outline appears behind the crosshair */}
        <path d={EDGE} fill="none" stroke="#14B8A6" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" pathLength={100} strokeDasharray="100" strokeDashoffset={still ? 0 : 100}>
          {!still && <animate attributeName="stroke-dashoffset" values="100;0;0" keyTimes="0;0.85;1" dur={`${LOOP_S}s`} repeatCount="indefinite" />}
        </path>

        {/* the crosshair riding the edge */}
        <g>
          {!still && <animateMotion path={EDGE} keyPoints="0;1;1" keyTimes="0;0.85;1" calcMode="linear" dur={`${LOOP_S}s`} repeatCount="indefinite" />}
          <g transform={still ? 'translate(308 106)' : undefined}>
            <circle r="9" fill="rgba(245,158,11,0.25)" stroke="#F59E0B" strokeWidth="2" />
            <line x1="-13" x2="-4" y1="0" y2="0" stroke="#F59E0B" strokeWidth="2" />
            <line x1="4" x2="13" y1="0" y2="0" stroke="#F59E0B" strokeWidth="2" />
            <line y1="-13" y2="-4" x1="0" x2="0" stroke="#F59E0B" strokeWidth="2" />
            <line y1="4" y2="13" x1="0" x2="0" stroke="#F59E0B" strokeWidth="2" />
          </g>
        </g>

        {/* compass and the turning hint */}
        <text x="16" y="138" fontSize="10" fontWeight="800" fill={ink}>EAST</text>
        <text x="304" y="138" fontSize="10" fontWeight="800" fill={ink} textAnchor="end">WEST</text>
        <text x="160" y="138" fontSize="9" fontWeight="700" fill={ink} textAnchor="middle">hold and turn slowly →</text>
        <text x="100" y="30" fontSize="8" fontWeight="700" fill={ink} textAnchor="middle">up the tower</text>
        <text x="274" y="97" fontSize="8" fontWeight="700" fill={ink} textAnchor="middle">open: horizon</text>
      </svg>
      <figcaption className={`mt-1.5 text-center text-xs ${dark ? 'text-white/75' : 'text-ink-soft'}`}>
        Keep the crosshair on the top edge: up over buildings and trees, down to the horizon where it is open.
      </figcaption>
    </figure>
  )
}
