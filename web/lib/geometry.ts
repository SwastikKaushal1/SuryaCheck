import type { Point } from './mockData'

export const MAP_W = 400
export const MAP_H = 300

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

export function polygonArea(poly: Point[]): number {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

export function polygonBounds(poly: Point[]) {
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY }
}

export function polygonCentroid(poly: Point[]): Point {
  const n = poly.length || 1
  return {
    x: poly.reduce((s, p) => s + p.x, 0) / n,
    y: poly.reduce((s, p) => s + p.y, 0) / n,
  }
}

export function scalePolygon(poly: Point[], about: Point, factor: number): Point[] {
  return poly.map((p) => ({
    x: about.x + (p.x - about.x) * factor,
    y: about.y + (p.y - about.y) * factor,
  }))
}

export function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Point[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }
  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

export function rectCorners(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ]
}

export const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** True when two convex shapes overlap by more than touching (separating-axis test). */
export function convexOverlap(a: Point[], b: Point[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const nx = q.y - p.y
      const ny = p.x - q.x
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity
      for (const v of a) { const d = v.x * nx + v.y * ny; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d) }
      for (const v of b) { const d = v.x * nx + v.y * ny; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d) }
      if (aMax <= bMin + 1e-9 || bMax <= aMin + 1e-9) return false
    }
  }
  return true
}

export const toPoints = (poly: Point[]) => poly.map((p) => `${p.x},${p.y}`).join(' ')

export function clientToMap(svg: SVGSVGElement | null, clientX: number, clientY: number): Point {
  if (!svg) return { x: 0, y: 0 }
  const ctm = svg.getScreenCTM()
  if (ctm) {
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const local = pt.matrixTransform(ctm.inverse())
    return { x: clamp(local.x, 0, MAP_W), y: clamp(local.y, 0, MAP_H) }
  }
  const rect = svg.getBoundingClientRect()
  return {
    x: clamp(((clientX - rect.left) / rect.width) * MAP_W, 0, MAP_W),
    y: clamp(((clientY - rect.top) / rect.height) * MAP_H, 0, MAP_H),
  }
}
