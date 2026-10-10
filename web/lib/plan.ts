import { calcFinance, type FinanceResult } from './finance'
import { clamp, pointInPolygon, polygonBounds, polygonCentroid, rectCorners, rectsOverlap, scalePolygon, type Rect } from './geometry'
import type { FinanceParams, Neighbour, Obstacle, Point, RoofData } from './mockData'
import { neighbourBlock } from './neighbours'
import { castsShadow } from './obstacles'
import { seasonsFor, shadowHull, sunPosition } from './solar'

/** Panel size and power. Live values come from GET /reference. */
export interface PanelSpec {
  widthM: number
  lengthM: number
  gapM: number
  kWp: number
}
export const DEFAULT_PANEL: PanelSpec = { widthM: 1.13, lengthM: 2.28, gapM: 0.03, kWp: 0.55 }
/** Tilts offered on the plan screen; also requested from POST /yield. */
export const TILTS = [5, 10, 15, 20, 25, 30, 35]
const CLEARANCE_M = 0.3
/** Largest roof we plan. Past this the outline is surely not one house, and packing it would freeze the page. */
export const MAX_ROOF_M2 = 3000

export interface UserInputs {
  billMode: 'rupees' | 'units'
  billValue: number
  ownHouse: boolean
  residential: boolean
}
export interface PanelCell extends Rect {
  score: number
  kept: boolean
  /** Degrees the panel is turned to line up with the roof edge (0 when the roof faces due south). */
  angle?: number
}
export interface HeatCell extends Rect {
  score: number
}
export interface PlanNumbers {
  /** Most panels the roof can hold at the chosen tilt. */
  panelsFit: number
  /** Panels we recommend: enough for the household's electricity use, never more than fit. */
  panelsFinal: number
  kWp: number
  /** Yearly energy before the skyline scan, and after it. */
  kWhBefore: number
  kWhFinal: number
  /** 'bill': the system already covers the electricity use. 'roof': the roof is the limit. */
  limitedBy: 'bill' | 'roof'
  /** Share of the household's yearly electricity the system produces (1 = all of it), if known. */
  coverage: number | null
}
/** What the skyline scan did to the roof, measured by PVGIS (or estimated if it was down). */
export interface SkylineLoss {
  lossPct: number
  yields: Record<string, number> | null
  source: 'pvgis' | 'estimate'
}
export interface PlanModel {
  roof: RoofData
  obstacles: Obstacle[]
  neighbours: Neighbour[]
  houseFloors: number
  tilt: number
  skylineLossPct: number
  heatCells: HeatCell[]
  panels: PanelCell[]
  numbers: PlanNumbers
  finance: FinanceResult
  /** True when panels lie flat on a sloped or sheet roof, so no tilt was chosen. */
  flush: boolean
  shadowsAt: (hour: number) => Point[][]
}
export interface PlanArgs {
  roof: RoofData
  obstacles: Obstacle[]
  neighbours: Neighbour[]
  /** Floors in your own house. A neighbour only shades you above this height. */
  houseFloors?: number
  /** Sloped / sheet roofs: panels lie flat, rows need no extra spacing. */
  flush: boolean
  latitude: number
  panel: PanelSpec
  yields: Record<string, number> | null
  fallbackYield: number
  /** Household electricity use per year in kWh. Null means size to the roof. */
  consumptionKwhYear: number | null
  skyline: SkylineLoss | null
  financeParams: FinanceParams
  eligible: boolean
}

const round10 = (n: number) => Math.round(n / 10) * 10
const rad = (deg: number) => (deg * Math.PI) / 180

/** How far the roof's longest edge is from running east-west, in degrees. Zero when it is too skewed to follow. */
export function roofAngle(points: Point[]): number {
  let best = 0
  let angle = 0
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]
    const len = Math.hypot(q.x - p.x, q.y - p.y)
    if (len > best) {
      best = len
      angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI
    }
  })
  let m = ((angle % 90) + 90) % 90
  if (m > 45) m -= 90
  return Math.abs(m) <= 25 ? Math.round(m * 10) / 10 : 0
}

export function buildPlanModel(args: PlanArgs): PlanModel {
  const { roof, neighbours, houseFloors = 0, flush, latitude, panel, yields, fallbackYield, skyline, consumptionKwhYear } = args
  // Sloped and sheet roofs are used as they are: the obstacles screen hides tanks and rooms for them,
  // so any marked while the roof was set to flat must not block panels or cast shadows here.
  const obstacles = flush ? [] : args.obstacles
  const mpu = roof.metersPerUnit
  const bounds = polygonBounds(roof.points)
  const lossFrac = (skyline?.lossPct ?? 0) / 100
  const seasons = seasonsFor(latitude)

  const blocks = neighbours.map((n) => neighbourBlock(n, roof.points, mpu, houseFloors))
  const hullsAt = (sun: { azimuth: number; elevation: number }) => [
    ...obstacles.filter(castsShadow).map((o) => shadowHull(o, sun, mpu)),
    ...blocks.map((o) => shadowHull(o, sun, mpu, 40)),
  ]
  const samples: { weight: number; hulls: Point[][] }[] = []
  for (const season of seasons) {
    for (let h = 7; h <= 17; h += 0.5) {
      const sun = sunPosition(season, h)
      if (sun.elevation <= 1) continue
      samples.push({ weight: Math.sin(rad(sun.elevation)), hulls: hullsAt(sun) })
    }
  }
  const totalWeight = samples.reduce((s, x) => s + x.weight, 0) || 1
  const southness = (y: number) => clamp((y - bounds.minY) / (bounds.h || 1), 0, 1)

  function shade(p: Point): number {
    let lit = 0
    for (const s of samples) if (!s.hulls.some((hull) => pointInPolygon(p, hull))) lit += s.weight
    const v = lit / totalWeight
    return clamp(v, 0, 1)
  }
  const score = (p: Point) => clamp(shade(p) * (1 - lossFrac * (0.45 + 0.9 * southness(p.y))), 0, 1)

  const heatCells: HeatCell[] = []
  const pitch = 14
  for (let y = bounds.minY; y < bounds.maxY; y += pitch)
    for (let x = bounds.minX; x < bounds.maxX; x += pitch) {
      const c = { x: x + pitch / 2, y: y + pitch / 2 }
      if (pointInPolygon(c, roof.points)) heatCells.push({ x, y, w: pitch, h: pitch, score: score(c) })
    }

  const usable = scalePolygon(roof.points, polygonCentroid(roof.points), 0.93)
  const clearance = CLEARANCE_M / mpu
  const blocked: Rect[] = obstacles.map((o) => ({
    x: o.x - o.w / 2 - clearance,
    y: o.y - o.h / 2 - clearance,
    w: o.w + 2 * clearance,
    h: o.h + 2 * clearance,
  }))
  const winterNoon = seasons[0].peak

  // Rows follow the roof's own edge when it is only a little off true south, the way an installer lays them.
  const theta = roofAngle(roof.points)
  const about = polygonCentroid(roof.points)
  const spin = (p: Point, deg: number): Point => {
    const a = rad(deg)
    const dx = p.x - about.x
    const dy = p.y - about.y
    return { x: about.x + dx * Math.cos(a) - dy * Math.sin(a), y: about.y + dx * Math.sin(a) + dy * Math.cos(a) }
  }
  const usableR = usable.map((p) => spin(p, -theta))
  const boundsR = polygonBounds(usableR)
  const blockedR: Rect[] = blocked.map((r) => {
    const bb = polygonBounds(rectCorners(r).map((p) => spin(p, -theta)))
    return { x: bb.minX, y: bb.minY, w: bb.w, h: bb.h }
  })

  /** Every spot a panel fits at this tilt, in the turned frame where rows run left to right. */
  function pack(tiltDeg: number): Rect[] {
    const t = rad(tiltDeg)
    const depthM = panel.lengthM * Math.cos(t)
    const shadowM = flush ? 0 : (panel.lengthM * Math.sin(t)) / Math.tan(rad(winterNoon))
    const pw = panel.widthM / mpu
    const ph = depthM / mpu
    const stepX = (panel.widthM + panel.gapM) / mpu
    const stepY = (depthM + shadowM + panel.gapM) / mpu
    const gridFor = (ox: number, oy: number): Rect[] => {
      const cells: Rect[] = []
      for (let y = boundsR.minY + oy; y + ph <= boundsR.maxY; y += stepY)
        for (let x = boundsR.minX + ox; x + pw <= boundsR.maxX; x += stepX) {
          const r = { x, y, w: pw, h: ph }
          if (rectCorners(r).every((c) => pointInPolygon(c, usableR)) && !blockedR.some((b) => rectsOverlap(r, b))) cells.push(r)
        }
      return cells
    }
    let best: Rect[] = []
    for (const fx of [0, 0.25, 0.5, 0.75])
      for (const fy of [0, 0.25, 0.5, 0.75]) {
        const cells = gridFor(fx * stepX, fy * stepY)
        if (cells.length > best.length) best = cells
      }
    return best
  }

  // ---- size the system, then choose the tilt ---------------------------------------------
  /** Sloped and sheet roofs keep their own slope; their yield is read at this tilt. */
  const FLUSH_YIELD_TILT = 20
  const options = flush
    ? [{ tilt: FLUSH_YIELD_TILT, packTilt: 0 }]
    : TILTS.map((t) => ({ tilt: t, packTilt: t }))
  const need = consumptionKwhYear && consumptionKwhYear > 0 ? consumptionKwhYear : null

  const rows = options.map(({ tilt, packTilt }) => {
    const k = String(tilt)
    const clear = yields?.[k] ?? fallbackYield
    const skyFactor = skyline && clear > 0 ? clamp((skyline.yields?.[k] ?? clear * (1 - lossFrac)) / clear, 0, 1) : 1

    const scored = pack(packTilt).map((r) => {
      const world = spin({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, theta)
      const sh = shade(world)
      const clearKwh = panel.kWp * clear * sh
      return { ...r, cx: world.x, cy: world.y, score: score(world), clearKwh, finalKwh: clearKwh * skyFactor }
    })
    type Cell = (typeof scored)[number]
    const fit = scored.length

    // Where to start: the best-lit spot closest to the middle of the usable roof.
    const mid = fit
      ? { x: scored.reduce((t, c) => t + c.x + c.w / 2, 0) / fit, y: scored.reduce((t, c) => t + c.y + c.h / 2, 0) / fit }
      : { x: 0, y: 0 }
    const bestScore = scored.reduce((m, c) => Math.max(m, c.score), 0)
    let seed: Cell | null = null
    let seedDist = Infinity
    for (const c of scored) {
      if (c.score < bestScore - 0.03) continue
      const d = Math.hypot(c.x + c.w / 2 - mid.x, c.y + c.h / 2 - mid.y)
      if (d < seedDist) {
        seed = c
        seedDist = d
      }
    }
    const from = seed ? { x: seed.x + seed.w / 2, y: seed.y + seed.h / 2 } : mid
    const away = (c: Cell) => Math.hypot(c.x + c.w / 2 - from.x, c.y + c.h / 2 - from.y)
    const ordered = [...scored].sort((a, b) => Math.round(b.score * 12) - Math.round(a.score * 12) || away(a) - away(b))
    const rowsByY = new Map<string, Cell[]>()
    for (const c of scored) {
      const key = c.y.toFixed(1)
      rowsByY.set(key, [...(rowsByY.get(key) ?? []), c])
    }
    const rowList = [...rowsByY.values()].sort((a, b) => Math.abs(a[0].y + a[0].h / 2 - from.y) - Math.abs(b[0].y + b[0].h / 2 - from.y))

    /** n panels as a tidy block: whole rows, centred on the start spot, about as tall as it is wide. */
    const block = (n: number): Cell[] => {
      if (n >= fit) return ordered
      const rowsWanted = Math.max(1, Math.round(Math.sqrt(n / 3)))
      const perRow = Math.ceil(n / rowsWanted)
      const chosen = new Set<Cell>()
      for (const row of rowList.slice(0, rowsWanted))
        [...row].sort((a, b) => Math.abs(a.x + a.w / 2 - from.x) - Math.abs(b.x + b.w / 2 - from.x)).slice(0, perRow).forEach((c) => chosen.add(c))
      let list = [...chosen]
      if (list.length > n) list = list.sort((a, b) => away(a) - away(b)).slice(0, n)
      for (const c of ordered) {
        if (list.length >= n) break
        if (!chosen.has(c)) list.push(c)
      }
      return list
    }
    const energy = (list: Cell[]) => list.reduce((t, c) => t + c.finalKwh, 0)

    // Fewest panels whose yearly output covers the household's use.
    let chosen: Cell[] = ordered
    let limitedBy: PlanNumbers['limitedBy'] = 'roof'
    if (need !== null) {
      // No panel makes more than the best one, so fewer than need / best can never be enough. Start there.
      const bestKwh = scored.reduce((m, c) => Math.max(m, c.finalKwh), 0)
      const start = bestKwh > 0 ? Math.max(1, Math.ceil(need / bestKwh)) : fit + 1
      for (let n = start; n <= fit; n++) {
        const list = block(n)
        if (energy(list) >= need) {
          chosen = list
          limitedBy = 'bill'
          break
        }
      }
    }
    const count = chosen.length
    const kWhFinal = energy(chosen)
    const numbers: PlanNumbers = {
      panelsFit: fit,
      panelsFinal: count,
      kWp: Math.round(count * panel.kWp * 100) / 100,
      kWhBefore: round10(chosen.reduce((t, c) => t + c.clearKwh, 0)),
      kWhFinal: round10(kWhFinal),
      limitedBy,
      coverage: need !== null ? kWhFinal / need : null,
    }
    // What a household can actually use: energy beyond its own consumption earns little.
    const useful = need !== null ? Math.min(kWhFinal, need) : kWhFinal
    return { tilt, cells: chosen, numbers, useful }
  })

  // Best tilt: the most useful energy; on a near tie, the cheaper system (fewer panels), then the one that makes more energy.
  const row = rows.reduce((best, r) => {
    if (r.useful > best.useful * 1.01) return r
    if (r.useful >= best.useful * 0.99) {
      if (r.numbers.panelsFinal < best.numbers.panelsFinal) return r
      if (r.numbers.panelsFinal === best.numbers.panelsFinal && r.numbers.kWhFinal > best.numbers.kWhFinal) return r
    }
    return best
  })
  const panels: PanelCell[] = row.cells.map((c) => ({
    x: c.cx - c.w / 2,
    y: c.cy - c.h / 2,
    w: c.w,
    h: c.h,
    score: c.score,
    kept: true,
    angle: theta,
  }))

  return {
    roof,
    obstacles,
    neighbours,
    houseFloors,
    tilt: row.tilt,
    skylineLossPct: skyline?.lossPct ?? 0,
    heatCells,
    panels,
    numbers: row.numbers,
    finance: calcFinance(row.numbers.kWp, row.numbers.kWhFinal, need, args.eligible, args.financeParams),
    flush,
    shadowsAt: (hour) => {
      const sun = sunPosition(seasons[0], hour)
      return hullsAt(sun)
    },
  }
}
