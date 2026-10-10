import type { Lang } from './i18n'
import type { Range } from './mockData'

const IN = 'en-IN'

export const num = (n: number) => Math.round(n).toLocaleString(IN)

export const inr = (n: number) => `₹${Math.round(n).toLocaleString(IN)}`

export const rupeeRange = ([a, b]: Range) => `${inr(a)}–${Math.round(b).toLocaleString(IN)}`

const lakh = (n: number) => (n / 100000).toFixed(2).replace(/(\.\d)0$/, '$1')

export const lakhRange = ([a, b]: Range, lang: Lang = 'en') => `₹${lakh(a)}–${lakh(b)} ${lang === 'hi' ? 'लाख' : 'lakh'}`

export const yearsRange = ([a, b]: Range, lang: Lang = 'en') =>
  a <= 0 && b <= 0 ? '—' : `${a}–${b} ${lang === 'hi' ? 'साल' : 'years'}`

/** Yearly energy: "5,350 kWh" or, in Hindi, "5,350 यूनिट" (the word on every Indian bill). */
export const unitsYear = (kWh: number, lang: Lang = 'en') => `${num(kWh)} ${lang === 'hi' ? 'यूनिट' : 'kWh'}`

/** Area the way Indian homeowners think about it: 191 -> "about 228 gaj · 2,056 sq ft". */
export const areaInLocalUnits = (m2: number) => `about ${num(m2 * 1.19599)} gaj · ${num(m2 * 10.7639)} sq ft`

export const kw =(n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} kW`
