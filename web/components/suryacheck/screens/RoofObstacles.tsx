import { ArrowRight, Check, Minus, Plus, RotateCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../Button'
import { Card, SectionTitle } from '../Card'
import { NumberField } from '../NumberField'
import { fitRectFor, SatelliteMap } from '../SatelliteMap'
import { DrawLayer, NeighbourLayer, ObstacleEditor, ObstacleLayer, neighbourRisePx, obstacleRise, RoofOutline, ShadowLayer, type EditItem } from '../MapLayers'
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

/** Turn control: a slider plus quarter steps, for people who would rather not use the map handle. */
function TurnRow({ angle, onChange }: { angle: number; onChange: (deg: number) => void }) {
  const a = Math.round(angle) % 360
  const step = (d: number) => onChange((((a + d) % 360) + 360) % 360)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <RotateCw className="size-4" aria-hidden="true" />
          Turn
        </span>
        <span className="text-sm font-bold text-ink">{a}°</span>
      </div>
      <input type="range" min={0} max={359} step={1} value={a} onChange={(e) => onChange(Number(e.target.value))} aria-label="Turn in degrees" className="h-8 w-full accent-[#0F5C5E]" />
      <div className="grid grid-cols-3 gap-2">
        <Chip active={false} onClick={() => step(-15)} label="Turn 15 degrees left">−15°</Chip>
        <Chip active={a === 0} onClick={() => onChange(0)} label="Straight">Straight</Chip>
        <Chip active={false} onClick={() => step(15)} label="Turn 15 degrees right">+15°</Chip>
      </div>
    </div>
  )
}

export function RoofObstacles({
  frame,
  roof,
  roofType,
  onRoofType,
  obstacles,
  onAddObstacle,
  onUpdateObstacle,
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
  onAddObstacle: (obstacle: Omit<Obstacle, 'id'>) => string
  onUpdateObstacle: (id: string, patch: Partial<Obstacle>) => void
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
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  /** A tap drops an item at its usual size; dragging on the map draws it at the size you pulled out. */
  const dropObstacle = (p: Point, drawn?: { x: number; y: number; w: number; h: number }) => {
    const at = drawn ?? p
    if (!pointInPolygon(at, roof.points)) {
      setHint('Place it inside the amber roof outline.')
      return
    }
    setHint('')
    const preset = presetFor(kind)
    const fromMap = (units: number) => Math.min(30, Math.max(0.2, units * roof.metersPerUnit))
    const wM = drawn ? fromMap(drawn.w) : clampNum(widthStr, preset.widthM, 0.2, 30)
    const lM = shape === 'round' ? wM : drawn ? fromMap(drawn.h) : clampNum(lengthStr, preset.lengthM, 0.2, 30)
    const heightM = kind === 'clear' ? 0 : clampNum(heightStr, preset.heightM, 0, 30)
    const id = onAddObstacle({
      kind,
      shape,
      name: name.trim() || undefined,
      x: at.x,
      y: at.y,
      w: wM / roof.metersPerUnit,
      h: lM / roof.metersPerUnit,
      heightM,
    })
    setSelectedId(id)
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
  const blockOf = (n: Neighbour) => neighbourBlock(n, roof.points, mpu, houseFloors)
  const editItems: EditItem[] = [
    ...(flat
      ? obstacles.map((o) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, angle: o.angle, round: isRound(o), lift: { units: obstacleRise(o), px: 0 }, keepOnRoof: true }))
      : []),
    ...neighbours.map((n) => {
      const b = blockOf(n)
      return { id: n.id, x: b.x, y: b.y, w: b.w, h: b.h, angle: b.angle, lift: { units: 0, px: neighbourRisePx(n.floors) } }
    }),
  ]
  const editItem = (id: string, patch: { x: number; y: number; w: number; h: number; angle: number }) => {
    if (obstacles.some((o) => o.id === id)) onUpdateObstacle(id, patch)
    else onUpdateNeighbour(id, { rect: patch })
  }
  const selOb = obstacles.find((o) => o.id === selectedId)
  const editor = (
    <ObstacleEditor items={editItems} selectedId={selectedId} onSelect={setSelectedId} onChange={editItem} roof={roof.points} minUnits={0.2 / mpu} maxUnits={40 / mpu} />
  )

  return (
    <div className={SPLIT}>
      <div className={STICKY_MAP_PANEL}>
        {flat ? (
          <>
            <SatelliteMap frame={frame} className={MAP_FILL} fit={fit} fitKey={`roof-${neighbours.length}`} ariaLabel="Satellite map of your roof. Tap or drag on the roof to place the selected item.">
              <RoofOutline points={roof.points} />
              <DrawLayer round={shape === 'round'} mpu={mpu} onDraw={(r) => dropObstacle({ x: r.x, y: r.y }, r)} onTap={(p) => dropObstacle(p)} />
              <ShadowLayer shadows={shadows} />
              <ObstacleLayer obstacles={obstacles} labels />
              <NeighbourLayer neighbours={neighbours} roof={roof.points} mpu={mpu} houseFloors={houseFloors} />
              {editor}
            </SatelliteMap>
            <p className="text-base font-medium text-ink" aria-live="polite">
              {hint ||
                (selectedId
                  ? 'Drag it to move. Square handles resize it, the round handle on top turns it. Tap Done when finished.'
                  : `Drag on the roof to draw ${name.trim() ? name.trim() : `a ${presetFor(kind).label.toLowerCase()}`}, or just tap to drop one. Tap an item to move, resize or turn it.`)}
            </p>
          </>
        ) : (
          <SatelliteMap frame={frame} className={MAP_FILL} fit={fit} fitKey={`roof-${neighbours.length}`} ariaLabel="Satellite map of your roof">
            <RoofOutline points={roof.points} />
            <ShadowLayer shadows={shadows} />
            <NeighbourLayer neighbours={neighbours} roof={roof.points} mpu={mpu} houseFloors={houseFloors} />
            {editor}
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

          {selOb && (
            <Card className="flex flex-col gap-4 ring-2 ring-teal-deep/40">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-bold text-ink">Editing: {selOb.name?.trim() || presetFor(selOb.kind).label}</p>
                <button
                  type="button"
                  onClick={() => {
                    onRemoveObstacle(selOb.id)
                    setSelectedId(null)
                  }}
                  aria-label="Delete this item"
                  className="flex size-12 items-center justify-center rounded-full text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
                >
                  <Trash2 className="size-5" aria-hidden="true" />
                </button>
              </div>
              <p className="text-sm text-ink-soft">Drag the item on the map to move it, pull a square corner to resize it, or use the round handle to turn it.</p>
              <TurnRow angle={selOb.angle ?? 0} onChange={(deg) => onUpdateObstacle(selOb.id, { angle: deg })} />
              {selOb.kind !== 'clear' && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-ink">How tall is it?</p>
                  <div className="grid grid-cols-4 gap-2">
                    {HEIGHT_CHOICES.map((h) => (
                      <Chip key={h} active={selOb.heightM === h} onClick={() => onUpdateObstacle(selOb.id, { heightM: h })}>
                        {h} m
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              <Button variant="secondary" onClick={() => setSelectedId(null)}>
                <Check className="size-5" aria-hidden="true" />
                Done
              </Button>
            </Card>
          )}

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
                      className={cn('flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 py-2 shadow-sm ring-1 ring-amber-900/5', o.id === selectedId && 'ring-2 ring-teal-deep')}
                    >
                      <span
                        className="size-4 shrink-0 rounded-sm"
                        style={{ backgroundColor: preset.color }}
                        aria-hidden="true"
                      />
                      <button type="button" onClick={() => setSelectedId(o.id === selectedId ? null : o.id)} aria-pressed={o.id === selectedId} className="flex-1 rounded-lg text-left text-base font-semibold text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40">
                        {o.name?.trim() || preset.label}
                        <span className="font-normal text-ink-soft">
                          {o.kind === 'clear' ? ' · keep clear' : ` · ${o.heightM} m`}
                          {` · ${isRound(o) ? `${+(o.w * mpu).toFixed(1)} m wide` : `${+(o.w * mpu).toFixed(1)} × ${+(o.h * mpu).toFixed(1)} m`}`}
                        </span>
                      </button>
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
          Tall buildings next door can shade your roof. Tap the green building on the map, then drag it to where it really stands, pull a square corner to match its size, and use the round handle to turn it.
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
            <li key={n.id} className={cn('flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-amber-900/5', n.id === selectedId && 'ring-2 ring-teal-deep')}>
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
              <TurnRow
                angle={blockOf(n).angle ?? 0}
                onChange={(deg) => {
                  const b = blockOf(n)
                  onUpdateNeighbour(n.id, { rect: { x: b.x, y: b.y, w: b.w, h: b.h, angle: deg } })
                }}
              />
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
        Next: shade from surroundings
        <ArrowRight className="size-5" aria-hidden="true" />
      </Button>
      </div>
    </div>
  )
}
