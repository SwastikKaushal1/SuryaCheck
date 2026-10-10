/**
 * Shared types, plus what is still simulated: sampleRoof (landing-page decoration) and the
 * camera skyline scan (scanStops / horizon / lossSummary), which has no backend endpoint yet.
 * Everything else now comes from the backend. Overlay coords are "units" (see lib/geo.ts).
 */

export type Range = [number, number]

export interface Point {
  x: number
  y: number
}

export interface LocationData {
  address: string
  city: string
  lat: number
  lng: number
  pvgisKwhPerKwYear: number
  billPerUnitRs: number
  defaultMonthlyBillRs: number
}

export interface QuickEstimate {
  referenceSystemKw: number
  monthlySavingsRange: Range
  locationOnlyKwhYear: number
}

export interface RoofData {
  points: Point[]
  areaM2: number
  metersPerUnit: number
  source: 'detected' | 'corners' | 'typed'
  /** Detected outlines: false when it is only the nearest building to the pin. */
  containsPin?: boolean
}

export type ObstacleKind =
  | 'tank' | 'stairs' | 'parapet' | 'heater' | 'ac' | 'dish' | 'chimney' | 'tree' | 'custom' | 'clear'

export interface Obstacle {
  id: string
  kind: ObstacleKind
  x: number
  y: number
  w: number
  h: number
  heightM: number
  /** Footprint shape. Defaults to round for tanks, box for everything else. */
  shape?: 'box' | 'round'
  /** Optional name the person gave it, shown on the map. */
  name?: string
  /** Turn in degrees, clockwise, around its centre. 0 when not turned. */
  angle?: number
}

export interface Neighbour {
  id: string
  /** Which side of your house it is on. Sets the starting spot; dragging it moves it. */
  side: 'N' | 'E' | 'S' | 'W'
  floors: number
  /** Exact place and size (map units, centre-based) once the person has moved or resized it. */
  rect?: { x: number; y: number; w: number; h: number; angle?: number }
}

export interface TiltRow {
  tilt: number
  panels: number
  kWp: number
  kWhYear: number
}

/** Same inputs as backend finance.compute, so the on-device stand-in gives the same numbers. */
export interface FinanceParams {
  /** Installed cost of the first kW, then of every extra kW (rupees, low to high). */
  firstKwRange: Range
  extraKwRange: Range
  /** Rupees per unit for this state. */
  tariff: number
  co2KgPerKwh: number
  subsidy: {
    perKwFirstTwo: number
    thirdKw: number
    cap: number
    /** Extra subsidy some states add on top of the central one: per kW, up to a cap (Delhi: 10,000 up to 30,000). */
    statePerKw: number
    stateCap: number
  }
}

export interface ScanStopReading {
  id: string
  label: string
  bearing: number
  elevation: number
}

export interface SkylineStop extends ScanStopReading {
  scannedElevation: number
  added?: boolean
}

export interface LossSummary {
  percent: number
  direction: string
}

// Decorative roof for the landing-page preview only.
export const sampleRoof: RoofData = {
  points: [
    { x: 100, y: 85 },
    { x: 300, y: 78 },
    { x: 308, y: 215 },
    { x: 108, y: 225 },
  ],
  areaM2: 118,
  metersPerUnit: 0.065,
  source: 'detected',
}

// SIMULATED camera scan readings (bearing clockwise from north)
/** Starting point for the shade check: open sky (3 degrees) in each direction the person can adjust. */
export const scanStops: ScanStopReading[] = [
  { id: 'stop-e', label: 'E', bearing: 90, elevation: 3 },
  { id: 'stop-se', label: 'SE', bearing: 135, elevation: 3 },
  { id: 'stop-s', label: 'S', bearing: 180, elevation: 3 },
  { id: 'stop-sw', label: 'SW', bearing: 225, elevation: 3 },
  { id: 'stop-w', label: 'W', bearing: 270, elevation: 3 },
]

/** Open-sky horizon: height of the skyline every 10 degrees of compass bearing, starting at north. */
export const horizon: number[] = Array.from({ length: 36 }, () => 3)
