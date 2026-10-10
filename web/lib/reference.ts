import type { LoanTerms, ReferenceData } from './api'
import type { FinanceParams } from './mockData'

/** Used only if GET /reference cannot be reached. Live values come from backend/reference.json. */
export const FALLBACK_REFERENCE: ReferenceData = {
  panel: { widthM: 1.13, lengthM: 2.28, gapM: 0.03, kWp: 0.55 },
  subsidy: { centralPerKwFirst2: 30000, centralThirdKw: 18000, centralCap: 78000, residentialOnly: true },
  cost: { firstKwRange: [60000, 80000], extraKwRange: [55000, 70000] },
  co2: { kgPerKwh: 0.71 },
  loan: { ratePct: 7.0, years: 10, maxAmount: 200000 },
  defaults: { avgTariff: 7.0, performanceKwhPerKwp: 1450 },
  states: {},
}

export const loanTermsFrom = (ref: ReferenceData): LoanTerms => ref.loan ?? FALLBACK_REFERENCE.loan!

export const tariffFor = (ref: ReferenceData, stateCode: string) =>
  ref.states[(stateCode || '').toUpperCase()]?.avgTariff ?? ref.defaults.avgTariff

/** Inputs for the on-device finance stand-in used while POST /finance loads or is down. */
export function financeParamsFrom(ref: ReferenceData, stateCode: string): FinanceParams {
  return {
    firstKwRange: ref.cost.firstKwRange,
    extraKwRange: ref.cost.extraKwRange,
    tariff: tariffFor(ref, stateCode),
    co2KgPerKwh: ref.co2.kgPerKwh,
    subsidy: {
      perKwFirstTwo: ref.subsidy.centralPerKwFirst2,
      thirdKw: ref.subsidy.centralThirdKw,
      cap: ref.subsidy.centralCap,
      statePerKw: ref.states[(stateCode || '').toUpperCase()]?.topUpPerKw ?? 0,
      stateCap: ref.states[(stateCode || '').toUpperCase()]?.topUpCap ?? 0,
    },
  }
}
