// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// TEC NX — posting + "my posts" BFF (C-112/ADR-010). Identity is derived from the session
// cookie server-side (never the body, P6); posts start unverified; NX Pro featured is synced
// from the LIVE subscription (visibility only). Public board search is tested elsewhere.
const GW = 'https://api.example.com';

const makeReq = (opts: { cookies?: Record<string, string>; body?: unknown; method?: string; url?: string }) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  const headers: Record<string, string> = {};
  if (cookieStr) headers['Cookie'] = cookieStr;
  return new NextRequest(opts.url ?? 'http://localhost/api/bff/nx/opportunities', {
    method: opts.method ?? 'POST', headers, body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
};
const ok = (data: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => ({ data }) } as Response);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_GATEWAY_URL = GW;
  process.env.INTERNAL_SECRET = 'secret';
});

describe('POST /api/bff/nx/opportunities (post)', () => {
  it('401 without a session (identity from the cookie, never the body — P6)', async () => {
    const { POST } = await import('@/app/api/bff/nx/opportunities/route');
    const res = await POST(makeReq({ body: { kind: 'job', title: 'Pi dev' } }));
    expect(res.status).toBe(401);
  });

  it('posts with the session owner + forwards NO owner from the body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ opportunity: { handle: 'pi-dev', title: 'Pi dev', verified: false } }, 201)) // create
      .mockResolvedValueOnce(ok({ plan: 'FREE', isActive: true }));                                             // sub (not Pro)
    const { POST } = await import('@/app/api/bff/nx/opportunities/route');
    const res = await POST(makeReq({ cookies: { tec_user: JSON.stringify({ piUsername: 'maya' }) }, body: { kind: 'job', title: 'Pi dev', owner: 'HACKER' } }));
    expect(res.status).toBe(201);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GW}/api/identity/nx/opportunity`);
    const sent = JSON.parse(init.body as string);
    expect(sent.owner).toBe('maya');       // session identity, not the body's "HACKER"
    fetchSpy.mockRestore();
  });

  it('Pro poster → featured is synced after the post', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ opportunity: { handle: 'pi-dev', verified: false } }, 201)) // create
      .mockResolvedValueOnce(ok({ plan: 'PRO', isActive: true, isExpired: false }))           // sub = Pro
      .mockResolvedValueOnce(ok({ featured: true, count: 1 }));                                // featured PATCH
    const { POST } = await import('@/app/api/bff/nx/opportunities/route');
    await POST(makeReq({ cookies: { tec_user: JSON.stringify({ piUsername: 'maya' }), tec_access_token: 'tok' }, body: { kind: 'grant', title: 'Builder grant' } }));
    const patch = fetchSpy.mock.calls.find(([u]) => String(u).endsWith('/api/identity/nx/featured'));
    expect(patch).toBeDefined();
    expect((patch![1] as RequestInit).method).toBe('PATCH');
    fetchSpy.mockRestore();
  });
});

describe('GET /api/bff/nx/mine (own posts + featured sync)', () => {
  it('401 without a session', async () => {
    const { GET } = await import('@/app/api/bff/nx/mine/route');
    const res = await GET(makeReq({ method: 'GET', url: 'http://localhost/api/bff/nx/mine' }));
    expect(res.status).toBe(401);
  });

  it('returns the caller own posts and reconciles featured with live Pro', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ results: [{ handle: 'pi-dev', title: 'Pi dev', featured: false, verified: false }] })) // mine
      .mockResolvedValueOnce(ok({ plan: 'PRO', isActive: true, isExpired: false }))                                      // sub = Pro
      .mockResolvedValueOnce(ok({ featured: true, count: 1 }));                                                          // reconcile PATCH
    const { GET } = await import('@/app/api/bff/nx/mine/route');
    const res  = await GET(makeReq({ method: 'GET', cookies: { tec_user: JSON.stringify({ piUsername: 'maya' }), tec_access_token: 'tok' }, url: 'http://localhost/api/bff/nx/mine' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.isPro).toBe(true);
    expect(json.opportunities[0].featured).toBe(true);   // reflected after the sync
    fetchSpy.mockRestore();
  });
});
