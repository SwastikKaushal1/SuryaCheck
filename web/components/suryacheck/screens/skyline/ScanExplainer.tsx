import { Camera, Lock, Smartphone } from 'lucide-react'
import { Button } from '../../Button'
import { Card } from '../../Card'

const REASONS = [
  {
    icon: Camera,
    title: 'Camera',
    text: 'To see where buildings and trees cut off the sky around your roof.',
  },
  {
    icon: Smartphone,
    title: 'Motion and compass',
    text: 'To know which way you are facing and how high you are pointing.',
  },
  {
    icon: Lock,
    title: 'Private',
    text: 'The video never leaves your phone.',
  },
]

export function ScanExplainer({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Scan your skyline</h1>
        <p className="text-base text-ink-soft">
          Stand on your roof and turn slowly. You will stop at five points, east to west.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {REASONS.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Card className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-deep">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-base font-bold text-ink">{title}</p>
                <p className="text-base text-ink-soft">{text}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <Button onClick={onStart}>Allow and start</Button>
        <Button variant="ghost" onClick={onSkip}>
          Not now
        </Button>
      </div>
    </div>
  )
}
