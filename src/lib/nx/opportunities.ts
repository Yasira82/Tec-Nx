// TEC NX — the Opportunity Exchange data model (C-112, repurposed by ADR-010).
// NX connects people to opportunities: "What is the right opportunity for me now?"
// It is the Pi economy's unified opportunity marketplace — jobs, partnerships,
// grants, hackathons, investments, co-founders, mentorship. NX is NOT the old
// cyber-security app (that role moved to System's Security Center — ADR-010).
//
// NX PRESENTS + matches opportunities; it does NOT process payments (tec-payment-
// service), verify parties (Zone/C-108/kyc), or own the relationship graph
// (Connection/C-107). This V1 is a curated READ-ONLY board; a real posting index
// + trust-weighted matching (Life intent + Connection graph) is Phase 1+.

export type Kind =
  | 'job' | 'partnership' | 'grant' | 'hackathon' | 'investment' | 'cofounder' | 'mentorship';

// Verified = the poster/org is KYC/Zone-verified — NX presents the badge, never mints it.
export interface Opportunity {
  id:        string;
  owner?:    string;      // poster's Pi username (public) — used to gate owner-only actions
  kind:      Kind;
  title:     string;
  org:       string;      // who is offering it
  summary:   string;
  location:  string;      // "Remote" or an area label
  reward:    string;      // pay / grant size / equity — indicative, in π or terms
  verified:  boolean;     // poster verified (Zone/kyc) — presented, not minted
  featured?: boolean;     // NX Pro — featured placement (visibility only, ranks below verified)
  tags:      string[];
}

export const KIND_META: Record<Kind, { icon: string; label: string }> = {
  job:         { icon: '💼', label: 'Job' },
  partnership: { icon: '🤝', label: 'Partnership' },
  grant:       { icon: '🎁', label: 'Grant' },
  hackathon:   { icon: '🏆', label: 'Hackathon' },
  investment:  { icon: '📈', label: 'Investment' },
  cofounder:   { icon: '🚀', label: 'Co-founder' },
  mentorship:  { icon: '🧭', label: 'Mentorship' },
};

export const KINDS = Object.keys(KIND_META) as Kind[];

// Curated sample board (demo). Read-only.
export const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'pi-app-dev', kind: 'job', title: 'Pi app developer (part-time)', org: 'Olive Branch Café',
    summary: 'Build a Pi-payment ordering page for a verified café. Paid in Pi per milestone.',
    location: 'Remote', reward: '~ 300π / project', verified: true, tags: ['nextjs', 'pi-sdk', 'part-time'],
  },
  {
    id: 'merchant-onboarding', kind: 'partnership', title: 'Regional merchant onboarding partner', org: 'TEC Explorer',
    summary: 'Help local shops accept Pi and get listed. Revenue share per onboarded merchant.',
    location: 'Your city', reward: 'Revenue share', verified: true, tags: ['growth', 'onboarding', 'local'],
  },
  {
    id: 'builder-grant', kind: 'grant', title: 'Pi Builder Grant — open call', org: 'TEC DX',
    summary: 'Micro-grants for open-source tools that help others build on Pi. Milestone-based.',
    location: 'Remote', reward: 'up to 2,000π', verified: true, tags: ['open-source', 'tooling', 'grant'],
  },
  {
    id: 'summer-hackathon', kind: 'hackathon', title: 'Summer Pi Hackathon', org: 'Pi Community',
    summary: 'Ship a Pi app in 48 hours. Prizes + a fast-track to Zone verification.',
    location: 'Online', reward: 'Prize pool', verified: false, tags: ['hackathon', 'weekend', 'prizes'],
  },
  {
    id: 'seed-round', kind: 'investment', title: 'Seed round — Pi logistics startup', org: 'Verified founder',
    summary: 'A KYC-verified founder is raising a small round. Educational/indicative only — capital moves via payment-service + FundX, never NX.',
    location: 'Remote', reward: 'Equity', verified: true, tags: ['seed', 'logistics', 'startup'],
  },
  {
    id: 'cofounder-cto', kind: 'cofounder', title: 'Technical co-founder wanted', org: '@maya',
    summary: 'Non-technical founder with a validated idea seeks a CTO co-founder for a Pi marketplace.',
    location: 'Remote', reward: 'Equity + salary later', verified: true, tags: ['cto', 'equity', 'marketplace'],
  },
  {
    id: 'mentor-pi', kind: 'mentorship', title: 'Pi SDK mentorship (free)', org: 'Lumen Tutoring',
    summary: 'Weekly office hours for new Pi builders. Free — pay it forward when you ship.',
    location: 'Remote', reward: 'Free', verified: true, tags: ['mentorship', 'learning', 'community'],
  },
  {
    id: 'design-partner', kind: 'partnership', title: 'Design partner — new Pi wallet UX', org: 'Pixel Forge Studio',
    summary: 'Looking for a UX designer to co-develop a wallet flow. Paid in Pi + credit.',
    location: 'Remote', reward: '~ 500π', verified: false, tags: ['design', 'ux', 'wallet'],
  },
];

export const getOpportunity = (id: string): Opportunity | null =>
  OPPORTUNITIES.find((o) => o.id === id) ?? null;

// ── Match / filter (C-112 §5) ───────────────────────────────────────────────
// Pure, testable board query: kind filter → text match → verified-first ranking
// (the "trust boost" Connection/Life will power in Phase 2, ADR-010).
const norm = (s: string) => s.trim().toLowerCase();

export interface OppQuery { kind?: Kind | 'all'; query?: string; }

export const matchOpportunities = (q: OppQuery, source: Opportunity[] = OPPORTUNITIES): Opportunity[] => {
  const text = norm(q.query ?? '');
  const kind = q.kind && q.kind !== 'all' ? q.kind : null;
  const hits = source.filter((o) => {
    if (kind && o.kind !== kind) return false;
    if (!text) return true;
    const hay = [o.title, o.org, o.summary, o.location, ...o.tags, KIND_META[o.kind].label].map(norm).join(' ');
    return hay.includes(text);
  });
  // Verified first, then title — a stable trust-weighted order.
  return [...hits].sort((a, b) => Number(b.verified) - Number(a.verified) || a.title.localeCompare(b.title));
};
