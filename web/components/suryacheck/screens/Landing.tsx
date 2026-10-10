import { ArrowRight, Home, IndianRupee, LoaderCircle, LocateFixed, Search, Sun, Timer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../Button'
import { MapPlaceholder } from '../MapPlaceholder'
import { api, isAbort, toApiError, type Place } from '@/lib/api'
import { pointInPolygon, polygonBounds, toPoints } from '@/lib/geometry'
import { sampleRoof as roofPolygon } from '@/lib/mockData'

const FEATURES = [
  { icon: Home, title: 'Roof-aware', text: 'We outline your roof and place panels around tanks and rooms.' },
  { icon: IndianRupee, title: 'Subsidy included', text: 'PM Surya Ghar subsidy is worked out for you, not left as homework.' },
  { icon: Timer, title: '30-second skyline scan', text: 'Turn slowly with your phone to catch shade from nearby buildings.' },
]

function SampleRoofPreview() {
  const panels = useMemo(() => {
    const b = polygonBounds(roofPolygon.points)
    const w = 17
    const h = 10
    const gap = 2.5
    const cells: { x: number; y: number }[] = []
    for (let y = b.minY + 8; y + h < b.maxY - 4; y += h + gap) {
      for (let x = b.minX + 8; x + w < b.maxX - 4; x += w + gap) {
        const corners = [
          { x, y },
          { x: x + w, y },
          { x, y: y + h },
          { x: x + w, y: y + h },
        ]
        if (corners.every((c) => pointInPolygon(c, roofPolygon.points))) cells.push({ x, y })
      }
    }
    return { cells, w, h }
  }, [])

  return (
    <MapPlaceholder
      ariaLabel="Sample placeholder map: a roof outlined in amber with solar panels laid out on it"
      label="Sample preview"
      className="lg:aspect-[5/4] lg:rounded-3xl"
    >
      <polygon points={toPoints(roofPolygon.points)} fill="#F59E0B" fillOpacity={0.12} stroke="#FBBF24" strokeWidth="2.5" strokeLinejoin="round" pointerEvents="none" />
      <g pointerEvents="none">
        {panels.cells.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={panels.w}
            height={panels.h}
            rx="1.5"
            fill="#1e40af"
            fillOpacity="0.92"
            stroke="#bfdbfe"
            strokeWidth="1"
          />
        ))}
      </g>
    </MapPlaceholder>
  )
}

export function Landing({ onPlace }: { onPlace: (place: Place) => void }) {
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState<'search' | 'locate' | null>(null)
  const [error, setError] = useState('')
  const [choices, setChoices] = useState<Place[]>([])
  const inflight = useRef<AbortController | null>(null)
  useEffect(() => () => inflight.current?.abort(), [])

  const search = async () => {
    const q = address.trim()
    if (q.length < 2) {
      setError('Type your address, or use your location.')
      return
    }
    inflight.current?.abort()
    const ctrl = new AbortController()
    inflight.current = ctrl
    setBusy('search')
    setError('')
    setChoices([])
    try {
      const rows = await api.geocode(q, ctrl.signal)
      if (rows.length === 0) setError("We couldn't find that address. Try adding your area, city or PIN code.")
      else if (rows.length === 1) onPlace(rows[0])
      else setChoices(rows)
    } catch (e) {
      if (!isAbort(e)) setError(toApiError(e).message)
    } finally {
      if (!ctrl.signal.aborted) setBusy(null)
    }
  }

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share your location. Please type your address.')
      return
    }
    setBusy('locate')
    setError('')
    setChoices([])
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const here: Place = { address: 'Your current location', city: '', lat: coords.latitude, lng: coords.longitude, stateCode: '' }
        try {
          onPlace((await api.reverse(coords.latitude, coords.longitude)) ?? here)
        } catch {
          onPlace(here) // a failed lookup must not block someone whose position we know
        } finally {
          setBusy(null)
        }
      },
      (err) => {
        setBusy(null)
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location is switched off for this site. Please type your address instead.'
            : 'We could not work out where you are. Please type your address.',
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 lg:gap-14 lg:py-8">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14">
        <div className="overflow-hidden rounded-3xl bg-sun-soft shadow-[0_10px_30px_-12px_rgba(217,119,6,0.5)] lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-rooftop.png" alt="Illustration of an Indian rooftop with solar panels under a rising sun" width={800} height={600} className="aspect-[4/3] w-full object-cover" />
        </div>

        <div className="flex flex-col gap-6 lg:gap-8">
          <div className="flex flex-col gap-2 lg:gap-4">
            <p className="hidden items-center gap-2 text-sm font-bold uppercase tracking-wide text-sun-dark lg:flex">
              <Sun className="size-4" aria-hidden="true" />
              Free rooftop solar check
            </p>
            <h1 className="text-balance text-[2rem] font-bold leading-tight text-ink lg:text-5xl lg:leading-[1.1]">Find out what your roof can produce.</h1>
            <p className="text-lg text-ink-soft lg:text-xl">About 3 minutes, no sign-up.</p>
          </div>

          <form
            className="flex flex-col gap-3 lg:max-w-xl"
            onSubmit={(e) => {
              e.preventDefault()
              void search()
            }}
          >
            <label htmlFor="address" className="sr-only">
              Your address
            </label>
            <div className="flex min-h-14 items-center gap-2 rounded-2xl border-2 border-input bg-white pl-4 pr-1.5 shadow-sm transition focus-within:border-sun-dark focus-within:ring-4 focus-within:ring-sun/30 hover:border-sun-dark/60">
              <Search className="size-5 shrink-0 text-ink-soft" aria-hidden="true" />
              <input
                id="address"
                type="text"
                autoComplete="street-address"
                placeholder="Type your address"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value)
                  if (error) setError('')
                }}
                aria-describedby={error ? 'address-error' : undefined}
                aria-invalid={error ? true : undefined}
                className="h-12 min-w-0 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-ink-soft/70"
              />
              <button
                type="submit"
                aria-label="Search this address"
                disabled={busy !== null}
                className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sun text-ink transition hover:bg-sun-dark hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40 disabled:opacity-60"
              >
                {busy === 'search' ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-6" aria-hidden="true" />}
              </button>
            </div>

            {error && (
              <p id="address-error" role="alert" className="text-base font-medium text-red-800">
                {error}
              </p>
            )}

            {choices.length > 0 && (
              <div className="flex flex-col gap-2" role="group" aria-label="Pick your address">
                <p className="text-base font-semibold text-ink">Which one is yours?</p>
                <ul className="flex flex-col gap-2">
                  {choices.map((c) => (
                    <li key={`${c.lat},${c.lng}`}>
                      <button
                        type="button"
                        onClick={() => onPlace(c)}
                        className="min-h-14 w-full rounded-2xl bg-white px-4 py-3 text-left text-base text-ink shadow-sm ring-1 ring-amber-900/10 transition hover:bg-sun-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40"
                      >
                        {c.address}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="secondary" onClick={locate} disabled={busy !== null}>
              {busy === 'locate' ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <LocateFixed className="size-5" aria-hidden="true" />}
              {busy === 'locate' ? 'Finding you…' : 'Use my location'}
            </Button>
          </form>
        </div>

        <div className="hidden lg:block">
          <SampleRoofPreview />
        </div>
      </div>

      <ul className="hidden gap-5 lg:grid lg:grid-cols-3" aria-label="What you get">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li
            key={title}
            className="flex items-start gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-900/5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-deep">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-bold text-ink">{title}</p>
              <p className="text-base text-ink-soft">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
