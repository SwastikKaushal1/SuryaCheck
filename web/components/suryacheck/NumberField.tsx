import { useId } from 'react'
import { Tag } from './Tag'

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  prefix,
  min,
  max,
  step,
  showInputTag = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  suffix?: string
  prefix?: string
  min?: number
  max?: number
  step?: number
  showInputTag?: boolean
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {showInputTag && <Tag kind="input" />}
      </div>
      <div className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-input bg-white px-4 focus-within:border-sun-dark focus-within:ring-4 focus-within:ring-sun/30">
        {prefix && <span className="text-lg font-semibold text-ink-soft">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full min-w-0 bg-transparent text-lg font-semibold text-ink outline-none"
        />
        {suffix && <span className="shrink-0 text-base font-medium text-ink-soft">{suffix}</span>}
      </div>
    </div>
  )
}
