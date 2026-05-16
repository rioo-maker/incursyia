export const metadata = {
  title: 'Privacy Policy — IncursYIA',
}

export default function PrivacyPage() {
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
      }}>Privacy Policy</h1>
      <p style={meta}>Last updated: May 2025</p>

      <Section title="1. Data We Collect">
        <ul style={list}>
          <li><strong>Account information:</strong> Email address, name, company name.</li>
          <li><strong>Payment information:</strong> Processed securely by Stripe. We do not store card numbers.</li>
          <li><strong>Usage data:</strong> Features used, actions performed, timestamps, device/browser type.</li>
          <li><strong>Business data:</strong> Content you create or connect (emails, social posts, analytics) for AI processing.</li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Data">
        <ul style={list}>
          <li>Operating and improving the IncursYIA platform.</li>
          <li>Processing payments and managing subscriptions.</li>
          <li>Providing AI-powered automation and insights.</li>
          <li>Sending service-related communications (billing, updates, security alerts).</li>
          <li>Aggregated analytics to improve our service (no individual tracking).</li>
        </ul>
      </Section>

      <Section title="3. Data Processors">
        <p>We work with the following third-party processors:</p>
        <ul style={list}>
          <li><strong>Supabase</strong> — Database and authentication (EU/US).</li>
          <li><strong>Vercel</strong> — Application hosting (global edge network).</li>
          <li><strong>Stripe</strong> — Payment processing (PCI DSS compliant).</li>
          <li><strong>OpenAI / Anthropic</strong> — AI model providers for task automation.</li>
        </ul>
        <p style={{ marginTop: 12 }}>All processors are bound by data processing agreements ensuring appropriate safeguards.</p>
      </Section>

      <Section title="4. Data Retention">
        <ul style={list}>
          <li><strong>Active accounts:</strong> Data retained for the duration of your account.</li>
          <li><strong>After deletion:</strong> Personal data is permanently deleted within 30 days of account closure.</li>
          <li><strong>Legal obligations:</strong> Billing records may be retained as required by tax/accounting law.</li>
        </ul>
      </Section>

      <Section title="5. Your Rights">
        <p>Under GDPR and applicable data protection laws, you have the right to:</p>
        <ul style={list}>
          <li><strong>Access</strong> — Request a copy of your personal data.</li>
          <li><strong>Correction</strong> — Update inaccurate or incomplete data.</li>
          <li><strong>Deletion</strong> — Request erasure of your personal data.</li>
          <li><strong>Portability</strong> — Receive your data in a structured, machine-readable format.</li>
          <li><strong>Objection</strong> — Object to processing based on legitimate interest.</li>
          <li><strong>Restriction</strong> — Request limited processing in certain circumstances.</li>
        </ul>
        <p style={{ marginTop: 12 }}>To exercise any of these rights, contact <a href="mailto:contact@incursyia.com" style={link}>contact@incursyia.com</a>. We will respond within 30 days.</p>
      </Section>

      <Section title="6. Cookies">
        <p>We use minimal cookies strictly necessary for the service:</p>
        <ul style={list}>
          <li><strong>Authentication session cookie</strong> — Keeps you logged in. Essential, no consent required.</li>
          <li>We do <strong>not</strong> use advertising cookies, tracking pixels, or third-party analytics cookies.</li>
        </ul>
      </Section>

      <Section title="7. Security">
        <p>We implement industry-standard measures including encryption in transit (TLS), encryption at rest, access controls, and regular security reviews. Despite these measures, no system is 100% secure.</p>
      </Section>

      <Section title="8. International Transfers">
        <p>Your data may be processed in the United States and European Union through our processors. All transfers are protected by standard contractual clauses or equivalent safeguards.</p>
      </Section>

      <Section title="9. Changes to This Policy">
        <p>We will notify you of material changes via email or in-app notification at least 14 days before they take effect.</p>
      </Section>

      <Section title="10. Contact">
        <p>For privacy requests or questions:<br />
          <a href="mailto:contact@incursyia.com" style={link}>contact@incursyia.com</a>
        </p>
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
