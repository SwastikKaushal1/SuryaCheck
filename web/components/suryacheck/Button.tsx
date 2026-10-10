import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-sun text-ink shadow-[0_8px_18px_-8px_rgba(217,119,6,0.8)] hover:bg-sun-dark hover:text-white',
  secondary: 'border-2 border-teal-deep bg-white text-teal-deep hover:bg-teal-soft',
  ghost: 'text-teal-deep hover:bg-teal-soft',
  danger: 'border-2 border-red-200 bg-white text-red-800 hover:bg-red-50',
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 py-2 text-base font-semibold transition active:scale-[0.98] lg:enabled:hover:-translate-y-px lg:enabled:hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}
