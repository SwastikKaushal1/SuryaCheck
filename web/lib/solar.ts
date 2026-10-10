import { clamp, convexHull, rectCorners } from './geometry'
import type { Obstacle, Point, SkylineStop } from './mockData'
import { isRound } from './obstacles'

export interface Season {
  name: 'winter' | 'equinox' | 'summer'
  peak: number
  azFrom: number
  azTo: number
}

export const WINTER: Season = { name: 'winter', peak: 38, azFrom: 115, azTo: 245 }
export const SEASONS: Season[] = [
  WINTER,
  { name: 'equinox', peak: 61, azFrom: 90, azTo: 270 },
  { name: 'summer', peak: 85, azFrom: 65, azTo: 295 },
]

const rad = (deg: number) => (deg * Math.PI) / 180

/** Noon sun heights at winter solstice / equinox / summer solstice for a latitude (Delhi gives ~38/61/85). */
export function seasonsFor(lat: number): Season[] {
  const eq = 90 - Math.abs(lat)
  const c = (v: number) => clamp(v, 5, 90)
  return [
    { ...WINTER, peak: c(eq - 23.44) },
    { ...SEASONS[1], peak: c(eq) },
    { ...SEASONS[2], peak: c(eq + 23.44) },
  ]
}

/** Toy sun path for Delhi: good enough to move shadows around in a prototype. */
export function sunPosition(season: Season, hour: number) {
  const t = clamp((hour - 7) / 10, 0, 1)
  return {
    azimuth: season.azFrom + (season.azTo - season.azFrom) * t,
    elevation: season.peak * Math.sin(Math.PI * t),
  }
}

export function shadowHull(
  obstacle: Obstacle,
  sun: { azimuth: number; elevation: number },
  metersPerUnit: number,
  /** Longest shadow to draw. Tanks and rooms are short; tall neighbours need more. */
  maxLengthM = 8,
): Point[] {
  const footprint = isRound(obstacle)
    ? Array.from({ length: 20 }, (_, i) => {
        const a = (i / 20) * 2 * Math.PI
        return { x: obstacle.x + (obstacle.w / 2) * Math.cos(a), y: obstacle.y + (obstacle.h / 2) * Math.sin(a) }
      })
    : rectCorners({
        x: obstacle.x - obstacle.w / 2,
        y: obstacle.y - obstacle.h / 2,
        w: obstacle.w,
        h: obstacle.h,
      })
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
    for (let h = 7; h <= 17; h += 0.5) {
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

/** Red (little sun) to green (lots of sun). */
export function scoreColor(score: number, alpha = 0.62): string {
  const s = clamp((score - 0.5) / 0.5, 0, 1)
  return `hsl(${Math.round(s * 125)} 78% 44% / ${alpha})`
}

export function formatHour(hour: number): string {
  const h = Math.floor(hour)
  const m = hour - h >= 0.5 ? '30' : '00'
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${suffix}`
}
