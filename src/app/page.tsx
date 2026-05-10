'use client'
import { useState } from 'react'
import { Nav } from '@/components/Nav'
import { Hero } from '@/components/Hero'
import { LiveStats } from '@/components/LiveStats'
import { Features } from '@/components/Features'
import { Steps } from '@/components/Steps'
import { FAQ } from '@/components/FAQ'
import { CTA } from '@/components/CTA'
import { Footer } from '@/components/Footer'
import { SignupModal } from '@/components/SignupModal'

export default function Home() {
  const [showSignup, setShowSignup] = useState(false)

  const handleCTA = () => setShowSignup(true)
  const handleDash = () => { window.location.href = '/dashboard' }

  return (
    <>
      <Nav onCTA={handleCTA} />
      <main>
        <Hero onCTA={handleCTA} onDash={handleDash} />
        <LiveStats />
        <Features />
        <Steps />
        <FAQ />
        <CTA onCTA={handleCTA} />
      </main>
      <Footer />
      <SignupModal open={showSignup} onClose={() => setShowSignup(false)} />
    </>
  )
}
