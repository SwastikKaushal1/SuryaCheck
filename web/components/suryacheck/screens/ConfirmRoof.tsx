import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../Button'
import { Card } from '../Card'
import { CornerHandle, EdgeAdder, RoofOutline } from '../MapLayers'
import { DEFAULT_FIT, fitRectFor, SatelliteMap } from '../SatelliteMap'
import { Tag } from '../Tag'
import { MAP_FILL, SIDE_PANEL, SPLIT, STICKY_MAP_PANEL } from '../layout'
import { RoofFallback } from './RoofFallback'
import { num } from '@/lib/format'
import { GEO_MPU, type GeoFrame } from '@/lib/geo'
import { polygonArea } from '@/lib/geometry'
import type { Point, RoofData } from '@/lib/mockData'

type Stage = 'ask' | 'adjust' | 'rejected' | 'manual'

/** A typical house roof is 40 to 200 m². Outside this range the outline is probably wrong. */
const BIG_ROOF_M2 = 260
const SMALL_ROOF_M2 = 15

export function ConfirmRoof({
  frame,
  status,
  error,
  detected,
  onRetry,
  onConfirm,
}: {
  frame: GeoFrame
  /** Progress of the roof lookup (GET /building). */
  status: 'loading' | 'ready' | 'error'
  error?: string
  detected: RoofData | null
  onRetry: () => void
  onConfirm: (roof: RoofData) => void
}) {
  const [stage, setStage] = useState<Stage>('ask')
  const [draft, setDraft] = useState<Point[] | null>(null)

  if (stage === 'manual' || stage === 'rejected' || (status === 'ready' && !detected)) {
    return <RoofFallback frame={frame} reason={stage === 'rejected' ? 'rejected' : 'missing'} onUse={onConfirm} />
  }

  if (status !== 'ready' || !detected) {
    return (
      <div className={SPLIT}>
        <div className={STICKY_MAP_PANEL}>
          <SatelliteMap frame={frame} className={MAP_FILL} fit={DEFAULT_FIT} fitKey="searching" interactive ariaLabel="Satellite map around your pin while we look for your roof" />
        </div>
        <div className={SIDE_PANEL}>
          <div className="flex flex-col gap-1 max-lg:-order-1">
            <h1 className="text-2xl font-bold text-ink lg:text-3xl">{status === 'error' ? 'We could not find your roof' : 'Looking for your roof…'}</h1>
            <p className="text-base text-ink-soft" role={status === 'error' ? 'alert' : 'status'}>
              {status === 'error' ? error : 'Checking the map for a building outline at your pin.'}
            </p>
          </div>
          {status === 'loading' ? (
            <Card className="flex items-center gap-3">
              <LoaderCircle className="size-6 shrink-0 animate-spin text-teal-deep" aria-hidden="true" />
              <span className="text-base font-medium text-ink">This can take a few seconds.</span>
            </Card>
          ) : (
            <Button onClick={onRetry}>
              <RefreshCw className="size-5" aria-hidden="true" />
              Try again
            </Button>
          )}
          <Button variant="secondary" onClick={() => setStage('manual')}>
            Mark my roof myself
          </Button>
        </div>
      </div>
    )
  }

  const adjusting = stage === 'adjust'
  const points = adjusting ? (draft ?? detected.points) : detected.points
  const areaM2 = Math.round(polygonArea(points) * GEO_MPU ** 2)

  const moveCorner = (i: number, p: Point) => setDraft((d) => (d ?? detected.points).map((q, k) => (k === i ? p : q)))
  const addCorner = (after: number) =>
    setDraft((d) => {
      const base = d ?? detected.points
      const a = base[after]
      const b = base[(after + 1) % base.length]
      const next = [...base]
      next.splice(after + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
      return next
    })

  return (
    <div className={SPLIT}>
      <div className={STICKY_MAP_PANEL}>
        <SatelliteMap frame={frame} className={MAP_FILL} fit={fitRectFor(detected.points, 0.6)} fitKey="detected" interactive ariaLabel="Satellite map with an amber outline of the roof we found">
          <RoofOutline points={points} />
          {adjusting &&
            points.map((p, i) => {
              const next = points[(i + 1) % points.length]
              return <EdgeAdder key={`e${i}-${points.length}`} at={{ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 }} onAdd={() => addCorner(i)} ariaLabel={`Add a corner after corner ${i + 1}`} />
            })}
          {adjusting && points.map((p, i) => <CornerHandle key={`c${i}-${points.length}`} point={p} label={String(i + 1)} ariaLabel={`Roof corner ${i + 1}. Drag to move.`} onMove={(q) => moveCorner(i, q)} />)}
        </SatelliteMap>
      </div>

      <div className={SIDE_PANEL}>
        <div className="flex flex-col gap-1 max-lg:-order-1">
          <h1 className="text-2xl font-bold text-ink lg:text-3xl">Is this your roof?</h1>
          <p className="text-base text-ink-soft">
            {adjusting
              ? 'Drag each corner onto the edge of your roof. Tap a + to add a corner.'
              : detected.containsPin === false
                ? 'This is the closest building to your pin. Is it yours?'
                : 'We found this outline from the map.'}
          </p>
        </div>

        <Card className="flex items-center justify-between gap-3 bg-sun-soft">
          <div>
            <p className="text-sm font-medium text-ink-soft">Roof area we found</p>
            <p className="text-3xl font-bold text-ink">{num(areaM2)} m²</p>
          </div>
          <Tag kind="estimate" />
        </Card>

        {areaM2 > BIG_ROOF_M2 && (
          <Card className="flex items-start gap-3 bg-red-50 text-red-900 ring-1 ring-red-200" role="alert">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-base font-medium">
              This outline is big for one house. It may cover several buildings, which would make the plan too optimistic. Tap &quot;Adjust corners&quot; and trace only your own roof.
            </p>
          </Card>
        )}
        {areaM2 < SMALL_ROOF_M2 && (
          <Card className="flex items-start gap-3 bg-red-50 text-red-900 ring-1 ring-red-200" role="alert">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-base font-medium">
              This outline is very small, maybe just a part of a roof. If your roof is bigger, tap &quot;Adjust corners&quot; and drag the corners out to its edges.
            </p>
          </Card>
        )}

        {adjusting ? (
          <div className="flex flex-col gap-3">
            <Button onClick={() => onConfirm({ ...detected, points, areaM2 })}>Save corners</Button>
            <Button variant="ghost" onClick={() => { setDraft(null); setStage('ask') }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button onClick={() => onConfirm({ ...detected, areaM2 })}>Yes, that&apos;s my roof</Button>
            <Button variant="secondary" onClick={() => setStage('adjust')}>Adjust corners</Button>
            <Button variant="danger" onClick={() => setStage('rejected')}>Not my house</Button>
          </div>
        )}
      </div>
    </div>
  )
}
