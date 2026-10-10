import { ArrowRight, Info, LoaderCircle, RefreshCw, Trees, ZoomIn, ZoomOut } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../Button'
import { Card, StatCard } from '../Card'
import { fitRectFor, SatelliteMap, ScaleBar } from '../SatelliteMap'
import { TiltDiagram } from '../TiltDiagram'
import { NeighbourLayer, ObstacleLayer, PanelDimension, PanelLayer, RoofOutline, ShadowLayer } from '../MapLayers'
import { Tag } from '../Tag'
import { MAP_FILL, SIDE_PANEL, SPLIT, STICKY_MAP_PANEL } from '../layout'
import { inr, kw, lakhRange, num, yearsRange } from '@/lib/format'
import type { FinanceParams, Point } from '@/lib/mockData'
import type { PlanModel } from '@/lib/plan'
import { formatHour, scoreColor, seasonsFor } from '@/lib/solar'
import type { GeoFrame } from '@/lib/geo'
import { polygonBounds, toPoints } from '@/lib/geometry'
import { DEFAULT_PANEL } from '@/lib/plan'

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
  ownHouse,
  residential,
  subsidyRules,
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
  ownHouse: boolean
  residential: boolean
  subsidyRules: FinanceParams['subsidy']
  onScan: () => void
  onSummary: () => void
}) {
  const { numbers, finance } = plan
  // Open on a steady close-up of the panels. "Whole roof" zooms out, and the same framing comes back each time.
  const [closeUp, setCloseUp] = useState(true)
  const panelPts = plan.panels.flatMap((p) => [{ x: p.x, y: p.y }, { x: p.x + p.w, y: p.y + p.h }])
  const canCloseUp = panelPts.length > 0
  const shadows = plan.shadowsAt(hour)
  const eligible = ownHouse && residential

  const subsidyNote = eligible
    ? `₹${num(subsidyRules.perKwFirstTwo)} per kW for the first 2 kW, ₹${num(subsidyRules.thirdKw)} for the 3rd kW, up to ₹${num(subsidyRules.cap)}.`
    : `No subsidy because ${!ownHouse ? 'the house is not yours' : 'the connection is not residential'}. It needs both.`

  return (
    <div className={SPLIT}>
      <div className={STICKY_MAP_PANEL}>
      <SatelliteMap
        frame={frame}
        className={MAP_FILL}
        fit={closeUp && canCloseUp ? closeUpRect(panelPts, plan.roof.metersPerUnit) : fitRectFor(plan.roof.points, 0.1)}
        fitKey={closeUp && canCloseUp ? `plan-panels-${panelPts.length}` : 'plan-roof'}
        fitMaxZoom={closeUp && canCloseUp ? 21 : undefined}
        ariaLabel="Satellite map of your roof with solar panels and shadows"
        notice={
          <>
            <div className="pointer-events-none absolute left-2 top-2 z-[600] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-ink shadow-md">
              <span className="inline-block h-3.5 w-2.5 rounded-[3px] bg-gradient-to-br from-blue-900 to-blue-600 ring-1 ring-slate-300" aria-hidden="true" />
              {numbers.panelsFinal} panels · {numbers.kWp} kW{plan.flush ? '' : ` · ${plan.tilt}° tilt`}
            </div>
            <ScaleBar />
            <p className="pointer-events-none absolute left-2 top-[3.4rem] z-[600] rounded-lg bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-ink shadow">
              Each panel is {DEFAULT_PANEL.lengthM} × {DEFAULT_PANEL.widthM} m, drawn to scale
            </p>
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
                <span className="h-2 w-32 rounded-full" style={{ background: `linear-gradient(90deg, ${scoreColor(0.05)}, ${scoreColor(0.5)}, ${scoreColor(0.95)})` }} />
                <span className="flex justify-between">
                  <span>Less sun</span>
                  <span>More sun</span>
                </span>
              </div>
            )}
          </>
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
        <ShadowLayer shadows={shadows} />
        <g className="sc-fade-in">
          <PanelLayer panels={plan.panels.filter((p) => p.kept)} />
          <PanelDimension panels={plan.panels.filter((p) => p.kept)} mpu={plan.roof.metersPerUnit} />
        </g>
        <ObstacleLayer obstacles={plan.obstacles} />
        <NeighbourLayer neighbours={plan.neighbours} roof={plan.roof.points} mpu={plan.roof.metersPerUnit} houseFloors={plan.houseFloors} />
      </SatelliteMap>

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
            onChange={(e) => onHour(Number(e.target.value))}
            className="h-12 w-full cursor-pointer accent-sun-dark"
          />
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
      </div>

      <div className={SIDE_PANEL}>
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
      </div>
    </div>
  )
}
