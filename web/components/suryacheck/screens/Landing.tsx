import { ArrowRight, Building2, Check, FileText, Home, Scale, ScanLine, Smartphone, IndianRupee, LoaderCircle, LocateFixed, MapPin, PencilRuler, Search, Sun, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../Button'
import { MapPlaceholder } from '../MapPlaceholder'
import { PhoneScanMock } from './skyline/PhoneScanMock'
import { api, isAbort, toApiError, type Place } from '@/lib/api'
import { toPoints } from '@/lib/geometry'
import { sampleRoof } from '@/lib/mockData'

const FEATURES: { icon: typeof Home; title: string; text: string; fact?: string; count?: number }[] = [
  { icon: Home, title: 'Roof-aware', text: 'We outline your roof and place panels around tanks, rooms and trees.', fact: 'Panels drawn to scale' },
  { icon: Zap, title: 'Sized to your bill', text: 'Only as many panels as you will use, not as many as fit.', fact: 'Fits your bill, not your roof' },
  { icon: IndianRupee, title: 'Subsidy included', text: 'PM Surya Ghar subsidy is worked out for you, not left as homework.', count: 78000 },
  { icon: Building2, title: 'Shade counted', text: 'Tanks, stair rooms, taller neighbours, and the trees and towers around you.', fact: 'Checked across 3 seasons' },
  { icon: Smartphone, title: 'Your phone is the scanner', text: 'Trace the skyline with your phone camera. Planning on a laptop? Scan a QR code and the readings appear there.', fact: 'About 30 seconds' },
  { icon: Scale, title: 'Honest advice', text: 'If solar will not pay off on your roof, we tell you so before showing any plan.', fact: 'No sales pitch' },
]

const STEPS = [
  { icon: MapPin, title: 'Find your house', text: 'Search your address or use your location, then confirm your roof on the satellite map.' },
  { icon: PencilRuler, title: 'Mark what is on the roof', text: 'Water tanks, stair rooms, trees and taller neighbours, with their real sizes and heights.' },
  { icon: ScanLine, title: 'Scan your surroundings', text: 'Stand where the panels will go and sweep your phone across the buildings and trees. We show when they hide the sun.' },
  { icon: Sun, title: 'Get an honest plan', text: 'Panels sized to your bill at the best tilt, with real sunshine data. If solar will not pay off, we say so.' },
  { icon: FileText, title: 'Take it to an installer', text: 'Download a PDF report or share it on WhatsApp, with the questions to ask every installer.' },
]

const DATA = [
  { name: 'PVGIS (EU Joint Research Centre)', use: 'Sunshine and yearly energy for your exact location' },
  { name: 'OpenStreetMap', use: 'Addresses and building outlines' },
  { name: 'Esri World Imagery', use: 'Satellite pictures of your roof' },
  { name: 'Photon (Komoot)', use: 'Address suggestions as you type' },
  { name: "Your phone's camera and compass", use: 'The skyline you trace. Only angles are sent, never the video.' },
  { name: 'PM Surya Ghar rules', use: 'Central subsidy: ₹30,000 per kW for 2 kW, ₹18,000 for the 3rd' },
]

/** Counts up to `to` once it scrolls into view. */
function CountUp({ to, prefix = '' }: { to: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setN(to)
      return
    }
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400)
        setN(Math.round(to * (1 - Math.pow(1 - k, 3))))
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to])
  return <span ref={ref}>{prefix}{n.toLocaleString('en-IN')}</span>
}

/** A tiny looping picture for each "How it works" step. */
function StepScene({ i }: { i: number }) {
  const common = 'hs h-full w-full'
  if (i === 0)
    return (
      <svg viewBox="0 0 200 90" className={common} aria-hidden="true">
        {[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5].map((c) => <rect key={`${r}-${c}`} x={14 + c * 30} y={8 + r * 20} width="26" height="16" rx="3" fill="#e9dcc4" />))}
        <rect x="74" y="28" width="56" height="36" rx="3" fill="#f6c46a" stroke="#d97706" strokeWidth="2" />
        <ellipse className="hs-ripple" cx="102" cy="52" rx="10" ry="4" fill="none" stroke="#0f5c5e" strokeWidth="2" />
        <g className="hs-pin">
          <path d="M102 54 C95 46 92 42 92 37 A10 10 0 0 1 112 37 C112 42 109 46 102 54 Z" fill="#0f5c5e" />
          <circle cx="102" cy="37" r="3.5" fill="#fff" />
        </g>
      </svg>
    )
  if (i === 1)
    return (
      <svg viewBox="0 0 200 90" className={common} aria-hidden="true">
        <rect x="30" y="10" width="140" height="62" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
        <g className="hs-pop">
          <circle cx="62" cy="34" r="11" fill="#4f9bbf" />
          <circle cx="62" cy="31" r="11" fill="#9ad3ee" stroke="#fff" strokeWidth="1.5" />
        </g>
        <g className="hs-pop" style={{ animationDelay: '.25s' }}>
          <rect x="110" y="22" width="44" height="30" rx="2" fill="#a8998a" stroke="#fff" strokeWidth="1.5" />
          <rect x="128" y="40" width="8" height="12" fill="#3b2f25" />
        </g>
        <g className="hs-measure">
          <line x1="110" y1="62" x2="154" y2="62" stroke="#0f5c5e" strokeWidth="2" />
          <line x1="110" y1="58" x2="110" y2="66" stroke="#0f5c5e" strokeWidth="2" />
          <line x1="154" y1="58" x2="154" y2="66" stroke="#0f5c5e" strokeWidth="2" />
        </g>
        <text className="hs-label" x="132" y="84" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f5c5e">2.9 m</text>
      </svg>
    )
  if (i === 2)
    return (
      <svg viewBox="0 0 120 112" className={common} aria-hidden="true">
        {/* the street behind, and the phone running our scan screen in front of it */}
        <path d="M-60 112 V80 H-36 V58 H-10 V74 H4 V44 L10 28 L16 44 V74 H36 V70 H84 V60 H110 V52 H136 V76 H180 V112 Z" fill="#0f5c5e" opacity=".22" />
        <PhoneScanMock className="drop-shadow-md" transform="translate(30 2)" />
      </svg>
    )
  if (i === 3)
    return (
      <svg viewBox="0 0 200 90" className={common} aria-hidden="true">
        <g className="hs-sun">
          <circle cx="100" cy="16" r="9" fill="#f59e0b" />
          <circle cx="100" cy="16" r="14" fill="#f59e0b" opacity=".25" />
        </g>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <g key={k} transform={`translate(${46 + (k % 3) * 37} ${k < 3 ? 38 : 62})`}>
            <rect className="hs-cell" style={{ animationDelay: `${k * 0.15}s` }} width="32" height="20" rx="2" fill="#94a3b8" stroke="#dbeafe" strokeWidth="1.2" />
          </g>
        ))}
      </svg>
    )
  return (
    <svg viewBox="0 0 200 90" className={common} aria-hidden="true">
      <rect x="62" y="8" width="58" height="74" rx="5" fill="#fff" stroke="#d6c7ad" strokeWidth="2" />
      <rect x="70" y="16" width="28" height="7" rx="2" fill="#0f5c5e" />
      {[0, 1, 2, 3, 4].map((k) => (
        <rect key={k} className="hs-line" style={{ animationDelay: `${k * 0.18}s` }} x="70" y={32 + k * 9} width={k % 2 ? 30 : 42} height="4" rx="2" fill="#e7d9bf" />
      ))}
      <g className="hs-plane">
        <path d="M120 54 L146 44 L136 62 L132 55 Z" fill="#f59e0b" />
        <path d="M132 55 L146 44" stroke="#b45309" strokeWidth="1" />
      </g>
    </svg>
  )
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold uppercase tracking-wide text-sun-dark">{eyebrow}</p>
      <h2 className="text-balance text-2xl font-extrabold tracking-tight text-ink lg:text-4xl">{title}</h2>
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
      ariaLabel="Animated sample: a roof is outlined, a water tank and stair room appear with their shadows, the buildings around are traced with a phone, then eight solar panels are placed"
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

        {/* the surroundings to the south, traced by the phone sweep */}
        <g className="sp-sky">
          <path d="M0 300 V268 H34 V250 H70 V266 H96 V238 L102 222 L108 238 V266 H150 A20 20 0 0 1 190 262 V256 H236 V246 H272 V262 H312 V252 H350 V270 H400 V300 Z" fill="#0f5c5e" fillOpacity="0.8" />
        </g>
        <path className="sp-trace" pathLength={100} d="M0 268 H34 V250 H70 V266 H96 V238 L102 222 L108 238 V266 H150 A20 20 0 0 1 190 262 V256 H236 V246 H272 V262 H312 V252 H350 V270 H400" fill="none" stroke="#FBBF24" strokeWidth="3" strokeLinejoin="round" />
        {/* the phone doing the sweep, as on our real scan screen */}
        <g className="sp-phone">
          <PhoneScanMock dur={3} transform="translate(322 112) scale(.95)" />
        </g>

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
            {['1. Find the roof', '2. Mark tank and room', '3. Scan the skyline', '4. Place the panels'].map((t, i) => (
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

  // Suggestions while typing: wait for a short pause, then ask the backend (Photon, open source).
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  useEffect(() => {
    const q = address.trim()
    if (q.length < 3) {
      setSuggestions([])
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      api
        .suggest(q, ctrl.signal)
        .then((rows) => {
          setSuggestions(rows)
          setActive(-1)
        })
        .catch(() => {}) // suggestions are a nicety: the search button still works without them
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [address])
  const showSuggestions = open && suggestions.length > 0 && busy === null

  const pick = (p: Place) => {
    setOpen(false)
    setAddress(p.address)
    onPlace(p)
  }

  const onKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      pick(suggestions[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

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
            <h1 className="text-balance text-[2.25rem] font-extrabold leading-[1.05] tracking-tight text-ink lg:text-6xl lg:leading-[1.02]">Find out what your roof can produce.</h1>
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
            <div className="relative">
            <div className="flex min-h-14 items-center gap-2 rounded-2xl border-2 border-input bg-white pl-4 pr-1.5 shadow-sm transition focus-within:border-sun-dark focus-within:ring-4 focus-within:ring-sun/30 hover:border-sun-dark/60">
              <Search className="size-5 shrink-0 text-ink-soft" aria-hidden="true" />
              <input
                id="address"
                type="text"
                role="combobox"
                autoComplete="off"
                placeholder="Type your address, area or PIN code"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value)
                  setOpen(true)
                  if (error) setError('')
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={onKeys}
                aria-expanded={showSuggestions}
                aria-controls="address-suggestions"
                aria-autocomplete="list"
                aria-activedescendant={showSuggestions && active >= 0 ? `address-option-${active}` : undefined}
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
            {showSuggestions && (
              <ul
                id="address-suggestions"
                role="listbox"
                aria-label="Suggested addresses"
                className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-auto rounded-2xl bg-white py-1.5 shadow-xl ring-1 ring-amber-900/10"
              >
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.lat},${s.lng},${i}`}
                    id={`address-option-${i}`}
                    role="option"
                    aria-selected={i === active}
                    // mousedown, not click: it fires before the input loses focus and closes the list
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pick(s)
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 text-left ${i === active ? 'bg-sun-soft' : ''}`}
                  >
                    <MapPin className="mt-1 size-4 shrink-0 text-sun-dark" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold text-ink">{s.address.split(', ')[0]}</span>
                      <span className="block truncate text-sm text-ink-soft">{s.address.split(', ').slice(1).join(', ')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
          <SectionHead eyebrow="How it works" title="Five steps, about three minutes" />
        </Reveal>
        <Reveal className="relative">
          <div aria-hidden="true" className="absolute left-[10%] right-[10%] top-[84px] hidden lg:block">
            <span className="step-line block h-0.5 rounded bg-gradient-to-r from-sun via-sun-dark to-teal-deep" />
            <span className="step-dot absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sun shadow-[0_0_0_4px_rgba(245,158,11,0.25)]" />
          </div>
          <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal as="li" key={title} delay={i * 120} className="group">
                <div className="step-glow flex h-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-900/5 transition duration-300 hover:shadow-lg" style={{ animationDelay: `${i * 2}s` }}>
                  <div className="h-32 overflow-hidden rounded-xl bg-gradient-to-br from-sun-soft/70 to-sand/70">
                    <StepScene i={i} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-sun text-base font-extrabold text-ink">{i + 1}</span>
                    <Icon className="icon-bob size-5 text-teal-deep" aria-hidden="true" />
                  </div>
                  <p className="text-lg font-bold text-ink">{title}</p>
                  <p className="text-base text-ink-soft">{text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </Reveal>
      </section>

      <section id="features" className="flex scroll-mt-24 flex-col gap-6" aria-label="What you get">
        <Reveal>
          <SectionHead eyebrow="What you get" title="A plan you can check, not a sales pitch" />
        </Reveal>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, fact, count }, i) => (
            <Reveal
              as="li"
              key={title}
              delay={i * 110}
              className="shine group flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-sun/40"
            >
              <div className="flex items-start gap-4">
                <span className="float-icon flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-deep transition-colors duration-300 group-hover:bg-sun group-hover:text-ink" style={{ animationDelay: `${i * 0.5}s` }}>
                  <Icon className="icon-bob size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-lg font-bold text-ink">{title}</p>
                  <p className="text-base text-ink-soft">{text}</p>
                </div>
              </div>
              <p className="mt-auto w-fit rounded-full bg-sun-soft px-3 py-1 text-sm font-bold text-sun-dark">
                {count ? (
                  <>
                    Up to <CountUp to={count} prefix="₹" />
                  </>
                ) : (
                  fact
                )}
              </p>
            </Reveal>
          ))}
        </ul>
      </section>

      <Reveal as="section" className="scroll-mt-24"><div id="open-data" role="region" className="flex scroll-mt-24 flex-col gap-6 rounded-3xl bg-teal-deep p-6 text-white lg:p-10" aria-label="Our data">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold uppercase tracking-wide text-sun">Our data</p>
          <h2 className="text-balance text-2xl font-extrabold tracking-tight lg:text-4xl">Built on open data you can check</h2>
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
