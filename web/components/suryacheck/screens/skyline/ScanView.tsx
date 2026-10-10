import { Check, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../Button'
import type { ScanStopReading } from '@/lib/mockData'
import { cn } from '@/lib/utils'

const CHECKS = ['Facing the stop', 'Steady', 'Sky at top']
const CHECK_DELAYS = [900, 1800, 2700]

function StopArc({ stops, index }: { stops: ScanStopReading[]; index: number }) {
  const pts = stops.map((s, i) => {
    const a = Math.PI - (i / (stops.length - 1)) * Math.PI
    return { s, x: 150 + Math.cos(a) * 118, y: 70 - Math.sin(a) * 52 }
  })
  return (
    <svg viewBox="0 0 300 90" className="w-full" role="img" aria-label={`Stop ${index + 1} of ${stops.length}: ${stops[index].label}`}>
      <path d="M32 70 A118 52 0 0 1 268 70" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeDasharray="4 5" />
      {pts.map(({ s, x, y }, i) => {
        const done = i < index
        const current = i === index
        return (
          <g key={s.id}>
            <circle
              cx={x}
              cy={y}
              r={current ? 15 : 12}
              fill={done ? '#0F5C5E' : current ? '#F59E0B' : 'rgba(0,0,0,0.5)'}
              stroke={current ? '#fff' : 'rgba(255,255,255,0.6)'}
              strokeWidth={current ? 3 : 1.5}
            />
            {done ? (
              <path d={`M${x - 5} ${y} l3.5 3.5 l7 -7`} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={current ? '#2b2118' : '#fff'}>
                {s.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function ScanView({
  stops,
  onDone,
  onCancel,
  onStopChange,
}: {
  stops: ScanStopReading[]
  onDone: () => void
  onCancel: () => void
  onStopChange?: (index: number) => void
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    onStopChange?.(index)
  }, [index, onStopChange])
  const [attempt, setAttempt] = useState(0)
  const [checks, setChecks] = useState([false, false, false])
  const [flash, setFlash] = useState(0)
  const [tick, setTick] = useState(0)
  const [tiltOverride, setTiltOverride] = useState<number | null>(null)
  const locking = useRef(false)
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = stops[index]

  useEffect(() => {
    setChecks([false, false, false])
    locking.current = false
    const timers = CHECK_DELAYS.map((delay, i) =>
      setTimeout(() => setChecks((c) => c.map((v, k) => (k === i ? true : v))), delay),
    )
    return () => timers.forEach(clearTimeout)
  }, [index, attempt])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 160)
    return () => clearInterval(id)
  }, [])

  useEffect(
    () => () => {
      if (lockTimer.current) clearTimeout(lockTimer.current)
    },
    [],
  )

  const lock = useCallback(() => {
    if (locking.current) return
    locking.current = true
    setFlash((f) => f + 1)
    lockTimer.current = setTimeout(() => {
      if (index >= stops.length - 1) onDone()
      else {
        setIndex((i) => i + 1)
        setTiltOverride(null)
      }
    }, 450)
  }, [index, stops.length, onDone])

  const allPassed = checks.every(Boolean)
  useEffect(() => {
    if (allPassed) lock()
  }, [allPassed, lock])

  const settled = checks.filter(Boolean).length
  const wobble = Math.sin(tick * 0.9) * (6 - settled * 2)
  const facing = Math.round((stop.bearing + wobble + 360) % 360)
  const tilt = tiltOverride ?? Math.round(stop.elevation / 2 + Math.cos(tick * 0.7) * (4 - settled))

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 shadow-xl"
        role="img"
        aria-label="Simulated camera view. No real camera is used."
      >
        <svg viewBox="0 0 300 400" className="absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 400 V300 L20 300 V270 L50 270 V310 L80 310 V250 L120 250 V290 L150 290 V230 L190 230 V280 L225 280 V260 L260 260 V300 L300 300 V400 Z"
            fill="#0b1118"
            opacity="0.85"
          />
          {[75, 150, 225].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="400" stroke="rgba(255,255,255,0.06)" />
          ))}
        </svg>

        <div className="absolute inset-x-0 top-2 px-2">
          <StopArc stops={stops} index={index} />
        </div>

        <div className="absolute inset-x-0 top-1/2 flex items-center">
          <div className="h-0.5 flex-1 bg-sun shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
        </div>
        <p className="absolute inset-x-0 top-[calc(50%+8px)] text-center text-xs font-medium text-white/80">
          Line up the top of the buildings with this line
        </p>

        <p
          className="absolute inset-x-0 bottom-3 text-center font-mono text-lg font-bold text-white"
          aria-live="off"
        >
          Facing: {facing}°, Tilt: {tilt}°
        </p>

        {flash > 0 && (
          <div
            key={flash}
            aria-hidden="true"
            className="animate-camera-flash pointer-events-none absolute inset-0 bg-white"
          />
        )}
        <span className="absolute left-3 top-[52%] rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
          Simulated camera
        </span>
      </div>

      <p className="text-center text-base font-semibold text-ink" aria-live="polite">
        Stop {index + 1} of {stops.length}: point at {stop.label}
      </p>

      <ul className="grid grid-cols-3 gap-2" aria-label="Steadiness checks">
        {CHECKS.map((label, i) => (
          <li
            key={label}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center text-sm font-semibold transition',
              checks[i] ? 'bg-teal-deep text-white' : 'bg-white text-ink-soft ring-1 ring-amber-900/10',
            )}
          >
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full',
                checks[i] ? 'bg-white text-teal-deep' : 'border-2 border-input',
              )}
            >
              {checks[i] && <Check className="size-4" aria-hidden="true" />}
            </span>
            {label}
            <span className="sr-only">{checks[i] ? 'done' : 'waiting'}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <Button onClick={lock}>Lock now</Button>
        <Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Redo this stop
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Stop scanning
        </Button>
      </div>

      <div className="rounded-2xl border border-dashed border-input p-3">
        <label htmlFor="sim-tilt" className="flex items-center justify-between text-xs font-medium text-ink-soft">
          Dev only: simulate tilt
          <span>{tiltOverride ?? 'auto'}°</span>
        </label>
        <input
          id="sim-tilt"
          type="range"
          min={0}
          max={60}
          value={tiltOverride ?? 0}
          onChange={(e) => setTiltOverride(Number(e.target.value))}
          className="h-10 w-full accent-sun-dark"
        />
      </div>

      <p className="text-center text-sm text-ink-soft">
        Trees count as solid obstacles, so a leafy tree may be over-counted.
      </p>
    </div>
  )
}
