'use client';

// TEC NX — post an opportunity + your posts (C-112 / ADR-010). Turns NX from a curated
// board into a real two-sided community service: any signed-in Pi user posts a job / grant /
// gig, and the whole community discovers it. Posts start UNVERIFIED (Zone/kyc verifies later
// — presented, never minted). NX Pro ⭐ features your posts (visibility only, ranks below
// verified). Identity is derived from the session server-side (never a client field, P6).
import { useEffect, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { KIND_META, KINDS, type Kind, type Opportunity } from '@/lib/nx/opportunities';

export default function PostOpportunity({ onPosted }: { onPosted?: () => void }) {
  const [open, setOpen]   = useState(false);
  const [kind, setKind]   = useState<Kind>('job');
  const [title, setTitle] = useState('');
  const [org, setOrg]     = useState('');
  const [summary, setSummary] = useState('');
  const [location, setLocation] = useState('');
  const [reward, setReward] = useState('');
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState('');

  const [mine, setMine]   = useState<Opportunity[]>([]);
  const [isPro, setIsPro] = useState(false);

  const loadMine = () => {
    fetch('/api/bff/nx/mine', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { opportunities?: Opportunity[]; isPro?: boolean } | null) => {
        if (!j) return;
        setMine(j.opportunities ?? []);
        setIsPro(Boolean(j.isPro));
      })
      .catch(() => {});
  };
  useEffect(loadMine, []);

  async function submit() {
    const t = title.trim();
    if (!t || busy) { if (!t) setMsg('A title is required.'); return; }
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/bff/nx/opportunities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ kind, title: t, org: org.trim(), summary: summary.trim(), location: location.trim(), reward: reward.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.status === 401) { setMsg('Sign in to post an opportunity.'); return; }
      if (!res.ok || !j.ok)   { setMsg(j.error ?? 'Could not post. Please try again.'); return; }
      setMsg('✅ Posted — it’s live on the board.');
      setTitle(''); setOrg(''); setSummary(''); setLocation(''); setReward('');
      setOpen(false); loadMine(); onPosted?.();
    } catch { setMsg('Network error. Please retry.'); }
    finally { setBusy(false); }
  }

  return (
    <section style={{ marginTop: 20, padding: 16, background: TEC_COLORS.surface, borderRadius: 12, border: '1px solid #ffffff10' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: TEC_COLORS.text }}>📣 Post an opportunity</div>
        <button onClick={() => setOpen((v) => !v)} style={btn(open ? 'ghost' : 'solid')}>
          {open ? 'Close' : '+ New post'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: TEC_COLORS.subtext, margin: '6px 0 0', lineHeight: 1.5 }}>
        Share a job, grant, gig, or partnership with the whole Pi community. Posts start unverified
        (Zone/kyc verifies later). {isPro ? 'Your posts are ⭐ Featured (Pro).' : 'Merchant Pro ⭐ features your posts.'}
      </p>

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} style={field}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_META[k].icon} {KIND_META[k].label}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" maxLength={100} style={field} />
          <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Who's offering it (org / you)" maxLength={80} style={field} />
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short summary" maxLength={400} rows={3} style={{ ...field, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (Remote)" maxLength={60} style={{ ...field, flex: 1 }} />
            <input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="Reward (π / terms)" maxLength={60} style={{ ...field, flex: 1 }} />
          </div>
          <button onClick={submit} disabled={busy} style={btn('solid')}>{busy ? 'Posting…' : 'Post to the board'}</button>
        </div>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: msg.startsWith('✅') ? TEC_COLORS.gold : TEC_COLORS.error }}>{msg}</div>}

      {mine.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: TEC_COLORS.subtext, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Your posts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mine.map((o) => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
                <span style={{ color: TEC_COLORS.text }}>{KIND_META[o.kind].icon} {o.title}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  {o.featured && <span style={{ fontSize: 10, color: TEC_COLORS.gold }}>⭐</span>}
                  <span style={{ fontSize: 10.5, color: o.verified ? TEC_COLORS.gold : TEC_COLORS.subtext }}>{o.verified ? 'Verified' : 'Unverified'}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const field: React.CSSProperties = {
  background: '#0a0d18', border: '1px solid #ffffff1a', borderRadius: 8, padding: '9px 11px',
  color: '#e7e7ea', fontSize: 13, fontFamily: 'inherit', width: '100%',
};
const btn = (kind: 'solid' | 'ghost'): React.CSSProperties => ({
  background: kind === 'solid' ? `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})` : 'transparent',
  color: kind === 'solid' ? '#0a0800' : TEC_COLORS.gold,
  border: kind === 'solid' ? 'none' : `1px solid ${TEC_COLORS.gold}66`,
  borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
});
