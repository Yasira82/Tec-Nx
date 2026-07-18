// TEC NX — opportunity detail (C-112, repurposed by ADR-010). Read-only view of
// one opportunity. NX presents + routes you to the poster; it never moves capital
// (→ payment-service + FundX), verifies parties (→ Zone/KYC), or owns the graph
// (→ Connection). Investments shown are indicative/educational only.
import Link from 'next/link';
import type { Metadata } from 'next';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { getOpportunity, OPPORTUNITIES, KIND_META } from '@/lib/nx/opportunities';
import { resolveOpportunity } from '@/lib/nx/server';

// Pre-render the curated sample handles; allow live-only backend handles to render
// on demand (the NX opportunity module is the index of record — ADR-010).
export function generateStaticParams() {
  return OPPORTUNITIES.map((o) => ({ id: o.id }));
}
export const dynamicParams = true;

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const o = getOpportunity(id);
  return {
    title:       o ? `${o.title} — TEC NX` : 'TEC NX — Opportunity',
    description: o ? `${o.title}: ${o.summary}` : 'An opportunity on TEC NX (C-112).',
  };
}

export default async function OpportunityPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Resolve from the live NX backend (opportunity module); fall back to the curated
  // sample so the page never 500s (the board is always available — ADR-010).
  const { opportunity: o } = await resolveOpportunity(id);

  const wrap: React.CSSProperties = {
    minHeight: '100vh', background: TEC_COLORS.bg, color: TEC_COLORS.text,
    padding: '32px 22px', fontFamily: 'system-ui, -apple-system, sans-serif',
  };
  const inner: React.CSSProperties = { maxWidth: 680, margin: '0 auto' };

  if (!o) {
    return (
      <main style={wrap}>
        <div style={inner}>
          <Link href="/app" style={{ fontSize: 13, color: TEC_COLORS.gold, textDecoration: 'none' }}>← Opportunities</Link>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: TEC_COLORS.text, marginTop: 16 }}>Opportunity not found</h1>
          <p style={{ fontSize: 13, color: TEC_COLORS.subtext }}>No opportunity <code>{id}</code> on the board.</p>
        </div>
      </main>
    );
  }

  const meta = KIND_META[o.kind];
  const factCard: React.CSSProperties = {
    background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.gold}22`,
    borderRadius: 12, padding: 14,
  };

  return (
    <main style={wrap}>
      <div style={inner}>
        <Link href="/app" style={{ fontSize: 13, color: TEC_COLORS.gold, textDecoration: 'none' }}>← Opportunities</Link>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1, color: TEC_COLORS.subtext, textTransform: 'uppercase' }}>{meta.icon} {meta.label} · {o.org}</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: TEC_COLORS.gold, margin: '4px 0 0' }}>{o.title}</h1>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: o.verified ? '#0a0800' : TEC_COLORS.text, background: o.verified ? `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})` : 'transparent', border: o.verified ? 'none' : `1px solid ${TEC_COLORS.subtext}66`, borderRadius: 999, padding: '6px 12px', whiteSpace: 'nowrap' }}>
            {o.verified ? '✅ Verified poster' : 'Unverified'}
          </div>
        </div>

        <p style={{ fontSize: 14, color: TEC_COLORS.subtext, margin: '14px 0 0', lineHeight: 1.6 }}>{o.summary}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 20 }}>
          <div style={factCard}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEC_COLORS.text }}>💠 Reward</div>
            <div style={{ fontSize: 12, color: TEC_COLORS.subtext, marginTop: 5, lineHeight: 1.5 }}>{o.reward} · indicative (ADR-010). Capital moves via payment-service + FundX, never NX.</div>
          </div>
          <div style={factCard}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEC_COLORS.text }}>📍 Location</div>
            <div style={{ fontSize: 12, color: TEC_COLORS.subtext, marginTop: 5, lineHeight: 1.5 }}>{o.location}</div>
          </div>
          <div style={factCard}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEC_COLORS.text }}>🛡️ Trust</div>
            <div style={{ fontSize: 12, color: TEC_COLORS.subtext, marginTop: 5, lineHeight: 1.5 }}>
              {o.verified ? 'Poster is KYC/Zone-verified — NX presents the badge, never mints it.' : 'Poster not yet verified. NX never self-certifies a party.'}
            </div>
          </div>
        </div>

        {o.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
            {o.tags.map((t) => (
              <span key={t} style={{ fontSize: 11, color: TEC_COLORS.gold, border: `1px solid ${TEC_COLORS.gold}33`, borderRadius: 999, padding: '3px 10px' }}>#{t}</span>
            ))}
          </div>
        )}

        <p style={{ fontSize: 11, color: TEC_COLORS.subtext, margin: '22px 0 0', lineHeight: 1.5 }}>
          This is a read-only sample. NX matches + presents opportunities and routes you
          to the poster — verification via Zone/KYC, trust via Connection, capital via
          payment-service + FundX. NX is the Opportunity Exchange (ADR-010), not a security app.
        </p>
      </div>
    </main>
  );
}
