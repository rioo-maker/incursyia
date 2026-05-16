export const metadata = {
  title: 'Legal Mentions — IncursYIA',
}

export default function LegalMentionsPage() {
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
      }}>Legal Mentions</h1>
      <p style={meta}>Last updated: May 2025</p>

      <Section title="Platform">
        <InfoRow label="Name" value="IncursYIA" />
        <InfoRow label="Description" value="AI-powered autonomous co-founder platform" />
        <InfoRow label="Website" value="incursyia.com" />
      </Section>

      <Section title="Editor">
        <InfoRow label="Name" value="[Your Name]" />
        <InfoRow label="Status" value="Individual entrepreneur" />
        <InfoRow label="Location" value="Abidjan, Ivory Coast (Cote d'Ivoire)" />
        <InfoRow label="Contact" value="contact@incursyia.com" isEmail />
      </Section>

      <Section title="Hosting">
        <InfoRow label="Provider" value="Vercel Inc." />
        <InfoRow label="Address" value="340 S Lemon Ave #4133, Walnut, CA 91789, USA" />
        <InfoRow label="Website" value="vercel.com" />
      </Section>

      <Section title="Database">
        <InfoRow label="Provider" value="Supabase Inc." />
        <InfoRow label="Location" value="San Francisco, CA, USA" />
        <InfoRow label="Website" value="supabase.com" />
      </Section>

      <Section title="Payment Processing">
        <InfoRow label="Provider" value="Stripe Inc." />
        <InfoRow label="Location" value="San Francisco, CA, USA" />
        <InfoRow label="Compliance" value="PCI DSS Level 1 certified" />
      </Section>

      <Section title="Intellectual Property">
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          lineHeight: 1.75,
          color: 'var(--text-secondary)',
        }}>
          All elements of the IncursYIA platform (design, code, branding, content) are protected by intellectual property law. Reproduction or use without prior authorization is prohibited.
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
        marginBottom: 16,
      }}>{title}</h2>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>{children}</div>
    </section>
  )
}

function InfoRow({ label, value, isEmail }: { label: string; value: string; isEmail?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      fontFamily: 'var(--font-body)',
      fontSize: 15,
      lineHeight: 1.6,
    }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 120 }}>{label}:</span>
      {isEmail ? (
        <a href={`mailto:${value}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{value}</a>
      ) : (
        <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
      )}
    </div>
  )
}

const meta: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  color: 'var(--text-muted)',
  marginBottom: 0,
}
