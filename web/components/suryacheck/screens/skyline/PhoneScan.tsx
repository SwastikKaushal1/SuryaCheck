import { ArrowLeft, ArrowRight, Check, Crosshair, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { aimFromOrientation, averageBearing, type Aim } from '@/lib/orientation'

/** One skyline reading taken with the phone: what you see in that direction, how high it rises. */
export interface ScanMark {
  bearing: number
  elevation: number
}

type Sensor = 'waiting' | 'compass' | 'no-compass' | 'no-sensor'

/** Phone-sized touch device with orientation sensors. Checked after mount (never during server render). */
export function canPhoneScan(): boolean {
  if (typeof window === 'undefined') return false
  return 'DeviceOrientationEvent' in window && window.matchMedia('(pointer: coarse)').matches && !!navigator.mediaDevices
}

/**
 * iPhone (and some newer Chrome builds) ask for motion permission, which must be requested from a tap.
 * Only a clear "denied" stops the scan; if the browser can't ask, we try anyway and the scan view
 * explains if no readings arrive.
 */
export async function askMotionPermission(): Promise<'granted' | 'denied' | 'unknown'> {
  const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }
  if (typeof DOE?.requestPermission !== 'function') return 'unknown' // Android and others: no prompt
  try {
    return await DOE.requestPermission()
  } catch {
    return 'unknown'
  }
}

const SMOOTH = 8 // readings averaged, so the numbers don't jitter

/**
 * Full-screen camera view with a crosshair. Point it at the top of the tallest building or tree
 * in a direction and tap Mark: the compass gives the direction, the tilt gives how high it rises.
 */
export function PhoneScan({
  onDone,
  onCancel,
  onMark,
  onUndo,
  doneLabel,
  status,
}: {
  onDone: (marks: ScanMark[]) => void
  onCancel: () => void
  /** Called the moment a direction is marked (phone-as-scanner sends it to the laptop). */
  onMark?: (mark: ScanMark) => void
  onUndo?: () => void
  /** Text for the finish button; defaults to "Use N". */
  doneLabel?: string
  /** One line shown under the readout, e.g. "Linked to your laptop". */
  status?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const recent = useRef<Aim[]>([])
  const [aim, setAim] = useState<Aim | null>(null)
  const [sensor, setSensor] = useState<Sensor>('waiting')
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting')
  const [marks, setMarks] = useState<ScanMark[]>([])
  const [flash, setFlash] = useState(false)

  // Camera (back camera if there is one). Without it the scan still works by aiming the phone itself.
  useEffect(() => {
    let stream: MediaStream | null = null
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          void videoRef.current.play().catch(() => {})
        }
        setCamera('on')
      })
      .catch(() => setCamera('off'))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  // Motion sensors. Android gives true-north readings on "deviceorientationabsolute";
  // iPhone gives a ready-made compass heading as webkitCompassHeading.
  useEffect(() => {
    let gotAbsolute = false
    const take = (bearing: number | null, beta: number, gamma: number) => {
      const elevation = aimFromOrientation(0, beta, gamma).elevation
      const next = { bearing: bearing ?? 0, elevation }
      recent.current = [...recent.current.slice(-(SMOOTH - 1)), next]
      const r = recent.current
      setAim({ bearing: averageBearing(r.map((a) => a.bearing)), elevation: r.reduce((t, a) => t + a.elevation, 0) / r.length })
      setSensor(bearing === null ? 'no-compass' : 'compass')
    }
    const onAbsolute = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null || e.gamma == null) return
      gotAbsolute = true
      take(aimFromOrientation(e.alpha, e.beta, e.gamma).bearing, e.beta, e.gamma)
    }
    const onRelative = (e: DeviceOrientationEvent) => {
      if (gotAbsolute || e.beta == null || e.gamma == null) return
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      if (typeof ios === 'number' && !Number.isNaN(ios)) take(ios, e.beta, e.gamma)
      else if (e.absolute && e.alpha != null) take(aimFromOrientation(e.alpha, e.beta, e.gamma).bearing, e.beta, e.gamma)
      else take(null, e.beta, e.gamma)
    }
    window.addEventListener('deviceorientationabsolute', onAbsolute as EventListener)
    window.addEventListener('deviceorientation', onRelative)
    // No readings at all after a few seconds: this device (or browser) has no usable motion sensors.
    const noSensor = window.setTimeout(() => setSensor((s) => (s === 'waiting' ? 'no-sensor' : s)), 3000)
    return () => {
      window.clearTimeout(noSensor)
      window.removeEventListener('deviceorientationabsolute', onAbsolute as EventListener)
      window.removeEventListener('deviceorientation', onRelative)
    }
  }, [])


  // ---------- guided walk-through: five directions, one at a time ----------
  const [stage, setStage] = useState<'intro' | 'guide' | 'finished'>('intro')
  const [step, setStep] = useState(0)
  const target = GUIDE[Math.min(step, GUIDE.length - 1)]
  const hasCompass = sensor === 'compass'
  const canTilt = sensor === 'compass' || sensor === 'no-compass'
  // Signed turn to the target: positive = turn right (clockwise).
  const turn = aim && hasCompass ? ((target.bearing - aim.bearing + 540) % 360) - 180 : 0
  const facing = canTilt && (!hasCompass || Math.abs(turn) <= FACING_TOLERANCE)
  const up = aim ? Math.round(aim.elevation) : 0

  const record = (elevation: number) => {
    if (!facing) return
    // We guided the person to this exact direction, so store it (steadier than the live compass).
    const m = { bearing: target.bearing, elevation: Math.max(0, Math.min(45, Math.round(elevation))) }
    setMarks((list) => [...list.slice(0, step), m])
    onMark?.(m)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 180)
    navigator.vibrate?.(30)
    if (step + 1 >= GUIDE.length) setStage('finished')
    else setStep(step + 1)
  }
  const back = () => {
    if (step === 0 && stage !== 'finished') return
    const to = stage === 'finished' ? GUIDE.length - 1 : step - 1
    setMarks((list) => list.slice(0, to))
    onUndo?.()
    setStep(to)
    setStage('guide')
  }

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label="Scan your surroundings with the camera">
      <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
      {camera === 'off' && <div className="absolute inset-0 bg-gradient-to-b from-sky-900 via-sky-800 to-stone-800" />}
      {flash && <div className="pointer-events-none absolute inset-0 z-30 bg-white/40" />}

      {/* close */}
      <button type="button" onClick={onCancel} aria-label="Close the scan" className="absolute right-3 top-3 z-40 flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur">
        <X className="size-6" aria-hidden="true" />
      </button>

      {stage === 'intro' && (
        <div className="relative z-20 flex flex-1 flex-col justify-end bg-black/60 p-5 pb-8">
          <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 text-ink shadow-2xl">
            <h2 className="text-2xl font-bold">Scan your surroundings</h2>
            <p className="text-sm text-ink-soft">About a minute. We guide you through 5 directions and measure how high the buildings and trees around you rise.</p>
            <ol className="flex flex-col gap-3">
              {INTRO.map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sun text-sm font-extrabold">{i + 1}</span>
                  <span>
                    <span className="block text-base font-semibold">{t}</span>
                    <span className="block text-sm text-ink-soft">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            {status && <p className="rounded-xl bg-teal-soft px-3 py-2 text-xs font-semibold text-teal-deep">{status}</p>}
            {sensor === 'no-sensor' ? (
              <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-900">
                This device is not sharing its motion sensors with the browser, so a scan cannot work here. Close this and use the choices on the page.
              </p>
            ) : (
              <button type="button" onClick={() => setStage('guide')} disabled={sensor === 'waiting'} className="min-h-14 rounded-2xl bg-sun text-lg font-bold text-ink disabled:opacity-50">
                {sensor === 'waiting' ? 'Starting the sensors…' : 'I am in the middle of my roof, start'}
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'guide' && (
        <>
          {/* top: progress, compass strip, the instruction */}
          <div className="relative z-20 flex flex-col gap-2 bg-gradient-to-b from-black/80 via-black/50 to-transparent px-4 pb-6 pt-4">
            <div className="flex items-center gap-1.5 pr-12" aria-label={`Direction ${step + 1} of ${GUIDE.length}`}>
              {GUIDE.map((g, i) => (
                <span key={g.bearing} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-sun' : i === step ? 'bg-white' : 'bg-white/25'}`} />
              ))}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Direction {step + 1} of {GUIDE.length}
            </p>
            {hasCompass && aim && <CompassStrip bearing={aim.bearing} target={target.bearing} />}
            <p className="text-2xl font-extrabold leading-tight">
              {facing ? <span className="text-emerald-300">Facing {target.name} ✓</span> : <>Face {target.name.toUpperCase()}</>}
            </p>
            <p className="text-sm text-white/85">
              {!hasCompass
                ? `No compass on this phone: face ${target.name.toLowerCase()} yourself (${target.hint}).`
                : facing
                  ? 'Now tilt up until the crosshair sits on the top of the tallest building or tree beyond your roof.'
                  : `Turn ${turn > 0 ? 'right' : 'left'} about ${Math.round(Math.abs(turn) / 5) * 5}°. ${target.hint[0].toUpperCase()}${target.hint.slice(1)}.`}
            </p>
            {status && <p className="self-start rounded-full bg-teal-deep/90 px-2.5 py-0.5 text-xs font-semibold">{status}</p>}
          </div>

          {/* middle: turn arrow until facing, then the crosshair, height line and gauge */}
          <div className="pointer-events-none relative z-10 flex flex-1 items-center justify-center">
            {facing ? (
              <>
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-sun/80" />
                <Crosshair className="size-20 text-sun drop-shadow-[0_0_6px_rgba(0,0,0,0.8)]" strokeWidth={1.5} aria-hidden="true" />
                <span className="absolute left-1/2 top-1/2 ml-12 -translate-y-1/2 rounded-full bg-black/60 px-2.5 py-1 text-base font-bold text-sun">{Math.max(0, up)}° up</span>
                <HeightGauge elevation={up} />
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-3xl bg-black/55 px-6 py-5 backdrop-blur">
                {turn > 0 ? <ArrowRight className="size-24 text-sun" strokeWidth={2.5} aria-hidden="true" /> : <ArrowLeft className="size-24 text-sun" strokeWidth={2.5} aria-hidden="true" />}
                <span className="text-xl font-bold">Turn {turn > 0 ? 'right' : 'left'}</span>
              </div>
            )}
          </div>

          {/* bottom: the two answers */}
          <div className="relative z-20 flex flex-col gap-2 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 pb-6">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => record(OPEN_SKY)} disabled={!facing} className="min-h-14 rounded-2xl bg-white/15 px-3 text-base font-semibold backdrop-blur disabled:opacity-35">
                Nothing tall here
              </button>
              <button type="button" onClick={() => aim && record(aim.elevation)} disabled={!facing} className="min-h-14 rounded-2xl bg-sun px-3 text-base font-extrabold text-ink shadow-lg active:scale-95 disabled:opacity-35">
                Mark the top
              </button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={back} disabled={step === 0} className="min-h-11 px-2 font-semibold text-white/85 disabled:opacity-30">
                ← Back
              </button>
              <span className="text-white/60">
                {marks.length} of {GUIDE.length} done
              </span>
            </div>
          </div>
        </>
      )}

      {stage === 'finished' && (
        <div className="relative z-20 flex flex-1 flex-col justify-end bg-black/60 p-5 pb-8">
          <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 text-ink shadow-2xl">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <Check className="size-7 text-teal-deep" aria-hidden="true" />
              All {GUIDE.length} directions done
            </h2>
            <ul className="grid grid-cols-5 gap-1.5 text-center">
              {marks.map((m, i) => (
                <li key={GUIDE[i].bearing} className="rounded-xl bg-sand px-1 py-2">
                  <span className="block text-xs font-semibold text-ink-soft">{GUIDE[i].short}</span>
                  <span className="block text-lg font-bold">{m.elevation <= OPEN_SKY ? 'open' : `${m.elevation}°`}</span>
                </li>
              ))}
            </ul>
            {status && <p className="rounded-xl bg-teal-soft px-3 py-2 text-xs font-semibold text-teal-deep">{status}</p>}
            <button type="button" onClick={() => onDone(marks)} className="min-h-14 rounded-2xl bg-teal-deep text-lg font-bold text-white">
              {doneLabel ?? 'Use this skyline'}
            </button>
            <button type="button" onClick={back} className="min-h-11 text-sm font-semibold text-ink-soft">
              Redo the last direction
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const INTRO: [string, string][] = [
  ['Stand in the middle of your roof', 'That is where most panels will go.'],
  ['Hold your phone upright', 'Portrait, like taking a photo, with the camera facing away from you.'],
  ['Follow the arrow, then tilt up', 'Turn to each direction we show, then put the crosshair on the top of the tallest building or tree.'],
  ['Only things beyond your roof', 'Skip your own water tank or stair room: you marked those in the last step.'],
  ['Nothing tall there?', 'Tap "Nothing tall here" and we move on.'],
]

/** The directions we walk through: the sun's path over India runs east, south, then west. */
const GUIDE = [
  { bearing: 90, name: 'East', short: 'E', hint: 'where the sun rises' },
  { bearing: 135, name: 'South-East', short: 'SE', hint: 'between sunrise and noon' },
  { bearing: 180, name: 'South', short: 'S', hint: 'where the sun is at noon' },
  { bearing: 225, name: 'South-West', short: 'SW', hint: 'between noon and sunset' },
  { bearing: 270, name: 'West', short: 'W', hint: 'where the sun sets' },
]
/** How close (degrees) to the target counts as facing it. Phone compasses wobble by ~10°. */
const FACING_TOLERANCE = 20
/** Height recorded for "Nothing tall here": the open-sky skyline. */
const OPEN_SKY = 3

/** A strip of compass marks centred on where the phone points, with the target highlighted. */
function CompassStrip({ bearing, target }: { bearing: number; target: number }) {
  const SPAN = 90 // degrees shown either side
  const rel = (b: number) => ((b - bearing + 540) % 360) - 180
  const labels = [0, 45, 90, 135, 180, 225, 270, 315].map((b, i) => ({ b, t: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][i] }))
  const pos = (b: number) => `${50 + (rel(b) / SPAN) * 50}%`
  const t = rel(target)
  return (
    <div className="relative h-9 overflow-hidden rounded-xl bg-black/45" aria-hidden="true">
      {labels
        .filter((l) => Math.abs(rel(l.b)) < SPAN)
        .map((l) => (
          <span key={l.b} className={`absolute top-1.5 -translate-x-1/2 text-sm font-bold ${l.b === target ? 'text-sun' : 'text-white/80'}`} style={{ left: pos(l.b) }}>
            {l.t}
          </span>
        ))}
      {Math.abs(t) < SPAN ? (
        <span className="absolute bottom-0 h-1.5 w-8 -translate-x-1/2 rounded-full bg-sun" style={{ left: pos(target) }} />
      ) : (
        <span className={`absolute top-1.5 text-sm font-bold text-sun ${t > 0 ? 'right-2' : 'left-2'}`}>{t > 0 ? '→' : '←'}</span>
      )}
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white" />
    </div>
  )
}

/** Vertical meter on the right: how far above the horizon the phone points (0-45°). */
function HeightGauge({ elevation }: { elevation: number }) {
  const pct = Math.max(0, Math.min(45, elevation)) / 45
  return (
    <div className="absolute right-3 top-1/2 flex h-56 -translate-y-1/2 flex-col items-center gap-1" aria-hidden="true">
      <span className="text-[10px] font-bold text-white/80">45°</span>
      <div className="relative w-2.5 flex-1 rounded-full bg-white/25">
        <div className="absolute inset-x-0 bottom-0 rounded-full bg-sun" style={{ height: `${pct * 100}%` }} />
      </div>
      <span className="text-[10px] font-bold text-white/80">0°</span>
    </div>
  )
}
