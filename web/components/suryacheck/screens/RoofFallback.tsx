import { RotateCcw, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../Button'
import { Card } from '../Card'
import { CornerHandle, EdgeLengths, OutlineMover, RoofOutline } from '../MapLayers'
import { NumberField } from '../NumberField'
import { DEFAULT_FIT, fitRectFor, SatelliteMap } from '../SatelliteMap'
import { Segmented } from '../Segmented'
import { Tag } from '../Tag'
import { MAP_FILL, SIDE_PANEL, SPLIT, STICKY_MAP_PANEL } from '../layout'
import { areaInLocalUnits, num } from '@/lib/format'
import { ANCHOR, GEO_MPU, type GeoFrame } from '@/lib/geo'
import { polygonArea } from '@/lib/geometry'
import type { Point, RoofData } from '@/lib/mockData'
import { BIG_ROOF_M2, MAX_ROOF_M2 } from '@/lib/plan'

type Method = 'tap' | 'type'

export function RoofFallback({ frame, reason, onUse }: { frame: GeoFrame; reason: 'rejected' | 'missing'; onUse: (roof: RoofData) => void }) {
  const [method, setMethod] = useState<Method>('tap')
  const [corners, setCorners] = useState<Point[]>([])
  const [length, setLength] = useState('12')
  const [width, setWidth] = useState('9')

  // The satellite map knows the real scale, so no "front wall length" question is needed.
  const tapped = useMemo<RoofData | null>(
    () => (corners.length < 3 ? null : { points: corners, metersPerUnit: GEO_MPU, areaM2: Math.round(polygonArea(corners) * GEO_MPU ** 2), source: 'corners' }),
    [corners],
  )
  const typed = useMemo<RoofData | null>(() => {
    const l = Number(length)
    const w = Number(width)
    if (!(l > 0) || !(w > 0)) return null
    const hw = l / GEO_MPU / 2
    const hh = w / GEO_MPU / 2
    return {
      points: [
        { x: ANCHOR.x - hw, y: ANCHOR.y - hh },
        { x: ANCHOR.x + hw, y: ANCHOR.y - hh },
        { x: ANCHOR.x + hw, y: ANCHOR.y + hh },
        { x: ANCHOR.x - hw, y: ANCHOR.y + hh },
      ],
      metersPerUnit: GEO_MPU,
      areaM2: Math.round(l * w),
      source: 'typed',
    }
  }, [length, width])
  const picked = method === 'tap' ? tapped : typed
  const tooBig = !!picked && picked.areaM2 > MAX_ROOF_M2
  const result = tooBig ? null : picked

  return (
    <div className={SPLIT}>
      <div className={STICKY_MAP_PANEL}>
        {method === 'tap' ? (
          <>
            <SatelliteMap frame={frame} className={MAP_FILL} fit={DEFAULT_FIT} fitKey="tap" interactive ariaLabel="Satellite map. Tap around the edge of your roof. The shape closes by itself." onTap={(p) => setCorners((c) => [...c, p])}>
              {corners.length >= 3 && <RoofOutline points={corners} />}
              <EdgeLengths points={corners} closed={corners.length >= 3} />
              {corners.length === 2 && <line x1={corners[0].x} y1={corners[0].y} x2={corners[1].x} y2={corners[1].y} stroke="#FBBF24" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
              {corners.map((c, i) => (
                <CornerHandle key={i} point={c} label={String(i + 1)} ariaLabel={`Roof corner ${i + 1}. Drag to move.`} onMove={(p) => setCorners((list) => list.map((q, k) => (k === i ? p : q)))} />
              ))}
              {corners.length >= 3 && <OutlineMover points={corners} onMove={setCorners} />}
            </SatelliteMap>
            <p className="text-base font-medium text-ink" aria-live="polite">
              {corners.length === 0 ? 'Tap the first corner of your roof. Use + to zoom in.' : corners.length < 3 ? `${corners.length} marked. Tap ${3 - corners.length} more corner${corners.length === 2 ? '' : 's'} and the shape closes by itself.` : `${corners.length} corners, shape closed. Tap to add more, or drag any corner to fine-tune.`}
            </p>
          </>
        ) : (
          typed && (
            <SatelliteMap frame={frame} className={MAP_FILL} fit={fitRectFor(typed.points, 0.5)} fitKey={`type-${length}-${width}`} ariaLabel="Satellite map showing the roof size you typed, centred on your pin">
              <RoofOutline points={typed.points} />
              <EdgeLengths points={typed.points} />
            </SatelliteMap>
          )
        )}
      </div>

      <div className={SIDE_PANEL}>
        <div className="flex flex-col gap-1 max-lg:-order-1">
          <h1 className="text-2xl font-bold text-ink lg:text-3xl">Let&apos;s mark your roof</h1>
          <p className="text-base text-ink-soft">{reason === 'rejected' ? 'No problem. Show us your roof in one of two ways.' : 'We could not find an outline for this house. Show us your roof in one of two ways.'}</p>
        </div>
        <div className="max-lg:-order-1">
          <Segmented<Method> ariaLabel="How do you want to mark your roof?" value={method} onChange={setMethod} options={[{ value: 'tap', label: 'Tap corners' }, { value: 'type', label: 'Type size' }]} />
        </div>

        {method === 'tap' ? (
          <Card className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">Tap around the edge of your roof, one corner after another. Use as many corners as the roof needs. The outline closes by itself, so there is no last point to find. To slide the whole shape, drag the Move handle in the middle.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setCorners((c) => c.slice(0, -1))} disabled={corners.length === 0} className="min-h-12">
                <Undo2 className="size-4" aria-hidden="true" />
                Undo last
              </Button>
              <Button variant="ghost" onClick={() => setCorners([])} disabled={corners.length === 0} className="min-h-12">
                <RotateCcw className="size-4" aria-hidden="true" />
                Clear all
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Length" suffix="m" value={length} onChange={setLength} min={1} step={0.5} />
              <NumberField label="Width" suffix="m" value={width} onChange={setWidth} min={1} step={0.5} />
            </div>
            <p className="text-sm text-ink-soft">The box is placed on your pin. If the pin is not in the middle of your roof, use &ldquo;Tap corners&rdquo; instead.</p>
          </Card>
        )}

        <Card className="flex items-center justify-between gap-3 bg-sun-soft">
          <div>
            <p className="text-sm font-medium text-ink-soft">Roof area</p>
            <p className="text-3xl font-bold text-ink">{picked ? `${num(picked.areaM2)} m²` : '—'}</p>
            {picked && <p className="text-sm text-ink-soft">{areaInLocalUnits(picked.areaM2)}</p>}
          </div>
          <Tag kind="input" />
        </Card>
        {!tooBig && picked && picked.areaM2 > BIG_ROOF_M2 && (
          <p className="rounded-xl bg-sun-soft p-3 text-sm font-medium text-ink" role="status">
            That is bigger than most house roofs (40 to 150 m², about 50 to 180 gaj). Check the side lengths on the map
            match your house, and drag any corner that is off.
          </p>
        )}
        {tooBig && (
          <p className="text-base font-medium text-red-800" role="alert">
            That is too big for one house. We can plan roofs up to {num(MAX_ROOF_M2)} m².
          </p>
        )}
        <Button disabled={!result} onClick={() => result && onUse(result)}>Use this roof</Button>
      </div>
    </div>
  )
}
