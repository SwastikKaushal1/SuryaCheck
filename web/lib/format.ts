import type { Range } from './mockData'

const IN = 'en-IN'

export const num = (n: number) => Math.round(n).toLocaleString(IN)

export const inr = (n: number) => `₹${Math.round(n).toLocaleString(IN)}`

export const rupeeRange = ([a, b]: Range) => `${inr(a)}–${Math.round(b).toLocaleString(IN)}`

const lakh = (n: number) => (n / 100000).toFixed(2).replace(/(\.\d)0$/, '$1')

export const lakhRange = ([a, b]: Range) => `₹${lakh(a)}–${lakh(b)} lakh`

export const yearsRange = ([a, b]: Range) => (a <= 0 && b <= 0 ? '—' : `${a}–${b} years`)

export const kw = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} kW`
