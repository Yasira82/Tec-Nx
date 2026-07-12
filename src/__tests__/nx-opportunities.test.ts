import { describe, it, expect } from 'vitest';
import {
  OPPORTUNITIES, KINDS, KIND_META, getOpportunity, matchOpportunities,
} from '@/lib/nx/opportunities';

describe('TEC NX — Opportunity Exchange (C-112 / ADR-010, read-only)', () => {
  it('every opportunity kind has display metadata', () => {
    for (const k of KINDS) {
      expect(KIND_META[k]?.label).toBeTruthy();
      expect(KIND_META[k]?.icon).toBeTruthy();
    }
  });

  it('covers the opportunity spectrum (jobs, partnerships, grants, hackathons, ...)', () => {
    const kinds = new Set(OPPORTUNITIES.map((o) => o.kind));
    for (const k of ['job', 'partnership', 'grant', 'hackathon', 'cofounder', 'mentorship'] as const) {
      expect(kinds.has(k), k).toBe(true);
    }
  });

  it('getOpportunity resolves by id and fails closed for an unknown id', () => {
    expect(getOpportunity('nope')).toBeNull();
    expect(getOpportunity('pi-app-dev')?.kind).toBe('job');
  });

  it('text search matches title, org, summary, location, tags, and kind label', () => {
    expect(matchOpportunities({ query: 'grant' }).some((o) => o.id === 'builder-grant')).toBe(true);
    expect(matchOpportunities({ query: 'co-founder' }).some((o) => o.id === 'cofounder-cto')).toBe(true);
    expect(matchOpportunities({ query: 'ux' }).some((o) => o.id === 'design-partner')).toBe(true);
  });

  it('kind filter restricts the board', () => {
    const grants = matchOpportunities({ kind: 'grant' });
    expect(grants.length).toBeGreaterThan(0);
    expect(grants.every((o) => o.kind === 'grant')).toBe(true);
  });

  it('ranking is trust-first: verified posters sort ahead of unverified', () => {
    const all = matchOpportunities({});
    const firstUnverified = all.findIndex((o) => !o.verified);
    const lastVerified    = all.map((o) => o.verified).lastIndexOf(true);
    expect(lastVerified).toBeLessThan(firstUnverified === -1 ? Infinity : firstUnverified);
  });

  it('an empty query returns the whole board; a no-match returns []', () => {
    expect(matchOpportunities({}).length).toBe(OPPORTUNITIES.length);
    expect(matchOpportunities({ query: 'zzz-nonexistent-zzz' })).toEqual([]);
  });

  it('is an Opportunity Exchange, not a security app (ADR-010 repurpose)', () => {
    const blob = OPPORTUNITIES.map((o) => `${o.title} ${o.summary}`).join(' ').toLowerCase();
    expect(blob).toMatch(/job|partner|grant|hackathon|co-?founder|mentor/);
  });
});
