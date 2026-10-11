import { ArrowRight, Eye, Info, ThumbsDown, Landmark, LoaderCircle, Pause, Play, RefreshCw, Trees, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Card, SectionTitle, StatCard } from '../Card'
import { MonthlyChart } from '../MonthlyChart'
import { fitRectFor, SatelliteMap, ScaleBar } from '../SatelliteMap'
import { TiltDiagram } from '../TiltDiagram'
import { NeighbourLayer, ObstacleLayer, PanelDimension, PanelLayer, RoofOutline, ShadowLayer, SkylineRing, SkylineShade, SunMarker } from '../MapLayers'
import { Tag } from '../Tag'
import { MAP_FILL, SIDE_PANEL, SPLIT, STICKY_MAP_PANEL } from '../layout'
import type { LoanPlan } from '@/lib/finance'
import { inr, kw, lakhRange, num, rupeeRange, yearsRange } from '@/lib/format'
import type { FinanceParams, Point } from '@/lib/mockData'
import type { PlanModel } from '@/lib/plan'
import { compassName, formatHour, horizonAt, scoreColor, seasonsFor, sunPosition } from '@/lib/solar'
import type { GeoFrame } from '@/lib/geo'
import { polygonBounds, toPoints } from '@/lib/geometry'
import { DEFAULT_PANEL, monthlyFromShape, solarVerdict } from '@/lib/plan'

/**
 * One fixed framing for the panels: centred on them, at least 14 m wide, and 4:3 like the map,
 * so the same plan always looks the same size and tiny systems are not blown up.
 */
function closeUpRect(points: Point[], mpu: number) {
  const b = polygonBounds(points)
  const w = Math.max(b.w * 1.8, 14 / mpu, (b.h * 2.2 * 4) / 3)
  const h = (w * 3) / 4
  return { x: b.minX + b.w / 2 - w / 2, y: b.minY + b.h / 2 - h / 2, w, h }
}

export function PlanScreen({
  frame,
  plan,
  sunStatus,
  sunError,
  onRetrySun,
  hour,
  onHour,
  heatmap,
  onHeatmap,
  scanDone,
  skylineHorizon = null,
  ownHouse,
  residential,
  subsidyRules,
  loan,
  monthlyShape,
  useKwhMonth,
  onScan,
  onSummary,
}: {
  frame: GeoFrame
  plan: PlanModel
  /** Progress of the PVGIS yield lookup (POST /yield). */
  sunStatus: 'idle' | 'loading' | 'ready' | 'error'
  sunError?: string
  onRetrySun: () => void
  hour: number
  onHour: (hour: number) => void
  heatmap: boolean
  onHeatmap: (on: boolean) => void
  scanDone: boolean
  /** The surroundings' skyline (36 heights, every 10° from north), drawn around the roof; null if not added. */
  skylineHorizon?: number[] | null
  ownHouse: boolean
  residential: boolean
  subsidyRules: FinanceParams['subsidy']
  /** EMI next to savings; null when there is nothing to borrow. */
  loan: LoanPlan | null
  /** PVGIS kWh per kWp for each month at the chosen tilt; null until it arrives (or if it fails). */
  monthlyShape: number[] | null
  /** Household use per month in kWh, drawn as a line on the chart. */
  useKwhMonth: number | null
  onScan: () => void
  onSummary: () => void
}) {
  const { numbers, finance } = plan
  // Open on a steady close-up of the panels. "Whole roof" zooms out, and the same framing comes back each time.
  const [closeUp, setCloseUp] = useState(true)
  const panelPts = plan.panels.flatMap((p) => [{ x: p.x, y: p.y }, { x: p.x + p.w, y: p.y + p.h }])
  const canCloseUp = panelPts.length > 0
  const shadows = plan.shadowsAt(hour)
  // Winter sun at the time on the slider: is it behind the scanned surroundings? (Open sky reads ~3°, so ignore that.)
  const winterSun = sunPosition(seasonsFor(frame.lat)[0], hour)
  const skylineHere = skylineHorizon ? horizonAt(skylineHorizon, winterSun.azimuth) : 0
  const sunHidden = skylineHere > 3.5 && winterSun.elevation < skylineHere
  const eligible = ownHouse && residential
  // A clearly bad deal gets an honest "don't" first; the plan is one tap away if they still want it.
  // Wait for the exact sunshine numbers so the advice doesn't flip when they arrive.
  const verdict = solarVerdict(numbers, finance)
  const [showAnyway, setShowAnyway] = useState(false)
  const advise = !verdict.recommend && sunStatus !== 'loading'
  // While we advise against it, show none of the plan: no panels, sizes or controls.
  const hidePlan = advise && !showAnyway

  // "Play the day": sweep the winter sun from 7 am to 5 pm so the shadows move across the roof.
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    const DURATION_MS = 7000
    const from = hour >= 16.9 ? 7 : hour
    const start = performance.now() - ((from - 7) / 10) * DURATION_MS
    // A timer rather than requestAnimationFrame: ~25 fps is plenty for shadows, and it keeps going in throttled tabs.
    const id = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / DURATION_MS)
      onHour(Math.round((7 + 10 * t) * 20) / 20)
      if (t >= 1) setPlaying(false)
    }, 40)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  const monthly = monthlyShape ? monthlyFromShape(numbers.kWhFinal, monthlyShape) : null

  const stateNote = subsidyRules.statePerKw > 0
    ? ` Your state adds ₹${num(subsidyRules.statePerKw)} per kW, up to ₹${num(subsidyRules.stateCap)}.`
    : ''
  const subsidyNote = eligible
    ? `₹${num(subsidyRules.perKwFirstTwo)} per kW for the first 2 kW, ₹${num(subsidyRules.thirdKw)} for the 3rd kW, up to ₹${num(subsidyRules.cap)}.${stateNote}`
    : `No subsidy because ${!ownHouse ? 'the house is not yours' : 'the connection is not residential'}. It needs both.`

  return (
    <div className={SPLIT}>
      <div className={STICKY_MAP_PANEL}>
      <SatelliteMap
        frame={frame}
        className={MAP_FILL}
        fit={closeUp && canCloseUp && !hidePlan ? closeUpRect(panelPts, plan.roof.metersPerUnit) : fitRectFor(plan.roof.points, 0.1)}
        fitKey={closeUp && canCloseUp && !hidePlan ? `plan-panels-${panelPts.length}` : 'plan-roof'}
        ariaLabel="Satellite map of your roof with solar panels and shadows"
        notice={
          hidePlan ? (
            <ScaleBar />
          ) : (
          <>
            <div className="pointer-events-none absolute left-2 top-2 z-[600] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-ink shadow-md">
              <span className="inline-block h-3.5 w-2.5 rounded-[3px] bg-gradient-to-br from-blue-900 to-blue-600 ring-1 ring-slate-300" aria-hidden="true" />
              {numbers.panelsFinal} panels · {numbers.kWp} kW{plan.flush ? '' : ` · ${plan.tilt}° tilt`}
            </div>
            <ScaleBar />
            <p className="pointer-events-none absolute left-2 top-[3.4rem] z-[600] rounded-lg bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-ink shadow">
              Each panel is {DEFAULT_PANEL.lengthM} × {DEFAULT_PANEL.widthM} m, drawn to scale
            </p>
            {skylineHorizon && winterSun.elevation > 0 && (
              <p
                className={`pointer-events-none absolute left-2 top-[5.1rem] z-[600] max-w-[calc(100%-1rem)] rounded-lg px-2.5 py-1 text-xs font-bold shadow ${sunHidden ? 'bg-red-700 text-white' : 'bg-white/90 text-ink'}`}
                role="status"
              >
                {formatHour(hour)}:{' '}
                {sunHidden
                  ? `sun hidden behind your surroundings to the ${compassName(winterSun.azimuth)}`
                  : `sun in the ${compassName(winterSun.azimuth)}, clear of your surroundings`}
              </p>
            )}
            {canCloseUp && (
              <button
                type="button"
                onClick={() => setCloseUp((v) => !v)}
                className="absolute right-2 top-2 z-[600] flex min-h-11 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-sm font-bold text-ink shadow-md hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40"
              >
                {closeUp ? <ZoomOut className="size-4" aria-hidden="true" /> : <ZoomIn className="size-4" aria-hidden="true" />}
                {closeUp ? 'Whole roof' : 'Zoom to panels'}
              </button>
            )}
            {heatmap && (
              <div className="pointer-events-none absolute bottom-7 right-2 z-[600] flex flex-col gap-1 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-ink shadow-md">
                <span className="h-2 w-32 rounded-full" style={{ background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.885)}, ${scoreColor(1)})` }} />
                <span className="flex justify-between">
                  <span>Less sun</span>
                  <span>More sun</span>
                </span>
              </div>
            )}
          </>
          )
        }
      >
        <RoofOutline points={plan.roof.points} fillOpacity={0.14} />
        {heatmap && (
          <g pointerEvents="none">
            {plan.heatCells.map((c, i) => (
              <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx="2" fill={scoreColor(c.score)} fillOpacity="0.85" />
            ))}
          </g>
        )}
        {skylineHorizon && <SkylineRing horizon={skylineHorizon} roof={plan.roof.points} mpu={plan.roof.metersPerUnit} />}
        <ShadowLayer shadows={shadows} />
        <SkylineShade roof={plan.roof.points} active={sunHidden} />
        <SunMarker roof={plan.roof.points} azimuth={winterSun.azimuth} elevation={winterSun.elevation} hidden={sunHidden} mpu={plan.roof.metersPerUnit} />
        {!hidePlan && (
        <g className="sc-fade-in">
          <PanelLayer panels={plan.panels.filter((p) => p.kept)} />
          <PanelDimension panels={plan.panels.filter((p) => p.kept)} mpu={plan.roof.metersPerUnit} />
        </g>
        )}
        <ObstacleLayer obstacles={plan.obstacles} />
        <NeighbourLayer neighbours={plan.neighbours} roof={plan.roof.points} mpu={plan.roof.metersPerUnit} houseFloors={plan.houseFloors} />
      </SatelliteMap>

      {!hidePlan && (
      <Card className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6 lg:p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-ink">Panel tilt</span>
            <span className="text-lg font-bold text-ink">{plan.flush ? 'Flush' : `${plan.tilt}°`}</span>
          </div>
          <p className="text-sm text-ink-soft">
            {plan.flush
              ? 'Panels lie flat on your roof, so there is no tilt to choose.'
              : 'We picked the angle that gives you the most power on this roof, facing south.'}
          </p>
          {!plan.flush && <TiltDiagram tilt={plan.tilt} sunElevation={Math.round(seasonsFor(frame.lat)[0].peak)} />}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="hour" className="text-base font-semibold text-ink">
              Time of day (winter)
            </label>
            <span className="text-lg font-bold text-ink">{formatHour(hour)}</span>
          </div>
          <input
            id="hour"
            type="range"
            min={7}
            max={17}
            step={0.5}
            value={hour}
            onChange={(e) => {
              setPlaying(false)
              onHour(Number(e.target.value))
            }}
            className="h-10 w-full cursor-pointer accent-sun-dark"
          />
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause the day' : 'Play the day: watch the shadows move from 7 am to 5 pm'}
            className="flex min-h-11 items-center justify-center gap-1.5 self-start rounded-full bg-teal-deep px-4 text-sm font-bold text-white shadow-md hover:bg-teal-deep/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40"
          >
            {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            {playing ? 'Pause' : 'Play the day'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="heat" className="text-base font-semibold text-ink">
            Sun heatmap
            <span className="block text-sm font-normal text-ink-soft">Red gets less sun, green gets more</span>
          </label>
          <button
            id="heat"
            type="button"
            role="switch"
            aria-checked={heatmap}
            onClick={() => onHeatmap(!heatmap)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40 ${
              heatmap ? 'bg-teal-deep' : 'bg-input'
            }`}
          >
            <span
              className={`absolute left-1 top-1 size-6 rounded-full bg-white shadow transition-transform ${
                heatmap ? 'translate-x-6' : ''
              }`}
            />
          </button>
        </div>
      </Card>
      )}
      </div>

      <div className={SIDE_PANEL}>
      {advise && !showAnyway ? (
        <>
          <section aria-label="Our advice" className="flex flex-col gap-3 rounded-3xl bg-red-700 p-5 text-white shadow-[0_14px_30px_-14px_rgba(185,28,28,0.9)]" role="alert">
            <ThumbsDown className="size-9" aria-hidden="true" />
            <h1 className="text-3xl font-bold leading-tight">We don&apos;t recommend solar for this roof</h1>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-base text-white/95">
              {verdict.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="text-sm text-white/85">Panels last about 25 years, and the inverter usually needs replacing once along the way. With numbers like these, the money is better kept.</p>
          </section>
          <Card className="flex flex-col gap-2 text-ink">
            <p className="text-base font-semibold">Think something is off?</p>
            <p className="text-sm text-ink-soft">A wrong roof outline, a tank marked in the wrong place, or a skyline scan taken from the wrong spot can make the numbers look worse than they are.</p>
          </Card>
          <div className="flex flex-col gap-3">
            <Button variant="secondary" onClick={onScan}>
              <Trees className="size-5" aria-hidden="true" />
              Check the shade from surroundings again
            </Button>
            <Button variant="ghost" onClick={() => setShowAnyway(true)}>
              <Eye className="size-5" aria-hidden="true" />
              Show me the plan anyway
            </Button>
          </div>
        </>
      ) : (
      <>
      {advise && (
        <Card className="flex flex-col gap-1 border-l-4 border-red-600 bg-red-50 text-red-900" role="status">
          <p className="flex items-center gap-2 text-base font-bold">
            <ThumbsDown className="size-5 shrink-0" aria-hidden="true" />
            We don&apos;t recommend solar here
          </p>
          <p className="text-sm">{verdict.reasons[0]}</p>
        </Card>
      )}
      <div className="flex flex-col gap-1 max-lg:-order-1">
        <h1 className="text-2xl font-bold text-ink lg:text-3xl">Your solar plan</h1>
        <p className="text-base text-ink-soft">
          {scanDone
            ? 'Updated with the shade from your surroundings.'
            : 'Sized for your electricity use, set at the best angle for your roof.'}
        </p>
      </div>

      {sunStatus === 'loading' && (
        <Card className="flex items-center gap-3 bg-teal-soft text-teal-deep" role="status">
          <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium">Getting exact sunshine numbers for your roof…</p>
        </Card>
      )}
      {sunStatus === 'error' && (
        <Card className="flex flex-col gap-2 border-l-4 border-red-300 bg-red-50 text-red-900" role="alert">
          <p className="text-sm font-medium">{sunError || 'We could not get exact sunshine numbers.'} The numbers below use an average for your area.</p>
          <Button variant="secondary" onClick={onRetrySun} className="min-h-11">
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        </Card>
      )}
      {numbers.panelsFit === 0 && (
        <Card className="bg-sun-soft text-ink" role="status">
          <p className="text-sm font-medium">No panels fit on this outline. Check the roof corners, or remove a tank or room that may be in the way.</p>
        </Card>
      )}

      <section
        aria-label="What we suggest"
        className="flex flex-col gap-2 rounded-3xl bg-teal-deep p-5 text-white shadow-[0_14px_30px_-14px_rgba(15,92,94,0.9)]"
      >
        <p className="text-base text-white/90">We suggest</p>
        <p className="text-4xl font-bold leading-tight">
          {numbers.panelsFinal} {numbers.panelsFinal === 1 ? 'panel' : 'panels'}{' '}
          <span className="text-xl font-semibold">· {kw(numbers.kWp)}</span>
        </p>
        <p className="text-base text-white/90">
          {numbers.limitedBy === 'bill' ? (
            <>
              Makes about {num(numbers.kWhFinal)} units a year, enough to cover all the electricity you use.
              Your roof could hold up to {numbers.panelsFit}, but you would not use the extra power.
            </>
          ) : (
            <>
              Your roof holds {numbers.panelsFit} panels, about {num(numbers.kWhFinal)} units a year
              {numbers.coverage ? `, which covers about ${Math.round(numbers.coverage * 100)}% of what you use` : ''}.
            </>
          )}
        </p>
        {scanDone && numbers.kWhBefore !== numbers.kWhFinal && (
          <p className="text-sm text-white/80">
            Shade from nearby buildings lowered the yearly output from {num(numbers.kWhBefore)} units.
          </p>
        )}
        <Tag kind="estimate" className="self-start bg-white text-teal-deep ring-white" />
      </section>

      <section aria-label="Your numbers" className="grid grid-cols-2 gap-3">
        <StatCard label="Cost" value={lakhRange(finance.costRange)} note="before subsidy" tag="estimate" />
        <StatCard
          label="Subsidy"
          value={eligible ? inr(finance.subsidy) : 'Not eligible'}
          note="PM Surya Ghar"
          tag="estimate"
        />
        <StatCard
          label="Saves you"
          value={`${inr(finance.savingsYearRange[0])}${finance.savingsYearRange[1] !== finance.savingsYearRange[0] ? '–' + num(finance.savingsYearRange[1]) : ''}`}
          note="each year"
          tag="estimate"
        />
        <StatCard label="Pays back in" value={yearsRange(finance.paybackRange)} note="after subsidy" tag="estimate" />
      </section>

      {loan && (
        <section aria-label="Paying with a loan" className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_4px_20px_-6px_rgba(120,80,20,0.18)] ring-1 ring-amber-900/5">
          <SectionTitle tag="estimate">
            <span className="flex items-center gap-2">
              <Landmark className="size-5 text-teal-deep" aria-hidden="true" />
              With a solar loan
            </span>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-ink-soft">Your EMI</p>
              <p className="text-2xl font-bold text-ink">{loan.emiRange[0] === loan.emiRange[1] ? inr(loan.emiRange[0]) : rupeeRange(loan.emiRange)}</p>
              <p className="text-xs text-ink-soft">a month</p>
            </div>
            <div>
              <p className="text-sm text-ink-soft">Your bill goes down by</p>
              <p className="text-2xl font-bold text-ink">{inr(loan.monthlySavings)}</p>
              <p className="text-xs text-ink-soft">a month</p>
            </div>
          </div>
          <p className={`rounded-xl p-3 text-sm font-semibold ${loan.paysFromDayOne ? 'bg-teal-soft text-teal-deep' : 'bg-sun-soft text-ink'}`}>
            {loan.paysFromDayOne
              ? 'Your savings cover the EMI, so the system pays for itself from the first month.'
              : `For ${loan.terms.years} years you pay up to ${inr(loan.emiRange[1] - loan.monthlySavings)} a month more than you save. After that, the savings are all yours.`}
          </p>
          <p className="text-xs text-ink-soft">
            PM Surya Ghar collateral-free loan, about {loan.terms.ratePct}% for {loan.terms.years} years, up to {inr(loan.terms.maxAmount)}.
            Assumes the subsidy pays down the loan when it arrives.
            {loan.upfrontRange[1] > 0 ? ` You pay up to ${inr(loan.upfrontRange[1])} up front above the loan limit.` : ''} Check the rate with your bank.
          </p>
        </section>
      )}

      {monthly && (
        <section aria-label="Units made each month" className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_4px_20px_-6px_rgba(120,80,20,0.18)] ring-1 ring-amber-900/5">
          <SectionTitle tag="pvgis">Through the year</SectionTitle>
          <MonthlyChart kWh={monthly} useKwhMonth={useKwhMonth} />
        </section>
      )}

      <Card className="flex flex-col gap-2 border-l-4 border-teal-deep bg-teal-soft text-teal-deep">
        <p className="flex items-start gap-2 text-sm font-medium">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {subsidyNote}
        </p>
        {finance.notes.map((n) => (
          <p key={n} className="pl-6 text-sm">{n}</p>
        ))}
        {finance.source === 'local' && <p className="pl-6 text-sm">Money figures are a rough on-device guess until we reach the server.</p>}
        <p className="pl-6 text-sm">
          A bigger system is not always a better deal beyond 3 kW, because the subsidy stops growing
          there.
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        <Button onClick={onScan} className="min-h-14 text-lg">
          <Trees className="size-5" aria-hidden="true" />
          {scanDone ? 'Change the shade from surroundings' : 'Add shade from nearby buildings and trees'}
        </Button>
        <Button variant="secondary" onClick={onSummary}>
          Take it with you
          <ArrowRight className="size-5" aria-hidden="true" />
        </Button>
      </div>
      </>
      )}
      </div>
    </div>
  )
}
