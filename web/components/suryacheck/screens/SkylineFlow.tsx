import { type ReactNode, useState } from 'react'
import { SkylineResult } from './skyline/SkylineResult'
import type { Neighbour, ScanStopReading, SkylineStop } from '@/lib/mockData'

const toStops = (readings: ScanStopReading[]): SkylineStop[] =>
  readings.map((r) => ({ ...r, scannedElevation: r.elevation }))

/** "Shade from your surroundings": the person says how high buildings and trees rise in each direction. */
export function SkylineFlow({
  readings,
  baseHorizon,
  adjustHorizon,
  neighbourSides = [],
  onApply,
  onSkip,
  latitude,
  standHere,
}: {
  standHere?: ReactNode
  readings: ScanStopReading[]
  baseHorizon: number[]
  /** Drops the parts of the skyline already counted as tall neighbours. */
  adjustHorizon?: (horizon: number[]) => number[]
  neighbourSides?: Neighbour['side'][]
  onApply: (stops: SkylineStop[]) => void
  /** "Nothing tall around me": go to the plan with no skyline shade. */
  onSkip: () => void
  /** House latitude, for the sun paths on the chart. */
  latitude?: number
}) {
  const [stops, setStops] = useState<SkylineStop[]>(() => toStops(readings))
  return (
    <SkylineResult
      stops={stops}
      baseHorizon={baseHorizon}
      adjustHorizon={adjustHorizon}
      neighbourSides={neighbourSides}
      onChange={setStops}
      onReset={() => setStops(toStops(readings))}
      onApply={() => onApply(stops)}
      onSkip={onSkip}
      latitude={latitude}
      standHere={standHere}
    />
  )
}
