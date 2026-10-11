import { ArrowLeft, ArrowRight, Check, CodeXml, ShieldCheck } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const DESKTOP_STEPS = ['Location', 'Roof', 'Obstacles', 'Shade', 'Plan', 'Summary'] as const

export function LogoMark({ className = 'size-9' }: { className?: string }) {
  // Each copy needs its own gradient ids; shared ids break when the first copy is hidden.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const sun = `lm-sun-${uid}`
  const roof = `lm-roof-${uid}`
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={sun} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id={roof} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0F5C5E" />
          <stop offset="1" stopColor="#0B3D3F" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${sun})`} />
      <g stroke="#fff" strokeWidth="3.2" strokeLinecap="round" opacity="0.95">
        <path d="M32 6v6M13 14l4 4M51 14l-4 4M6 30h6M58 30h-6" />
      </g>
      <circle cx="32" cy="29" r="10" fill="#fff" />
      <path d="M8 58 L16 38 H48 L56 58 Z" fill={`url(#${roof})`} />
      <path d="M26 38 L22 58 M38 38 L42 58 M12 48H52" stroke="#7DD3D8" strokeWidth="1.6" fill="none" opacity="0.85" />
    </svg>
  )
}

export const GITHUB_URL = 'https://github.com/SwastikKaushal1/SuryaCheck'

export function Logo({ onHome, tagline = false }: { onHome?: () => void; tagline?: boolean }) {
  const inner = (
    <>
      <LogoMark className="size-9 drop-shadow-sm" />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-extrabold tracking-tight text-ink">SuryaCheck</span>
        {tagline && <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft max-sm:hidden">Rooftop solar, simply</span>}
      </span>
    </>
  )
  if (!onHome) return <div className="flex items-center gap-2.5">{inner}</div>
  return (
    <button
      type="button"
      onClick={onHome}
      aria-label="SuryaCheck home"
      className="flex items-center gap-2.5 rounded-xl text-left transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40"
    >
      {inner}
    </button>
  )
}

function DesktopNav({
  onHome,
  desktopStep,
  onDesktopStep,
  navRight,
}: {
  onHome?: () => void
  desktopStep: number
  onDesktopStep?: (step: number) => void
  navRight?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 hidden h-16 border-b border-amber-900/10 bg-white/90 backdrop-blur lg:block">
      <div className="mx-auto grid h-full max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-8">
        <div className="flex items-center gap-4">
          <Logo onHome={onHome} />
        </div>

        <nav aria-label="Progress">
          <ol className="flex items-center gap-1.5">
            {DESKTOP_STEPS.map((label, i) => {
              const n = i + 1
              const current = n === desktopStep
              const done = n < desktopStep
              const content = (
                <>
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      current && 'bg-teal-deep text-white',
                      done && 'bg-sun text-ink',
                      !current && !done && 'bg-sand text-ink-soft',
                    )}
                  >
                    {done ? <Check className="size-4" aria-hidden="true" /> : n}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      current ? 'text-ink' : 'text-ink-soft max-xl:sr-only',
                    )}
                  >
                    {label}
                  </span>
                </>
              )
              return (
                <li key={label} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span
                      aria-hidden="true"
                      className={cn('h-0.5 w-3 rounded xl:w-5', n <= desktopStep ? 'bg-sun-dark' : 'bg-amber-900/15')}
                    />
                  )}
                  {done && onDesktopStep ? (
                    <button
                      type="button"
                      onClick={() => onDesktopStep(n)}
                      aria-label={`Go back to step ${n}: ${label}`}
                      className="flex min-h-10 items-center gap-2 rounded-full px-1.5 transition hover:bg-sun-soft"
                    >
                      {content}
                    </button>
                  ) : (
                    <span
                      aria-current={current ? 'step' : undefined}
                      className="flex min-h-10 items-center gap-2 px-1.5"
                    >
                      {content}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="flex justify-end">{navRight}</div>
      </div>
    </header>
  )
}

const LANDING_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'What you get' },
  { href: '#open-data', label: 'Our data' },
]

/** Focus the address box at the top of the start page. */
export function focusAddress() {
  const el = document.getElementById('address') as HTMLInputElement | null
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.focus({ preventScroll: true })
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-amber-900/10 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-5 lg:px-8">
        <Logo tagline />
        <nav aria-label="Page sections" className="hidden items-center gap-1 lg:flex">
          {LANDING_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="SuryaCheck on GitHub"
            className="flex size-11 items-center justify-center rounded-full text-ink transition hover:bg-sand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40 lg:w-auto lg:gap-2 lg:px-4"
          >
            <CodeXml className="size-5" aria-hidden="true" />
            <span className="hidden text-sm font-semibold lg:inline">GitHub</span>
          </a>
          <button
            type="button"
            onClick={focusAddress}
            className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-teal-deep px-4 text-sm font-bold text-white shadow-md transition hover:bg-teal-deep/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40"
          >
            <span className="sm:hidden">Start</span>
            <span className="max-sm:hidden">Start my plan</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}

function LandingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-10 border-t border-amber-900/10 bg-white">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.6fr] lg:px-8">
        <div className="flex flex-col gap-3">
          <Logo tagline />
          <p className="max-w-xs text-sm text-ink-soft">A free rooftop solar planner for Indian homes. See what your roof can produce and what it costs after subsidy.</p>
        </div>
        <nav aria-label="Explore" className="flex flex-col gap-2">
          <p className="text-sm font-bold uppercase tracking-wide text-ink">Explore</p>
          {LANDING_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="w-fit text-sm text-ink-soft transition hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <nav aria-label="Project" className="flex flex-col gap-2">
          <p className="text-sm font-bold uppercase tracking-wide text-ink">Project</p>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="w-fit text-sm text-ink-soft transition hover:text-ink">Source code on GitHub</a>
          <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer" className="w-fit text-sm text-ink-soft transition hover:text-ink">Report a problem</a>
          <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="w-fit text-sm text-ink-soft transition hover:text-ink">MIT licence</a>
        </nav>
        <div className="flex flex-col gap-2 rounded-2xl bg-teal-soft p-4 text-teal-deep">
          <p className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="size-5" aria-hidden="true" />
            Your privacy
          </p>
          <p className="text-sm">
            No sign-up and no tracking. Your address is used only to build your plan. It is sent to the public map and
            sunshine services we rely on, and is never saved to a database.
          </p>
        </div>
      </div>
      <div className="border-t border-amber-900/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-1 px-5 py-5 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>
            © {year} SuryaCheck · Made by <span className="font-semibold text-ink">Swastik Kaushal</span>
          </p>
          <p>Estimates, not quotations.</p>
        </div>
      </div>
    </footer>
  )
}

export function AppShell({
  landing = false,
  onBack,
  onHome,
  langToggle,
  devPanel,
  desktopStep = 1,
  onDesktopStep,
  children,
}: {
  /** The start page gets a marketing nav instead of the step tracker. */
  landing?: boolean
  onBack?: () => void
  /** Tapping the logo goes here (the start page). */
  onHome?: () => void
  langToggle?: ReactNode
  devPanel?: ReactNode
  desktopStep?: number
  onDesktopStep?: (step: number) => void
  children: ReactNode
}) {
  const total = DESKTOP_STEPS.length
  return (
    <div className="flex min-h-dvh justify-center bg-sand lg:block lg:bg-cream">
      <div className={cn('flex min-h-dvh w-full flex-col bg-cream sm:shadow-2xl lg:max-w-none lg:shadow-none', landing ? 'max-w-none font-display' : 'max-w-[430px]')}>
        {landing ? (
          <LandingNav />
        ) : (
          <>
            <DesktopNav onHome={onHome} desktopStep={desktopStep} onDesktopStep={onDesktopStep} navRight={langToggle} />

            <header className="sticky top-0 z-20 bg-cream/95 px-3 pb-2 pt-2 backdrop-blur lg:hidden">
              <div className="flex min-h-12 items-center gap-1">
                <div className="w-12 shrink-0">
                  {onBack && (
                    <button
                      type="button"
                      onClick={onBack}
                      aria-label="Back"
                      className="flex size-12 items-center justify-center rounded-full text-ink hover:bg-sand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40"
                    >
                      <ArrowLeft className="size-6" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="flex flex-1 justify-center">
                  <Logo onHome={onHome} />
                </div>
                <div className="flex shrink-0 justify-end">{langToggle}</div>
              </div>
              <div
                className="mt-1 flex items-center gap-3 px-2"
                role="progressbar"
                aria-label={`Step ${desktopStep} of ${total}: ${DESKTOP_STEPS[desktopStep - 1]}`}
                aria-valuemin={1}
                aria-valuemax={total}
                aria-valuenow={desktopStep}
              >
                <div className="flex flex-1 gap-1">
                  {DESKTOP_STEPS.map((label, i) => (
                    <span key={label} className={`h-1.5 flex-1 rounded-full ${i < desktopStep ? 'bg-sun-dark' : 'bg-amber-900/10'}`} />
                  ))}
                </div>
                <span className="whitespace-nowrap text-xs font-semibold text-ink-soft">
                  Step {desktopStep} of {total} · <span className="text-ink">{DESKTOP_STEPS[desktopStep - 1]}</span>
                </span>
              </div>
            </header>
          </>
        )}

        <main className={cn('flex flex-1 flex-col gap-5 px-5 pb-6 pt-3 lg:mx-auto lg:w-full lg:max-w-[1280px] lg:px-8 lg:pb-8 lg:pt-6', landing && 'mx-auto w-full max-w-[1280px]')}>
          {children}
        </main>

        {devPanel && <div className="px-5 pb-3 lg:mx-auto lg:w-full lg:max-w-[1280px] lg:px-8">{devPanel}</div>}

        {landing ? (
          <LandingFooter />
        ) : (
          <footer className="px-5 pb-8 pt-2 text-center text-sm font-medium text-ink-soft">
            Estimates, not quotations. · Made by Swastik Kaushal
          </footer>
        )}
      </div>
    </div>
  )
}
