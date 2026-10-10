import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Tag, type TagKind } from './Tag'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white p-4 shadow-[0_4px_20px_-6px_rgba(120,80,20,0.18)] ring-1 ring-amber-900/5 lg:transition-shadow lg:hover:shadow-[0_10px_30px_-8px_rgba(120,80,20,0.3)]',
        className,
      )}
      {...props}
    />
  )
}

export function SectionTitle({ children, tag }: { children: ReactNode; tag?: TagKind }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-lg font-bold text-ink">{children}</h2>
      {tag && <Tag kind={tag} />}
    </div>
  )
}

export function StatCard({
  label,
  value,
  note,
  tag,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  tag: TagKind
}) {
  return (
    <Card className="flex flex-col gap-1.5 p-3.5">
      <p className="text-sm font-medium text-ink-soft">{label}</p>
      <p className="text-2xl font-bold leading-tight text-ink">{value}</p>
      {note && <p className="text-xs text-ink-soft">{note}</p>}
      <Tag kind={tag} className="mt-auto self-start" />
    </Card>
  )
}
