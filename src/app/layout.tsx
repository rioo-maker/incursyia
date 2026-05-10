import type { Metadata } from 'next'
import { Instrument_Serif, Outfit } from 'next/font/google'
import './globals.css'

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'IncursYIA — Your Autonomous AI Co-Founder',
  description:
    'An AI that plans, builds, automates, publishes, analyzes, and grows your business every day — without supervision.',
  openGraph: {
    title: 'IncursYIA — Your Autonomous AI Co-Founder',
    description: 'An AI that plans, builds, automates, publishes, analyzes, and grows your business every day.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  )
}
