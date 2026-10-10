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

/** Questions to take to every installer (summary screen and checklist). */
export const INSTALLER_QUESTIONS: Record<Lang, string[]> = {
  en: [
    "Is the quote's kW the same as the panel total?",
    'What is the panel brand and warranty?',
    'Is the subsidy paperwork included?',
    'Who handles the net-metering application with the electricity company?',
    'What does the quote say about the inverter and its warranty?',
    'What happens if the system makes less power than promised?',
  ],
  hi: [
    'क्या कोटेशन में लिखा kW पैनलों के कुल जोड़ के बराबर है?',
    'पैनल किस ब्रांड के हैं और उनकी वारंटी कितनी है?',
    'क्या सब्सिडी के कागज़ात का काम इसमें शामिल है?',
    'बिजली कंपनी में नेट-मीटरिंग का आवेदन कौन करेगा?',
    'कोटेशन में इन्वर्टर और उसकी वारंटी के बारे में क्या लिखा है?',
    'अगर सिस्टम वादे से कम बिजली बनाए तो क्या होगा?',
  ],
}

/** The small source tags ("estimate", "from PVGIS", "your input"). */
export const TAG_TEXT: Record<Lang, { estimate: string; pvgis: string; input: string }> = {
  en: { estimate: 'estimate', pvgis: 'from PVGIS', input: 'your input' },
  hi: { estimate: 'अनुमान', pvgis: 'PVGIS से', input: 'आपकी जानकारी' },
}

export const t = (lang: Lang, key: TextKey): string => dictionary[lang][key]
