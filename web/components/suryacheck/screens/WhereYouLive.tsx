import { ArrowRight, Info, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../Button'
import { Card } from '../Card'
import { SatelliteMap } from '../SatelliteMap'
import { NumberField } from '../NumberField'
import { Segmented, YesNo } from '../Segmented'
import { Tag } from '../Tag'
import { num } from '@/lib/format'
import type { GeoFrame, LngLat } from '@/lib/geo'
import type { LocationData } from '@/lib/mockData'
import type { UserInputs } from '@/lib/plan'

export function WhereYouLive({
  location,
  address,
  addressBusy = false,
  center,
  onPinMove,
  inputs,
  onChange,
  onContinue,
  aside,
}: {
  location: LocationData
  address: string
  /** True while the address for a moved pin is being looked up. */
  addressBusy?: boolean
  /** Where the map opens. The pin always sits at the middle of the map. */
  center: GeoFrame
  onPinMove: (pin: LngLat) => void
  inputs: UserInputs
  onChange: (patch: Partial<UserInputs>) => void
  onContinue: () => void
  aside?: ReactNode
}) {
  const unitsPerMonth =
    inputs.billMode === 'rupees' ? inputs.billValue / location.billPerUnitRs : inputs.billValue
  const rupeesPerMonth =
    inputs.billMode === 'units' ? inputs.billValue * location.billPerUnitRs : inputs.billValue

  const switchMode = (mode: UserInputs['billMode']) => {
    if (mode === inputs.billMode) return
    onChange({
      billMode: mode,
      billValue:
        mode === 'units'
          ? Math.round(inputs.billValue / location.billPerUnitRs)
          : Math.round(inputs.billValue * location.billPerUnitRs),
    })
  }

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-5 lg:sticky lg:top-[5.5rem]">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Where do you live?</h1>
        <p className="flex items-center gap-1.5 text-base text-ink-soft">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className={addressBusy ? 'opacity-50 transition-opacity' : 'transition-opacity'} aria-live="polite">
            {addressBusy ? 'Finding the address…' : address}
          </span>
        </p>
      </div>

      <div className="relative">
        <SatelliteMap frame={center} interactive centerPin initialZoom={19} onMoveEnd={onPinMove} ariaLabel="Satellite map. Move the map so the pin sits on your house." />
        <p className="pointer-events-none absolute left-3 top-3 z-[600] max-w-[calc(100%-5rem)] rounded-2xl bg-white/95 px-3.5 py-1.5 text-sm font-semibold text-ink shadow-md">
          Move the map until the pin is on your house
        </p>
      </div>
      </div>

      <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Segmented
            ariaLabel="Enter your bill in rupees or units"
            value={inputs.billMode}
            onChange={switchMode}
            options={[
              { value: 'rupees', label: '₹ per month' },
              { value: 'units', label: 'Units per month' },
            ]}
          />
          <NumberField
            label="Monthly electricity bill"
            prefix={inputs.billMode === 'rupees' ? '₹' : undefined}
            suffix={inputs.billMode === 'units' ? 'units' : undefined}
            value={inputs.billValue ? String(inputs.billValue) : ''}
            onChange={(v) => onChange({ billValue: Math.max(0, Number(v) || 0) })}
            min={0}
          />
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            {inputs.billMode === 'rupees'
              ? `About ${num(unitsPerMonth)} units a month`
              : `About ₹${num(rupeesPerMonth)} a month`}
            <Tag kind="estimate" />
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-ink" id="own-house-label">
            Is this your own house?
          </p>
          <YesNo
            ariaLabel="Is this your own house?"
            value={inputs.ownHouse}
            onChange={(ownHouse) => onChange({ ownHouse })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-ink">Is the connection residential?</p>
          <YesNo
            ariaLabel="Is the connection residential?"
            value={inputs.residential}
            onChange={(residential) => onChange({ residential })}
          />
          <p className="flex items-start gap-2 rounded-xl bg-teal-soft p-3 text-sm text-teal-deep">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            These two answers decide whether the government subsidy applies to you.
          </p>
          {!inputs.ownHouse && (
            <p className="rounded-xl bg-sun-soft p-3 text-sm text-ink">
              Renting or living in an apartment? A roof is usually shared or belongs to the landlord or society, so get their written OK before you buy. You can still use this plan to talk to them.
            </p>
          )}
        </div>
      </Card>

      {aside}

      {inputs.billValue <= 0 && (
        <p className="text-sm font-medium text-red-800" role="status">
          Enter your monthly bill so we can size the system for you.
        </p>
      )}
      <Button onClick={onContinue} disabled={inputs.billValue <= 0}>
        Continue
        <ArrowRight className="size-5" aria-hidden="true" />
      </Button>
      </div>
    </div>
  )
}
