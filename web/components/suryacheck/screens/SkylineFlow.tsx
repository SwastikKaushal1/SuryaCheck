import { useState } from 'react'
import { SkylineResult } from './skyline/SkylineResult'
import type { ScanStopReading, SkylineStop } from '@/lib/mockData'

const toStops = (readings: ScanStopReading[]): SkylineStop[] =>
  readings.map((r) => ({ ...r, scannedElevation: r.elevation }))

/** "Shade from your surroundings": the person says how high buildings and trees rise in each direction. */
export function SkylineFlow({
  readings,
  baseHorizon,
  onApply,
}: {
  readings: ScanStopReading[]
  baseHorizon: number[]
  onApply: (stops: SkylineStop[]) => void
}) {
  const [stops, setStops] = useState<SkylineStop[]>(() => toStops(readings))
  return (
    <SkylineResult
      stops={stops}
      baseHorizon={baseHorizon}
      onChange={setStops}
      onReset={() => setStops(toStops(readings))}
      onApply={() => onApply(stops)}
    />
  )
}
