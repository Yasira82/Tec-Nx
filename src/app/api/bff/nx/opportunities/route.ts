import { NextRequest, NextResponse } from 'next/server';
import { matchOpportunities, KINDS, type Kind } from '@/lib/nx/opportunities';

// GET /api/bff/nx/opportunities?q=&kind= — the Opportunity Exchange board
// (C-112, repurposed by ADR-010). NX matches + ranks opportunities. This V1
// ranks a curated read-only SAMPLE server-side (source:'sample'); when a real
// posting index exists (tec-identity-service postings + trust-weighted matching
// from Life intent + the Connection graph), this route proxies it and returns
// source:'live' with the same shape. Public read-only info; no capital, no
// verification, no graph mutation here (ADR-010).
export function GET(req: NextRequest) {
  const sp   = req.nextUrl.searchParams;
  const q    = sp.get('q') ?? '';
  const raw  = sp.get('kind') ?? 'all';
  const kind = (KINDS as string[]).includes(raw) ? (raw as Kind) : 'all';

  const opportunities = matchOpportunities({ query: q, kind });
  return NextResponse.json(
    { source: 'sample', opportunities, count: opportunities.length },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
