import { Camera, CheckCircle2, LoaderCircle, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { Logo } from './AppShell'
import { Button } from './Button'
import { askMotionPermission, PhoneScan } from './screens/skyline/PhoneScan'
import { api, toApiError } from '@/lib/api'

type Stage = 'code' | 'scanning' | 'done'

/**
 * The phone side of "use my phone as a scanner" (opened at /?scan=1234).
 * The phone has the camera and compass; every mark goes straight to the laptop that showed the code.
 */
export function ScannerPage({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.replace(/\D/g, '').slice(0, 4))
  const [stage, setStage] = useState<Stage>('code')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(0)
  const [failed, setFailed] = useState(false)

  const start = async () => {
    if (!/^\d{4}$/.test(code)) {
      setError('Enter the 4-digit code shown on your laptop.')
      return
    }
    setBusy(true)
    setError('')
    // Ask for motion access first: on iPhone this has to come straight from the tap.
    await askMotionPermission()
    try {
      await api.pairHello(code)
      setStage('scanning')
    } catch (e) {
      setError(toApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const send = (job: Promise<{ count: number }>) =>
    job.then(
      (r) => {
        setSent(r.count)
        setFailed(false)
      },
      () => setFailed(true),
    )

  if (stage === 'scanning') {
    return (
      <PhoneScan
        status={failed ? 'Not reaching your laptop. Check your internet.' : `Linked to your laptop · code ${code} · ${sent} readings sent`}
        onProfile={(marks) => void send(api.pairProfile(code, marks))}
        doneLabel="Send to my laptop"
        onDone={(marks) => {
          void send(api.pairProfile(code, marks))
          setStage('done')
        }}
        onCancel={() => setStage('code')}
      />
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream px-5 py-6">
      <Logo />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
        {stage === 'done' ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="size-14 text-teal-deep" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-ink">Done! Check your laptop.</h1>
            <p className="text-base text-ink-soft">
              {sent} readings sent. Your skyline is on the laptop now: it shows when the sun is hidden, and you can fix any point there.
            </p>
            <Button variant="secondary" onClick={() => setStage('scanning')}>
              <Camera className="size-5" aria-hidden="true" />
              Scan more
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Smartphone className="size-10 text-sun-dark" aria-hidden="true" />
              <h1 className="text-2xl font-bold text-ink">Use this phone as a scanner</h1>
              <p className="text-base text-ink-soft">
                Enter the code shown on your laptop. Then stand on your roof and point this phone at the tallest building or tree in each direction.
              </p>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-ink">Code from your laptop</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                  setError('')
                }}
                placeholder="1234"
                className="h-16 rounded-2xl border-2 border-input bg-white text-center text-4xl font-bold tracking-[0.5em] text-ink outline-none focus:border-sun-dark focus:ring-4 focus:ring-sun/30"
              />
            </label>
            {error && (
              <p role="alert" className="text-base font-medium text-red-800">
                {error}
              </p>
            )}
            <Button onClick={() => void start()} disabled={busy || code.length !== 4} className="min-h-14 text-lg">
              {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Camera className="size-5" aria-hidden="true" />}
              Start scanning
            </Button>
          </>
        )}
      </main>
    </div>
  )
}
