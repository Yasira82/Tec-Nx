import { NextRequest, NextResponse } from 'next/server';
import { KINDS, type Kind } from '@/lib/nx/opportunities';
import { opportunityFromBackend } from '@/lib/nx/server';

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
