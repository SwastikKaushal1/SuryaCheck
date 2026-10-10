import type { FinanceResponse } from './api'
import type { FinanceParams, Range } from './mockData'

export interface FinanceResult {
  eligible: boolean
  costRange: Range
  subsidy: number
  netCostRange: Range
  savingsYearRange: Range
  paybackRange: Range
  co2Tonnes: number
  /** Plain-language remarks from the backend. */
  notes: string[]
  /** 'server' = POST /finance, 'local' = on-device stand-in. */
  source: 'server' | 'local'
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step

/** PM Surya Ghar: 30,000/kW for the first 2 kW, 18,000 for the 3rd kW, capped at 78,000. */
export function subsidyFor(kW: number, rules: FinanceParams['subsidy']): number {
  const first = Math.min(kW, 2) * rules.perKwFirstTwo
  const third = Math.min(Math.max(kW - 2, 0), 1) * rules.thirdKw
  return Math.min(rules.cap, roundTo(first + third, 100))
}

export function calcFinance(
  kWp: number,
  kWhYear: number,
  eligible: boolean,
  params: FinanceParams,
): FinanceResult {
  const costRange: Range = [
    roundTo(kWp * params.costPerKwRange[0], 5000),
    roundTo(kWp * params.costPerKwRange[1], 5000),
  ]
  const subsidy = eligible ? subsidyFor(kWp, params.subsidy) : 0
  const netCostRange: Range = [
    Math.max(0, costRange[0] - subsidy),
    Math.max(0, costRange[1] - subsidy),
  ]
  const savingsYearRange: Range = [
    roundTo(kWhYear * params.tariffRangePerUnit[0], 100),
    roundTo(kWhYear * params.tariffRangePerUnit[1], 100),
  ]
  const best = savingsYearRange[1] > 0 ? netCostRange[0] / savingsYearRange[1] : 0
  const worst = savingsYearRange[0] > 0 ? netCostRange[1] / savingsYearRange[0] : 0
  const low = Math.max(1, Math.round(best))
  const high = Math.max(low + 1, Math.ceil(worst))
  const hasSavings = savingsYearRange[1] > 0
  return {
    eligible,
    costRange,
    subsidy,
    netCostRange,
    savingsYearRange,
    paybackRange: hasSavings ? [low, high] : [0, 0],
    co2Tonnes: Math.round(((kWhYear * params.co2KgPerKwh) / 1000) * 10) / 10,
    notes: [],
    source: 'local',
  }
}

/** Turns the backend's POST /finance answer into the shape the screens use. */
export function financeFromApi(r: FinanceResponse): FinanceResult {
  const lo = r.paybackRange ? Math.max(1, Math.floor(r.paybackRange[0])) : 0
  const payback: Range = r.paybackRange ? [lo, Math.max(lo + 1, Math.ceil(r.paybackRange[1]))] : [0, 0]
  return {
    eligible: r.subsidyBreakdown.eligible,
    costRange: r.costRange,
    subsidy: r.subsidy,
    netCostRange: r.netCostRange,
    savingsYearRange: [r.savingsYear, r.savingsYear],
    paybackRange: payback,
    co2Tonnes: Math.round(r.co2 / 100) / 10,
    notes: r.notes,
    source: 'server',
  }
}
