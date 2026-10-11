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
 * Full-screen camera view for tracing the skyline: hold the button and turn from east to west
 * with the crosshair on the top edge of everything; the compass gives each direction, the tilt its height.
 */
export function PhoneScan({
  onDone,
  onCancel,
  onProfile,
  doneLabel,
  status,
}: {
  onDone: (marks: ScanMark[]) => void
  onCancel: () => void
  /** Called (at most about once a second) with the skyline traced so far, to stream it to a paired laptop. */
  onProfile?: (marks: ScanMark[]) => void
  /** Text for the finish button. */
  doneLabel?: string
  /** One line shown under the readout, e.g. "Linked to your laptop". */
  status?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const recent = useRef<Aim[]>([])
  const [aim, setAim] = useState<Aim | null>(null)
  const [sensor, setSensor] = useState<Sensor>('waiting')
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting')

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


  // ---------- the sweep: hold the button and trace the skyline from east to west ----------
  const [stage, setStage] = useState<'intro' | 'sweep' | 'finished'>('intro')
  const [holding, setHolding] = useState(false)
  /** Tallest-so-far is not what we want: the latest reading in each 5° slice wins, so sweeping again fixes a slip. */
  const [bins, setBins] = useState<Map<number, number>>(() => new Map())
  const hasCompass = sensor === 'compass'
  const up = aim ? Math.round(aim.elevation) : 0
  const bearing = aim ? aim.bearing : 0
  // Before the first reading, guide the person to face east (where the sweep starts).
  const toEast = ((SWEEP_FROM + 30 - bearing + 540) % 360) - 180
  const nearStart = hasCompass && Math.abs(toEast) <= 35
  const inRange = hasCompass && bearing >= SWEEP_FROM - 5 && bearing <= SWEEP_TO + 5
  const coverage = bins.size / SLICES

  // Record while the button is held: one reading per 5° slice of the sun's side of the sky.
  useEffect(() => {
    if (!holding || !aim || !hasCompass) return
    if (aim.bearing < SWEEP_FROM - 2.5 || aim.bearing > SWEEP_TO + 2.5) return
    const slice = Math.round(aim.bearing / SLICE) * SLICE
    const elevation = Math.max(0, Math.min(45, Math.round(aim.elevation)))
    setBins((prev) => {
      if (prev.get(slice) === elevation) return prev
      const next = new Map(prev)
      next.set(slice, elevation)
      return next
    })
  }, [aim, holding, hasCompass])

  const marks: ScanMark[] = [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([b, e]) => ({ bearing: b, elevation: e }))

  // Stream the skyline to a paired laptop, at most about once a second.
  const latestMarks = useRef(marks)
  latestMarks.current = marks
  useEffect(() => {
    if (!onProfile || bins.size === 0) return
    const id = window.setTimeout(() => onProfile(latestMarks.current), 700)
    return () => window.clearTimeout(id)
  }, [bins, onProfile])

  const stopHolding = () => setHolding(false)
  const pct = Math.round(coverage * 100)

  return (
    <div className="fixed inset-0 z-[2000] flex select-none flex-col overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label="Scan your surroundings with the camera">
      <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
      {camera === 'off' && <div className="absolute inset-0 bg-gradient-to-b from-sky-900 via-sky-800 to-stone-800" />}

      <button type="button" onClick={onCancel} aria-label="Close the scan" className="absolute right-3 top-3 z-40 flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur">
        <X className="size-6" aria-hidden="true" />
      </button>

      {stage === 'intro' && (
        <div className="relative z-20 flex flex-1 flex-col justify-end bg-black/60 p-5 pb-8">
          <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 text-ink shadow-2xl">
            <h2 className="text-2xl font-bold">Trace your skyline</h2>
            <p className="text-sm text-ink-soft">About 30 seconds. Like taking a panorama: you slowly turn from east to west while keeping the crosshair on the top edge of everything around you.</p>
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
            {sensor === 'no-sensor' || sensor === 'no-compass' ? (
              <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-900">
                {sensor === 'no-sensor' ? 'This device is not sharing its motion sensors' : 'This phone does not share its compass'} with the browser, so a sweep cannot tell directions here. Close this and use the choices on the page.
              </p>
            ) : (
              <button type="button" onClick={() => setStage('sweep')} disabled={sensor === 'waiting'} className="min-h-14 rounded-2xl bg-sun text-lg font-bold text-ink disabled:opacity-50">
                {sensor === 'waiting' ? 'Starting the sensors…' : 'I am in the middle of my roof, start'}
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'sweep' && (
        <>
          {/* top: what to do right now */}
          <div className="relative z-20 flex flex-col gap-2 bg-gradient-to-b from-black/85 via-black/55 to-transparent px-4 pb-6 pt-4">
            <div className="flex items-center gap-2 pr-12">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
                <div className="h-full rounded-full bg-sun transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-bold">{pct}%</span>
            </div>
            {aim && <CompassStrip bearing={bearing} />}
            <p className="text-2xl font-extrabold leading-tight">
              {bins.size === 0 && !nearStart ? (
                'Face EAST to begin'
              ) : holding ? (
                <span className="text-emerald-300">Recording… keep turning right</span>
              ) : bins.size === 0 ? (
                'Ready: press and hold'
              ) : bearing > SWEEP_TO ? (
                <span className="text-emerald-300">You reached west ✓</span>
              ) : (
                'Hold and keep turning right'
              )}
            </p>
            <p className="text-sm text-white/85">
              {bins.size === 0 && !nearStart
                ? `Turn ${toEast > 0 ? 'right' : 'left'} about ${Math.round(Math.abs(toEast) / 5) * 5}°, towards where the sun rises.`
                : bearing > SWEEP_TO
                  ? 'Check the outline below. Missed a spot? Turn back and sweep it again. Then tap Finish.'
                  : 'Keep the crosshair on the top edge of buildings, trees and towers. Where it is open, keep it on the horizon. Skip your own tank or stair room.'}
            </p>
            {status && <p className="self-start rounded-full bg-teal-deep/90 px-2.5 py-0.5 text-xs font-semibold">{status}</p>}
          </div>

          {/* middle: crosshair and height, or the turn arrow before starting */}
          <div className="pointer-events-none relative z-10 flex flex-1 items-center justify-center">
            {bins.size === 0 && !nearStart ? (
              <div className="flex flex-col items-center gap-2 rounded-3xl bg-black/55 px-6 py-5 backdrop-blur">
                {toEast > 0 ? <ArrowRight className="size-24 text-sun" strokeWidth={2.5} aria-hidden="true" /> : <ArrowLeft className="size-24 text-sun" strokeWidth={2.5} aria-hidden="true" />}
                <span className="text-xl font-bold">Turn {toEast > 0 ? 'right' : 'left'}</span>
              </div>
            ) : (
              <>
                <div className={`absolute inset-x-0 top-1/2 h-0.5 ${holding ? 'bg-emerald-400' : 'bg-sun/80'}`} />
                <Crosshair className={`size-20 drop-shadow-[0_0_6px_rgba(0,0,0,0.8)] ${holding ? 'text-emerald-400' : 'text-sun'}`} strokeWidth={1.5} aria-hidden="true" />
                <span className="absolute left-1/2 top-1/2 ml-12 -translate-y-1/2 rounded-full bg-black/60 px-2.5 py-1 text-base font-bold text-sun">{Math.max(0, up)}° up</span>
                {holding && <span className="absolute left-1/2 top-[calc(50%+3rem)] -translate-x-1/2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold">● REC</span>}
              </>
            )}
          </div>

          {/* bottom: the skyline being drawn, and the hold button */}
          <div className="relative z-20 flex flex-col gap-3 bg-gradient-to-t from-black/90 via-black/75 to-transparent p-4 pb-6">
            <LiveProfile bins={bins} bearing={aim && inRange ? bearing : null} />
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <button type="button" onClick={() => setBins(new Map())} disabled={bins.size === 0} className="min-h-12 rounded-full bg-white/15 px-3 text-sm font-semibold backdrop-blur disabled:opacity-30">
                Start over
              </button>
              <button
                type="button"
                aria-label="Hold to record while you turn"
                disabled={!hasCompass}
                onPointerDown={(e) => {
                  // Keep recording if the finger slides off the button; harmless if the browser refuses.
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId)
                  } catch {}
                  setHolding(true)
                  navigator.vibrate?.(20)
                }}
                onPointerUp={stopHolding}
                onPointerCancel={stopHolding}
                onLostPointerCapture={stopHolding}
                onContextMenu={(e) => e.preventDefault()}
                className={`flex size-24 touch-none flex-col items-center justify-center rounded-full border-4 border-white text-sm font-extrabold leading-tight shadow-lg transition ${holding ? 'scale-110 bg-red-600 text-white' : 'bg-sun text-ink'} disabled:opacity-40`}
              >
                {holding ? 'Recording' : 'Hold'}
                <span className="text-[10px] font-semibold">{holding ? 'release to pause' : 'to record'}</span>
              </button>
              <button type="button" onClick={() => setStage('finished')} disabled={coverage < MIN_COVERAGE} className="min-h-12 rounded-full bg-teal-deep px-3 text-sm font-bold disabled:opacity-30">
                Finish
              </button>
            </div>
          </div>
        </>
      )}

      {stage === 'finished' && (
        <div className="relative z-20 flex flex-1 flex-col justify-end bg-black/60 p-5 pb-8">
          <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 text-ink shadow-2xl">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <Check className="size-7 text-teal-deep" aria-hidden="true" />
              Skyline traced
            </h2>
            <div className="rounded-2xl bg-teal-deep p-3">
              <LiveProfile bins={bins} bearing={null} />
            </div>
            <p className="text-sm text-ink-soft">
              {pct}% of the sun&apos;s side of the sky covered ({bins.size} readings). Gaps are filled in smoothly from the readings either side.
            </p>
            {status && <p className="rounded-xl bg-teal-soft px-3 py-2 text-xs font-semibold text-teal-deep">{status}</p>}
            <button type="button" onClick={() => onDone(marks)} className="min-h-14 rounded-2xl bg-teal-deep text-lg font-bold text-white">
              {doneLabel ?? 'Use this skyline'}
            </button>
            <button type="button" onClick={() => setStage('sweep')} className="min-h-11 text-sm font-semibold text-ink-soft">
              Go back and sweep more
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const INTRO: [string, string][] = [
  ['Stand in the middle of your roof', 'That is where most panels will go.'],
  ['Hold your phone upright and face east', 'Portrait, like taking a photo. The arrow shows you where east is.'],
  ['Press and hold, then turn slowly to the west', 'Keep the crosshair on the top edge of buildings, trees and towers. Where it is open, keep it on the horizon.'],
  ['Only things beyond your roof', 'Skip your own water tank or stair room: you marked those in the last step.'],
]

/** The sun's side of the sky over India: summer sunrise (~63°) round through south to summer sunset (~297°). */
const SWEEP_FROM = 60
const SWEEP_TO = 300
/** One reading per 5° slice while sweeping. */
const SLICE = 5
const SLICES = (SWEEP_TO - SWEEP_FROM) / SLICE + 1
/** Finish is offered once this share of the sky has readings. */
const MIN_COVERAGE = 0.25

/** A strip of compass marks centred on where the phone points. */
function CompassStrip({ bearing }: { bearing: number }) {
  const SPAN = 90
  const rel = (b: number) => ((b - bearing + 540) % 360) - 180
  const labels = [0, 45, 90, 135, 180, 225, 270, 315].map((b, i) => ({ b, t: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][i] }))
  const pos = (b: number) => `${50 + (rel(b) / SPAN) * 50}%`
  return (
    <div className="relative h-8 overflow-hidden rounded-xl bg-black/45" aria-hidden="true">
      {labels
        .filter((l) => Math.abs(rel(l.b)) < SPAN)
        .map((l) => (
          <span key={l.b} className={`absolute top-1 -translate-x-1/2 text-sm font-bold ${l.b === 90 || l.b === 270 ? 'text-sun' : 'text-white/80'}`} style={{ left: pos(l.b) }}>
            {l.t}
          </span>
        ))}
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white" />
    </div>
  )
}

/** The skyline as it is being traced: east on the left, west on the right, with a marker where the phone points now. */
function LiveProfile({ bins, bearing }: { bins: Map<number, number>; bearing: number | null }) {
  const W = 300
  const H = 64
  const x = (b: number) => ((b - SWEEP_FROM) / (SWEEP_TO - SWEEP_FROM)) * W
  const y = (e: number) => H - 6 - (Math.min(45, e) / 45) * (H - 14)
  const bw = (SLICE / (SWEEP_TO - SWEEP_FROM)) * W
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" aria-label={`Skyline traced so far: ${bins.size} readings`}>
      <rect x="0" y="0" width={W} height={H - 6} rx="6" fill="rgba(255,255,255,0.08)" />
      {[...bins.entries()].map(([b, e]) => (
        <rect key={b} x={x(b) - bw / 2} y={y(e)} width={bw + 0.5} height={H - 6 - y(e)} fill="#0F5C5E" stroke="#5eead4" strokeWidth="0.6" />
      ))}
      {[
        [90, 'E'],
        [135, 'SE'],
        [180, 'S'],
        [225, 'SW'],
        [270, 'W'],
      ].map(([b, t]) => (
        <text key={t} x={x(b as number)} y={H - 0.5} textAnchor="middle" fontSize="7" fontWeight="700" fill="rgba(255,255,255,0.75)">
          {t}
        </text>
      ))}
      {bearing !== null && <line x1={x(bearing)} x2={x(bearing)} y1="2" y2={H - 6} stroke="#FBBF24" strokeWidth="2" />}
    </svg>
  )
}
