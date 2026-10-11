import { useEffect, useId, useState } from 'react'

/**
 * A tiny picture of our real sweep screen (PhoneScan) for the landing page: the camera view pans
 * across the street as the person turns, while the crosshair stays in the middle on the top edge.
 * Same parts as the real screen: progress bar, compass strip, "Recording", live outline, Hold button.
 * Drawn in a 60 x 108 box; place it with `transform`.
 */

// Top edge of the street, one height every 10 units of turning (east -> west). Ground is at y = 86.
const TOPS = [66, 66, 46, 46, 58, 30, 58, 52, 50, 42, 42, 62, 66, 66, 54, 54, 66, 66]
const STEP = 10
const GROUND = 86
const SCENE_W = TOPS.length * STEP
// Where the crosshair sits on the screen.
const CX = 30
const CY = 50
const FROM = 15
const TO = SCENE_W - 15

const topAt = (s: number) => TOPS[Math.min(TOPS.length - 1, Math.max(0, Math.floor(s / STEP)))]
const EDGE = TOPS.map((t, i) => `${i ? 'L' : 'M'}${i * STEP} ${t} H${(i + 1) * STEP}`).join(' ')

// Pan so the edge under the crosshair is always at the crosshair (the person keeps it on the edge).
const SAMPLES = Array.from({ length: 41 }, (_, k) => FROM + ((TO - FROM) * k) / 40)
const PAN = SAMPLES.map((s) => `${CX - s} ${CY - topAt(s)}`).join(';')

// The live outline at the bottom: the same edge, squashed into a 44 x 10 strip.
const PROFILE = TOPS.map((t, i) => `${i ? 'L' : 'M'}${8 + (i * 44) / TOPS.length} ${92 + ((t - 30) / 36) * 8}`).join(' ')

const COMPASS = ['E', 'SE', 'S', 'SW', 'W']

export function PhoneScanMock({ dur = 4, className, transform }: { dur?: number; className?: string; transform?: string }) {
  const id = useId().replace(/:/g, '')
  const [still, setStill] = useState(false)
  useEffect(() => {
    try {
      setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    } catch {}
  }, [])
  const d = `${dur}s`
  const midPan = `${CX - SCENE_W / 2} ${CY - topAt(SCENE_W / 2)}`
  return (
    <g className={className} transform={transform}>
      <defs>
        <clipPath id={`${id}-screen`}>
          <rect x="3" y="3" width="54" height="102" rx="7" />
        </clipPath>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c4a6e" />
          <stop offset="1" stopColor="#57534e" />
        </linearGradient>
      </defs>
      {/* phone body */}
      <rect x="0" y="0" width="60" height="108" rx="10" fill="#111827" />
      <g clipPath={`url(#${id}-screen)`}>
        <rect x="3" y="3" width="54" height="102" fill={`url(#${id}-sky)`} />
        {/* camera view: the street pans left as the person turns right */}
        <g transform={still ? `translate(${midPan})` : undefined}>
          {!still && <animateTransform attributeName="transform" type="translate" values={PAN} dur={d} repeatCount="indefinite" />}
          <path d={`${EDGE} V${GROUND + 40} H0 Z`} fill="#334155" />
          {[25, 27, 53, 55, 85, 87, 93, 95].map((x, i) => (
            <rect key={i} x={x} y={i % 2 ? 60 : 52} width="1.6" height="2.2" fill="#64748b" />
          ))}
          <path d={EDGE} fill="none" stroke="#14B8A6" strokeWidth="1.4" strokeLinejoin="round" />
        </g>
        {/* top bar: progress, compass strip, what to do */}
        <rect x="3" y="3" width="54" height="24" fill="#000" opacity="0.6" />
        <rect x="7" y="7" width="40" height="2" rx="1" fill="#fff" opacity="0.25" />
        <rect x="7" y="7" width={still ? 40 : 0} height="2" rx="1" fill="#F59E0B">
          {!still && <animate attributeName="width" values="0;40" dur={d} repeatCount="indefinite" />}
        </rect>
        <text x="53" y="9.2" fontSize="3.2" fontWeight="800" fill="#fff" textAnchor="end">%</text>
        <rect x="7" y="11" width="46" height="6" rx="1.5" fill="#000" opacity="0.45" />
        <g>
          {!still && <animateTransform attributeName="transform" type="translate" values="16 0;-48 0" dur={d} repeatCount="indefinite" />}
          {COMPASS.map((c, i) => (
            <text key={c} x={14 + i * 16} y="15.6" fontSize="3.6" fontWeight="800" fill={c === 'E' || c === 'W' ? '#FBBF24' : '#fff'} textAnchor="middle">
              {c}
            </text>
          ))}
        </g>
        <rect x="29.6" y="11" width="0.8" height="6" fill="#fff" />
        <text x="7" y="23.5" fontSize="4" fontWeight="800" fill="#6ee7b7">Recording… keep turning</text>

        {/* middle: the line and crosshair stay put, on the top edge */}
        <line x1="3" x2="57" y1={CY} y2={CY} stroke="#34d399" strokeWidth="0.8" />
        <circle cx={CX} cy={CY} r="5" fill="none" stroke="#34d399" strokeWidth="1" />
        <g stroke="#34d399" strokeWidth="1">
          <line x1={CX - 8} x2={CX - 3} y1={CY} y2={CY} />
          <line x1={CX + 3} x2={CX + 8} y1={CY} y2={CY} />
          <line x1={CX} x2={CX} y1={CY - 8} y2={CY - 3} />
          <line x1={CX} x2={CX} y1={CY + 3} y2={CY + 8} />
        </g>
        <rect x={CX - 5} y={CY + 9} width="10" height="4" rx="2" fill="#dc2626" />
        <text x={CX} y={CY + 12} fontSize="2.8" fontWeight="800" fill="#fff" textAnchor="middle">● REC</text>

        {/* bottom: the outline so far, and the buttons */}
        <rect x="3" y="84" width="54" height="21" fill="#000" opacity="0.7" />
        <path d={PROFILE} fill="none" stroke="#14B8A6" strokeWidth="1" pathLength={100} strokeDasharray="100" strokeDashoffset={still ? 0 : 100}>
          {!still && <animate attributeName="stroke-dashoffset" values="100;0" dur={d} repeatCount="indefinite" />}
        </path>
        <rect x="6" y="99" width="13" height="4" rx="2" fill="#fff" opacity="0.2" />
        <text x="12.5" y="101.9" fontSize="2.6" fontWeight="700" fill="#fff" textAnchor="middle">Start over</text>
        <circle cx="30" cy="101" r="4.6" fill="#dc2626" stroke="#fff" strokeWidth="1.1">
          {!still && <animate attributeName="r" values="4.3;5;4.3" dur="1s" repeatCount="indefinite" />}
        </circle>
        <rect x="41" y="99" width="13" height="4" rx="2" fill="#0F5C5E" />
        <text x="47.5" y="101.9" fontSize="2.6" fontWeight="700" fill="#fff" textAnchor="middle">Finish</text>
      </g>
      {/* earpiece */}
      <rect x="25" y="1" width="10" height="1.4" rx="0.7" fill="#374151" />
    </g>
  )
}
