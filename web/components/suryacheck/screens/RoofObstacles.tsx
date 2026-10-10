import { ArrowRight, Minus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../Button'
import { Card, SectionTitle } from '../Card'
import { NumberField } from '../NumberField'
import { fitRectFor, SatelliteMap } from '../SatelliteMap'
import { NeighbourLayer, ObstacleLayer, RoofOutline, ShadowLayer } from '../MapLayers'
import { Segmented } from '../Segmented'
import { MAP_FILL, SIDE_PANEL, SPLIT, STICKY_MAP_PANEL } from '../layout'
import type { GeoFrame } from '@/lib/geo'
import { pointInPolygon } from '@/lib/geometry'
import { neighbourBlock, neighbourPoints } from '@/lib/neighbours'
import { seasonsFor, shadowHull, sunPosition } from '@/lib/solar'
import type { Neighbour, Obstacle, ObstacleKind, Point, RoofData } from '@/lib/mockData'
import { castsShadow, HEIGHT_CHOICES, isRound, OBSTACLE_PRESETS, presetFor } from '@/lib/obstacles'
import { cn } from '@/lib/utils'

export type RoofType = 'flat' | 'sloped' | 'sheet'

const clampNum = (text: string, fallback: number, lo: number, hi: number) => {
  const n = parseFloat(text)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}

const SIDES: Neighbour['side'][] = ['N', 'E', 'S', 'W']
const SIDE_NAMES: Record<Neighbour['side'], string> = {
  N: 'North',
  E: 'East',
  S: 'South',
  W: 'West',
}

function Chip({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  label?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'min-h-12 min-w-12 rounded-2xl border-2 px-4 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40',
        active
          ? 'border-teal-deep bg-teal-deep text-white'
          : 'border-input bg-white text-ink hover:bg-sand',
      )}
    >
      {children}
    </button>
  )
}

export function RoofObstacles({
  frame,
  roof,
  roofType,
  onRoofType,
  obstacles,
  onAddObstacle,
  onRemoveObstacle,
  neighbours,
  onAddNeighbour,
  onUpdateNeighbour,
  onRemoveNeighbour,
  houseFloors,
  onHouseFloors,
  onContinue,
}: {
  frame: GeoFrame
  roof: RoofData
  roofType: RoofType
  onRoofType: (type: RoofType) => void
  obstacles: Obstacle[]
  onAddObstacle: (obstacle: Omit<Obstacle, 'id'>) => void
  onRemoveObstacle: (id: string) => void
  neighbours: Neighbour[]
  onAddNeighbour: (side: Neighbour['side']) => void
  onUpdateNeighbour: (id: string, patch: Partial<Neighbour>) => void
  onRemoveNeighbour: (id: string) => void
  houseFloors: number
  onHouseFloors: (floors: number) => void
  onContinue: () => void
}) {
  const first = presetFor('tank')
  const [kind, setKind] = useState<ObstacleKind>('tank')
  const [shape, setShape] = useState<'box' | 'round'>(first.shape)
  const [widthStr, setWidthStr] = useState(String(first.widthM))
  const [lengthStr, setLengthStr] = useState(String(first.lengthM))
  const [heightStr, setHeightStr] = useState(String(first.heightM))
  const [name, setName] = useState('')
  const [hint, setHint] = useState('')
  const [when, setWhen] = useState<9 | 12 | 15>(15)

  const pickKind = (k: ObstacleKind) => {
    const p = presetFor(k)
    setKind(k)
    setShape(p.shape)
    setWidthStr(String(p.widthM))
    setLengthStr(String(p.lengthM))
    setHeightStr(String(p.heightM))
    setName('')
    setHint('')
  }

  const dropObstacle = (p: Point) => {
    if (!pointInPolygon(p, roof.points)) {
      setHint('Tap inside the amber roof outline.')
      return
    }
    setHint('')
    const preset = presetFor(kind)
    const wM = clampNum(widthStr, preset.widthM, 0.2, 30)
    const lM = shape === 'round' ? wM : clampNum(lengthStr, preset.lengthM, 0.2, 30)
    const heightM = kind === 'clear' ? 0 : clampNum(heightStr, preset.heightM, 0, 30)
    onAddObstacle({
      kind,
      shape,
      name: name.trim() || undefined,
      x: p.x,
      y: p.y,
      w: wM / roof.metersPerUnit,
      h: lM / roof.metersPerUnit,
      heightM,
    })
  }

  const freeSides = SIDES.filter((s) => !neighbours.some((n) => n.side === s))
  const flat = roofType === 'flat'
  const mpu = roof.metersPerUnit
  // Winter shadows at the chosen hour, so you can see what a neighbour really does to your roof.
  const sun = sunPosition(seasonsFor(frame.lat)[0], when)
  const shadows = [
    ...(flat ? obstacles.filter(castsShadow).map((o) => shadowHull(o, sun, mpu)) : []),
    ...neighbours.map((n) => shadowHull(neighbourBlock(n, roof.points, mpu, houseFloors), sun, mpu, 40)),
  ]
  const fit = fitRectFor([...roof.points, ...neighbourPoints(neighbours, roof.points, mpu, houseFloors)], 0.35)
  const moveNeighbour = (id: string, rect: NonNullable<Neighbour['rect']>) => onUpdateNeighbour(id, { rect })

  return (
    <div className={SPLIT}>
      <div className={STICKY_MAP_PANEL}>
        {flat ? (
          <>
            <SatelliteMap frame={frame} className={MAP_FILL} fit={fit} fitKey={`roof-${neighbours.length}`} ariaLabel="Satellite map of your roof. Tap to place the selected item." onTap={dropObstacle}>
              <RoofOutline points={roof.points} />
              <ShadowLayer shadows={shadows} />
              <ObstacleLayer obstacles={obstacles} labels />
              <NeighbourLayer neighbours={neighbours} roof={roof.points} mpu={mpu} houseFloors={houseFloors} onChange={moveNeighbour} />
            </SatelliteMap>
            <p className="text-base font-medium text-ink" aria-live="polite">
              {hint || (kind === 'clear' ? 'Tap the roof to mark a keep-clear zone.' : `Tap the roof to place ${name.trim() ? name.trim() : `a ${presetFor(kind).label.toLowerCase()}`}.`)}
            </p>
          </>
        ) : (
          <SatelliteMap frame={frame} className={MAP_FILL} fit={fit} fitKey={`roof-${neighbours.length}`} ariaLabel="Satellite map of your roof">
            <RoofOutline points={roof.points} />
            <ShadowLayer shadows={shadows} />
            <NeighbourLayer neighbours={neighbours} roof={roof.points} mpu={mpu} houseFloors={houseFloors} onChange={moveNeighbour} />
          </SatelliteMap>
        )}
      </div>

      <div className={SIDE_PANEL}>
      <div className="flex flex-col gap-1 max-lg:-order-1">
        <h1 className="text-2xl font-bold text-ink lg:text-3xl">What is on your roof?</h1>
        <p className="text-base text-ink-soft">Tanks and rooms cast shadows, so we need to know.</p>
      </div>

      <div className="max-lg:-order-1">
        <Segmented<RoofType>
          ariaLabel="Roof type"
          value={roofType}
          onChange={onRoofType}
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'sloped', label: 'Sloped' },
            { value: 'sheet', label: 'Sheet' },
          ]}
        />
      </div>

      {flat ? (
        <>
          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-ink">What are you placing?</p>
              <div className="grid grid-cols-2 gap-2">
                {OBSTACLE_PRESETS.map((p) => (
                  <Chip key={p.kind} active={kind === p.kind} onClick={() => pickKind(p.kind)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </div>
            {kind === 'custom' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-ink">Shape</p>
                  <Segmented<'box' | 'round'>
                    ariaLabel="Shape of the item"
                    value={shape}
                    onChange={setShape}
                    options={[
                      { value: 'box', label: 'Box' },
                      { value: 'round', label: 'Round' },
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="obstacle-name" className="text-sm font-semibold text-ink">
                    Name (optional)
                  </label>
                  <input
                    id="obstacle-name"
                    type="text"
                    maxLength={18}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Pump house"
                    className="min-h-12 rounded-2xl border-2 border-input bg-white px-4 text-lg font-semibold text-ink outline-none focus:border-sun-dark focus:ring-4 focus:ring-sun/30"
                  />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-ink">Size</p>
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label={shape === 'round' ? 'Diameter' : 'Width'}
                  value={widthStr}
                  onChange={setWidthStr}
                  suffix="m"
                  min={0.2}
                  max={30}
                  step={0.1}
                  showInputTag={false}
                />
                {shape === 'box' && (
                  <NumberField
                    label="Length"
                    value={lengthStr}
                    onChange={setLengthStr}
                    suffix="m"
                    min={0.2}
                    max={30}
                    step={0.1}
                    showInputTag={false}
                  />
                )}
              </div>
            </div>
            {kind === 'clear' ? (
              <p className="text-sm text-ink-soft">
                Panels will not be placed here, and it casts no shadow. Use it for a walkway, a
                skylight or space you want to keep free.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-ink">How tall is it?</p>
                <div className="grid grid-cols-4 gap-2">
                  {HEIGHT_CHOICES.map((h) => (
                    <Chip key={h} active={parseFloat(heightStr) === h} onClick={() => setHeightStr(String(h))}>
                      {h} m
                    </Chip>
                  ))}
                </div>
                <NumberField
                  label="Or type the exact height"
                  value={heightStr}
                  onChange={setHeightStr}
                  suffix="m"
                  min={0}
                  max={30}
                  step={0.1}
                  showInputTag={false}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-ink">Shadow at</p>
              <Segmented<'9' | '12' | '15'>
                ariaLabel="Time of day for the shadow"
                value={String(when) as '9' | '12' | '15'}
                onChange={(v) => setWhen(Number(v) as 9 | 12 | 15)}
                options={[
                  { value: '9', label: '9 am' },
                  { value: '12', label: 'Noon' },
                  { value: '15', label: '3 pm' },
                ]}
              />
            </div>
          </Card>

          <section aria-label="Items on your roof" className="flex flex-col gap-2">
            <SectionTitle>On your roof ({obstacles.length})</SectionTitle>
            {obstacles.length === 0 ? (
              <p className="text-base text-ink-soft">Nothing yet. A clear roof is great news.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {obstacles.map((o) => {
                  const preset = presetFor(o.kind)
                  return (
                    <li
                      key={o.id}
                      className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 py-2 shadow-sm ring-1 ring-amber-900/5"
                    >
                      <span
                        className="size-4 shrink-0 rounded-sm"
                        style={{ backgroundColor: preset.color }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-base font-semibold text-ink">
                        {o.name?.trim() || preset.label}
                        <span className="font-normal text-ink-soft">
                          {o.kind === 'clear' ? ' · keep clear' : ` · ${o.heightM} m`}
                          {` · ${isRound(o) ? `${+(o.w * mpu).toFixed(1)} m wide` : `${+(o.w * mpu).toFixed(1)} × ${+(o.h * mpu).toFixed(1)} m`}`}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveObstacle(o.id)}
                        aria-label={`Delete ${o.name?.trim() || preset.label}`}
                        className="flex size-12 items-center justify-center rounded-full text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
                      >
                        <Trash2 className="size-5" aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      ) : (
        <Card className="bg-teal-soft text-teal-deep">
          <p className="text-base font-medium">
            Panels lie flush on a {roofType === 'sloped' ? 'sloped' : 'sheet'} roof, so there is no
            tilt to choose and no need to mark tanks or rooms. We will use the roof as it is.
          </p>
        </Card>
      )}

      <section aria-label="Tall neighbours" className="flex flex-col gap-2">
        <SectionTitle>Tall neighbours (optional)</SectionTitle>
        <p className="text-sm text-ink-soft">
          Tall buildings next door can shade your roof. Drag the green building on the map to where it really stands, and drag its round corner to match its size.
        </p>
        {!flat && neighbours.length > 0 && (
          <Segmented<'9' | '12' | '15'>
            ariaLabel="Time of day for the shadow"
            value={String(when) as '9' | '12' | '15'}
            onChange={(v) => setWhen(Number(v) as 9 | 12 | 15)}
            options={[
              { value: '9', label: '9 am' },
              { value: '12', label: 'Noon' },
              { value: '15', label: '3 pm' },
            ]}
          />
        )}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-amber-900/5">
          <span className="text-base font-semibold text-ink">Floors in your house</span>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Fewer floors in your house" disabled={houseFloors <= 1} onClick={() => onHouseFloors(houseFloors - 1)} className="flex size-12 items-center justify-center rounded-full border-2 border-teal-deep text-teal-deep hover:bg-teal-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40 disabled:opacity-30">
              <Minus className="size-5" aria-hidden="true" />
            </button>
            <span className="w-8 text-center text-2xl font-bold text-ink" aria-live="polite">{houseFloors}</span>
            <button type="button" aria-label="More floors in your house" disabled={houseFloors >= 10} onClick={() => onHouseFloors(houseFloors + 1)} className="flex size-12 items-center justify-center rounded-full border-2 border-teal-deep text-teal-deep hover:bg-teal-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40 disabled:opacity-30">
              <Plus className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          {neighbours.map((n) => (
            <li key={n.id} className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-amber-900/5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5" role="group" aria-label="Which side of your house">
                  {SIDES.map((s) => {
                    const taken = s !== n.side && neighbours.some((x) => x.side === s)
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={taken}
                        aria-pressed={n.side === s}
                        aria-label={`${SIDE_NAMES[s]} side`}
                        onClick={() => onUpdateNeighbour(n.id, { side: s, rect: undefined })}
                        className={cn(
                          'size-12 rounded-xl border-2 text-base font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40 disabled:opacity-30',
                          n.side === s
                            ? 'border-teal-deep bg-teal-deep text-white'
                            : 'border-input bg-white text-ink',
                        )}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveNeighbour(n.id)}
                  aria-label={`Remove ${SIDE_NAMES[n.side]} neighbour`}
                  className="flex size-12 items-center justify-center rounded-full text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
                >
                  <Trash2 className="size-5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold text-ink">Floors</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Fewer floors"
                    disabled={n.floors <= 1}
                    onClick={() => onUpdateNeighbour(n.id, { floors: n.floors - 1 })}
                    className="flex size-12 items-center justify-center rounded-full border-2 border-teal-deep text-teal-deep hover:bg-teal-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40 disabled:opacity-30"
                  >
                    <Minus className="size-5" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center text-2xl font-bold text-ink" aria-live="polite">
                    {n.floors}
                  </span>
                  <button
                    type="button"
                    aria-label="More floors"
                    disabled={n.floors >= 10}
                    onClick={() => onUpdateNeighbour(n.id, { floors: n.floors + 1 })}
                    className="flex size-12 items-center justify-center rounded-full border-2 border-teal-deep text-teal-deep hover:bg-teal-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40 disabled:opacity-30"
                  >
                    <Plus className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {freeSides.length > 0 && (
          <Button variant="secondary" onClick={() => onAddNeighbour(freeSides[0])}>
            <Plus className="size-5" aria-hidden="true" />
            Add a tall neighbour
          </Button>
        )}
      </section>

      <Button onClick={onContinue}>
        See my solar plan
        <ArrowRight className="size-5" aria-hidden="true" />
      </Button>
      </div>
    </div>
  )
}
