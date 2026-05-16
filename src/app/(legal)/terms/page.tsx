export const metadata = {
  title: 'Terms of Service — IncursYIA',
}

export default function TermsPage() {
  return (
    <article style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 16,
      padding: 'clamp(24px, 5vw, 48px)',
    }}>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(28px, 4vw, 36px)',
        color: 'var(--text-primary)',
        marginBottom: 8,
      }}>Terms of Service</h1>
      <p style={meta}>Last updated: May 2025</p>

      <Section title="1. Service Description">
        <p>IncursYIA is an AI-powered co-founder platform that automates business tasks including marketing, email campaigns, social media management, analytics, and revenue tracking. The service is provided on a subscription basis.</p>
      </Section>

      <Section title="2. Account & User Obligations">
        <ul style={list}>
          <li>You must provide accurate and up-to-date information when creating an account.</li>
          <li>You are responsible for maintaining the security of your credentials.</li>
          <li>You agree not to use the platform for any illegal, fraudulent, or harmful activity.</li>
          <li>You must not attempt to reverse-engineer, exploit, or abuse the platform or its AI systems.</li>
        </ul>
      </Section>

      <Section title="3. Subscription & Billing">
        <ul style={list}>
          <li><strong>Plans:</strong> Free, Pro ($29/month), Business ($99/month).</li>
          <li><strong>Billing cycle:</strong> Monthly, charged in advance via Stripe.</li>
          <li><strong>Cancellation:</strong> You may cancel at any time. Access continues until the end of your current billing period.</li>
          <li><strong>Refunds:</strong> Full refund available within 14 days of initial purchase or plan upgrade, provided usage has been minimal.</li>
        </ul>
      </Section>

      <Section title="4. Platform Commission">
        <p>The platform may apply a commission on revenue generated through integrated services (e.g., connected stores, ad campaigns managed by IncursYIA). Commission rates, if applicable, will be clearly communicated before activation of relevant features.</p>
      </Section>

      <Section title="5. Intellectual Property">
        <ul style={list}>
          <li><strong>Your content:</strong> You retain full ownership of all content, data, and materials you provide or generate through the platform.</li>
          <li><strong>Our platform:</strong> IncursYIA, its code, design, AI models, and branding are the exclusive property of IncursYIA and its licensors.</li>
        </ul>
      </Section>

      <Section title="6. AI Disclaimer">
        <p>IncursYIA uses artificial intelligence to generate suggestions, automate tasks, and provide business insights. AI outputs are provided &quot;as-is&quot; and are <strong>not guaranteed</strong> to be accurate, complete, or suitable for any specific purpose. They do not constitute financial, legal, or professional advice. You are responsible for reviewing and validating all AI-generated actions before relying on them.</p>
      </Section>

      <Section title="7. Limitation of Liability">
        <p>To the maximum extent permitted by law, IncursYIA shall not be liable for any indirect, incidental, consequential, or special damages arising from your use of the platform. Our total liability is limited to the amount you paid in the 12 months preceding the claim.</p>
      </Section>

      <Section title="8. Termination">
        <p>We may suspend or terminate your account if you violate these terms, engage in abusive behavior, or if required by law. Upon termination, your data will be retained for 30 days to allow export, then permanently deleted.</p>
      </Section>

      <Section title="9. Modifications">
        <p>We may update these terms from time to time. You will be notified at least 30 days before material changes take effect. Continued use of the platform after the effective date constitutes acceptance.</p>
      </Section>

      <Section title="10. Governing Law">
        <p>These terms are governed by applicable international commercial law. Disputes will first be addressed through good-faith negotiation. If unresolved, disputes may be submitted to arbitration or the competent courts agreed upon by both parties.</p>
      </Section>

      <Section title="11. Contact">
        <p>For questions about these terms, contact us at: <a href="mailto:contact@incursyia.com" style={link}>contact@incursyia.com</a></p>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{
        fontFamily: 'var(--font-body)',
        fontSize: 18,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 12,
      }}>{title}</h2>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        lineHeight: 1.75,
        color: 'var(--text-secondary)',
      }}>{children}</div>
    </section>
  )
}

const meta: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  color: 'var(--text-muted)',
  marginBottom: 0,
}

const list: React.CSSProperties = {
  paddingLeft: 20,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const link: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'none',
}
