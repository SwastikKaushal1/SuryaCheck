import { ArrowLeft, Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const DESKTOP_STEPS = ['Location', 'Roof', 'Obstacles', 'Plan', 'Shade', 'Summary'] as const

export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lm-sun" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="lm-roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0F5C5E" />
          <stop offset="1" stopColor="#0B3D3F" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#lm-sun)" />
      <g stroke="#fff" strokeWidth="3.2" strokeLinecap="round" opacity="0.95">
        <path d="M32 6v6M13 14l4 4M51 14l-4 4M6 30h6M58 30h-6" />
      </g>
      <circle cx="32" cy="29" r="10" fill="#fff" />
      <path d="M8 58 L16 38 H48 L56 58 Z" fill="url(#lm-roof)" />
      <path d="M26 38 L22 58 M38 38 L42 58 M12 48H52" stroke="#7DD3D8" strokeWidth="1.6" fill="none" opacity="0.85" />
    </svg>
  )
}

export function Logo({ onHome }: { onHome?: () => void }) {
  const inner = (
    <>
      <LogoMark className="size-9 drop-shadow-sm" />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-extrabold tracking-tight text-ink">SuryaCheck</span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Rooftop solar, simply</span>
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
  onBack,
  onHome,
  desktopStep,
  onDesktopStep,
  navRight,
}: {
  onBack?: () => void
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
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft transition hover:bg-sand hover:text-ink"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
          )}
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

export function AppShell({
  step,
  total = 8,
  onBack,
  onHome,
  headerRight,
  devPanel,
  desktopStep = 1,
  onDesktopStep,
  navRight,
  children,
}: {
  step: number
  total?: number
  onBack?: () => void
  /** Tapping the logo goes here (the start page). */
  onHome?: () => void
  headerRight?: ReactNode
  devPanel?: ReactNode
  desktopStep?: number
  onDesktopStep?: (step: number) => void
  navRight?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh justify-center bg-sand lg:block lg:bg-cream">
      <div className="flex min-h-dvh w-full max-w-[430px] flex-col bg-cream sm:shadow-2xl lg:max-w-none lg:shadow-none">
        <DesktopNav
          onHome={onHome}
          onBack={onBack}
          desktopStep={desktopStep}
          onDesktopStep={onDesktopStep}
          navRight={navRight}
        />

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
            <div className="flex min-w-12 shrink-0 justify-end">{headerRight}</div>
          </div>
          <div
            className="mt-1 flex items-center gap-3 px-2"
            role="progressbar"
            aria-label={`Step ${step} of ${total}`}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={step}
          >
            <div className="flex flex-1 gap-1">
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-sun-dark' : 'bg-amber-900/10'}`}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-ink-soft">
              {step} of {total}
            </span>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-3 lg:mx-auto lg:w-full lg:max-w-[1280px] lg:px-8 lg:pb-8 lg:pt-6">
          {children}
        </main>

        {devPanel && <div className="px-5 pb-3 lg:mx-auto lg:w-full lg:max-w-[1280px] lg:px-8">{devPanel}</div>}

        <footer className="px-5 pb-8 pt-2 text-center text-sm font-medium text-ink-soft">
          Estimates, not quotations.
        </footer>
      </div>
    </div>
  )
}
