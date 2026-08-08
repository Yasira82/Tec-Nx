import { NextRequest, NextResponse } from 'next/server';
import { KINDS, type Kind } from '@/lib/nx/opportunities';
import { opportunityFromBackend, postOpportunity, resolveProStatus, setFeaturedForOwner } from '@/lib/nx/server';
import { isE2eMode, e2eStub } from '@/lib/server/e2e-mode';

// Identity is derived from the `tec_user` session cookie server-side — NEVER the body (P6).
function ownerFromSession(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('tec_user')?.value ?? '';
    if (!raw) return null;
    let u: Record<string, unknown>;
    try { u = JSON.parse(raw); } catch { u = JSON.parse(decodeURIComponent(raw)); }
    const owner = (u.piUsername ?? u.username) as string | undefined;
    return owner && owner.trim() ? owner : null;
  } catch { return null; }
}

// GET /api/bff/nx/opportunities?q=&kind= — the Opportunity Exchange board
// (C-112, repurposed by ADR-010). NX matches + ranks opportunities. Server-only:
// calls the real NX backend (opportunity module in identity-service) via the
// gateway and returns source:'live'. Real data end-to-end (C-135 §4): an
// unreachable backend returns source:'unavailable' with an empty board — never a
// fabricated sample. Public board info; no capital, no verification, no graph
// mutation here (ADR-010). NEW-A: the gateway URL is server-only (API_GATEWAY_URL).
const GW = process.env.API_GATEWAY_URL ?? '';

const gwHeaders = () => ({
  'Content-Type': 'application/json',
  'x-request-id': crypto.randomUUID(),
  ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
});

export async function GET(req: NextRequest) {
  const sp   = req.nextUrl.searchParams;
  const q    = sp.get('q') ?? '';
  const raw  = sp.get('kind') ?? 'all';
  const kind = (KINDS as string[]).includes(raw) ? (raw as Kind) : 'all';

  if (GW) {
    try {
      const qs = new URLSearchParams();
      if (q.trim())        qs.set('q', q.trim());
      if (kind !== 'all')  qs.set('kind', kind);
      const res = await fetch(`${GW}/api/identity/nx/search?${qs.toString()}`, {
        headers: gwHeaders(), cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const rows = (data?.data?.results ?? []) as Record<string, unknown>[];
        if (Array.isArray(rows)) {
          const opportunities = rows.map(opportunityFromBackend);
          return NextResponse.json(
            { source: 'live', opportunities, count: opportunities.length },
            { headers: { 'Cache-Control': 'public, max-age=60' } },
          );
        }
      }
    } catch { /* unreachable → unavailable below */ }
  }

  return NextResponse.json(
    { source: 'unavailable', opportunities: [], count: 0 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// POST /api/bff/nx/opportunities — post an opportunity (C-112). Identity is derived from
// the `tec_user` session cookie server-side — NEVER the request body (P6). The body carries
// only the opportunity fields; the owner is resolved here and the backend re-validates.
// After posting, the owner's FEATURED flags are reconciled with their LIVE subscription
// (NX Pro — visibility only, P5) so a Pro poster's new + existing posts are featured at once.
export async function POST(req: NextRequest) {
  if (isE2eMode()) return e2eStub(201, { opportunity: null });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = {
    kind:     typeof body.kind === 'string' ? body.kind : '',
    title:    typeof body.title === 'string' ? body.title : '',
    org:      typeof body.org === 'string' ? body.org : undefined,
    summary:  typeof body.summary === 'string' ? body.summary : undefined,
    location: typeof body.location === 'string' ? body.location : undefined,
    reward:   typeof body.reward === 'string' ? body.reward : undefined,
    tags:     Array.isArray(body.tags) ? body.tags.map(String) : undefined,
  };

  const owner  = ownerFromSession(req);
  const result = await postOpportunity(owner, input);

  // Reconcile featured with live Pro (best-effort — never fails the post).
  if (result.ok && owner) {
    const isPro = await resolveProStatus(req.cookies.get('tec_access_token')?.value ?? null);
    if (isPro) await setFeaturedForOwner(owner, true);
  }

  return NextResponse.json(
    { ok: result.ok, opportunity: result.opportunity ?? null, error: result.error },
    { status: result.ok ? 201 : result.status },
  );
}
