import { useState } from 'react'
import { num } from '@/lib/format'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const CHART_H = 120
/** Month label (18px) + the 4px gap above it: where every bar starts. */
const BASELINE = 22

/**
 * Units the system makes each month, with the household's monthly use as a dashed line.
 * Only the best and weakest months are labelled; hover or focus a bar to read the others.
 */
export function MonthlyChart({ kWh, useKwhMonth }: { kWh: number[]; useKwhMonth: number | null }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(...kWh, useKwhMonth ?? 0, 1) * 1.12
  const best = kWh.indexOf(Math.max(...kWh))
  const worst = kWh.indexOf(Math.min(...kWh))
  const shown = (i: number) => (active === null ? i === best || i === worst : i === active)
  const useY = useKwhMonth ? (useKwhMonth / max) * CHART_H : null

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative" style={{ height: CHART_H + BASELINE + 18 }}>
        {useY !== null && (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-teal-deep/70" style={{ bottom: useY + BASELINE }}>
            <span className="absolute -top-5 right-0 rounded bg-white/90 px-1 text-[11px] font-semibold text-teal-deep">
              You use {num(useKwhMonth!)}
            </span>
          </div>
        )}
        <ul className="absolute inset-0 flex items-end gap-[2px]" aria-label="Units made each month">
          {kWh.map((v, i) => (
            <li
              key={MONTHS[i]}
              tabIndex={0}
              aria-label={`${MONTH_NAMES[i]}: about ${num(v)} units`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-1 outline-none"
            >
              <span
                className={`relative z-20 h-[14px] whitespace-nowrap rounded bg-white px-0.5 text-[10px] font-semibold leading-[14px] text-ink ${shown(i) ? '' : 'invisible'}`}
              >
                {num(v)}
              </span>
              <span
                className={`w-full max-w-7 rounded-t-[4px] transition-colors group-focus-visible:ring-4 group-focus-visible:ring-sun/40 ${
                  active === i ? 'bg-sun-dark' : 'bg-sun/70'
                }`}
                style={{ height: Math.max(3, (v / max) * CHART_H) }}
              />
              <span className="h-[18px] text-[10px] leading-[18px] text-ink-soft">{MONTHS[i][0]}</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-xs text-ink-soft">
        Units (kWh) your panels make each month, from PVGIS sunshine data for your spot. Cloudy monsoon months make less.
      </figcaption>
    </figure>
  )
}
