import { num } from '@/lib/format'

export function TiltChart({
  rows,
  activeTilt,
  onPick,
  disabled,
}: {
  rows: { tilt: number; kWhYear: number }[]
  activeTilt: number
  onPick: (tilt: number) => void
  disabled?: boolean
}) {
  const max = Math.max(...rows.map((r) => r.kWhYear), 1)
  const chartH = 96
  const slot = 100 / rows.length

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex items-end gap-1.5" role="group" aria-label="Yearly energy at each tilt">
        {rows.map((r) => {
          const active = r.tilt === activeTilt
          return (
            <button
              key={r.tilt}
              type="button"
              disabled={disabled}
              onClick={() => onPick(r.tilt)}
              aria-pressed={active}
              aria-label={`${r.tilt} degrees: ${num(r.kWhYear)} kWh per year`}
              style={{ width: `${slot}%` }}
              className="group flex min-h-12 flex-col items-center justify-end gap-1 focus-visible:outline-none"
            >
              <span className="text-[11px] font-semibold text-ink-soft">
                {active ? num(r.kWhYear) : ''}
              </span>
              <span
                className={`w-full rounded-t-lg transition-all group-focus-visible:ring-4 group-focus-visible:ring-sun/40 ${
                  active ? 'bg-sun-dark' : 'bg-sun/45 group-hover:bg-sun/70'
                }`}
                style={{ height: Math.max(8, (r.kWhYear / max) * chartH) }}
              />
              <span className={`text-xs ${active ? 'font-bold text-ink' : 'text-ink-soft'}`}>
                {r.tilt}°
              </span>
            </button>
          )
        })}
      </div>
      <figcaption className="text-xs text-ink-soft">
        Yearly energy (kWh) at each roof tilt. Tap a bar to try it.
      </figcaption>
    </figure>
  )
}
