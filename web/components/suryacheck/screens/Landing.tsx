import { ArrowRight, Building2, Check, FileText, Home, IndianRupee, LoaderCircle, LocateFixed, MapPin, PencilRuler, Search, Sun, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../Button'
import { MapPlaceholder } from '../MapPlaceholder'
import { api, isAbort, toApiError, type Place } from '@/lib/api'
import { toPoints } from '@/lib/geometry'
import { sampleRoof } from '@/lib/mockData'

const FEATURES = [
  { icon: Home, title: 'Roof-aware', text: 'We outline your roof and place panels around tanks, rooms and trees.' },
  { icon: Zap, title: 'Sized to your bill', text: 'Only as many panels as you will use, not as many as fit.' },
  { icon: IndianRupee, title: 'Subsidy included', text: 'PM Surya Ghar subsidy is worked out for you, not left as homework.' },
  { icon: Building2, title: 'Shade counted', text: 'Mark taller buildings next door and we count the shade they cast.' },
]

const STEPS = [
  { icon: MapPin, title: 'Find your house', text: 'Search your address or use your location, then confirm your roof on the satellite map.' },
  { icon: PencilRuler, title: 'Mark what is on the roof', text: 'Water tanks, stair rooms, trees and taller neighbours, with their real sizes and heights.' },
  { icon: Sun, title: 'Get your plan', text: 'Panels sized to your bill, the best tilt for your roof, and real sunshine data for your spot.' },
  { icon: FileText, title: 'Take it to an installer', text: 'Download a PDF report or share it on WhatsApp, with the questions to ask every installer.' },
]

const DATA = [
  { name: 'PVGIS (EU Joint Research Centre)', use: 'Sunshine and yearly energy for your exact location' },
  { name: 'OpenStreetMap', use: 'Addresses and building outlines' },
  { name: 'Esri World Imagery', use: 'Satellite pictures of your roof' },
  { name: 'PM Surya Ghar rules', use: 'Central subsidy: ₹30,000 per kW for 2 kW, ₹18,000 for the 3rd' },
]

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold uppercase tracking-wide text-sun-dark">{eyebrow}</p>
      <h2 className="text-balance text-2xl font-bold text-ink lg:text-3xl">{title}</h2>
      {text && <p className="max-w-2xl text-base text-ink-soft lg:text-lg">{text}</p>}
    </div>
  )
}

/** Reveals its children with a fade-up when they scroll into view. */
function Reveal({ children, className, delay = 0, as: Tag = 'div' }: { children: React.ReactNode; className?: string; delay?: number; as?: 'div' | 'li' | 'section' }) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag
      ref={ref as never}
      className={`reveal ${shown ? 'is-visible' : ''} ${className ?? ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}

const PREVIEW_ROOF = sampleRoof.points
const PREVIEW_PANELS = Array.from({ length: 8 }, (_, i) => ({ x: 162 + (i % 4) * 19, y: i < 4 ? 146 : 184, i }))

/** A looping demo: roof outline, tank and room, their shadows, then a tidy block of panels. */
function AnimatedPreview() {
  return (
    <MapPlaceholder
      ariaLabel="Animated sample: a roof is outlined, a water tank and stair room appear with their shadows, then eight solar panels are placed"
      label="Sample preview"
      className="lg:aspect-[5/4] lg:rounded-3xl"
    >
      <g className="sp-anim" pointerEvents="none">
        <defs>
          <linearGradient id="sp-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b7be6" />
            <stop offset="1" stopColor="#173a8f" />
          </linearGradient>
        </defs>

        {/* sun crossing the sky */}
        <g className="sp-sun">
          <circle cx="200" cy="22" r="9" fill="#FBBF24" />
          <circle cx="200" cy="22" r="14" fill="#FBBF24" opacity="0.25" />
        </g>

        {/* roof */}
        <polygon className="sp-fill" points={toPoints(PREVIEW_ROOF)} fill="#F59E0B" fillOpacity="0.16" />
        <polygon className="sp-draw" points={toPoints(PREVIEW_ROOF)} pathLength={1000} fill="none" stroke="#FBBF24" strokeWidth="3" strokeLinejoin="round" />

        {/* shadows (sun low in the south-west) */}
        <polygon className="sp-shadow" points="128,120 152,120 172,96 148,96" fill="#0b1a12" />
        <polygon className="sp-shadow" points="232,104 278,104 300,86 254,86" fill="#0b1a12" />

        {/* water tank and staircase room */}
        <g className="sp-obs">
          <ellipse cx="140" cy="120" rx="13" ry="13" fill="#4f9bbf" />
          <ellipse cx="140" cy="114" rx="13" ry="13" fill="#9ad3ee" stroke="#fff" strokeWidth="1.2" />
        </g>
        <g className="sp-obs" style={{ animationDelay: '0.15s' }}>
          <rect x="232" y="104" width="46" height="10" fill="#7d7267" />
          <rect x="232" y="78" width="46" height="28" rx="2" fill="#a8998a" stroke="#fff" strokeWidth="1.2" />
          <rect x="250" y="106" width="9" height="8" fill="#3b2f25" />
        </g>

        {/* panels drop in one by one */}
        {PREVIEW_PANELS.map((p) => (
          <g key={p.i} className="sp-panel" style={{ animationDelay: `${p.i * 0.12}s` }}>
            <rect x={p.x} y={p.y} width="17" height="30" rx="1.5" fill="url(#sp-glass)" stroke="#dbeafe" strokeWidth="1" />
            <line x1={p.x + 8.5} y1={p.y + 2} x2={p.x + 8.5} y2={p.y + 28} stroke="#dbeafe" strokeOpacity="0.35" strokeWidth="0.6" />
            <line x1={p.x + 2} y1={p.y + 15} x2={p.x + 15} y2={p.y + 15} stroke="#dbeafe" strokeOpacity="0.35" strokeWidth="0.6" />
          </g>
        ))}
      </g>
      <foreignObject x="0" y="0" width="400" height="300" pointerEvents="none">
        <div className="relative size-full">
          <div className="absolute left-3 top-3 grid rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-ink shadow">
            {['1. Find the roof', '2. Mark tank and room', '3. Work out the shade', '4. Place the panels'].map((t, i) => (
              <span key={t} className={`sp-cap sp-cap-${i + 1} col-start-1 row-start-1`}>
                {t}
              </span>
            ))}
          </div>
          <div className="sp-badge absolute bottom-10 left-3 rounded-xl bg-teal-deep px-3 py-1.5 text-[12px] font-bold text-white shadow-lg">
            8 panels · 4.4 kW · sized to your bill
          </div>
        </div>
      </foreignObject>
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
    <div className="flex flex-1 flex-col gap-12 lg:gap-20 lg:py-8">
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
            <ul className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-sm font-semibold text-ink-soft" aria-label="Good to know">
              {['Free', 'No sign-up', 'Real sunshine data'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-teal-deep" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </form>
        </div>

        <div>
          <AnimatedPreview />
        </div>
      </div>

      <section id="how-it-works" className="flex scroll-mt-24 flex-col gap-6" aria-label="How it works">
        <Reveal>
          <SectionHead eyebrow="How it works" title="Four steps, about three minutes" />
        </Reveal>
        <Reveal className="relative">
          <span aria-hidden="true" className="step-line absolute left-[12%] right-[12%] top-[38px] hidden h-0.5 rounded bg-gradient-to-r from-sun via-sun-dark to-teal-deep lg:block" />
          <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal as="li" key={title} delay={i * 120} className="group flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-sun text-base font-extrabold text-ink shadow-[0_0_0_6px_#fff]">{i + 1}</span>
                  <Icon className="icon-bob size-5 text-teal-deep" aria-hidden="true" />
                </div>
                <p className="text-lg font-bold text-ink">{title}</p>
                <p className="text-base text-ink-soft">{text}</p>
              </Reveal>
            ))}
          </ol>
        </Reveal>
      </section>

      <section id="features" className="flex scroll-mt-24 flex-col gap-6" aria-label="What you get">
        <Reveal>
          <SectionHead eyebrow="What you get" title="A plan you can check, not a sales pitch" />
        </Reveal>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <Reveal
              as="li"
              key={title}
              delay={i * 110}
              className="group flex items-start gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-sun/40"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-deep transition-colors duration-300 group-hover:bg-sun group-hover:text-ink">
                <Icon className="icon-bob size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-lg font-bold text-ink">{title}</p>
                <p className="text-base text-ink-soft">{text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <Reveal as="section" className="scroll-mt-24"><div id="open-data" role="region" className="flex scroll-mt-24 flex-col gap-6 rounded-3xl bg-teal-deep p-6 text-white lg:p-10" aria-label="Our data">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold uppercase tracking-wide text-sun">Our data</p>
          <h2 className="text-balance text-2xl font-bold lg:text-3xl">Built on open data you can check</h2>
          <p className="max-w-2xl text-base text-white/80 lg:text-lg">
            No black box. Every number comes from geometry, sun physics and these public sources.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {DATA.map((d) => (
            <li key={d.name} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
              <p className="font-bold">{d.name}</p>
              <p className="text-sm text-white/80">{d.use}</p>
            </li>
          ))}
        </ul>
        <div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('address') as HTMLInputElement | null
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              el?.focus({ preventScroll: true })
            }}
            className="flex min-h-12 items-center gap-2 rounded-full bg-sun px-5 text-base font-bold text-ink shadow-md transition hover:bg-sun-dark hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
          >
            Check my roof
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div></Reveal>
    </div>
  )
}
