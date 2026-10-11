'use client'

import { useEffect, useState } from 'react'
import App from '@/components/suryacheck/App'
import { ScannerPage } from '@/components/suryacheck/ScannerPage'

export default function Page() {
  // "/?scan=1234" opens the phone scanner paired with a laptop. Read after mount: the page is a static export.
  const [scanCode, setScanCode] = useState<string | null>(null)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.has('scan')) setScanCode(p.get('scan') ?? '')
  }, [])
  return scanCode !== null ? <ScannerPage initialCode={scanCode} /> : <App />
}
