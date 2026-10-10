import type { ReferenceData } from './api'
import type { FinanceParams } from './mockData'

/** Used only if GET /reference cannot be reached. Live values come from backend/reference.json. */
export const FALLBACK_REFERENCE: ReferenceData = {
  panel: { widthM: 1.13, lengthM: 2.28, gapM: 0.03, kWp: 0.55 },
  subsidy: { centralPerKwFirst2: 30000, centralThirdKw: 18000, centralCap: 78000, residentialOnly: true },
  cost: { firstKwRange: [60000, 75000], extraKwRange: [55000, 65000] },
  co2: { kgPerKwh: 0.71 },
  defaults: { avgTariff: 7.0, performanceKwhPerKwp: 1450 },
  states: {},
}

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
      stateTopUp: ref.states[(stateCode || '').toUpperCase()]?.topUp ?? 0,
    },
  }
}
