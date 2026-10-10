import { useEffect, useMemo, useRef, useState } from 'react'
import { AppShell } from './AppShell'
import { ConfirmRoof } from './screens/ConfirmRoof'
import { Landing } from './screens/Landing'
import { PlanScreen } from './screens/PlanScreen'
import { QuickEstimate } from './screens/QuickEstimate'
import { RoofObstacles, type RoofType } from './screens/RoofObstacles'
import { SkylineFlow } from './screens/SkylineFlow'
import { LangToggle, Summary } from './screens/Summary'
import { WhereYouLive } from './screens/WhereYouLive'
import { api, type Place } from '@/lib/api'
import { financeFromApi } from '@/lib/finance'
import { GEO_MPU, lngLatToUnits, simplifyRing, type GeoFrame } from '@/lib/geo'
import { polygonArea } from '@/lib/geometry'
import type { Lang } from '@/lib/i18n'
import {
  horizon as scannedHorizon,
  scanStops,
  type LocationData,
  type Neighbour,
  type Obstacle,
  type QuickEstimate as QuickEstimateData,
  type RoofData,
  type SkylineStop,
} from '@/lib/mockData'
import { buildPlanModel, DEFAULT_PANEL, TILTS, type SkylineLoss, type UserInputs } from '@/lib/plan'
import { FALLBACK_REFERENCE, financeParamsFrom, tariffFor } from '@/lib/reference'
import { horizonFromStops, skylineLossPct } from '@/lib/solar'
import { useAsync } from '@/lib/useAsync'
import { useIsDesktop } from '@/lib/useIsDesktop'

type Screen = 'landing' | 'where' | 'quick' | 'roof' | 'obstacles' | 'plan' | 'skyline' | 'summary'

const ORDER: Screen[] = ['landing', 'where', 'quick', 'roof', 'obstacles', 'plan', 'skyline', 'summary']

const BACK: Partial<Record<Screen, Screen>> = {
  where: 'landing',
  quick: 'where',
  roof: 'quick',
  obstacles: 'roof',
  plan: 'obstacles',
  skyline: 'plan',
  summary: 'plan',
}

const SLOPED_TILT = 20

const DESKTOP_STEP: Record<Screen, number> = {
  landing: 1,
  where: 1,
  quick: 1,
  roof: 2,
  obstacles: 3,
  plan: 4,
  skyline: 5,
  summary: 6,
}

const DESKTOP_STEP_SCREEN: Screen[] = ['where', 'roof', 'obstacles', 'plan', 'skyline', 'summary']

const REFERENCE_SYSTEM_KW = 3
const DEFAULT_BILL = 2500
/** Where the map opens before anyone has searched. */
const DEFAULT_PLACE: Place = { address: 'New Delhi', city: 'New Delhi', lat: 28.6139, lng: 77.209, stateCode: 'DL' }

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
  })

export default function App() {
  const isDesktop = useIsDesktop()
  const [screen, setScreen] = useState<Screen>('landing')
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE)
  /** Where the pin is on the map right now. */
  const [pin, setPin] = useState<GeoFrame>({ lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng })
  /** The pin as it was when the person pressed Continue. All roof overlays hang off this. */
  const [committed, setCommitted] = useState<GeoFrame | null>(null)
  const [inputs, setInputs] = useState<UserInputs>({ billMode: 'rupees', billValue: DEFAULT_BILL, ownHouse: true, residential: true })
  const [roof, setRoof] = useState<RoofData | null>(null)
  const [roofType, setRoofType] = useState<RoofType>('flat')
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [neighbours, setNeighbours] = useState<Neighbour[]>([])
  const [houseFloors, setHouseFloors] = useState(2)
  const [hour, setHour] = useState(10)
  const [heatmap, setHeatmap] = useState(false)
  const [skylineHorizon, setSkylineHorizon] = useState<number[] | null>(null)
  const [scanDone, setScanDone] = useState(false)
  const [scanSession, setScanSession] = useState(0)
  const [lang, setLang] = useState<Lang>('en')
  const nextId = useRef(1)
  const [addressBusy, setAddressBusy] = useState(false)
  // When the pin is dragged somewhere new, look up the address there so the page never shows a stale one.
  useEffect(() => {
    if (screen !== 'where') return
    if (Math.abs(pin.lat - place.lat) < 2e-5 && Math.abs(pin.lng - place.lng) < 2e-5) return
    const ctrl = new AbortController()
    setAddressBusy(true)
    const timer = setTimeout(() => {
      api
        .reverse(pin.lat, pin.lng, ctrl.signal)
        .then((p) => {
          if (ctrl.signal.aborted) return
          setPlace((prev) => ({
            ...prev,
            lat: pin.lat,
            lng: pin.lng,
            address: p?.address || prev.address,
            city: p?.city || prev.city,
            stateCode: p?.stateCode || prev.stateCode,
          }))
        })
        .catch(() => {})
        .finally(() => {
          if (!ctrl.signal.aborted) setAddressBusy(false)
        })
    }, 600)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin.lat, pin.lng, screen])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [screen])

  const frame: GeoFrame = committed ?? pin
  const eligible = inputs.ownHouse && inputs.residential
  const flat = roofType === 'flat'

  // ---------- backend calls ----------
  const reference = useAsync((signal) => api.reference(signal), [])
  const ref = reference.data ?? FALLBACK_REFERENCE
  const tariff = tariffFor(ref, place.stateCode)

  const pinKey = `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`
  const quick = useAsync(
    screen === 'where' || screen === 'quick' ? (signal) => api.quick(pin.lat, pin.lng, signal) : null,
    [pinKey, screen === 'where' || screen === 'quick'],
  )
  // Keep the last good number on screen while a new pin is being checked.
  const lastQuick = useRef(0)
  if (quick.data) lastQuick.current = quick.data.kwhPerKwp

  const commitKey = committed ? `${committed.lat.toFixed(5)},${committed.lng.toFixed(5)}` : ''
  const building = useAsync(
    committed ? (signal) => api.building(committed.lat, committed.lng, signal) : null,
    [commitKey],
  )
  const clearYields = useAsync(
    committed ? (signal) => api.yields({ lat: committed.lat, lon: committed.lng, tilts: TILTS }, signal) : null,
    [commitKey],
  )

  const detectedRoof = useMemo<RoofData | null>(() => {
    const b = building.data
    if (!committed || !b?.found || !b.polygon) return null
    const ring = b.polygon.map(([lng, lat]) => lngLatToUnits(committed, { lng, lat }))
    const closed = ring.length > 1 && ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y
    const pts = simplifyRing(closed ? ring.slice(0, -1) : ring, 3)
    return {
      points: pts,
      metersPerUnit: GEO_MPU,
      areaM2: Math.round(polygonArea(pts) * GEO_MPU ** 2),
      source: 'detected',
      containsPin: b.containsPoint,
    }
  }, [building.data, committed])

  // Skyline shade, measured by PVGIS with the scanned horizon (edited by the person).
  const horizonKey = skylineHorizon ? skylineHorizon.map((h) => h.toFixed(1)).join(',') : ''
  const skyYields = useAsync(
    committed && skylineHorizon
      ? (signal) => api.yields({ lat: committed.lat, lon: committed.lng, tilts: TILTS, horizon: skylineHorizon }, signal)
      : null,
    [commitKey, horizonKey],
  )
  const skyline = useMemo<SkylineLoss | null>(() => {
    if (!skylineHorizon) return null
    const clear = clearYields.data
    const sky = skyYields.data
    if (clear && sky) {
      const ratios = TILTS.map((t) => (clear[String(t)] > 0 ? sky[String(t)] / clear[String(t)] : 1))
      const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length
      return { lossPct: Math.max(0, Math.round((1 - mean) * 100)), yields: sky, source: 'pvgis' }
    }
    return { lossPct: skylineLossPct(skylineHorizon), yields: null, source: 'estimate' }
  }, [skylineHorizon, clearYields.data, skyYields.data])

  // ---------- numbers shown on screen ----------
  const location: LocationData = {
    address: place.address,
    city: place.city,
    lat: pin.lat,
    lng: pin.lng,
    pvgisKwhPerKwYear: Math.round(quick.data?.kwhPerKwp ?? lastQuick.current),
    billPerUnitRs: tariff,
    defaultMonthlyBillRs: DEFAULT_BILL,
  }

  const quickEstimate = useMemo<QuickEstimateData | null>(() => {
    const kwh = location.pvgisKwhPerKwYear
    if (!kwh) return null
    const units = inputs.billMode === 'units' ? inputs.billValue : inputs.billValue / tariff
    const production = REFERENCE_SYSTEM_KW * kwh
    const monthly = (Math.min(production, units * 12) * tariff) / 12
    const r100 = (n: number) => Math.round(n / 100) * 100
    return { referenceSystemKw: REFERENCE_SYSTEM_KW, monthlySavingsRange: [r100(monthly * 0.9), r100(monthly * 1.1)], locationOnlyKwhYear: Math.round(production) }
  }, [location.pvgisKwhPerKwYear, inputs.billMode, inputs.billValue, tariff])

  const localPlan = useMemo(() => {
    if (!roof) return null
    return buildPlanModel({
      roof,
      obstacles,
      neighbours,
      houseFloors,
      flush: !flat,
      latitude: frame.lat,
      panel: { ...DEFAULT_PANEL, ...ref.panel },
      yields: clearYields.data ?? null,
      fallbackYield: lastQuick.current || ref.defaults.performanceKwhPerKwp,
      consumptionKwhYear: inputs.billValue > 0 ? (inputs.billMode === 'units' ? inputs.billValue : inputs.billValue / tariff) * 12 : null,
      skyline,
      financeParams: financeParamsFrom(ref, place.stateCode),
      eligible,
    })
  }, [roof, obstacles, neighbours, houseFloors, flat, frame.lat, ref, inputs.billMode, inputs.billValue, tariff, clearYields.data, skyline, place.stateCode, eligible])

  const kwp = localPlan?.numbers.kWp ?? 0
  const kwhYear = localPlan?.numbers.kWhFinal ?? 0
  const financeCall = useAsync(
    localPlan && kwp > 0 && (screen === 'plan' || screen === 'summary')
      ? async (signal) => {
          await sleep(350, signal) // wait for slider drags to settle
          return api.finance(
            {
              kwp,
              stateCode: place.stateCode,
              ...(inputs.billMode === 'rupees' ? { monthlyBill: inputs.billValue } : { monthlyUnits: inputs.billValue }),
              residential: inputs.residential,
              ownHouse: inputs.ownHouse,
              kwhPerKwp: Math.max(1, Math.round(kwhYear / kwp)),
            },
            signal,
          )
        }
      : null,
    [kwp, kwhYear, place.stateCode, inputs.billMode, inputs.billValue, inputs.residential, inputs.ownHouse, screen === 'plan' || screen === 'summary'],
  )

  const plan = useMemo(() => {
    if (!localPlan) return null
    return financeCall.status === 'ready' && financeCall.data
      ? { ...localPlan, finance: financeFromApi(financeCall.data) }
      : localPlan
  }, [localPlan, financeCall.status, financeCall.data])

  const sunStatus = clearYields.status === 'ready' && skyYields.status === 'loading' ? 'loading' : clearYields.status

  const go = (next: Screen) => setScreen(next)

  /** A new address: everything tied to the old house is dropped. */
  const choosePlace = (p: Place) => {
    setPlace(p)
    setPin({ lat: p.lat, lng: p.lng })
    setCommitted(null)
    setRoof(null)
    setObstacles([])
    setNeighbours([])
    setSkylineHorizon(null)
    setScanDone(false)
    go('where')
  }

  /** Continue from the map: freeze the pin. Moving it again discards the old roof. */
  const commitPin = (next: Screen) => {
    const moved = !committed || Math.abs(committed.lat - pin.lat) > 1e-6 || Math.abs(committed.lng - pin.lng) > 1e-6
    if (moved) {
      setCommitted({ ...pin })
      setRoof(null)
      setObstacles([])
      setNeighbours([])
      setSkylineHorizon(null)
      setScanDone(false)
    }
    go(next)
  }

  // Desktop shows the quick estimate beside the map, so it has no screen of its own.
  const view: Screen = isDesktop && screen === 'quick' ? 'where' : screen
  const backTarget: Screen | undefined = isDesktop && view === 'roof' ? 'where' : BACK[view]

  const goToDesktopStep = (n: number) => {
    const target = DESKTOP_STEP_SCREEN[n - 1]
    if (target === 'skyline') startScan()
    else go(target)
  }

  const applySkyline = (stops: SkylineStop[]) => {
    const edited = horizonFromStops(scannedHorizon, stops)
    setSkylineHorizon(edited)
    setScanDone(true)
    go('plan')
  }

  const startScan = () => {
    setScanSession((s) => s + 1)
    go('skyline')
  }

  return (
    <AppShell
      step={ORDER.indexOf(view) + 1}
      onBack={backTarget ? () => go(backTarget) : undefined}
      onHome={screen === 'landing' ? undefined : () => go('landing')}
      headerRight={view === 'summary' ? <LangToggle lang={lang} onChange={setLang} /> : undefined}
      desktopStep={DESKTOP_STEP[view]}
      onDesktopStep={goToDesktopStep}
      navRight={<LangToggle lang={lang} onChange={setLang} />}
    >
      {screen === 'landing' && <Landing onPlace={choosePlace} />}

      {view === 'where' && (
        <WhereYouLive
          location={location}
          address={place.address}
          addressBusy={addressBusy}
          center={pin}
          onPinMove={(p) => setPin({ lat: p.lat, lng: p.lng })}
          inputs={inputs}
          onChange={(patch) => setInputs((i) => ({ ...i, ...patch }))}
          onContinue={() => commitPin(isDesktop ? 'roof' : 'quick')}
          aside={
            isDesktop ? (
              <QuickEstimate
                location={location}
                estimate={quickEstimate}
                sunStatus={quick.status}
                sunError={quick.error?.message}
                onRetry={quick.reload}
                onContinue={() => commitPin('roof')}
                embedded
              />
            ) : undefined
          }
        />
      )}

      {view === 'quick' && (
        <QuickEstimate
          location={location}
          estimate={quickEstimate}
          sunStatus={quick.status}
          sunError={quick.error?.message}
          onRetry={quick.reload}
          onContinue={() => commitPin('roof')}
        />
      )}

      {screen === 'roof' && committed && (
        <ConfirmRoof
          key={commitKey}
          frame={committed}
          status={building.status === 'ready' ? 'ready' : building.status === 'error' ? 'error' : 'loading'}
          error={building.error?.message}
          detected={detectedRoof}
          onRetry={building.reload}
          onConfirm={(r) => {
            setRoof(r)
            go('obstacles')
          }}
        />
      )}

      {screen === 'obstacles' && roof && committed && (
        <RoofObstacles
          frame={committed}
          roof={roof}
          roofType={roofType}
          onRoofType={setRoofType}
          obstacles={obstacles}
          onAddObstacle={(o) => setObstacles((list) => [...list, { ...o, id: `ob-new-${nextId.current++}` }])}
          onRemoveObstacle={(id) => setObstacles((list) => list.filter((o) => o.id !== id))}
          neighbours={neighbours}
          onAddNeighbour={(side) => setNeighbours((list) => [...list, { id: `nb-${nextId.current++}`, side, floors: 3 }])}
          onUpdateNeighbour={(id, patch) => setNeighbours((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)))}
          onRemoveNeighbour={(id) => setNeighbours((list) => list.filter((n) => n.id !== id))}
          houseFloors={houseFloors}
          onHouseFloors={setHouseFloors}
          onContinue={() => go('plan')}
        />
      )}

      {screen === 'plan' && plan && committed && (
        <PlanScreen
          frame={committed}
          plan={plan}
          sunStatus={sunStatus}
          sunError={clearYields.error?.message}
          onRetrySun={clearYields.reload}
          hour={hour}
          onHour={setHour}
          heatmap={heatmap}
          onHeatmap={setHeatmap}
          scanDone={scanDone}
          ownHouse={inputs.ownHouse}
          residential={inputs.residential}
          subsidyRules={financeParamsFrom(ref, place.stateCode).subsidy}
          onScan={startScan}
          onSummary={() => go('summary')}
        />
      )}

      {screen === 'skyline' && (
        <SkylineFlow
          key={scanSession}
          readings={scanStops}
          baseHorizon={scannedHorizon}
          onApply={applySkyline}
        />
      )}

      {screen === 'summary' && plan && <Summary plan={plan} lang={lang} placeName={place.address} />}
    </AppShell>
  )
}
