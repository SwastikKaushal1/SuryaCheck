import { CameraOff } from 'lucide-react'
import { Button } from '../../Button'
import { Card } from '../../Card'

export function ScanFailed({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-red-50 text-red-800">
          <CameraOff className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-ink">We could not use your camera</h1>
        <p className="text-base text-ink-soft" role="alert">
          Camera or motion access was turned off, so we cannot scan the sky. Nothing is lost. Your
          plan is exactly as you left it.
        </p>
        <p className="text-sm text-ink-soft">
          To try again, allow camera and motion access in your phone&apos;s browser settings.
        </p>
      </Card>
      <div className="flex flex-col gap-3">
        <Button onClick={onRetry}>Try again</Button>
        <Button variant="secondary" onClick={onBack}>
          Back to my plan
        </Button>
      </div>
    </div>
  )
}
