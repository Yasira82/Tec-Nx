import { NextRequest, NextResponse } from 'next/server';
import { resolveMine, resolveProStatus, setFeaturedForOwner } from '@/lib/nx/server';

// GET /api/bff/nx/mine — the caller's OWN posted opportunities (C-112). Identity is derived
// from the `tec_user` session cookie server-side — NEVER a query param or body (P6). Also
// reconciles the owner's FEATURED flags with their LIVE subscription (NX Pro — visibility
// only, P5): a lapsed Pro clears featured on the next load; a new Pro lights it up. Honest
// empty state (no session / unreachable → []).
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

export async function GET(req: NextRequest) {
  const owner = ownerFromSession(req);
  if (!owner) return NextResponse.json({ opportunities: [], isPro: false }, { status: 401 });

  const opportunities = await resolveMine(owner);

  // Reconcile featured with live Pro when it has drifted (best-effort; never blocks).
  let isPro = false;
  if (opportunities.length > 0) {
    isPro = await resolveProStatus(req.cookies.get('tec_access_token')?.value ?? null);
    if (opportunities.some((o) => Boolean(o.featured) !== isPro)) {
      await setFeaturedForOwner(owner, isPro);
      opportunities.forEach((o) => { o.featured = isPro; });
    }
  }

  return NextResponse.json(
    { opportunities, isPro },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
