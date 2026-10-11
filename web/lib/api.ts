/** Typed client for the SuryaCheck FastAPI backend. Base URL: NEXT_PUBLIC_API_URL. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

/** The backend always answers errors as { error, hint }. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, hint: string, status = 0) {
    super(hint)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'
export const toApiError = (e: unknown): ApiError =>
  e instanceof ApiError ? e : new ApiError('unknown', 'Something went wrong. Please try again.')

async function request<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    })
  } catch (e) {
    if (isAbort(e)) throw e
    throw new ApiError('network', 'We could not reach the SuryaCheck server. Check your connection and try again.')
  }
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; hint?: string }
    throw new ApiError(b.error ?? 'http_error', b.hint ?? 'Something went wrong on our side. Please try again.', res.status)
  }
  return body as T
}

export interface Place {
  address: string
  city: string
  lat: number
  lng: number
  /** Two-letter state code such as "DL". Empty when unknown. */
  stateCode: string
}
interface PlaceRow {
  name: string
  lat: number
  lon: number
  state?: string
  stateCode?: string
  city?: string
}
const toPlace = (r: PlaceRow): Place => ({
  address: r.name,
  city: r.city || r.state || '',
  lat: r.lat,
  lng: r.lon,
  stateCode: r.stateCode ?? '',
})

export interface BuildingResponse {
  found: boolean
  containsPoint?: boolean
  /** Closed ring of [lng, lat] pairs. */
  polygon?: [number, number][]
  areaM2?: number
  levels?: string | null
  height?: string | null
  osmId?: number
}
export interface YieldRequest {
  lat: number
  lon: number
  tilts: number[]
  aspect?: number
  /** 36 elevation angles, one per 10 degrees clockwise from north. */
  horizon?: number[]
}
export type YieldResponse = Record<string, number>
export interface FinanceRequest {
  kwp: number
  stateCode?: string
  monthlyBill?: number
  monthlyUnits?: number
  residential?: boolean
  ownHouse?: boolean
  kwhPerKwp?: number
  tariff?: number
}
export interface FinanceResponse {
  subsidy: number
  subsidyBreakdown: { central: number; state: number; eligible: boolean }
  costRange: [number, number]
  netCostRange: [number, number]
  savingsYear: number
  paybackRange: [number, number] | null
  co2: number
  offsetKwhYear: number
  tariffUsed: number
  notes: string[]
}
export interface LoanTerms {
  ratePct: number
  years: number
  /** Most the scheme lends without collateral, in rupees. */
  maxAmount: number
}
export interface MonthlyResponse {
  tilt: number
  kwhPerKwp: number
  /** kWh per kWp for each month, January first. */
  monthly: number[]
  source: string
}
export interface PairView {
  marks: { bearing: number; elevation: number }[]
  phoneConnected: boolean
  updated: number
}
export interface ReferenceData {
  panel: { widthM: number; lengthM: number; gapM: number; kWp: number }
  subsidy: { centralPerKwFirst2: number; centralThirdKw: number; centralCap: number; residentialOnly: boolean }
  cost: { firstKwRange: [number, number]; extraKwRange: [number, number] }
  co2: { kgPerKwh: number }
  /** PM Surya Ghar collateral-free loan. Optional so an older backend still works. */
  loan?: LoanTerms
  defaults: { avgTariff: number; performanceKwhPerKwp: number }
  /** avgTariff: rupees per unit on a ~300 units/month household's top slab. topUpPerKw/topUpCap: state subsidy. */
  states: Record<string, { name: string; avgTariff: number; topUpPerKw?: number; topUpCap?: number }>
}

export const api = {
  async geocode(q: string, signal?: AbortSignal): Promise<Place[]> {
    const rows = await request<PlaceRow[]>(`/geocode?q=${encodeURIComponent(q)}`, {}, signal)
    return rows.map(toPlace)
  },
  /** Suggestions while typing (Photon, open source). Needs at least 3 characters. */
  async suggest(q: string, signal?: AbortSignal): Promise<Place[]> {
    const rows = await request<PlaceRow[]>(`/suggest?q=${encodeURIComponent(q)}`, {}, signal)
    return rows.map(toPlace)
  },
  async reverse(lat: number, lon: number, signal?: AbortSignal): Promise<Place | null> {
    const r = await request<(PlaceRow & { found: boolean }) | { found: false }>(`/reverse?lat=${lat}&lon=${lon}`, {}, signal)
    return r.found ? toPlace(r as PlaceRow) : null
  },
  quick: (lat: number, lon: number, signal?: AbortSignal) =>
    request<{ kwhPerKwp: number; tilt: number; source: string }>(`/quick?lat=${lat}&lon=${lon}`, {}, signal),
  monthly: (lat: number, lon: number, tilt: number, signal?: AbortSignal) =>
    request<MonthlyResponse>(`/monthly?lat=${lat}&lon=${lon}&tilt=${tilt}`, {}, signal),
  building: (lat: number, lon: number, signal?: AbortSignal) =>
    request<BuildingResponse>(`/building?lat=${lat}&lon=${lon}`, {}, signal),
  yields: (body: YieldRequest, signal?: AbortSignal) =>
    request<YieldResponse>('/yield', { method: 'POST', body: JSON.stringify(body) }, signal),
  finance: (body: FinanceRequest, signal?: AbortSignal) =>
    request<FinanceResponse>('/finance', { method: 'POST', body: JSON.stringify(body) }, signal),
  reference: (signal?: AbortSignal) => request<ReferenceData>('/reference', {}, signal),

  // Phone-as-scanner pairing: the laptop creates a code and polls it; the phone sends marks to it.
  pairCreate: () => request<{ code: string; expiresIn: number }>('/pair', { method: 'POST' }),
  pairView: (code: string, signal?: AbortSignal) => request<PairView>(`/pair/${code}`, {}, signal),
  pairHello: (code: string) => request<{ ok: boolean }>(`/pair/${code}/hello`, { method: 'POST' }),
  pairMark: (code: string, mark: { bearing: number; elevation: number }) =>
    request<{ count: number }>(`/pair/${code}/marks`, { method: 'POST', body: JSON.stringify(mark) }),
  pairProfile: (code: string, marks: { bearing: number; elevation: number }[]) =>
    request<{ count: number }>(`/pair/${code}/profile`, { method: 'POST', body: JSON.stringify({ marks }) }),
  pairUndo: (code: string) => request<{ count: number }>(`/pair/${code}/marks/last`, { method: 'DELETE' }),
}
