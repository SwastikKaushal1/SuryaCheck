import type { Obstacle, ObstacleKind } from './mockData'

export interface ObstaclePreset {
  kind: ObstacleKind
  label: string
  short: string
  shape: 'box' | 'round'
  /** Starting size in metres (a round item uses the width as its diameter). */
  widthM: number
  lengthM: number
  heightM: number
  color: string
}

export const OBSTACLE_PRESETS: ObstaclePreset[] = [
  { kind: 'tank', label: 'Water tank', short: 'Tank', shape: 'round', widthM: 1.7, lengthM: 1.7, heightM: 1.5, color: '#4f9bbf' },
  { kind: 'stairs', label: 'Staircase room', short: 'Stairs', shape: 'box', widthM: 2.9, lengthM: 2.2, heightM: 3, color: '#a8998a' },
  { kind: 'parapet', label: 'Parapet wall', short: 'Parapet', shape: 'box', widthM: 3.9, lengthM: 0.4, heightM: 1, color: '#7d7267' },
  { kind: 'heater', label: 'Solar water heater', short: 'Heater', shape: 'box', widthM: 1.8, lengthM: 1.2, heightM: 1.5, color: '#e0a23a' },
  { kind: 'ac', label: 'AC unit', short: 'AC', shape: 'box', widthM: 0.9, lengthM: 0.4, heightM: 0.8, color: '#9aa5ad' },
  { kind: 'dish', label: 'Dish / antenna', short: 'Dish', shape: 'round', widthM: 0.8, lengthM: 0.8, heightM: 1.2, color: '#c9d1d8' },
  { kind: 'chimney', label: 'Chimney / vent', short: 'Vent', shape: 'box', widthM: 0.5, lengthM: 0.5, heightM: 1.5, color: '#8c6b5a' },
  { kind: 'tree', label: 'Tree', short: 'Tree', shape: 'round', widthM: 2.5, lengthM: 2.5, heightM: 4, color: '#5f8f4e' },
  { kind: 'custom', label: 'Custom item', short: 'Item', shape: 'box', widthM: 2, lengthM: 2, heightM: 1.5, color: '#8a7fb0' },
  { kind: 'clear', label: 'Keep clear (no panels)', short: 'Keep clear', shape: 'box', widthM: 1.5, lengthM: 3, heightM: 0, color: '#f2b84b' },
]

export const HEIGHT_CHOICES = [1, 1.5, 2, 3]

export const presetFor = (kind: ObstacleKind) =>
  OBSTACLE_PRESETS.find((p) => p.kind === kind) ?? OBSTACLE_PRESETS[0]

/** True when the footprint is a circle or ellipse rather than a rectangle. */
export const isRound = (o: Pick<Obstacle, 'kind' | 'shape'>) => (o.shape ?? presetFor(o.kind).shape) === 'round'

/** A keep-clear zone stops panels going there but casts no shadow. */
export const castsShadow = (o: Pick<Obstacle, 'kind'>) => o.kind !== 'clear'
