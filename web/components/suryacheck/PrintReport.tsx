import { useMemo } from 'react'
import { LogoMark } from './AppShell'
import { ObstacleLayer, PanelLayer } from './MapLayers'
import { inr, kw, lakhRange, num, yearsRange } from '@/lib/format'
import { polygonBounds, toPoints } from '@/lib/geometry'
import type { Lang } from '@/lib/i18n'
import { DEFAULT_PANEL, type PlanModel } from '@/lib/plan'

const TEXT = {
  en: {
    title: 'Rooftop Solar Report',
    tagline: 'Your plan, in numbers an installer can quote against.',
    prepared: 'Prepared on',
    ref: 'Report no.',
    site: 'Site',
    headline: 'The short version',
    panels: 'Solar panels',
    size: 'System size',
    energy: 'Energy per year',
    netCost: 'Cost after subsidy',
    payback: 'Pays back in',
    layout: 'Your roof layout',
    layoutNote: (tilt: string) => `Panels shown to scale on your marked roof. ${tilt}`,
    tiltAt: (t: number) => `Tilt ${t}°, facing south.`,
    flush: 'Panels lie flat on the roof slope.',
    breakdownTitle: 'Approximate cost breakdown',
    breakdownNote: 'A typical split of an installed rooftop system. Real quotes vary by brand and city.',
    item: 'Item',
    range: 'Approx. cost',
    modules: 'Solar panels (modules)',
    inverter: 'Inverter',
    structure: 'Mounting structure',
    wiring: 'Cables, protection and earthing',
    labour: 'Installation labour',
    paperwork: 'Net-metering and paperwork',
    total: 'Total before subsidy',
    subsidy: 'Government subsidy (PM Surya Ghar)',
    noSubsidy: 'Subsidy not available for this connection',
    net: 'You pay (approx.)',
    savingsTitle: 'What you earn back',
    yearSave: 'Saves per year',
    life: 'Saved over 25 years',
    lifeNote: 'Panels lose about 0.5% output each year; tariff taken as flat.',
    co2: 'CO₂ avoided per year',
    co2u: 'tonnes',
    assumeTitle: 'What this is based on',
    a1: 'Sunshine: live PVGIS data for your exact spot',
    a1b: 'Sunshine: a regional estimate (live data was not reachable)',
    a2: (n: number, w: number) => `Panels: ${n} × ${w} W, about ${DEFAULT_PANEL.widthM} × ${DEFAULT_PANEL.lengthM} m each`,
    a3: (n: number) => `Items on your roof that cast shade: ${n}`,
    a4: (n: number) => `Tall neighbouring buildings considered: ${n}`,
    a5: (p: number) => `Shade from buildings around you (skyline): about ${p}% of yearly energy`,
    a6: 'Sized to cover your yearly electricity use, not to fill the roof',
    nextTitle: 'Next steps',
    steps: [
      'Get two or three quotes and compare them against this report.',
      'Apply for the subsidy on the PM Surya Ghar national portal (pmsuryaghar.gov.in) with your installer.',
      'Your installer files the net-metering application with the electricity company.',
      'After inspection and the new meter, you start saving.',
    ],
    qsTitle: 'Questions to ask every installer',
    qs: [
      "Is the quote's kW the same as the panel total above?",
      'What is the panel brand and warranty?',
      'Is the subsidy paperwork included?',
      'Who handles net metering with the electricity company?',
      'What are the inverter brand and its warranty?',
      'What happens if the system makes less power than promised?',
    ],
    disclaimer:
      'This report is a planning estimate made from satellite pictures and public data. It is not a quotation or an engineering design. Prices, subsidy rules and tariffs change; confirm them with your installer and electricity company before you buy.',
    neighbour: 'Tall neighbour',
  },
  hi: {
    title: 'रूफटॉप सोलर रिपोर्ट',
    tagline: 'आपकी योजना, उन आंकड़ों में जिन पर इंस्टॉलर कोटेशन दे सके।',
    prepared: 'तैयार की गई',
    ref: 'रिपोर्ट संख्या',
    site: 'जगह',
    headline: 'संक्षेप में',
    panels: 'सोलर पैनल',
    size: 'सिस्टम का आकार',
    energy: 'सालाना बिजली',
    netCost: 'सब्सिडी के बाद लागत',
    payback: 'लागत वापसी',
    layout: 'आपकी छत का नक्शा',
    layoutNote: (tilt: string) => `आपकी चिह्नित छत पर पैनल नाप के अनुसार। ${tilt}`,
    tiltAt: (t: number) => `झुकाव ${t}°, दक्षिण की ओर।`,
    flush: 'पैनल छत की ढलान पर सपाट लगेंगे।',
    breakdownTitle: 'लागत का मोटा हिसाब',
    breakdownNote: 'लगे हुए रूफटॉप सिस्टम का सामान्य बंटवारा। असली कोटेशन ब्रांड और शहर से बदलते हैं।',
    item: 'मद',
    range: 'अनुमानित लागत',
    modules: 'सोलर पैनल (मॉड्यूल)',
    inverter: 'इन्वर्टर',
    structure: 'पैनल लगाने का ढांचा',
    wiring: 'केबल, सुरक्षा और अर्थिंग',
    labour: 'इंस्टॉलेशन का खर्च',
    paperwork: 'नेट-मीटरिंग और कागज़ी काम',
    total: 'सब्सिडी से पहले कुल',
    subsidy: 'सरकारी सब्सिडी (पीएम सूर्य घर)',
    noSubsidy: 'इस कनेक्शन पर सब्सिडी उपलब्ध नहीं',
    net: 'आप देंगे (लगभग)',
    savingsTitle: 'आपको क्या वापस मिलेगा',
    yearSave: 'सालाना बचत',
    life: '25 साल में बचत',
    lifeNote: 'पैनल हर साल लगभग 0.5% कम बिजली देते हैं; बिजली दर स्थिर मानी गई है।',
    co2: 'सालाना CO₂ में कमी',
    co2u: 'टन',
    assumeTitle: 'यह किस पर आधारित है',
    a1: 'धूप: आपकी सटीक जगह का PVGIS डेटा',
    a1b: 'धूप: क्षेत्रीय अनुमान (लाइव डेटा नहीं मिला)',
    a2: (n: number, w: number) => `पैनल: ${n} × ${w} वाट, हर एक लगभग ${DEFAULT_PANEL.widthM} × ${DEFAULT_PANEL.lengthM} मीटर`,
    a3: (n: number) => `छत पर छाया करने वाली चीज़ें: ${n}`,
    a4: (n: number) => `ऊंची पड़ोसी इमारतें गिनी गईं: ${n}`,
    a5: (p: number) => `आसपास की इमारतों की छाया: सालाना बिजली का लगभग ${p}%`,
    a6: 'आपके सालाना बिजली उपयोग के हिसाब से, छत भरने के हिसाब से नहीं',
    nextTitle: 'अगले कदम',
    steps: [
      'दो-तीन कोटेशन लें और इस रिपोर्ट से मिलाएं।',
      'इंस्टॉलर के साथ पीएम सूर्य घर पोर्टल (pmsuryaghar.gov.in) पर सब्सिडी के लिए आवेदन करें।',
      'इंस्टॉलर बिजली कंपनी में नेट-मीटरिंग का आवेदन देता है।',
      'निरीक्षण और नया मीटर लगने के बाद आपकी बचत शुरू।',
    ],
    qsTitle: 'हर इंस्टॉलर से पूछने के सवाल',
    qs: [
      'क्या कोटेशन का kW ऊपर के पैनल कुल के बराबर है?',
      'पैनल का ब्रांड और वारंटी क्या है?',
      'क्या सब्सिडी का कागज़ी काम शामिल है?',
      'बिजली कंपनी के साथ नेट मीटरिंग कौन करवाएगा?',
      'इन्वर्टर का ब्रांड और वारंटी क्या है?',
      'अगर सिस्टम वादे से कम बिजली बनाए तो क्या होगा?',
    ],
    disclaimer:
      'यह रिपोर्ट सैटेलाइट तस्वीरों और सार्वजनिक आंकड़ों से बना योजना-अनुमान है। यह कोटेशन या इंजीनियरिंग डिज़ाइन नहीं है। कीमतें, सब्सिडी नियम और बिजली दरें बदलती रहती हैं; खरीदने से पहले इंस्टॉलर और बिजली कंपनी से पक्का करें।',
    neighbour: 'ऊंची पड़ोसी इमारत',
  },
} as const

/** Typical share of an installed rooftop system's cost. Sums to 100. */
const SPLIT = [
  ['modules', 46],
  ['inverter', 14],
  ['structure', 12],
  ['wiring', 10],
  ['labour', 13],
  ['paperwork', 5],
] as const

const round1000 = (n: number) => Math.round(n / 1000) * 1000
const rs = ([a, b]: readonly [number, number]) => (a === b ? inr(a) : `${inr(a)} – ${inr(b)}`)

function RoofDrawing({ plan }: { plan: PlanModel }) {
  const b = polygonBounds(plan.roof.points)
  const m = Math.max(b.w, b.h) * 0.1
  return (
    <svg viewBox={`${b.minX - m} ${b.minY - m} ${b.w + 2 * m} ${b.h + 2 * m}`} className="mx-auto h-auto max-h-[330px] w-full" role="img" aria-label="Roof layout">
      <polygon points={toPoints(plan.roof.points)} fill="#FEF3C7" stroke="#D97706" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <ObstacleLayer obstacles={plan.obstacles} />
      <PanelLayer panels={plan.panels} />
    </svg>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h2 className="flex items-center gap-2 border-b-2 border-[#0F5C5E] pb-1 text-[15px] font-extrabold uppercase tracking-wide text-[#0F5C5E]">{title}</h2>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

/** Only shown when printing. The browser's "Save as PDF" turns it into the downloaded report. */
export function PrintReport({ plan, lang, placeName }: { plan: PlanModel; lang: Lang; placeName: string }) {
  const T = TEXT[lang]
  const { numbers, finance } = plan
  const meta = useMemo(() => {
    const d = new Date()
    return {
      date: d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      id: `SC-${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
    }
  }, [lang])

  const cost = finance.costRange
  const lifeSave = (yearly: number) => {
    let total = 0
    for (let y = 0; y < 25; y++) total += yearly * Math.pow(0.995, y)
    return Math.round(total / 1000) * 1000
  }
  const saveRange: [number, number] = [finance.savingsYearRange[0], finance.savingsYearRange[1]]
  const netLow = finance.netCostRange[0]
  const netHigh = finance.netCostRange[1]
  const lifeNet: [number, number] = [lifeSave(saveRange[0]) - netHigh, lifeSave(saveRange[1]) - netLow]
  const source = finance.source

  return (
    <div id="print-report" className="hidden bg-white text-[13px] leading-snug text-[#2b2118] print:block" style={{ fontFamily: 'inherit' }}>
      {/* Header band */}
      <header className="flex items-center justify-between rounded-xl bg-gradient-to-r from-[#0F5C5E] to-[#0B3D3F] px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <LogoMark className="size-12" />
          <div>
            <p className="text-2xl font-extrabold leading-none tracking-tight">SuryaCheck</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-100">{T.title}</p>
          </div>
        </div>
        <div className="text-right text-[11px] leading-5 text-teal-50">
          <p>
            {T.ref}: <b>{meta.id}</b>
          </p>
          <p>
            {T.prepared}: <b>{meta.date}</b>
          </p>
        </div>
      </header>

      <div className="mt-4 flex items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6a5a49]">{T.site}</p>
          <p className="text-base font-bold">{placeName || '—'}</p>
        </div>
        <p className="max-w-[48%] text-right text-[12px] italic text-[#6a5a49]">{T.tagline}</p>
      </div>

      {/* Headline numbers */}
      <Section title={T.headline}>
        <div className="grid grid-cols-5 gap-2">
          {[
            [T.panels, String(numbers.panelsFinal)],
            [T.size, kw(numbers.kWp)],
            [T.energy, `${num(numbers.kWhFinal)} kWh`],
            [T.netCost, lakhRange([netLow, netHigh])],
            [T.payback, yearsRange(finance.paybackRange)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-amber-200 bg-[#FFF8E7] px-2.5 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#6a5a49]">{k}</p>
              <p className="mt-1 text-[17px] font-extrabold text-[#0F5C5E]">{v}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Layout */}
      <Section title={T.layout}>
        <figure className="break-inside-avoid">
          <div className="rounded-lg border border-amber-200 bg-[#FFFCF3] p-4">
            <RoofDrawing plan={plan} />
          </div>
          <figcaption className="mt-2 text-center text-[12px] text-[#6a5a49]">
            <p>{T.layoutNote(plan.flush ? T.flush : T.tiltAt(plan.tilt))}</p>
            {plan.neighbours.length > 0 && (
              <p className="mt-1">{plan.neighbours.map((n) => `${T.neighbour}: ${n.side}, ${n.floors}`).join(' · ')}</p>
            )}
          </figcaption>
        </figure>
      </Section>

      {/* Savings */}
      <Section title={T.savingsTitle}>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-amber-200 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6a5a49]">{T.yearSave}</p>
            <p className="mt-1 text-[16px] font-extrabold">{rs(saveRange)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6a5a49]">{T.life}</p>
            <p className="mt-1 text-[16px] font-extrabold">{rs(lifeNet.map((v) => Math.max(0, v)) as [number, number])}</p>
            <p className="mt-0.5 text-[10px] text-[#6a5a49]">{T.lifeNote}</p>
          </div>
          <div className="rounded-lg border border-amber-200 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6a5a49]">{T.co2}</p>
            <p className="mt-1 text-[16px] font-extrabold">
              {finance.co2Tonnes} {T.co2u}
            </p>
          </div>
        </div>
      </Section>

      {/* Cost breakdown */}
      <Section title={T.breakdownTitle}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F3EBDD] text-left text-[11px] uppercase tracking-wide text-[#6a5a49]">
              <th className="px-3 py-1.5">{T.item}</th>
              <th className="px-3 py-1.5 text-right">{T.range}</th>
            </tr>
          </thead>
          <tbody>
            {SPLIT.map(([key, pct]) => (
              <tr key={key} className="border-b border-amber-100">
                <td className="px-3 py-1.5">{T[key]}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{rs([round1000((cost[0] * pct) / 100), round1000((cost[1] * pct) / 100)])}</td>
              </tr>
            ))}
            <tr className="border-b border-amber-200 font-bold">
              <td className="px-3 py-1.5">{T.total}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{rs(cost)}</td>
            </tr>
            <tr className="border-b border-amber-100 text-[#0F5C5E]">
              <td className="px-3 py-1.5">{finance.eligible ? T.subsidy : T.noSubsidy}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{finance.eligible ? `− ${inr(finance.subsidy)}` : '—'}</td>
            </tr>
            <tr className="bg-[#0F5C5E] font-extrabold text-white">
              <td className="px-3 py-2">{T.net}</td>
              <td className="px-3 py-2 text-right tabular-nums">{rs([netLow, netHigh])}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1.5 text-[11px] text-[#6a5a49]">{T.breakdownNote}</p>
      </Section>

      {/* Basis */}
      <Section title={T.assumeTitle}>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>{source === 'server' ? T.a1 : T.a1b}</li>
          <li>{T.a2(numbers.panelsFinal, Math.round(DEFAULT_PANEL.kWp * 1000))}</li>
          <li>{T.a3(plan.obstacles.length)}</li>
          <li>{T.a4(plan.neighbours.length)}</li>
          {plan.skylineLossPct > 0 && <li>{T.a5(Math.round(plan.skylineLossPct))}</li>}
          <li>{T.a6}</li>
        </ul>
      </Section>

      <div className="grid grid-cols-2 gap-6">
        <Section title={T.nextTitle}>
          <ol className="list-decimal space-y-1 pl-5">
            {T.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Section>
        <Section title={T.qsTitle}>
          <ul className="list-disc space-y-1 pl-5">
            {T.qs.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </Section>
      </div>

      <footer className="mt-6 border-t border-amber-200 pt-3 text-[10.5px] leading-snug text-[#6a5a49]">
        <p>{T.disclaimer}</p>
        <p className="mt-1 font-semibold text-[#0F5C5E]">SuryaCheck · {meta.id}</p>
      </footer>
    </div>
  )
}
