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

/** Corners of every neighbour block, so a map can zoom out far enough to show them. */
export const neighbourPoints = (neighbours: Neighbour[], roof: Point[], mpu: number, houseFloors = 0): Point[] =>
  neighbours.flatMap((n) => {
    const o = neighbourBlock(n, roof, mpu, houseFloors)
    return rectCorners({ x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h })
  })
