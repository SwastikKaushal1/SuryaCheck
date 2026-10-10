import { ArrowRight, LoaderCircle, RefreshCw, SunMedium, Wallet } from 'lucide-react'
import { Button } from '../Button'
import { Card } from '../Card'
import { Tag } from '../Tag'
import { num, rupeeRange } from '@/lib/format'
import type { LocationData, QuickEstimate as QuickEstimateData } from '@/lib/mockData'

export type QuickStatus = 'idle' | 'loading' | 'ready' | 'error'

export function QuickEstimate({
  location,
  estimate,
  sunStatus,
  sunError,
  onRetry,
  onContinue,
  embedded = false,
}: {
  location: LocationData
  estimate: QuickEstimateData | null
  sunStatus: QuickStatus
  sunError?: string
  onRetry: () => void
  onContinue: () => void
  embedded?: boolean
}) {
  const Heading = embedded ? 'h2' : 'h1'
  const place = location.city ? `where ${location.city} sits on the map` : 'where your home sits on the map'
  const sunReady = location.pvgisKwhPerKwYear > 0 && sunStatus !== 'error'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Heading className={embedded ? 'text-xl font-bold text-ink' : 'text-2xl font-bold text-ink'}>A quick first look</Heading>
        <p className="text-base text-ink-soft">Based only on {place}.</p>
      </div>

      <section aria-label="Sunshine at your location" aria-busy={sunStatus === 'loading'} className="flex flex-col gap-3 rounded-3xl bg-teal-deep p-5 text-white shadow-[0_14px_30px_-14px_rgba(15,92,94,0.9)]">
        <SunMedium className="size-8 text-sun" aria-hidden="true" />
        <p className="text-lg text-white/90">Your location gets about</p>
        {sunReady ? (
          <>
            <p className="text-4xl font-bold leading-tight">
              {num(location.pvgisKwhPerKwYear)} <span className="text-xl font-semibold">kWh per kW per year</span>
            </p>
            <Tag kind="pvgis" className="self-start bg-white text-teal-deep ring-white" />
          </>
        ) : sunStatus === 'error' ? (
          <div className="flex flex-col gap-3" role="alert">
            <p className="text-base text-white/90">{sunError || 'We could not check the sunshine here.'}</p>
            <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-white px-4 text-sm font-bold text-teal-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xl font-semibold" role="status">
            <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
            Checking the sun…
          </p>
        )}
      </section>

      <Card className="flex flex-col gap-3">
        <Wallet className="size-7 text-sun-dark" aria-hidden="true" />
        <p className="text-lg text-ink">A typical system could save about</p>
        {estimate ? (
          <>
            <p className="text-3xl font-bold leading-tight text-ink">
              {rupeeRange(estimate.monthlySavingsRange)} <span className="text-lg font-semibold text-ink-soft">a month</span>
            </p>
            <Tag kind="estimate" className="self-start" />
            <p className="text-sm text-ink-soft">This is a rough guess for a {estimate.referenceSystemKw} kW system. We have not looked at your roof yet, so the next steps make it exact.</p>
          </>
        ) : (
          <p className="flex items-center gap-2 text-xl font-semibold text-ink-soft" role="status">
            {sunStatus === 'error' ? (
              'Not available right now.'
            ) : (
              <>
                <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                Working it out…
              </>
            )}
          </p>
        )}
      </Card>

      {!embedded && (
        <Button onClick={onContinue}>
          Make it exact for my roof
          <ArrowRight className="size-5" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
