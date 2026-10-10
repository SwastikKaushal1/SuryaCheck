import type { Place } from './api'
import type { GeoFrame } from './geo'
import type { Lang } from './i18n'
import type { Neighbour, Obstacle, RoofData } from './mockData'
import type { UserInputs } from './plan'

/**
 * The person's plan, kept in this browser so a refresh (or a closed tab) does not start them over.
 * Nothing leaves the device. A version bump drops plans saved in an older shape.
 */
export interface SavedProgress {
  v: 1
  savedAt: number
  screen: string
  place: Place
  pin: GeoFrame
  committed: GeoFrame | null
  inputs: UserInputs
  roof: RoofData | null
  roofType: 'flat' | 'sloped' | 'sheet'
  obstacles: Obstacle[]
  neighbours: Neighbour[]
  houseFloors: number
  skylineHorizon: number[] | null
  scanDone: boolean
  lang: Lang
}

const KEY = 'suryacheck:progress'
/** A plan older than this is probably for a different visit; start fresh. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function loadProgress(): SavedProgress | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as SavedProgress
    if (p?.v !== 1 || !p.place || !p.pin || !p.inputs || Date.now() - p.savedAt > MAX_AGE_MS) return null
    return p
  } catch {
    return null // private mode, blocked storage or a damaged entry: just start fresh
  }
}

export function saveProgress(p: Omit<SavedProgress, 'v' | 'savedAt'>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...p, v: 1, savedAt: Date.now() }))
  } catch {
    /* storage full or blocked: the app still works, it just won't remember */
  }
}

/** Highest number used in ids like "ob-new-7" / "nb-3", so new items never reuse an id. */
export const maxIdNumber = (ids: string[]) =>
  ids.reduce((m, id) => Math.max(m, Number(id.match(/(\d+)$/)?.[1] ?? 0)), 0)
