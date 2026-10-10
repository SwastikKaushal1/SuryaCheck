import type { Point } from './mockData'

/**
 * Overlay unit space. Everything drawn on the map lives in flat "units", north up, y down.
 * One unit is GEO_MPU metres. A GeoFrame pins unit (200,150) to a real lat/lng (the pin).
 */
export const GEO_MPU = 0.065
export const ANCHOR: Point = { x: 200, y: 150 }

export interface GeoFrame {
  lat: number
  lng: number
}
export interface LngLat {
  lng: number
  lat: number
}

const M_PER_DEG = 111319.4908
const EARTH_CIRCUMFERENCE_M = 40075016.686
const rad = (deg: number) => (deg * Math.PI) / 180

export function lngLatToUnits(frame: GeoFrame, p: LngLat): Point {
  const kx = M_PER_DEG * Math.cos(rad(frame.lat))
  return {
    x: ANCHOR.x + ((p.lng - frame.lng) * kx) / GEO_MPU,
    y: ANCHOR.y - ((p.lat - frame.lat) * M_PER_DEG) / GEO_MPU,
  }
}

export function unitsToLngLat(frame: GeoFrame, p: Point): LngLat {
  const kx = M_PER_DEG * Math.cos(rad(frame.lat))
  return {
    lng: frame.lng + ((p.x - ANCHOR.x) * GEO_MPU) / kx,
    lat: frame.lat - ((p.y - ANCHOR.y) * GEO_MPU) / M_PER_DEG,
  }
}

export const groundResolution = (zoom: number, lat: number) =>
  (EARTH_CIRCUMFERENCE_M * Math.cos(rad(lat))) / (256 * 2 ** zoom)

/** Screen pixels per overlay unit at a Leaflet zoom level. */
export const pxPerUnit = (zoom: number, lat: number) => GEO_MPU / groundResolution(zoom, lat)

export function metresBetween(a: GeoFrame, b: GeoFrame): number {
  const dy = (b.lat - a.lat) * M_PER_DEG
  const dx = (b.lng - a.lng) * M_PER_DEG * Math.cos(rad((a.lat + b.lat) / 2))
  return Math.hypot(dx, dy)
}

/** Douglas-Peucker on a closed ring, so a rounded OSM outline becomes a handful of corners. */
export function simplifyRing(points: Point[], tol: number): Point[] {
  if (points.length <= 4) return points
  const perp = (p: Point, a: Point, b: Point) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y)
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
  }
  const run = (pts: Point[]): Point[] => {
    if (pts.length < 3) return pts
    let far = 0
    let at = -1
    for (let i = 1; i < pts.length - 1; i++) {
      const d = perp(pts[i], pts[0], pts[pts.length - 1])
      if (d > far) {
        far = d
        at = i
      }
    }
    if (far <= tol || at < 0) return [pts[0], pts[pts.length - 1]]
    return [...run(pts.slice(0, at + 1)).slice(0, -1), ...run(pts.slice(at))]
  }
  let a = 0
  let b = 1
  let best = -1
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)
      if (d > best) {
        best = d
        a = i
        b = j
      }
    }
  const first = points.slice(a, b + 1)
  const second = [...points.slice(b), ...points.slice(0, a + 1)]
  const out = [...run(first).slice(0, -1), ...run(second).slice(0, -1)]
  return out.length >= 3 ? out : points
}
