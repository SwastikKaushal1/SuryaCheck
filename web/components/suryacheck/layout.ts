/** Two-column desktop split. Below lg it is the same single column as before. */
export const SPLIT =
  'flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)] lg:items-start lg:gap-8'

/** Left column that keeps the map fixed at full height under the navbar. */
export const STICKY_MAP_PANEL =
  'flex flex-col gap-5 lg:sticky lg:top-[5.5rem] lg:h-[calc(100dvh-7rem)] lg:min-h-[420px] lg:gap-3'

/** Lets a MapPlaceholder fill its sticky panel instead of keeping 4:3. */
export const MAP_FILL = 'lg:aspect-auto lg:min-h-0 lg:flex-1'

/**
 * Right column. On phones it dissolves (`contents`) so its children keep their
 * original order in the single column; use `-order-*` to hoist items above the map.
 */
export const SIDE_PANEL = 'max-lg:contents lg:flex lg:flex-col lg:gap-5'
