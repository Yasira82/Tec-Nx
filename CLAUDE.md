# TEC NX — Claude Code Instructions

> ⚡ **SESSION START:** اقرأ `knowledge-base/C-02___CURRENT_STATE_.md` + **`C-112` (NX charter,
> repurposed by `ADR-010`)** من `yasira82/tec-knowledge-base` (branch: `main`).

## What This App Is

**The Opportunity Exchange** for the Pi economy (C-112, **repurposed by ADR-010**).
NX answers one question:

```
"What is the right opportunity for me now?"
```

NX connects people to opportunities — **jobs · partnerships · grants · hackathons ·
investments · co-founders · mentorship** — the Pi economy's unified opportunity
marketplace (think *LinkedIn Opportunities + AngelList + Pi Jobs*, but native to Pi).

> **ADR-010 (July 2026):** NX was **repurposed from Cyber Security → Opportunity
> Exchange**. Its old security role moved to **System (C-110) as a "Security Center"**
> (security *alerts* → Alert/C-111; *verification/trust* → Zone/C-120). NX is **not**
> a security app. See C-64 ADR-010.

Built from `tec-template-base` (Next.js 15 frontend).

**Current Phase: NX V0/V1 — Opportunity board (read-only).** Identity / domain / slug /
legal + a themed board (search · kind filter · trust-first ranking over a curated
**read-only sample**) + an `/opportunity/[id]` detail page + **NX Pro** (the Pi Portal
"Process a Transaction" gate). A real posting index + trust-weighted matching (Life
intent + Connection graph) is Phase 1+. Not yet deployed.

---

## Pi App Identity

| Field | Value |
|-------|-------|
| **App** | TEC NX |
| **Domain** | `https://nx.tecosystem.app` |
| **Pi App ID** | ⏳ TBD — register at Pi Developer Portal · then Vercel `NEXT_PUBLIC_PI_APP_ID` |
| **APP_SOURCE slug** | `nx` (payment-service resolves `PI_API_KEY_NX`) |
| **PI_SANDBOX** | `false` (Mainnet) |

---

## NX-Specific Rules (C-112 / ADR-010)

### The boundary — NX matches + presents; it does NOT execute
NX **OWNS**: the opportunity posting index, matching + trust-weighted ranking, kind
browsing, and the opportunity board. NX does **NOT OWN**:
- **Capital movement** → `tec-payment-service` + FundX (C-113). Investments shown are indicative/educational only; NX never moves money.
- **Party verification** → Zone (C-120) / `tec-kyc-service`. NX presents the "Verified" badge, never mints it.
- **The relationship graph** → Connection (C-107). **Security** → System Security Center (ADR-010).

### Isolation (P6)
Posting/applying derives identity from the `tec_user` session cookie server-side —
**never** a query param or body. Public board info only. No session → fail closed.

**Reference of record:** `yasira82/tec-knowledge-base` — `C-112` (charter, repurposed) +
`C-64` **ADR-010** (the repurpose decision) + `C-12_Dual_Mode_Payment.md` + `C-123`.

---

## Stack

- Next.js 15 App Router + TypeScript strict · React 18
- `@yasser172/tec-ui` (design system) · `@yasser172/tec-auth` · `@yasser172/tec-sdk`
- Vitest (unit) + Playwright (e2e) · Deployment: Vercel

---

## Architecture Rules (non-negotiable)

### CSRF — middleware ONLY (P2 single source of truth)
CSRF is enforced in **`middleware.ts`** and **nowhere else**: a request is trusted
if the double-submit token matches **OR** it is first-party (Origin host === Host /
`*.tecosystem.app`).
- ❌ **NEVER** add a CSRF check inside a route handler (`csrfCookie !== csrfHeader`
  → 403). It 403's legit Mode-2 payments in Pi Browser (drops `sameSite=None`
  cookies). The CI `payment-policy` job fails the build if you do. (KB C-12 §11)
- ✅ A route may *forward* `x-csrf-token` to a downstream call; it must never *validate* it.

### ADR-007 — Dual-mode payment (Pi foreign session)
Every buy handler MUST guard before touching `window.Pi`:
```typescript
const isHubNavigation = () =>
  document.referrer.toLowerCase().includes('hub.tecosystem.app');
if (isHubNavigation() || !(window as any).Pi || !piReady) {
  redirectToHubPayment(...);   // Mode 1: Hub modal → /hub?pay=1&...
  return;
}
// Mode 2: standalone — createPaymentRecord() then createU2APayment() (src/lib/pi-payment.ts)
```

### ADR-009 — Unified payment contract
`amount` is a **number**; gateway path is **`/api/payment/*`** (singular); the only
inter-service header is **`x-internal-key`** + `INTERNAL_SECRET`. Don't re-declare
payment Zod locally — shapes live in `@yasser172/tec-sdk`.

### Two-SDK boundary
```
Client components → src/lib-client/*  (browser state, Pi hooks)
API routes (BFF)  → @yasser172/tec-sdk via /api/bff/*  (server-only)
```

### Auth / cookies (LOCKED)
SSO via Hub cookies `tec_access_token`, `tec_csrf`, `tec_user`. Never localStorage.
Identity is derived from the `tec_user` cookie server-side — **never from the request body**.

---

## What's included

```
middleware.ts                              CSRF (double-submit OR Origin) + page guard
src/app/api/auth/sso-callback/route.ts     Hub SSO landing (open-redirect-safe)
src/app/api/auth/refresh/route.ts          token refresh
src/app/api/bff/payment/{create,approve,complete,resolve-incomplete}/route.ts
src/app/api/bff/items/route.ts             example domain route (copy this pattern)
src/app/api/health/route.ts                health endpoint (C-92/C-96) — fail-safe, public, never 500s
src/lib/pi-payment.ts                      createPaymentRecord + createU2APayment
src/lib/pi/PiRuntime.ts                    PAL — single choke-point for window.Pi.* (R1)
src/lib/pi/PiCircuitBreaker.ts             CLOSED→OPEN→HALF_OPEN (3 fails → 60s)
src/lib/flags.ts                           feature flags (NEXT_PUBLIC_FLAG_*) + useFlag
src/lib/observability/logger.ts            structured JSON logger (log.info/warn/error) — no silent failures (C-96)
src/lib/observability/reportError.ts       Sentry-ready error reporter (single swap-point)
src/app/privacy/page.tsx · terms/page.tsx  Pi Portal legal pages
src/styles/tec-design-tokens.css           import in app/layout.tsx
.github/workflows/ci.yml                   payment-policy + CSRF guard + lint/typecheck/test/build
```

**v2 (production-ready by default):** every new app ships
- `/api/health` — uniform C-92 signal (platform health runtime + observability scrape + SLO/runtime-evidence loop);
- structured `log` + `reportError` — use `log.error`/`reportError` in catch blocks (a silent error handler is an invisible failure, C-96; `reportError` is the one place to wire Sentry per app);
- `PiRuntime` (PAL) + `PiCircuitBreaker` — never call `window.Pi.*` directly; go through PiRuntime so an SDK change is a one-file fix (R1) and flapping is contained;
- `flags.ts` — feature flags from day one (`NEXT_PUBLIC_FLAG_<NAME>`);
- coverage gate — `npm run test:coverage` (add devDep `@vitest/coverage-v8`; 60% floor, raise as the app grows).

---

## New app setup checklist

```
□ package.json: set "name"
□ middleware.ts: adjust PROTECTED_ROUTES
□ sso-callback/route.ts: set ALLOWED_AUDIENCES + DEFAULT_REDIRECT to your domain
□ src/lib/pi-payment.ts + payment/create: set APP_SOURCE slug
□ privacy/page.tsx + terms/page.tsx: set APP / DOMAIN / governing law / contacts
□ Add ADR-007 isHubNavigation() guard to every buy handler
□ .env: API_GATEWAY_URL · INTERNAL_SECRET · SSO_SECRET · NEXT_PUBLIC_PI_APP_ID · PI_SANDBOX=false (prod)
□ Pi Developer Portal: register domain + App ID; set /privacy + /terms URLs
□ Verify a real Pi payment Mode 1 (via Hub) AND Mode 2 (standalone)
```

---

## What NOT To Do

- Do NOT validate CSRF in a route handler — middleware only (CI blocks it)
- Do NOT send `amount` as a string, or use `/payments` / `x-service-secret`
- Do NOT skip the ADR-007 `isHubNavigation()` guard before `window.Pi`
- Do NOT store tokens in localStorage; do NOT derive identity from the body
- Do NOT add `NEXT_PUBLIC_*` for internal service URLs or `INTERNAL_SECRET`
- Do NOT use an open `redirect` param without the same-origin guard (open redirect)

---

## Commit Convention

```
feat(scope):  new feature      fix(payment): payment flow fix (test carefully)
fix(scope):   bug fix          chore(scope): build/config
```

---

## Skills

Available via plugin — invoke automatically when the situation matches:

| Situation | Skill |
|-----------|-------|
| Writing new feature or fixing a bug → use TDD | `/tdd` |
| Bug, regression, or unexpected behavior | `/diagnose` |
| Writing or modifying tests | `/test-guard` |
| Writing or modifying BFF routes, payment handlers, or API contracts | `/clean-code-guard` |
| Updating docs, CLAUDE.md, or knowledge-base entries | `/docs-guard` |
| Planning a new feature or architectural decision | `/grill-with-docs` |
| Breaking down a roadmap item into GitHub Issues | `/to-issues` |
| Session is getting long or context is filling up | `/handoff` |
| Adding pre-commit hooks to this repo | `/setup-pre-commit` |
