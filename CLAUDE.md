# Grower Contract & Settlement Platform

Web application for Food & Beverage grower accounting (contracts → receiving → traceability → settlement → payout), integrated with Dynamics 365 Finance & Supply Chain Management.

**The master plan is `Docs/PLAN.md`. Consult the section for the current phase before doing any work. Record anything that diverges from the plan in `Docs/DECISIONS.md`.**

## Current status

- **Phase 0 (Foundation) — complete.** Monorepo, MSAL auth + app roles end-to-end, mock-first D365 layer, SQL schema scaffold, CI/CD.
- **Next: Phase 1** — D365 reference data + live connectivity (see `Docs/PLAN.md` §8).

## Repo layout (independent packages — no npm workspaces; run npm inside each dir)

| Path | What |
|---|---|
| `web/` | React 18 + TypeScript + Vite SPA. Fluent UI v9, TanStack Query, Zustand, MSAL (`@azure/msal-react`). Hash routing (GitHub Pages-safe). Deployed to GitHub Pages. |
| `api/` | Azure Functions v4 (TypeScript, Node). HTTP API + future sync jobs. Prisma schema for Azure SQL in `api/prisma/`. Until the DB is provisioned, contracts/receipts/sales orders come from the deterministic demo seed in `api/src/demo/seed.ts` (becomes the Prisma seed script in Phase 2). |
| `edge-agent/` | Node service stub for scale/label hardware at receiving stations (built out in Phase 4). |
| `infra/` | Bicep IaC (Function App, Azure SQL, Service Bus, App Insights). |
| `Docs/` | `PLAN.md` (master plan), `DECISIONS.md` (divergence log), `SETUP.md` (Entra app registration + local dev). |

## Conventions (non-negotiable)

1. **TypeScript strict** everywhere.
2. **Zod validation at every API boundary** — parse query/body/route params before use; return 400 on failure.
3. **No client-side-only auth.** Every Function handler is wrapped in `withAuth` (`api/src/auth/withAuth.ts`) which validates the bearer token and the `roles` claim server-side. Settlement endpoints are hard-gated to `Accountant`/`Admin`. UI role checks (`web/src/auth`) are navigation convenience only.
4. **Mock-first D365.** All D365 access goes through the `D365Client` interface (`api/src/d365/`). `D365_MODE=mock|live` selects the fixture-backed mock or live OData client. Never call D365 endpoints directly from a handler. Likewise `AUTH_MODE=mock|entra` switches auth for local dev (mock identity via `x-mock-roles` header).
5. **Every D365 write goes through the `IntegrationOutbox`** (intent → attempt → success/fail with payload + response) with an idempotency key. Never lose a push silently.
6. **Every state change writes to `AuditLog`** (who, what, before/after, timestamp).
7. **Verify D365 entity names against the environment's OData `$metadata` before coding against them** (Phase 1 adds a metadata-verification script). Entity names in the plan are assumptions until verified — record actuals in `Docs/DECISIONS.md`.
8. Secrets stay out of the repo: `local.settings.json` / `.env` locally, Key Vault references in Azure.

## Commands

```bash
# API (from api/)
npm install
npm run dev        # func start on http://localhost:7071 (uses local.settings.json — copy from local.settings.sample.json)
npm run typecheck
npm test
npm run build

# Web (from web/)
npm install
npm run dev        # Vite on http://localhost:5174 (mock auth by default — see web/.env.development)
npm run typecheck
npm test
npm run build

# Database (from api/, needs DATABASE_URL)
npx prisma migrate dev
```

## Roles (Entra app roles — exact strings used in tokens, API, and UI)

`Admin`, `Accountant`, `ContractManager`, `ContractApprover`, `ReceivingClerk`, `Viewer` (future: `GrowerPortal`). Defined in `api/src/auth/roles.ts` and `web/src/auth/roles.ts` — keep the two files in sync.
