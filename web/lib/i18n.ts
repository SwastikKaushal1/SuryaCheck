export type Lang = 'en' | 'hi'

const dictionary = {
  en: {
    planTitle: 'Your solar plan',
    panels: 'Panels',
    systemSize: 'System size',
    subsidy: 'Subsidy',
    payback: 'Payback',
    yearlyEnergy: 'Energy per year',
    cost: 'Estimated cost',
    download: 'Download PDF',
    share: 'Share on WhatsApp',
    roofLayout: 'Your roof layout',
    preparedBy: 'Prepared by SuryaCheck. These are estimates; ask an installer for a site survey before you buy.',
    shareHeading: 'My solar plan',
    perYear: 'a year',
    neighbourNote: 'Tall neighbour',
    installerQs: 'Questions to ask installers',
    emi: 'Loan EMI per month',
    monthlySaving: 'Bill saving per month',
  },
  hi: {
    planTitle: 'आपकी सोलर योजना',
    panels: 'पैनल',
    systemSize: 'सिस्टम का आकार',
    subsidy: 'सब्सिडी',
    payback: 'लागत वापसी',
    yearlyEnergy: 'सालाना बिजली',
    cost: 'अनुमानित लागत',
    download: 'PDF डाउनलोड करें',
    share: 'WhatsApp पर शेयर करें',
    roofLayout: 'आपकी छत का नक्शा',
    preparedBy: 'SuryaCheck द्वारा तैयार। ये अनुमान हैं; खरीदने से पहले इंस्टॉलर से साइट सर्वे करवाएं।',
    shareHeading: 'मेरी सोलर योजना',
    perYear: 'सालाना',
    neighbourNote: 'ऊंची पड़ोसी इमारत',
    installerQs: 'इंस्टॉलर से पूछने के सवाल',
    emi: 'लोन की मासिक EMI',
    monthlySaving: 'हर महीने बिल में बचत',
  },
} as const

export type TextKey = keyof (typeof dictionary)['en']

export const t = (lang: Lang, key: TextKey): string => dictionary[lang][key]
