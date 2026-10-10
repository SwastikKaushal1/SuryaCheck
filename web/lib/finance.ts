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

/** PM Surya Ghar: 30,000/kW for the first 2 kW, 18,000 for the 3rd kW, capped at 78,000. Same as backend central_subsidy. */
export function subsidyFor(kW: number, rules: FinanceParams['subsidy']): number {
  const first = Math.min(kW, 2) * rules.perKwFirstTwo
  const third = Math.max(0, Math.min(kW, 3) - 2) * rules.thirdKw
  return Math.min(rules.cap, first + third)
}

/** Whole years, never zero, low < high. Shared by the local and server paths so both round alike. */
function paybackYears(raw: Range | null): Range {
  if (!raw) return [0, 0]
  const lo = Math.max(1, Math.floor(raw[0]))
  return [lo, Math.max(lo + 1, Math.ceil(raw[1]))]
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * On-device copy of backend finance.compute, used while POST /finance loads or is down.
 * Keep the two in step, or the numbers jump when the server answers.
 */
export function calcFinance(
  kWp: number,
  kWhYear: number,
  /** Household use per year. Energy beyond it is not counted as savings. */
  consumptionKwhYear: number | null,
  eligible: boolean,
  params: FinanceParams,
): FinanceResult {
  const first = Math.min(kWp, 1)
  const extra = Math.max(0, kWp - 1)
  const lo = Math.round(first * params.firstKwRange[0] + extra * params.extraKwRange[0])
  const hi = Math.round(first * params.firstKwRange[1] + extra * params.extraKwRange[1])
  const subsidy = eligible ? Math.round(subsidyFor(kWp, params.subsidy) + params.subsidy.stateTopUp) : 0
  const netCostRange: Range = [Math.max(0, lo - subsidy), Math.max(0, hi - subsidy)]

  const offset = consumptionKwhYear && consumptionKwhYear > 0 ? Math.min(kWhYear, consumptionKwhYear) : kWhYear
  const savings = Math.round(offset * params.tariff)
  const rawPayback: Range | null = savings > 0 ? [round1(netCostRange[0] / savings), round1(netCostRange[1] / savings)] : null

  const notes: string[] = []
  if (!eligible) notes.push('Central subsidy applies only to residential connections in your own house.')
  if (consumptionKwhYear && kWhYear > consumptionKwhYear)
    notes.push('System produces more than you use. Extra energy is not counted as savings.')

  return {
    eligible,
    costRange: [lo, hi],
    subsidy,
    netCostRange,
    savingsYearRange: [savings, savings],
    paybackRange: paybackYears(rawPayback),
    co2Tonnes: Math.round(Math.round(offset * params.co2KgPerKwh) / 100) / 10,
    notes,
    source: 'local',
  }
}

/** Turns the backend's POST /finance answer into the shape the screens use. */
export function financeFromApi(r: FinanceResponse): FinanceResult {
  return {
    eligible: r.subsidyBreakdown.eligible,
    costRange: r.costRange,
    subsidy: r.subsidy,
    netCostRange: r.netCostRange,
    savingsYearRange: [r.savingsYear, r.savingsYear],
    paybackRange: paybackYears(r.paybackRange),
    co2Tonnes: Math.round(r.co2 / 100) / 10,
    notes: r.notes,
    source: 'server',
  }
}
