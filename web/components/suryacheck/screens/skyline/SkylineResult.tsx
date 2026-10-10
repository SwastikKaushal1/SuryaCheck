import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '../../Button'
import { Card, SectionTitle } from '../../Card'
import { NumberField } from '../../NumberField'
import { Tag } from '../../Tag'
import { clamp } from '@/lib/geometry'
import type { Neighbour, SkylineStop } from '@/lib/mockData'
import { horizonAt, horizonFromStops, skylineLossPct, tallestDirection } from '@/lib/solar'
import { cn } from '@/lib/utils'

const W = 340
const H = 200
const LEFT = 34
const RIGHT = 332
const TOP = 12
const BOTTOM = 168
const MAX_ELEV = 45
const MAX_STOPS = 9

/** Quick starting points for people who do not know skyline angles. Keys are compass bearings. */
const PRESETS: { label: string; hint: string; heights: Record<number, number> }[] = [
  { label: 'Open sky', hint: 'Nothing tall nearby', heights: { 90: 3, 135: 3, 180: 3, 225: 3, 270: 3 } },
  { label: 'Some buildings or trees around', hint: 'Two or three floors, a few trees', heights: { 90: 16, 135: 13, 180: 10, 225: 13, 270: 16 } },
  { label: 'Tall buildings close by', hint: 'A crowded lane or apartment blocks', heights: { 90: 32, 135: 28, 180: 22, 225: 28, 270: 32 } },
]

const SIDE_WORDS: Record<Neighbour['side'], string> = { N: 'north', E: 'east', S: 'south', W: 'west' }
/** ['E', 'W'] -> "east and west side" */
const listSides = (sides: Neighbour['side'][]) => {
  const words = sides.map((s) => SIDE_WORDS[s])
  const joined = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0]
  return `${joined} side${words.length > 1 ? 's' : ''}`
}

const xOf = (bearing: number) => LEFT + ((bearing - 90) / 180) * (RIGHT - LEFT)
const yOf = (elev: number) => BOTTOM - (elev / MAX_ELEV) * (BOTTOM - TOP)

export function SkylineResult({
  stops,
  baseHorizon,
  adjustHorizon,
  neighbourSides = [],
  onChange,
  onReset,
  onApply,
}: {
  stops: SkylineStop[]
  baseHorizon: number[]
  /** Drops the parts of the skyline already counted as tall neighbours. */
  adjustHorizon?: (horizon: number[]) => number[]
  neighbourSides?: Neighbour['side'][]
  onChange: (stops: SkylineStop[]) => void
  onReset: () => void
  onApply: () => void
}) {
  const [selectedId, setSelectedId] = useState(stops[0]?.id ?? '')
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<string | null>(null)

  const sorted = [...stops].sort((a, b) => a.bearing - b.bearing)
  const horizon = horizonFromStops(baseHorizon, stops)
  // The loss we show is the one the plan will use, after leaving out neighbours already counted.
  const counted = adjustHorizon ? adjustHorizon(horizon) : horizon
  const lossPct = skylineLossPct(counted)
  const direction = tallestDirection(counted)
  const selected = stops.find((s) => s.id === selectedId) ?? sorted[0]

  const path = (() => {
    let d = `M${xOf(90)} ${BOTTOM}`
    for (let b = 90; b <= 270; b += 10) d += ` L${xOf(b)} ${yOf(horizon[b / 10])}`
    return `${d} L${xOf(270)} ${BOTTOM} Z`
  })()

  const setElevation = (id: string, elevation: number) =>
    onChange(stops.map((s) => (s.id === id ? { ...s, elevation: clamp(Math.round(elevation), 0, MAX_ELEV) } : s)))

  const elevationFromPointer = (clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const y = ((clientY - rect.top) / rect.height) * H
    return ((BOTTOM - y) / (BOTTOM - TOP)) * MAX_ELEV
  }

  const addStop = () => {
    if (stops.length >= MAX_STOPS) return
    const bearings = [90, ...sorted.map((s) => s.bearing), 270]
    let best = { gap: 0, at: 180 }
    for (let i = 0; i < bearings.length - 1; i++) {
      const gap = bearings[i + 1] - bearings[i]
      if (gap > best.gap) best = { gap, at: Math.round((bearings[i] + gap / 2) / 10) * 10 }
    }
    const elevation = Math.round(horizonAt(horizon, best.at))
    const stop: SkylineStop = {
      id: `stop-added-${best.at}-${stops.length}`,
      label: `${best.at}°`,
      bearing: best.at,
      elevation,
      scannedElevation: elevation,
      added: true,
    }
    onChange([...stops, stop])
    setSelectedId(stop.id)
  }

  const removeStop = (id: string) => {
    const rest = stops.filter((s) => s.id !== id)
    onChange(rest)
    if (selectedId === id) setSelectedId(rest[0]?.id ?? '')
  }

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-5">
      <div className="flex flex-col gap-1 lg:col-span-2">
        <h1 className="text-2xl font-bold text-ink lg:text-3xl">Shade from your surroundings</h1>
        <p className="text-base text-ink-soft">
          Tall buildings and trees block low morning and evening sun. Pick what is closest to your street, then drag the dots to fine-tune.
        </p>
        {neighbourSides.length > 0 && (
          <p className="mt-2 rounded-xl bg-teal-soft p-3 text-sm text-teal-deep">
            {neighbourSides.length > 1
              ? `You already added tall neighbours on the ${listSides(neighbourSides)}. Their shadows are already in your plan, so anything in those directions no taller than them is not counted again here.`
              : `You already added a tall neighbour on the ${listSides(neighbourSides)}. Its shadow is already in your plan, so anything in that direction no taller than it is not counted again here.`}
          </p>
        )}
      </div>

      <Card className="flex flex-col gap-2 p-3 lg:sticky lg:top-[5.5rem] lg:p-5">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          role="group"
          aria-label="Skyline chart, east to west. Each dot is the height of what you see in that direction."
        >
          <rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={BOTTOM - TOP} fill="#FEF3C7" rx="6" />
          {[0, 15, 30, 45].map((e) => (
            <g key={e}>
              <line x1={LEFT} x2={RIGHT} y1={yOf(e)} y2={yOf(e)} stroke="#d6c7a8" strokeWidth="0.6" strokeDasharray="3 3" />
              <text x={LEFT - 5} y={yOf(e) + 3} textAnchor="end" fontSize="9" fill="#6b5b45">
                {e}°
              </text>
            </g>
          ))}
          <path d={path} fill="#0F5C5E" fillOpacity="0.85" stroke="#0a3d3f" strokeWidth="1.5" strokeLinejoin="round" />
          {[
            [90, 'E'],
            [135, 'SE'],
            [180, 'S'],
            [225, 'SW'],
            [270, 'W'],
          ].map(([b, l]) => (
            <text key={l} x={xOf(b as number)} y={BOTTOM + 16} textAnchor="middle" fontSize="10" fontWeight="700" fill="#2b2118">
              {l}
            </text>
          ))}
          {sorted.map((s) => {
            const active = s.id === selected?.id
            const edited = s.elevation !== s.scannedElevation
            return (
              <g
                key={s.id}
                tabIndex={0}
                role="slider"
                aria-label={`${s.label} skyline height`}
                aria-valuemin={0}
                aria-valuemax={MAX_ELEV}
                aria-valuenow={s.elevation}
                aria-valuetext={`${s.elevation} degrees`}
                onFocus={() => setSelectedId(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                    e.preventDefault()
                    setElevation(s.id, s.elevation + 1)
                  }
                  if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                    e.preventDefault()
                    setElevation(s.id, s.elevation - 1)
                  }
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  dragging.current = s.id
                  setSelectedId(s.id)
                }}
                onPointerMove={(e) => {
                  if (dragging.current === s.id) setElevation(s.id, elevationFromPointer(e.clientY))
                }}
                onPointerUp={() => {
                  dragging.current = null
                }}
                className="cursor-grab outline-none focus-visible:[&>circle:last-of-type]:stroke-[4px]"
              >
                <circle cx={xOf(s.bearing)} cy={yOf(s.elevation)} r="20" fill="transparent" />
                <circle
                  cx={xOf(s.bearing)}
                  cy={yOf(s.elevation)}
                  r={active ? 9 : 7}
                  fill={edited ? '#F59E0B' : '#fff'}
                  stroke={active ? '#2b2118' : '#F59E0B'}
                  strokeWidth="2.5"
                />
              </g>
            )
          })}
          <text x={LEFT} y={H - 2} fontSize="8.5" fill="#6b5b45">
            Looking from east to west, height of buildings and trees
          </text>
        </svg>
      </Card>

      <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2" role="group" aria-label="Quick choices">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(stops.map((s) => ({ ...s, elevation: p.heights[s.bearing] ?? s.elevation })))}
            className="min-h-14 rounded-2xl border-2 border-input bg-white px-4 text-left text-base font-semibold text-ink hover:bg-sand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40"
          >
            {p.label}
            <span className="block text-sm font-normal text-ink-soft">{p.hint}</span>
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-2 bg-sun-soft">
        <p className="text-lg font-bold text-ink">
          {lossPct === 0 ? 'Your sky looks open: almost no sun is blocked.' : `Surroundings block about ${lossPct}% of your sun.`}
        </p>
        {lossPct > 0 && <p className="text-base text-ink">The tallest side is {direction}.</p>}
        <Tag kind="estimate" className="self-start" />
      </Card>

      <section aria-label="Stops" className="flex flex-col gap-3">
        <SectionTitle>Directions ({stops.length})</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {sorted.map((s) => {
            const edited = s.elevation !== s.scannedElevation
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === selected?.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  'min-h-12 rounded-2xl border-2 px-4 text-base font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40',
                  s.id === selected?.id ? 'border-teal-deep bg-teal-deep text-white' : 'border-input bg-white text-ink',
                )}
              >
                {s.label} · {s.elevation}°{edited && <span className="sr-only"> edited</span>}
                {edited && <span aria-hidden="true"> *</span>}
              </button>
            )
          })}
        </div>

        {selected && (
          <Card className="flex flex-col gap-3">
            <NumberField
              label={`${selected.label} skyline height`}
              value={String(selected.elevation)}
              onChange={(v) => v !== '' && setElevation(selected.id, Number(v))}
              suffix="degrees"
              min={0}
              max={MAX_ELEV}
              showInputTag={false}
            />
            <p className="text-sm text-ink-soft">Starting value: {selected.scannedElevation}°</p>
            {selected.added && (
              <Button variant="danger" onClick={() => removeStop(selected.id)}>
                <Trash2 className="size-4" aria-hidden="true" />
                Remove this direction
              </Button>
            )}
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={addStop} disabled={stops.length >= MAX_STOPS}>
            <Plus className="size-4" aria-hidden="true" />
            Add a direction
          </Button>
          <Button variant="secondary" onClick={onReset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset to open sky
          </Button>
        </div>
      </section>

      <Button onClick={onApply} className="min-h-14 text-lg">
        Update my plan
      </Button>
      </div>
    </div>
  )
}
