'use client';

import { useEffect }               from 'react';
import { useRouter }               from 'next/navigation';
import { usePiAuth, ssoRedirect }  from '@yasser172/tec-auth';
import { TEC_COLORS }              from '@yasser172/tec-ui';

// ── تعديل حسب الـ domain ──────────────────────────────────
// Defensive: only use an env value that is a real http(s) URL — a placeholder
// (e.g. C_HUB_URL) or empty string must never become a redirect target → 404
// (July 2026 System incident, KB C-12 §11).
const httpOr = (raw: string | undefined, fallback: string): string =>
  raw && /^https?:\/\//i.test(raw) ? raw.replace(/\/+$/, '') : fallback;

const HUB_URL    = httpOr(process.env.NEXT_PUBLIC_HUB_URL, 'https://hub.tecosystem.app');
const APP_URL    = httpOr(process.env.NEXT_PUBLIC_APP_URL, 'https://nx.tecosystem.app');
const APP_NAME   = process.env.NEXT_PUBLIC_APP_NAME   ?? 'TEC NX';
const APP_EMOJI  = process.env.NEXT_PUBLIC_APP_EMOJI  ?? '🧩';

export default function HomePage() {
  const { isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/app');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogin = () => {
    ssoRedirect(HUB_URL, `${APP_URL}/app`);
  };

  return (
    <div style={{
      minHeight:      '100vh',
      background:     '#050816',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{APP_EMOJI}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: TEC_COLORS.gold, marginBottom: 8 }}>
          {APP_NAME}
        </div>
        <div style={{ fontSize: 13, color: TEC_COLORS.subtext, marginBottom: 6 }}>
          TEC ECOSYSTEM · OPPORTUNITIES
        </div>
        <div style={{ fontSize: 13, color: TEC_COLORS.subtext, marginBottom: 32, maxWidth: 320, lineHeight: 1.5 }}>
          The opportunity exchange for the Pi economy — jobs, partnerships, grants,
          hackathons, and co-founders.
        </div>
        <button
          onClick={handleLogin}
          disabled={isLoading}
          style={{
            padding:      '14px 32px',
            background:   `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
            border:       'none',
            borderRadius: 16,
            color:        '#0a0800',
            fontSize:     15,
            fontWeight:   700,
            cursor:       isLoading ? 'not-allowed' : 'pointer',
            opacity:      isLoading ? 0.6 : 1,
          }}>
          {isLoading ? '...' : 'Login with Pi'}
        </button>
      </div>
    </div>
  );
}
