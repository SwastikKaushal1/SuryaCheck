import { skylineLossPct } from '../lib/solar'
import { buildPlanModel, DEFAULT_PANEL, TILTS } from '../lib/plan'
import { financeParamsFrom, FALLBACK_REFERENCE } from '../lib/reference'
import { GEO_MPU, lngLatToUnits, unitsToLngLat } from '../lib/geo'
import { polygonArea, pointInPolygon, rectCorners } from '../lib/geometry'
let fails = 0
const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++ }

const f = { lat: 28.5245, lng: 77.2066 }
const b = unitsToLngLat(f, { x: 260, y: 90 }), r = lngLatToUnits(f, b)
ok(Math.abs(r.x - 260) < 1e-6 && Math.abs(r.y - 90) < 1e-6, 'geo round trip')

const ring = (W: number, H: number, deg = 15) => { const t = deg * Math.PI / 180
  return [[-W/2,-H/2],[W/2,-H/2],[W/2,H/2],[-W/2,H/2]].map(([x,y]) => ({ x: 200 + (x*Math.cos(t)-y*Math.sin(t))/GEO_MPU, y: 150 + (x*Math.sin(t)+y*Math.cos(t))/GEO_MPU })) }
const mk = (W: number, H: number) => { const p = ring(W, H); return { points: p, areaM2: Math.round(polygonArea(p)*GEO_MPU**2), metersPerUnit: GEO_MPU, source: 'detected' as const } }
// PVGIS-like: best near 25 deg, ~1600 kWh/kWp
const yields: Record<string, number> = {}; TILTS.forEach(t => yields[String(t)] = 1600 - Math.abs(t - 25) * 4)
const fp = financeParamsFrom(FALLBACK_REFERENCE, 'DL')
const base = { obstacles: [], neighbours: [], flush: false, latitude: 28.5, panel: DEFAULT_PANEL, yields, fallbackYield: 1450, skyline: null, financeParams: fp, eligible: true }
const units = (u: number) => u * 12

const big = mk(14.7, 11)  // ~162 m2, fits ~26+ panels
const small = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(385) })   // Rs2500 bill
console.log('Rs2500 bill ->', small.numbers, 'tilt', small.tilt)
ok(small.numbers.limitedBy === 'bill', 'a modest bill is limited by the bill, not the roof')
ok(small.numbers.panelsFinal <= 8 && small.numbers.panelsFinal >= 4, `Rs2500 bill gets a small system (${small.numbers.panelsFinal} panels, ${small.numbers.kWp} kW)`)
ok(small.numbers.coverage! >= 1 && small.numbers.coverage! < 1.25, `covers ~100% of use (${(small.numbers.coverage!*100).toFixed(0)}%)`)
ok(small.numbers.panelsFit > small.numbers.panelsFinal, 'roof could hold more than we recommend')
ok(small.panels.length === small.numbers.panelsFinal, 'only recommended panels are drawn')
ok(small.tilt >= 15 && small.tilt <= 30, `chosen tilt is sensible (${small.tilt})`)

const huge = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000) })
ok(huge.numbers.limitedBy === 'roof' && huge.numbers.panelsFinal === huge.numbers.panelsFit, `huge bill uses the whole roof (${huge.numbers.panelsFinal})`)
ok(huge.numbers.coverage! < 1, `and says it only covers part (${(huge.numbers.coverage!*100).toFixed(0)}%)`)
ok(huge.tilt <= small.tilt, `roof-limited house prefers a lower tilt to fit more (${huge.tilt} vs ${small.tilt})`)

const tinyRoof = buildPlanModel({ ...base, roof: mk(5, 4), consumptionKwhYear: units(385) })
ok(tinyRoof.numbers.limitedBy === 'roof' && tinyRoof.numbers.coverage! < 1, `small roof is the limit (${tinyRoof.numbers.panelsFinal} panels, ${(tinyRoof.numbers.coverage!*100).toFixed(0)}%)`)

const mid = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(150) })
ok(mid.numbers.panelsFinal < small.numbers.panelsFinal, 'smaller bill => fewer panels')

const none = buildPlanModel({ ...base, roof: big, consumptionKwhYear: null })
ok(none.numbers.panelsFinal === none.numbers.panelsFit, 'no bill known => size to the roof')

const hy: Record<string, number> = {}; TILTS.forEach(t => hy[String(t)] = yields[String(t)] * 0.85)
const sky = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(385), skyline: { lossPct: 15, yields: hy, source: 'pvgis' } })
ok(sky.numbers.panelsFinal > small.numbers.panelsFinal, `skyline shade => a few more panels to compensate (${small.numbers.panelsFinal} -> ${sky.numbers.panelsFinal})`)
ok(sky.numbers.kWhFinal < sky.numbers.kWhBefore, 'and before/after energy differ')

const withTank = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000), obstacles: [{ id: 't', kind: 'tank', x: 200, y: 150, w: 26, h: 26, heightM: 2 }] })
ok(withTank.numbers.panelsFit < huge.numbers.panelsFit, 'tank reduces what fits')
ok(small.panels.every(p => rectCorners(p).every(c => pointInPolygon(c, big.points))), 'every panel inside the roof')

const flush = buildPlanModel({ ...base, roof: big, flush: true, consumptionKwhYear: units(6000) })
ok(flush.flush && flush.numbers.panelsFit >= huge.numbers.panelsFit, `flush roof: tilt not chosen, fits as many or more (${flush.numbers.panelsFit})`)
// tall neighbour: casts real shadow on the roof, but only above the height of your own house
const tall = { id: 'n', side: 'W' as const, floors: 6 }
const nbr = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000), neighbours: [tall], houseFloors: 2 })
const nbrNone = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000) })
ok(nbr.numbers.kWhFinal < nbrNone.numbers.kWhFinal, `tall neighbour lowers output (${nbrNone.numbers.kWhFinal} -> ${nbr.numbers.kWhFinal})`)
ok(nbr.shadowsAt(9).length > 0, 'neighbour shadow is drawn')
const lowNbr = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000), neighbours: [tall], houseFloors: 6 })
ok(lowNbr.numbers.kWhFinal >= nbr.numbers.kWhFinal, 'taller own house => less shade from the neighbour')
const placed = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000), neighbours: [{ ...tall, rect: { x: 900, y: 900, w: 60, h: 60 } }], houseFloors: 2 })
ok(placed.numbers.kWhFinal > nbr.numbers.kWhFinal, 'dragged far away => no shade')
const t0 = Date.now(); buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(385) }); ok(Date.now() - t0 < 400, `fast (${Date.now()-t0} ms)`)

// shade check: open sky costs nothing, a closed-in street costs real energy
const flatH = (d: number) => Array.from({ length: 36 }, () => d)
ok(skylineLossPct(flatH(3)) === 0, 'open sky => 0% loss')
ok(skylineLossPct(flatH(30)) > 15, `closed-in street => big loss (${skylineLossPct(flatH(30))}%)`)
ok(skylineLossPct(flatH(30)) > skylineLossPct(flatH(12)), 'taller surroundings => more loss')


// custom items: round shadow, keep-clear zone, heights
import { shadowHull as sh } from '../lib/solar'
const sun0 = { azimuth: 180, elevation: 30 }
const roundObj = { id: 'r', kind: 'custom' as const, shape: 'round' as const, x: 200, y: 150, w: 40, h: 40, heightM: 2 }
const boxObj = { ...roundObj, id: 'b', shape: 'box' as const }
ok(sh(roundObj, sun0, GEO_MPU).length > 8, 'round item casts a rounded shadow outline')
ok(sh(boxObj, sun0, GEO_MPU).length <= 6, 'box item casts a straight-edged shadow')
const zone = { id: 'z', kind: 'clear' as const, x: 200, y: 150, w: 60, h: 120, heightM: 0 }
const withZone = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000), obstacles: [zone] })
ok(withZone.numbers.panelsFit < huge.numbers.panelsFit, `keep-clear zone removes panel spots (${huge.numbers.panelsFit} -> ${withZone.numbers.panelsFit})`)
ok(!withZone.panels.some(p => Math.abs((p.x + p.w / 2) - 200) < 28 && Math.abs((p.y + p.h / 2) - 150) < 58), 'no panel sits inside the keep-clear zone')
const tallBox = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000), obstacles: [{ ...boxObj, heightM: 4 }] })
const lowBox = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000), obstacles: [{ ...boxObj, heightM: 0.5 }] })
ok(tallBox.numbers.kWhFinal < lowBox.numbers.kWhFinal, 'a taller custom item never helps yield')

// turned items: the footprint, the shadow and the panel exclusion all follow the angle
import { obstacleFootprint } from '../lib/obstacles'
import { polygonBounds } from '../lib/geometry'
const bar = { id: 'bar', kind: 'clear' as const, x: 200, y: 150, w: 80, h: 16, heightM: 0 }
const fpFlat = polygonBounds(obstacleFootprint(bar))
const fpTurned = polygonBounds(obstacleFootprint({ ...bar, angle: 90 }))
ok(Math.abs(fpFlat.w - 80) < 1e-6 && Math.abs(fpTurned.w - 16) < 1e-6 && Math.abs(fpTurned.h - 80) < 1e-6, 'a box turned 90 degrees swaps its width and length')
const turnedBox = { ...boxObj, w: 60, h: 12, angle: 90, heightM: 3 }
const flatShadow = polygonBounds(sh({ ...turnedBox, angle: 0 }, { azimuth: 90, elevation: 30 }, GEO_MPU))
const turnedShadow = polygonBounds(sh(turnedBox, { azimuth: 90, elevation: 30 }, GEO_MPU))
ok(Math.abs(flatShadow.h - turnedShadow.h) > 20, 'turning an item changes the shadow it throws')
const turnedBar = { ...bar, w: 90, h: 18, angle: 40 }
const withBar = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000), obstacles: [turnedBar] })
ok(withBar.numbers.panelsFit < huge.numbers.panelsFit, `a turned keep-clear zone removes panel spots (${huge.numbers.panelsFit} -> ${withBar.numbers.panelsFit})`)
const barShape = obstacleFootprint(turnedBar)
ok(!withBar.panels.some((p) => rectCorners(p).some((c) => pointInPolygon(c, barShape))), 'no panel corner sits inside the turned zone')
const flatBarPlan = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(6000), obstacles: [{ ...turnedBar, angle: 0 }] })
ok(withBar.numbers.panelsFit >= flatBarPlan.numbers.panelsFit - 6, 'a diagonal zone is not treated as a huge bounding box')

// sloped / sheet roofs ignore tanks marked while the roof was set to flat
const flushTank = buildPlanModel({ ...base, roof: big, flush: true, consumptionKwhYear: units(6000), obstacles: [{ ...boxObj, heightM: 4 }] })
ok(flushTank.numbers.panelsFit === flush.numbers.panelsFit && flushTank.obstacles.length === 0, 'flush roof: leftover obstacles neither block panels nor show')

// on-device finance gives the same numbers as backend finance.compute
// (backend, no state top-up: kwp 3, tariff 6.5, bill 3000/month, 1500 kWh/kWp -> cost 170000-220000, subsidy 78000, savings 29250, payback 3.1-4.9)
import { calcFinance, emiFor, loanPlan } from '../lib/finance'
const local = calcFinance(3, 4500, (3000 / 6.5) * 12, true, { ...fp, tariff: 6.5 })
ok(local.costRange[0] === 170000 && local.costRange[1] === 220000, `local cost matches backend (${local.costRange})`)
ok(local.subsidy === 78000 && local.netCostRange[0] === 92000 && local.netCostRange[1] === 142000, 'local subsidy and net cost match backend')
ok(local.savingsYearRange[0] === 29250 && local.paybackRange[0] === 3 && local.paybackRange[1] === 5, `local savings/payback match backend (${local.savingsYearRange}, ${local.paybackRange})`)
const delhi = (kW: number) => calcFinance(kW, kW * 1500, null, true, { ...fp, tariff: 6.1, subsidy: { ...fp.subsidy, statePerKw: 10000, stateCap: 30000 } })
ok(delhi(3).subsidy === 108000 && delhi(1.1).subsidy === 33000 + 11000, `Delhi top-up is per kW, capped (3 kW ${delhi(3).subsidy}, 1.1 kW ${delhi(1.1).subsidy})`)
const over = calcFinance(3, 4500, 2000, true, { ...fp, tariff: 6.5 })
ok(over.savingsYearRange[0] === 13000 && over.notes.length === 1, 'energy beyond what you use earns nothing')

// skyline does not count a tall neighbour a second time
import { withoutNeighbours } from '../lib/neighbours'
const west = [{ id: 'w', side: 'W' as const, floors: 6 }]
const street = flatH(20)
const adj = withoutNeighbours(street, west, big.points, GEO_MPU, 2)
ok(adj[27] === 3 && adj[9] === 20, `west neighbour clears the west skyline only (W ${adj[27]}, E ${adj[9]})`)
ok(withoutNeighbours(flatH(60), west, big.points, GEO_MPU, 2)[27] === 60, 'skyline taller than the neighbour is kept')
ok(withoutNeighbours(street, [], big.points, GEO_MPU) === street, 'no neighbours => skyline unchanged')

// EMI next to savings
ok(Math.abs(emiFor(100000, 7, 10) - 1161) < 1, `EMI matches the standard formula (${emiFor(100000, 7, 10).toFixed(0)} for 1 lakh, 7%, 10 yr)`)
const lp = loanPlan(local, { ratePct: 7, years: 10, maxAmount: 200000 })!
ok(lp.loanRange[1] === 142000 && lp.upfrontRange[1] === 0 && lp.monthlySavings === Math.round(29250 / 12), 'loan covers the cost after subsidy')
ok(lp.paysFromDayOne === (lp.emiRange[1] <= lp.monthlySavings), `pays-from-day-one flag is honest (EMI ${lp.emiRange}, saves ${lp.monthlySavings})`)
const capped = loanPlan({ ...local, netCostRange: [250000, 300000] }, { ratePct: 7, years: 10, maxAmount: 200000 })!
ok(capped.loanRange[1] === 200000 && capped.upfrontRange[1] === 100000, 'cost above the loan limit is paid up front')

// monthly chart keeps the plan's yearly total
import { monthlyFromShape } from '../lib/plan'
const months = monthlyFromShape(5280, [100, 110, 140, 150, 155, 130, 110, 105, 120, 130, 110, 95])
ok(Math.abs(months.reduce((a, b) => a + b, 0) - 5280) < 1e-6 && months[4] > months[6], 'monthly split adds up to the year and keeps the monsoon dip')
import { formatHour } from '../lib/solar'
ok(formatHour(13.5) === '1:30 pm' && formatHour(7) === '7:00 am' && formatHour(11.99) === '12:00 pm', `formatHour (${formatHour(13.5)}, ${formatHour(11.99)})`)


// sun position follows the real solar equations (Delhi), not a fixed 7 am - 5 pm day
import { seasonsFor as sf, sunPosition as sp, scoreColor as sc } from '../lib/solar'
const [win, eqx, sum] = sf(28.6)
ok(Math.abs(sp(win, 12).elevation - 38) < 1 && Math.abs(sp(sum, 12).elevation - 85) < 1, 'noon sun: 38° in winter, 85° in summer')
ok(Math.abs(sp(sum, 7).elevation - 24) < 1.5 && sp(sum, 6).elevation > 8, `summer 7 am sun is ~24° up, not on the horizon (${sp(sum, 7).elevation.toFixed(0)}°)`)
ok(sp(win, 6).elevation < 0 && Math.abs(sp(eqx, 18).elevation) < 1, 'sun is down before winter sunrise and sets at 6 pm on the equinox')
ok(Math.abs(sp(win, 9).azimuth - 135) < 2 && Math.abs(sp(win, 12).azimuth - 180) < 0.5, 'winter morning sun in the south-east, noon sun due south')

// heatmap: honest colours, nothing drawn on top of solid items
const hueOf = (s: number) => Number(sc(s).match(/hsl\((\d+)/)![1])
ok(hueOf(1) > 110 && hueOf(0.7) === 0 && hueOf(0.88) < 70, 'a spot losing 30% of its sun is red; only near-unshaded spots are green')
const room = { id: 'room', kind: 'stairs' as const, x: 200, y: 150, w: 46, h: 77, heightM: 3 }
const withRoom = buildPlanModel({ ...base, roof: big, consumptionKwhYear: units(385), obstacles: [room] })
const roomShape = obstacleFootprint(room)
ok(!withRoom.heatCells.some((c) => pointInPolygon({ x: c.x + c.w / 2, y: c.y + c.h / 2 }, roomShape)), 'no heat square is drawn on top of the room')
const near = (dx: number, dy: number) => withRoom.heatCells.reduce((b, c) => (Math.hypot(c.x + c.w / 2 - (200 + dx), c.y + c.h / 2 - (150 + dy)) < Math.hypot(b.x + b.w / 2 - (200 + dx), b.y + b.h / 2 - (150 + dy)) ? c : b))
ok(near(0, -60).score < near(0, 60).score && near(0, 60).score > 0.97, `north of the room gets less sun than south (${near(0, -60).score.toFixed(2)} vs ${near(0, 60).score.toFixed(2)})`)

// phone skyline scan: sensor angles -> where the back camera points, and marks -> skyline directions
import { aimFromOrientation, averageBearing } from '../lib/orientation'
import { mergeScan } from '../lib/solar'
const aimS = aimFromOrientation(180, 110, 0), aimE = aimFromOrientation(270, 90, 0)
ok(Math.round(aimS.bearing) === 180 && Math.round(aimS.elevation) === 20, `phone upright facing south, tilted back 20° -> S, 20° up (${aimS.bearing.toFixed(0)}°, ${aimS.elevation.toFixed(0)}°)`)
ok(Math.round(aimE.bearing) === 90 && Math.round(aimE.elevation) === 0, 'phone upright facing east -> E, level')
ok(Math.round(averageBearing([350, 10])) % 360 === 0, 'averaging bearings works across north')
const baseStops = [90, 135, 180, 225, 270].map((b) => ({ id: `s${b}`, label: String(b), bearing: b, elevation: 3, scannedElevation: 3 }))
const merged = mergeScan(baseStops, [{ bearing: 140, elevation: 25 }, { bearing: 200, elevation: 18 }, { bearing: 296, elevation: 12 }, { bearing: 10, elevation: 30 }, { bearing: 142, elevation: 27 }], Array(36).fill(3))
ok(merged.find((s) => s.bearing === 135)!.elevation === 27, 'a mark near SE updates SE (last mark wins)')
ok(merged.find((s) => s.bearing === 180)!.elevation === 18 && merged.some((s) => s.bearing === 296 && s.elevation === 12 && s.added), 'a mark snaps to the nearest direction; one past the last direction is added')
ok(!merged.some((s) => s.bearing === 10) && merged.length === 6, 'marks facing north are left out')
// phone sweep: dense readings -> fine skyline, a narrow tower stays narrow, and the sun's hidden times
import { applyScan, blockedRanges, profileToStops, sunPaths } from '../lib/solar'
const sweep = Array.from({ length: 49 }, (_, i) => 60 + i * 5).map((b) => ({ bearing: b, elevation: b === 150 || b === 155 ? 35 : 4 })) // a tower at ~152°
const sweepStops = profileToStops(sweep)
ok(sweepStops.length === 25 && sweepStops.find((s) => s.bearing === 150)!.elevation === 35, `a sweep becomes one point per 10° and keeps the tower (${sweepStops.length} points)`)
ok(sweepStops.filter((s) => s.elevation > 10).length <= 2, 'the narrow tower stays narrow (at most 2 slices tall)')
const applied = applyScan(baseStops, sweep, Array(36).fill(3))
ok(applied.length === 25 && !applied.some((s) => s.id === 's135'), 'a sweep replaces the 5 default directions it covers')
ok(applyScan(baseStops, [{ bearing: 140, elevation: 20 }], Array(36).fill(3)).length === 5, 'a single mark still just updates the nearest direction')
const towerHorizon = Array.from({ length: 36 }, (_, i) => (i === 15 || i === 16 ? 40 : 3)) // a 40° block at 150-160°
const winterPath = sunPaths(towerHorizon, 28.6)[0].points
const hidden = blockedRanges(winterPath)
ok(hidden.length === 1 && hidden[0][0] > 8.5 && hidden[0][1] < 12, `a tall block to the south-south-east hides the winter sun only for a while in the morning (${hidden.map(([a, b]) => `${a}-${b}`).join(', ')})`)
ok(blockedRanges(sunPaths(Array(36).fill(3), 28.6)[1].points).length === 0, 'open sky: the equinox sun is never hidden')
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0)
