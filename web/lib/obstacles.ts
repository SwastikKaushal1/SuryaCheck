import type { ObstacleKind } from './mockData'

export interface ObstaclePreset {
  kind: ObstacleKind
  label: string
  short: string
  w: number
  h: number
  color: string
}

export const OBSTACLE_PRESETS: ObstaclePreset[] = [
  { kind: 'tank', label: 'Water tank', short: 'Tank', w: 26, h: 26, color: '#4f9bbf' },
  { kind: 'stairs', label: 'Staircase room', short: 'Stairs', w: 44, h: 34, color: '#a8998a' },
  { kind: 'parapet', label: 'Parapet', short: 'Parapet', w: 60, h: 6, color: '#7d7267' },
  { kind: 'heater', label: 'Solar water heater', short: 'Heater', w: 28, h: 18, color: '#e0a23a' },
]

export const HEIGHT_CHOICES = [1, 1.5, 2, 3]

export const presetFor = (kind: ObstacleKind) =>
  OBSTACLE_PRESETS.find((p) => p.kind === kind) ?? OBSTACLE_PRESETS[0]
