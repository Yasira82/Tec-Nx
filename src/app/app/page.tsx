'use client';

// TEC NX — the Opportunity Exchange (C-112, repurposed by ADR-010). "What is the
// right opportunity for me now?" NX connects people to opportunities — jobs,
// partnerships, grants, hackathons, investments, co-founders, mentorship. NX matches
// + presents; it never processes capital (→ payment-service + FundX), verifies
// parties (→ Zone/KYC), or owns the relationship graph (→ Connection). App shell:
// Board / Post / Pro / Settings bottom nav.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePiAuth } from '@yasser172/tec-auth';
import { useMe } from '@/lib-client/hooks/useMe';
import { useTranslation } from '@/lib/i18n';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { InviteCard } from '@/components/referral/InviteCard';
import { NxPro } from './components/NxPro';
import PostOpportunity from './components/PostOpportunity';
import { BottomNav, type NxTab } from './components/BottomNav';
import { SettingsView } from './components/SettingsView';
import {
  KINDS, KIND_META,
  type Kind, type Opportunity,
} from '@/lib/nx/opportunities';

export default function NxHome() {
  const { user, isLoading } = usePiAuth();
  const me = useMe(); // server-resolved Pi username (Pi Browser hides tec_user from client JS — C-123 §3)
  const { t } = useTranslation();
  const [tab, setTab] = useState<NxTab>('board');

  const piName = me.username ?? user?.piUsername ?? null;
  const name = piName ? `@${piName}` : '';

  const [query, setQuery] = useState('');
  const [kind,  setKind]  = useState<Kind | 'all'>('all');
  const [board, setBoard] = useState<Opportunity[]>([]);
  // Real data end-to-end (C-135 §4): live board or an honest state — never a sample.
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [refresh, setRefresh] = useState(0);   // bumped after a new post to reload the board

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams();
        if (query.trim()) qs.set('q', query.trim());
        if (kind !== 'all') qs.set('kind', kind);
        const res  = await fetch(`/api/bff/nx/opportunities?${qs.toString()}`, { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (data && data.source === 'live' && Array.isArray(data.opportunities)) {
          setBoard(data.opportunities as Opportunity[]);
          setStatus('ready');
        } else {
          setBoard([]);
          setStatus('unavailable');
        }
      } catch {
        if (alive) { setBoard([]); setStatus('unavailable'); }
      }
    }, 180);
    return () => { alive = false; clearTimeout(timer); };
  }, [query, kind, refresh]);

  const count = board.length;
  const verified = useMemo(() => board.filter((o) => o.verified).length, [board]);

  const card: React.CSSProperties = {
    background: TEC_COLORS.surface, border: `1px solid ${TEC_COLORS.gold}22`,
    borderRadius: 12, padding: 14, display: 'block', textDecoration: 'none',
  };
  const chip = (active: boolean): React.CSSProperties => ({
    fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    color: active ? '#0a0800' : TEC_COLORS.text,
    background: active ? `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})` : 'transparent',
    border: `1px solid ${TEC_COLORS.gold}${active ? '' : '33'}`,
    borderRadius: 999, padding: '6px 12px', cursor: 'pointer',
  });

  const title =
    tab === 'post' ? t.nx.nav.post
    : tab === 'pro' ? t.nx.nav.pro
    : tab === 'settings' ? t.nx.nav.settings
    : (isLoading || !name ? t.nx.board : t.nx.boardName.replace('{name}', name));

  return (
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: TEC_COLORS.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 22px calc(96px + env(safe-area-inset-bottom))' }}>
        <header>
          <div style={{ fontSize: 12, letterSpacing: 1, color: TEC_COLORS.subtext, textTransform: 'uppercase' }}>{t.nx.brand}</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: TEC_COLORS.gold, margin: '6px 0 0' }}>{title}</h1>
          {tab === 'board' && (
            <p style={{ fontSize: 14, color: TEC_COLORS.subtext, margin: '6px 0 0', lineHeight: 1.6 }}>{t.nx.subtitle}</p>
          )}
        </header>

        {tab === 'board' && (
          <>
            {/* Search */}
            <div style={{ marginTop: 20 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.nx.searchPlaceholder}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: TEC_COLORS.surface, color: TEC_COLORS.text, border: `1px solid ${TEC_COLORS.gold}33`, fontSize: 14 }}
              />
            </div>

            {/* Kind chips */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
              <button style={chip(kind === 'all')} onClick={() => setKind('all')}>{t.nx.all}</button>
              {KINDS.map((k) => (
                <button key={k} style={chip(kind === k)} onClick={() => setKind(k)}>{KIND_META[k].icon} {KIND_META[k].label}</button>
              ))}
            </div>

            {/* Board */}
            <section style={{ marginTop: 26 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: TEC_COLORS.text, margin: 0 }}>
                  {status === 'ready' ? `${count} opportunit${count === 1 ? 'y' : 'ies'}` : 'Opportunities'}
                </h2>
                {status === 'ready' && (
                  <span style={{ fontSize: 11, color: TEC_COLORS.subtext, border: `1px solid ${TEC_COLORS.gold}33`, borderRadius: 999, padding: '2px 10px' }}>
                    live board · {verified} verified
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {status === 'loading' && (
                  <div style={{ ...card, textAlign: 'center', color: TEC_COLORS.subtext, fontSize: 13 }}>
                    Loading opportunities…
                  </div>
                )}
                {status === 'unavailable' && (
                  <div style={{ ...card, textAlign: 'center', color: TEC_COLORS.subtext, fontSize: 13 }}>
                    The opportunity board is unavailable right now. Please try again shortly.
                  </div>
                )}
                {status === 'ready' && board.map((o) => (
                  <Link key={o.id} href={`/opportunity/${o.id}`} style={card}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: TEC_COLORS.text }}>
                        {KIND_META[o.kind].icon} {o.title}
                      </span>
                      <span style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                        {o.featured && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: TEC_COLORS.gold, border: `1px solid ${TEC_COLORS.gold}55`, borderRadius: 999, padding: '2px 8px' }}>⭐ Featured</span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 800, color: o.verified ? TEC_COLORS.gold : TEC_COLORS.subtext, border: `1px solid ${o.verified ? TEC_COLORS.gold + '55' : TEC_COLORS.subtext + '55'}`, borderRadius: 999, padding: '2px 8px' }}>
                          {o.verified ? '✅ Verified' : 'Unverified'}
                        </span>
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: TEC_COLORS.gold, marginTop: 3 }}>
                      {KIND_META[o.kind].label} · {o.org} · {o.location} · {o.reward}
                    </div>
                    <div style={{ fontSize: 12, color: TEC_COLORS.subtext, marginTop: 5, lineHeight: 1.5 }}>{o.summary}</div>
                  </Link>
                ))}
                {status === 'ready' && count === 0 && (
                  <div style={{ ...card, textAlign: 'center', color: TEC_COLORS.subtext, fontSize: 13 }}>
                    No matches. Try a different term or category.
                  </div>
                )}
              </div>
            </section>

            <p style={{ fontSize: 11, color: TEC_COLORS.subtext, margin: '24px 0 0', lineHeight: 1.5 }}>{t.nx.footer}</p>
          </>
        )}

        {tab === 'post' && (
          /* Post an opportunity — NX becomes a real two-sided community service. */
          <PostOpportunity onPosted={() => { setRefresh((n) => n + 1); setTab('board'); }} />
        )}

        {tab === 'pro' && (
          /* NX Pro — real Pi U2A payment (service subscription). */
          <NxPro />
        )}

        {tab === 'settings' && <SettingsView />}
      </div>

      <BottomNav active={tab} onSelect={setTab} />
    </main>
  );
}
