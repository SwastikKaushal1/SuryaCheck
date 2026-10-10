import { polygonBounds, rectCorners } from './geometry'
import type { Neighbour, Obstacle, Point } from './mockData'

/** How much taller than your roof one "floor" is. */
export const FLOOR_HEIGHT_M = 3
const GAP_M = 2 // lane or setback between your wall and theirs
const DEPTH_M = 6 // how far the neighbouring building reaches away from you
const OVERHANG_M = 3 // it runs a little past both ends of your roof

/**
 * The building we draw (and cast shadows from) for a tall neighbour: a block that runs along
 * the matching edge of your roof, so on the west side it stands as a vertical bar.
 */
export function neighbourBlock(n: Neighbour, roof: Point[], mpu: number, houseFloors = 0): Obstacle {
  const b = polygonBounds(roof)
  const gap = GAP_M / mpu
  const depth = DEPTH_M / mpu
  const over = OVERHANG_M / mpu
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  // Only the part above your own roof throws shade on it.
  const base = { id: n.id, kind: 'stairs' as const, heightM: Math.max(0, n.floors - houseFloors) * FLOOR_HEIGHT_M }
  if (n.rect) return { ...base, ...n.rect }
  switch (n.side) {
    case 'N':
      return { ...base, x: cx, y: b.minY - gap - depth / 2, w: b.w + 2 * over, h: depth }
    case 'S':
      return { ...base, x: cx, y: b.maxY + gap + depth / 2, w: b.w + 2 * over, h: depth }
    case 'E':
      return { ...base, x: b.maxX + gap + depth / 2, y: cy, w: depth, h: b.h + 2 * over }
    case 'W':
      return { ...base, x: b.minX - gap - depth / 2, y: cy, w: depth, h: b.h + 2 * over }
  }
}

/** Skyline height with nothing in the way (same as the open-sky horizon in mockData). */
const OPEN_SKY_DEG = 3

/** Compass bearing (clockwise from north) from a to b, in map units where y points south. */
const bearingTo = (a: Point, b: Point) => (((Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI) + 360) % 360
/** Signed degrees from bearing `from` to bearing `to`, in -180..180. */
const turn = (from: number, to: number) => ((to - from + 540) % 360) - 180

/**
 * Tall neighbours already cast real shadows in the plan. The skyline step would count the same
 * buildings again, so in the directions a neighbour covers, skyline heights no taller than that
 * neighbour (as seen from the middle of the roof) are treated as open sky.
 */
export function withoutNeighbours(horizon: number[], neighbours: Neighbour[], roof: Point[], mpu: number, houseFloors = 0): number[] {
  if (!neighbours.length) return horizon
  const b = polygonBounds(roof)
  const mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
  const sectors = neighbours.map((n) => {
    const o = neighbourBlock(n, roof, mpu, houseFloors)
    const x0 = o.x - o.w / 2
    const y0 = o.y - o.h / 2
    const centre = bearingTo(mid, o)
    const offsets = rectCorners({ x: x0, y: y0, w: o.w, h: o.h }).map((c) => turn(centre, bearingTo(mid, c)))
    const dx = Math.max(x0 - mid.x, 0, mid.x - (x0 + o.w))
    const dy = Math.max(y0 - mid.y, 0, mid.y - (y0 + o.h))
    const distM = Math.max(1, Math.hypot(dx, dy) * mpu)
    return { centre, from: Math.min(...offsets), to: Math.max(...offsets), elevation: (Math.atan(o.heightM / distM) * 180) / Math.PI }
  })
  return horizon.map((h, i) => {
    const covered = sectors.some((s) => {
      const rel = turn(s.centre, i * 10)
      return rel >= s.from && rel <= s.to && h <= s.elevation
    })
    return covered ? Math.min(h, OPEN_SKY_DEG) : h
  })
}

/** Corners of every neighbour block, so a map can zoom out far enough to show them. */
export const neighbourPoints = (neighbours: Neighbour[], roof: Point[], mpu: number, houseFloors = 0): Point[] =>
  neighbours.flatMap((n) => {
    const o = neighbourBlock(n, roof, mpu, houseFloors)
    return rectCorners({ x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h })
  })
