import { cn } from '@/lib/utils'

export type TagKind = 'estimate' | 'pvgis' | 'input'

const LABELS: Record<TagKind, string> = {
  estimate: 'estimate',
  pvgis: 'from PVGIS',
  input: 'your input',
}

const STYLES: Record<TagKind, string> = {
  estimate: 'bg-amber-100 text-amber-900 ring-amber-300',
  pvgis: 'bg-teal-soft text-teal-deep ring-teal-deep/30',
  input: 'bg-sky-100 text-sky-900 ring-sky-300',
}

export function Tag({ kind, className }: { kind: TagKind; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ring-1 ring-inset',
        STYLES[kind],
        className,
      )}
    >
      {LABELS[kind]}
    </span>
  )
}
