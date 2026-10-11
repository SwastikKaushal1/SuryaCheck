import { clamp, convexHull } from './geometry'
import type { Obstacle, Point, SkylineStop } from './mockData'
import { obstacleFootprint } from './obstacles'

/** A day that stands for a season: the winter solstice, an equinox, or the summer solstice. */
export interface Season {
  name: 'winter' | 'equinox' | 'summer'
  /** Sun's declination that day, in degrees (-23.44 in December, 0 in March/September, +23.44 in June). */
  decl: number
  /** Latitude of the house, degrees north. */
  lat: number
  /** Noon sun height that day, degrees. */
  peak: number
}

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const DECLINATION = { winter: -23.44, equinox: 0, summer: 23.44 } as const
/** Latitude used when none is known (Delhi). */
const DEFAULT_LAT = 28.6

/** The three days we simulate, for a latitude (Delhi gives noon sun heights of about 38°, 61° and 85°). */
export function seasonsFor(lat: number): Season[] {
  return (['winter', 'equinox', 'summer'] as const).map((name) => {
    const decl = DECLINATION[name]
    return { name, decl, lat, peak: clamp(90 - Math.abs(lat - decl), 0, 90) }
  })
}

export const SEASONS: Season[] = seasonsFor(DEFAULT_LAT)
export const WINTER: Season = SEASONS[0]

/** Half-hour steps covering the longest day anywhere in India; times when the sun is down are skipped by callers. */
export const DAY_HOURS: number[] = Array.from({ length: 30 }, (_, i) => 4.5 + i * 0.5)

/**
 * Where the sun is, from the standard solar-position equations (hour angle and declination).
 * `hour` is local solar time (12 = sun due south). Azimuth is degrees clockwise from north.
 * Elevation is negative while the sun is below the horizon.
 */
export function sunPosition(season: Season, hour: number) {
  const H = rad(15 * (hour - 12))
  const phi = rad(season.lat)
  const d = rad(season.decl)
  const elevation = deg(Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H)))
  const azimuth = (deg(Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi))) + 180 + 360) % 360
  return { azimuth, elevation }
}

export function shadowHull(
  obstacle: Obstacle,
  sun: { azimuth: number; elevation: number },
  metersPerUnit: number,
  /** Longest shadow to draw. Tanks and rooms are short; tall neighbours need more. */
  maxLengthM = 8,
): Point[] {
  const footprint = obstacleFootprint(obstacle)
  const lengthM = Math.min(maxLengthM, obstacle.heightM / Math.tan(rad(Math.max(sun.elevation, 6))))
  const lengthUnits = lengthM / metersPerUnit
  const dx = -Math.sin(rad(sun.azimuth)) * lengthUnits
  const dy = Math.cos(rad(sun.azimuth)) * lengthUnits
  return convexHull([...footprint, ...footprint.map((p) => ({ x: p.x + dx, y: p.y + dy }))])
}

export function horizonAt(horizon: number[], bearing: number): number {
  const b = ((bearing % 360) + 360) % 360
  const i = Math.floor(b / 10)
  const f = (b - i * 10) / 10
  return horizon[i % 36] * (1 - f) + horizon[(i + 1) % 36] * f
}

/** Share of the sun's energy blocked by the skyline, across three seasons. */
function rawSkylineLoss(horizon: number[]): number {
  let blocked = 0
  let total = 0
  for (const season of SEASONS) {
    for (const h of DAY_HOURS) {
      const sun = sunPosition(season, h)
      if (sun.elevation <= 0) continue
      const weight = Math.sin(rad(sun.elevation))
      total += weight
      if (sun.elevation < horizonAt(horizon, sun.azimuth)) blocked += weight
    }
  }
  return total ? blocked / total : 0
}

/** Share of yearly sun energy (percent) that a horizon blocks, compared with open sky. */
export function skylineLossPct(horizon: number[]): number {
  const open = rawSkylineLoss(Array.from({ length: 36 }, () => 3))
  return clamp(Math.round((rawSkylineLoss(horizon) - open) * 100), 0, 60)
}

/** Scales the baseline loss from the mock API so edits to the skyline move the number. */
export function lossPctFromHorizon(
  horizon: number[],
  baselineHorizon: number[],
  baselinePercent: number,
): number {
  const base = rawSkylineLoss(baselineHorizon)
  if (base <= 0) return 0
  return clamp(Math.round((baselinePercent * rawSkylineLoss(horizon)) / base), 0, 60)
}

/** Applies the user's per-stop edits on top of the scanned horizon. */
export function horizonFromStops(base: number[], stops: SkylineStop[]): number[] {
  if (!stops.length) return base
  const sorted = [...stops].sort((a, b) => a.bearing - b.bearing)
  const anchors = [
    { b: sorted[0].bearing - 20, d: 0 },
    ...sorted.map((s) => ({ b: s.bearing, d: s.elevation - s.scannedElevation })),
    { b: sorted[sorted.length - 1].bearing + 20, d: 0 },
  ]
  return base.map((value, i) => {
    const bearing = i * 10
    let delta = 0
    for (let k = 0; k < anchors.length - 1; k++) {
      const a = anchors[k]
      const c = anchors[k + 1]
      if (bearing >= a.b && bearing <= c.b) {
        delta = c.b === a.b ? a.d : a.d + ((c.d - a.d) * (bearing - a.b)) / (c.b - a.b)
        break
      }
    }
    return clamp(value + delta, 0, 45)
  })
}

/** Directions a phone scan may set. The sun in India rises no further north than ~63° and sets by ~297°. */
export const SCAN_FROM = 60
export const SCAN_TO = 300

/**
 * Puts phone-scan readings onto the skyline: a mark within 22.5° of an existing direction updates it
 * (the last mark wins), any other mark becomes a new direction. Marks facing north are left out.
 */
export function mergeScan(stops: SkylineStop[], marks: { bearing: number; elevation: number }[], base: number[]): SkylineStop[] {
  const next = stops.map((s) => ({ ...s }))
  marks.forEach((m, i) => {
    if (m.bearing < SCAN_FROM || m.bearing > SCAN_TO) return
    const elevation = clamp(Math.round(m.elevation), 0, 45)
    const near = next
      .map((s) => ({ s, gap: Math.abs(s.bearing - m.bearing) }))
      .filter((x) => x.gap <= 22.5)
      .sort((a, b) => a.gap - b.gap)[0]
    if (near) {
      near.s.elevation = elevation
    } else {
      const bearing = Math.round(m.bearing)
      next.push({
        id: `scan-${bearing}-${i}`,
        label: shortCompass(bearing),
        bearing,
        elevation,
        scannedElevation: Math.round(horizonAt(base, bearing)),
        added: true,
      })
    }
  })
  return next
}

/**
 * A continuous phone sweep (readings every few degrees) becomes one skyline point per 10°, the
 * resolution PVGIS uses, keeping the tallest reading in each slice so a thin tower is not lost.
 */
export function profileToStops(marks: { bearing: number; elevation: number }[]): SkylineStop[] {
  const tallest = new Map<number, number>()
  for (const m of marks) {
    if (m.bearing < SCAN_FROM || m.bearing > SCAN_TO) continue
    const b = Math.round(m.bearing / 10) * 10
    tallest.set(b, Math.max(tallest.get(b) ?? 0, clamp(Math.round(m.elevation), 0, 45)))
  }
  return [...tallest.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bearing, elevation]) => ({ id: `sweep-${bearing}`, label: `${bearing}°`, bearing, elevation, scannedElevation: 3, added: true }))
}

/** A sweep covers at least this many 10° slices; fewer readings are treated as separate marks. */
const SWEEP_MIN_SLICES = 6

/**
 * Puts any phone scan on the skyline. A sweep replaces the directions it covered with its own
 * fine-grained points (directions outside the sweep are kept); a few single marks update the
 * nearest directions, as mergeScan does.
 */
export function applyScan(stops: SkylineStop[], marks: { bearing: number; elevation: number }[], base: number[]): SkylineStop[] {
  const sweep = profileToStops(marks)
  if (sweep.length < SWEEP_MIN_SLICES) return mergeScan(stops, marks, base)
  const from = sweep[0].bearing - 10
  const to = sweep[sweep.length - 1].bearing + 10
  return [...stops.filter((s) => s.bearing < from || s.bearing > to), ...sweep]
}

export interface SunPathPoint {
  hour: number
  azimuth: number
  elevation: number
  /** True when the skyline hides the sun at this moment. */
  blocked: boolean
}

/** The sun's track across the sky on the three sample days, every 15 minutes, marked where the skyline hides it. */
export function sunPaths(horizon: number[], lat: number): { season: Season; points: SunPathPoint[] }[] {
  return seasonsFor(lat).map((season) => {
    const points: SunPathPoint[] = []
    for (let h = 4.5; h <= 19.5; h += 0.25) {
      const sun = sunPosition(season, h)
      if (sun.elevation <= 0) continue
      // The open-sky baseline is ~3° of haze, not an obstacle: only a skyline above that counts as hiding the sun.
      const sky = horizonAt(horizon, sun.azimuth)
      points.push({ hour: h, ...sun, blocked: sky > 3.5 && sun.elevation < sky })
    }
    return { season, points }
  })
}

/** Time ranges (solar time, hours) when the skyline hides the sun, e.g. [[7.25, 8.75], [16, 17.5]]. */
export function blockedRanges(points: SunPathPoint[]): [number, number][] {
  const out: [number, number][] = []
  for (const p of points) {
    if (!p.blocked) continue
    const last = out[out.length - 1]
    if (last && p.hour - last[1] < 0.26) last[1] = p.hour
    else out.push([p.hour, p.hour])
  }
  return out.map(([a, b]) => [a, b + 0.25])
}

/** 135 -> "SE" */
export const shortCompass = (bearing: number) =>
  compassName(bearing)
    .split('-')
    .map((w) => w[0].toUpperCase())
    .join('')

const COMPASS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
]

export function compassName(bearing: number): string {
  return COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]
}

export function tallestDirection(horizon: number[]): string {
  let best = 0
  horizon.forEach((v, i) => {
    if (v > horizon[best]) best = i
  })
  return compassName(best * 10)
}

/** Share of the year's sun below which a spot is shown fully red. Installers avoid spots that lose 20%+. */
export const HEAT_RED_BELOW = 0.8
/** Share of the year's sun at or above which a spot is shown fully green (practically unshaded). */
export const HEAT_GREEN_FROM = 0.97

/** Red (loses 20%+ of its sun) through yellow to green (practically no shade). */
export function scoreColor(score: number, alpha = 0.62): string {
  const s = clamp((score - HEAT_RED_BELOW) / (HEAT_GREEN_FROM - HEAT_RED_BELOW), 0, 1)
  return `hsl(${Math.round(s * 125)} 78% 44% / ${alpha})`
}

/** 13.5 -> "1:30 pm". Rounds to 10 minutes so the clock ticks smoothly while the day plays. */
export function formatHour(hour: number): string {
  const total = Math.round((hour * 60) / 10) * 10
  const h = Math.floor(total / 60)
  const m = String(total % 60).padStart(2, '0')
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${suffix}`
}
