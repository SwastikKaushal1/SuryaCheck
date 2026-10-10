import { Download, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../Button'
import { Card, SectionTitle } from '../Card'
import { PrintReport } from '../PrintReport'
import { Tag, type TagKind } from '../Tag'
import type { LoanPlan } from '@/lib/finance'
import { inr, kw, lakhRange, num, rupeeRange, yearsRange } from '@/lib/format'
import { t, type Lang } from '@/lib/i18n'
import type { PlanModel } from '@/lib/plan'

const INSTALLER_QUESTIONS = [
  "Is the quote's kW the same as the panel total?",
  'What is the panel brand and warranty?',
  'Is the subsidy paperwork included?',
  'Who handles the net-metering application with the electricity company?',
  'What does the quote say about the inverter and its warranty?',
  'What happens if the system makes less power than promised?',
]

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return (
    <div role="group" aria-label="Language" className="flex rounded-full bg-sand p-0.5">
      {(['en', 'hi'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
          className={`min-h-11 min-w-11 rounded-full px-2.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/40 ${
            lang === l ? 'bg-teal-deep text-white' : 'text-ink'
          }`}
        >
          {l === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  )
}

function Row({ label, value, tag }: { label: string; value: string; tag: TagKind }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-900/10 py-3 last:border-b-0">
      <div className="flex flex-col gap-1">
        <span className="text-base text-ink-soft">{label}</span>
        <Tag kind={tag} />
      </div>
      <span className="text-right text-xl font-bold text-ink">{value}</span>
    </div>
  )
}

function planFacts(plan: PlanModel, lang: Lang, loan: LoanPlan | null): (readonly [string, string])[] {
  const { numbers, finance } = plan
  const facts: (readonly [string, string])[] = [
    [t(lang, 'panels'), String(numbers.panelsFinal)],
    [t(lang, 'systemSize'), kw(numbers.kWp)],
    [t(lang, 'yearlyEnergy'), `${num(numbers.kWhFinal)} kWh`],
    [t(lang, 'cost'), lakhRange(finance.costRange)],
    [t(lang, 'subsidy'), finance.eligible ? inr(finance.subsidy) : '₹0'],
    [t(lang, 'payback'), yearsRange(finance.paybackRange)],
  ]
  if (loan) {
    const emi = loan.emiRange[0] === loan.emiRange[1] ? inr(loan.emiRange[0]) : rupeeRange(loan.emiRange)
    facts.push([t(lang, 'emi'), emi], [t(lang, 'monthlySaving'), inr(loan.monthlySavings)])
  }
  return facts
}

/** The text sent through WhatsApp. */
export function whatsappText(plan: PlanModel, lang: Lang, placeName: string, loan: LoanPlan | null = null): string {
  const lines = planFacts(plan, lang, loan).map(([k, v]) => `${k}: ${v}`)
  return [`☀️ ${t(lang, 'shareHeading')}${placeName ? ` – ${placeName}` : ''}`, ...lines, '', t(lang, 'preparedBy')].join('\n')
}

/** A clean drawing of the roof and panels, used in the PDF so it prints sharply without map pictures. */
export function Summary({ plan, loan = null, lang, placeName = '' }: { plan: PlanModel; loan?: LoanPlan | null; lang: Lang; placeName?: string }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const facts = planFacts(plan, lang, loan)

  const shareOnWhatsApp = () => {
    const text = whatsappText(plan, lang, placeName, loan)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-6 print:hidden">
      <h1 className="text-2xl font-bold text-ink lg:col-span-2 lg:text-3xl">{t(lang, 'planTitle')}</h1>

      <div className="flex flex-col gap-5">
      <Card className="flex flex-col py-2">
        {facts.map(([label, value]) => (
          <Row key={label} label={label} value={value} tag="estimate" />
        ))}
      </Card>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
        <Button onClick={() => window.print()}>
          <Download className="size-5" aria-hidden="true" />
          {t(lang, 'download')}
        </Button>
        <Button variant="secondary" onClick={shareOnWhatsApp}>
          <MessageCircle className="size-5" aria-hidden="true" />
          {t(lang, 'share')}
        </Button>
      </div>
      </div>

      <section aria-label={t(lang, 'installerQs')} className="flex flex-col gap-3">
        <SectionTitle>{t(lang, 'installerQs')}</SectionTitle>
        <ul className="flex flex-col gap-2">
          {INSTALLER_QUESTIONS.map((q, i) => (
            <li key={q}>
              <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-amber-900/5 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-sun/40">
                <input
                  type="checkbox"
                  checked={!!checked[i]}
                  onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
                  className="mt-0.5 size-6 shrink-0 accent-teal-deep"
                />
                <span className={`text-base text-ink ${checked[i] ? 'text-ink-soft line-through' : ''}`}>
                  {q}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
    {typeof document !== 'undefined' && createPortal(<PrintReport plan={plan} lang={lang} placeName={placeName} />, document.body)}
    </>
  )
}
