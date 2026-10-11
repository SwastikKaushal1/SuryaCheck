import { MapPin } from 'lucide-react'
import { Card } from '../../Card'
import { ObstacleLayer, PanelLayer, RoofOutline } from '../../MapLayers'
import { fitRectFor, SatelliteMap, useMapView } from '../../SatelliteMap'
import type { GeoFrame } from '@/lib/geo'
import type { Obstacle, Point } from '@/lib/mockData'
import type { PanelCell } from '@/lib/plan'

/** "You are here" pin at the middle of the panels: where to stand for the scan. */
function StandPin({ at }: { at: Point }) {
  const { scale } = useMapView()
  const s = 1 / scale
  return (
    <g transform={`translate(${at.x} ${at.y})`} pointerEvents="none">
      <circle r={22 * s} fill="#0F5C5E" fillOpacity="0.25">
        <animate attributeName="r" values={`${12 * s};${26 * s};${12 * s}`} dur="2s" repeatCount="indefinite" />
      </circle>
      <circle r={9 * s} fill="#0F5C5E" stroke="#fff" strokeWidth={3 * s} />
    </g>
  )
}

/**
 * Before the phone scan: shows where the panels will most likely go, so the person
 * knows where on the roof to stand. The skyline seen from there is what matters.
 */
export function StandHere({ frame, roof, panels, obstacles }: { frame: GeoFrame; roof: Point[]; panels: PanelCell[]; obstacles: Obstacle[] }) {
  const kept = panels.filter((p) => p.kept)
  const spot = kept.length
    ? { x: kept.reduce((s, p) => s + p.x + p.w / 2, 0) / kept.length, y: kept.reduce((s, p) => s + p.y + p.h / 2, 0) / kept.length }
    : null
  return (
    <Card className="flex flex-col gap-2 p-3">
      <p className="flex items-center gap-2 text-base font-bold text-ink">
        <MapPin className="size-5 text-teal-deep" aria-hidden="true" />
        Where to stand for the scan
      </p>
      <SatelliteMap
        frame={frame}
        className="h-52 w-full overflow-hidden rounded-xl"
        fit={fitRectFor(roof, 0.4)}
        fitKey="stand"
        ariaLabel="Satellite map of your roof with the likely panel spot and where to stand"
      >
        <RoofOutline points={roof} fillOpacity={0.12} />
        <PanelLayer panels={kept} />
        <ObstacleLayer obstacles={obstacles} />
        {spot && <StandPin at={spot} />}
      </SatelliteMap>
      <p className="text-sm text-ink-soft">
        {spot
          ? 'The blue panels show where your panels will most likely go. Stand at the pulsing dot, in the middle of them, so the scan sees what they will see.'
          : 'Stand on the open part of your roof where the panels will go, away from water tanks and stair rooms.'}
      </p>
    </Card>
  )
}
