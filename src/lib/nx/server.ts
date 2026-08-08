import { type Kind, type Opportunity } from './opportunities';

// Server-only NX backend access (C-112, repurposed by ADR-010). Calls the real NX
// opportunity module (identity-service) via the gateway with the inter-service key,
// and maps a backend row to the frontend Opportunity shape. Real data end-to-end
// (C-135 §4): an unreachable backend resolves to `unavailable` (no opportunity) —
// never a fabricated sample. NEW-A: the gateway URL is server-only
// (API_GATEWAY_URL) — never shipped to the client.
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
    owner:    o.owner ? String(o.owner) : undefined,
    kind:     String(o.kind ?? '').toLowerCase() as Kind,
    title:    String(o.title ?? ''),
    org:      String(o.org ?? ''),
    summary:  String(o.summary ?? ''),
    location: String(o.location ?? ''),
    reward:   String(o.reward ?? ''),
    verified: Boolean(o.verified ?? false),
    featured: Boolean(o.featured ?? false),
    tags:     Array.isArray(o.tags) ? (o.tags as string[]) : [],
  };
}

// The caller's LIVE NX-Pro entitlement — read from commerce (Subscription owner, C-47)
// with the session JWT. NX never STORES billing (P5); it reflects it to gate FEATURED.
// Pro only while the period is live. Any failure → false (fail closed, P6).
export async function resolveProStatus(token: string | null): Promise<boolean> {
  if (!GW || !token) return false;
  try {
    const res = await fetch(`${GW}/api/commerce/subscriptions/status`, {
      headers: { ...gwHeaders(), Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    if (!res.ok) return false;
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const s = (d.data ?? d) as Record<string, unknown>;
    const plan = String(s.plan ?? s.tier ?? '').toUpperCase();
    const active  = s.isActive === true || s.active === true || (plan !== '' && plan !== 'FREE');
    const expired = s.isExpired === true;
    const end     = s.current_period_end ?? s.currentPeriodEnd ?? s.expires_at;
    const notExpired = !expired && (!end || new Date(String(end)).getTime() > Date.now());
    return active && notExpired && plan !== '' && plan !== 'FREE';
  } catch { return false; }
}

export interface PostResult { ok: boolean; status: number; opportunity?: Opportunity; error?: string; }

// Post an opportunity to the board (C-112 — NX owns the posting index). `owner` is the
// session identity resolved by the BFF (never a client field, P6); the backend validates
// kind/title + starts it UNVERIFIED (Zone/kyc verifies later — presented, never minted).
export async function postOpportunity(
  owner: string | null,
  input: { kind: string; title: string; org?: string; summary?: string; location?: string; reward?: string; tags?: string[] },
): Promise<PostResult> {
  if (!owner) return { ok: false, status: 401, error: 'Sign in to post an opportunity.' };
  if (!GW)    return { ok: false, status: 503, error: 'NX is unavailable right now.' };
  try {
    const res = await fetch(`${GW}/api/identity/nx/opportunity`, {
      method: 'POST', headers: gwHeaders(), body: JSON.stringify({ owner, ...input }), cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) {
      const o = (json?.data as Record<string, unknown> | undefined)?.opportunity;
      return { ok: true, status: 201, opportunity: o ? opportunityFromBackend(o as Record<string, unknown>) : undefined };
    }
    const msg = res.status === 400
      ? String((json as { message?: string })?.message ?? 'Please check the title and kind.')
      : 'Could not post. Please try again.';
    return { ok: false, status: res.status, error: msg };
  } catch { return { ok: false, status: 503, error: 'NX is unavailable right now.' }; }
}

// The caller's OWN posted opportunities (P6). `owner` derived from the session by the BFF.
export async function resolveMine(owner: string | null): Promise<Opportunity[]> {
  if (!GW || !owner) return [];
  try {
    const res = await fetch(`${GW}/api/identity/nx/mine/${encodeURIComponent(owner)}`, { headers: gwHeaders(), cache: 'no-store' });
    if (!res.ok) return [];
    const rows = (await res.json().catch(() => ({})))?.data?.results;
    return Array.isArray(rows) ? rows.map((o) => opportunityFromBackend(o as Record<string, unknown>)) : [];
  } catch { return []; }
}

// NX Pro — sync FEATURED on all the owner's posts to match live Pro (visibility only).
// Best-effort; never blocks a read.
export async function setFeaturedForOwner(owner: string | null, on: boolean): Promise<boolean> {
  if (!GW || !owner) return false;
  try {
    const res = await fetch(`${GW}/api/identity/nx/featured`, {
      method: 'PATCH', headers: gwHeaders(), body: JSON.stringify({ owner, featured: on }), cache: 'no-store',
    });
    return res.ok;
  } catch { return false; }
}

export interface ResolvedOpportunity {
  opportunity: Opportunity | null;
  source:      'live' | 'unavailable';
}

// One opportunity by handle — live backend only. A live 404 is authoritative
// (opportunity: null, source: 'live'); an unreachable backend resolves to
// (opportunity: null, source: 'unavailable'). Never a fabricated sample.
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
    } catch { /* unreachable → unavailable below */ }
  }
  return { opportunity: null, source: 'unavailable' };
}
