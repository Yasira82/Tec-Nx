import { getOpportunity, type Kind, type Opportunity } from './opportunities';

// Server-only NX backend access (C-112, repurposed by ADR-010). Calls the real NX
// opportunity module (identity-service) via the gateway with the inter-service key,
// and maps a backend row to the frontend Opportunity shape. Everything here degrades
// to the curated static board so the app is never blank / never 500s. NEW-A: the
// gateway URL is server-only (API_GATEWAY_URL) — never shipped to the client.
const GW = process.env.API_GATEWAY_URL ?? '';

const gwHeaders = () => ({
  'Content-Type': 'application/json',
  'x-request-id': crypto.randomUUID(),
  ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
});

// backend (nx_opportunities) → frontend Opportunity. `kind` and `verified` are
// PRESENTED, not minted here — verification is Zone/kyc's (ADR-010).
export function opportunityFromBackend(o: Record<string, unknown>): Opportunity {
  return {
    id:       String(o.handle ?? ''),
    kind:     String(o.kind ?? '').toLowerCase() as Kind,
    title:    String(o.title ?? ''),
    org:      String(o.org ?? ''),
    summary:  String(o.summary ?? ''),
    location: String(o.location ?? ''),
    reward:   String(o.reward ?? ''),
    verified: Boolean(o.verified ?? false),
    tags:     Array.isArray(o.tags) ? (o.tags as string[]) : [],
  };
}

export interface ResolvedOpportunity {
  opportunity: Opportunity | null;
  source:      'live' | 'sample';
}

// One opportunity by handle — live backend first, curated sample as fallback. A live
// 404 is authoritative (opportunity: null, source: 'live'); an unreachable backend
// falls back to the sample board (source: 'sample').
export async function resolveOpportunity(id: string): Promise<ResolvedOpportunity> {
  if (GW) {
    try {
      const res = await fetch(`${GW}/api/identity/nx/opportunity/${encodeURIComponent(id)}`, {
        headers: gwHeaders(), cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const o = data?.data?.opportunity;
        if (o) return { opportunity: opportunityFromBackend(o as Record<string, unknown>), source: 'live' };
      }
      if (res.status === 404) return { opportunity: null, source: 'live' };
    } catch { /* fall through to the curated static board */ }
  }
  return { opportunity: getOpportunity(id), source: 'sample' };
}
