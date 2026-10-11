import { LoaderCircle, Smartphone, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../Button'
import { Card } from '../../Card'
import { api, toApiError } from '@/lib/api'
import type { SkylineStop } from '@/lib/mockData'
import { applyScan } from '@/lib/solar'

const POLL_MS = 1000
/** Stop asking after this long with nothing new, so a forgotten tab doesn't poll forever. */
const IDLE_STOP_MS = 10 * 60 * 1000

type Phase = { kind: 'idle' } | { kind: 'starting' } | { kind: 'live'; code: string } | { kind: 'ended'; note: string }

/**
 * Laptop side of "use my phone as a scanner": shows a code, then draws each mark the phone sends
 * onto the skyline chart within about a second.
 */
export function PairWithPhone({
  stops,
  baseHorizon,
  onChange,
}: {
  stops: SkylineStop[]
  baseHorizon: number[]
  onChange: (stops: SkylineStop[]) => void
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [phoneConnected, setPhoneConnected] = useState(false)
  const [received, setReceived] = useState(0)
  const [error, setError] = useState('')
  // The skyline as it was when pairing started; phone marks are always laid on top of this.
  const before = useRef<SkylineStop[]>(stops)
  const lastKey = useRef('')
  const latest = useRef({ onChange, baseHorizon })
  latest.current = { onChange, baseHorizon }

  const start = async () => {
    setError('')
    setPhase({ kind: 'starting' })
    try {
      const { code } = await api.pairCreate()
      before.current = stops
      lastKey.current = ''
      setPhoneConnected(false)
      setReceived(0)
      setPhase({ kind: 'live', code })
    } catch (e) {
      setError(toApiError(e).message)
      setPhase({ kind: 'idle' })
    }
  }

  useEffect(() => {
    if (phase.kind !== 'live') return
    const code = phase.code
    let lastNews = Date.now()
    let stopped = false
    const ctrl = new AbortController()
    const tick = async () => {
      try {
        const v = await api.pairView(code, ctrl.signal)
        if (stopped) return
        setPhoneConnected(v.phoneConnected)
        const key = JSON.stringify(v.marks)
        if (key !== lastKey.current) {
          lastKey.current = key
          lastNews = Date.now()
          setReceived(v.marks.length)
          latest.current.onChange(applyScan(before.current, v.marks, latest.current.baseHorizon))
        }
        if (Date.now() - lastNews > IDLE_STOP_MS) setPhase({ kind: 'ended', note: 'Stopped listening after 10 quiet minutes. Your marks are kept.' })
      } catch (e) {
        if (stopped) return
        const err = toApiError(e)
        if (err.status === 404) setPhase({ kind: 'ended', note: 'The pairing code expired. Your marks are kept; start again to scan more.' })
        // Other errors (a blip in the connection): just try again on the next tick.
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), POLL_MS)
    return () => {
      stopped = true
      ctrl.abort()
      window.clearInterval(id)
    }
  }, [phase])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const localOnly = /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(origin)

  if (phase.kind === 'live') {
    return (
      <Card className="flex flex-col gap-3 border-2 border-teal-deep/30" role="status" aria-live="polite">
        <p className="flex items-center gap-2 text-base font-bold text-ink">
          <Smartphone className="size-5 text-teal-deep" aria-hidden="true" />
          Scan with your phone
        </p>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-ink">
          <li>
            On your phone, open{' '}
            {localOnly ? (
              <>
                your <b>https</b> link to this site (for example the Cloudflare tunnel) and add <b>/?scan={phase.code}</b>
              </>
            ) : (
              <b className="break-all">{origin}/?scan={phase.code}</b>
            )}
          </li>
          <li>Enter this code if it asks:</li>
        </ol>
        <p className="text-center text-5xl font-extrabold tracking-[0.3em] text-ink">{phase.code}</p>
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-teal-deep">
          {phoneConnected ? (
            <>● Phone connected · {received} direction{received === 1 ? '' : 's'} received</>
          ) : (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Waiting for your phone…
            </>
          )}
        </p>
        <Button variant="secondary" onClick={() => setPhase({ kind: 'ended', note: `Scanning finished: ${received} direction${received === 1 ? '' : 's'} added. Drag any dot that looks off.` })}>
          <Square className="size-4" aria-hidden="true" />
          Finish scanning
        </Button>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={() => void start()} disabled={phase.kind === 'starting'}>
        {phase.kind === 'starting' ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Smartphone className="size-5" aria-hidden="true" />}
        Use my phone as a scanner
      </Button>
      {phase.kind === 'ended' && <p className="rounded-xl bg-teal-soft p-3 text-sm font-medium text-teal-deep">{phase.note}</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  )
}
