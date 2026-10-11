import { Check, Crosshair, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { aimFromOrientation, averageBearing, type Aim } from '@/lib/orientation'
import { compassName } from '@/lib/solar'

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
export function PhoneScan({ onDone, onCancel }: { onDone: (marks: ScanMark[]) => void; onCancel: () => void }) {
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

  const mark = () => {
    if (!aim || sensor !== 'compass') return
    setMarks((m) => [...m, { bearing: Math.round(aim.bearing), elevation: Math.max(0, Math.min(45, Math.round(aim.elevation))) }])
    setFlash(true)
    window.setTimeout(() => setFlash(false), 180)
    navigator.vibrate?.(30)
  }

  const direction = aim ? compassName(aim.bearing) : '…'
  const up = aim ? Math.round(aim.elevation) : 0

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Scan your surroundings with the camera">
      <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
      {camera === 'off' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-sky-900 to-stone-800 p-8 text-center text-sm text-white/80">
          The camera is off, but you can still scan: point the back of your phone at the top of each building or tree.
        </div>
      )}
      {flash && <div className="pointer-events-none absolute inset-0 bg-white/40" />}

      {/* top: live readout */}
      <div className="relative z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Pointing</p>
          <p className="text-2xl font-bold capitalize">
            {sensor === 'compass'
              ? `${direction} · ${Math.round(aim!.bearing)}°`
              : sensor === 'waiting'
                ? 'Finding the compass…'
                : sensor === 'no-sensor'
                  ? 'No motion sensors'
                  : 'No compass'}
          </p>
          <p className="text-lg font-semibold text-sun">{aim ? `${up >= 0 ? up : 0}° above the horizon` : ' '}</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close the scan" className="flex size-11 items-center justify-center rounded-full bg-white/15 backdrop-blur">
          <X className="size-6" aria-hidden="true" />
        </button>
      </div>

      {/* crosshair */}
      <div className="pointer-events-none relative z-10 flex flex-1 items-center justify-center">
        <div className="absolute inset-x-0 top-1/2 h-px bg-sun/70" />
        <Crosshair className="size-16 text-sun drop-shadow" strokeWidth={1.5} aria-hidden="true" />
      </div>

      {/* bottom: instructions, marks, buttons */}
      <div className="relative z-10 flex flex-col gap-3 bg-gradient-to-t from-black/85 to-transparent p-4 pb-6">
        <p className="text-center text-sm text-white/85">
          {sensor === 'no-compass' || sensor === 'no-sensor'
            ? `This ${sensor === 'no-sensor' ? 'device is not sharing its motion sensors' : 'phone does not share its compass'} with the browser, so a scan cannot tell directions. Close this and use the choices on the page instead.`
            : 'Hold the phone upright. Put the crosshair on the top of the tallest building or tree, then tap Mark. Turn and repeat for east, south and west.'}
        </p>
        {marks.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Directions marked">
            {marks.map((m, i) => (
              <li key={i} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold capitalize backdrop-blur">
                {compassName(m.bearing)} {m.elevation}°
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <button
            type="button"
            onClick={() => setMarks((m) => m.slice(0, -1))}
            disabled={marks.length === 0}
            className="min-h-12 rounded-full bg-white/15 px-3 text-sm font-semibold backdrop-blur disabled:opacity-30"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={mark}
            disabled={sensor !== 'compass'}
            aria-label="Mark this direction"
            className="flex size-20 items-center justify-center rounded-full border-4 border-white bg-sun text-base font-extrabold text-ink shadow-lg active:scale-95 disabled:opacity-40"
          >
            Mark
          </button>
          <button
            type="button"
            onClick={() => onDone(marks)}
            disabled={marks.length === 0}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-teal-deep px-3 text-sm font-bold disabled:opacity-30"
          >
            <Check className="size-4" aria-hidden="true" />
            Use {marks.length || ''}
          </button>
        </div>
      </div>
    </div>
  )
}
