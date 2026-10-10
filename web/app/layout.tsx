import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Hind } from 'next/font/google'
import './globals.css'

const hind = Hind({
  subsets: ['latin', 'devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hind',
})

/** Bold display face for the start page. The app screens keep Hind, which also covers Hindi. */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
})

export const metadata: Metadata = {
  title: 'SuryaCheck - free rooftop solar planner for Indian homes',
  description:
    'Find out what your roof can produce. A free, 3-minute rooftop solar planner for Indian homeowners. No sign-up.',
  icons: { icon: '/icon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#F59E0B',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${hind.variable} ${bricolage.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
