# Decisions Log

Anything that diverged from or refined `PLAN.md`, per its §9.5. Newest first within each phase.

## Phase 0 — Foundation (2026-06-11)

| # | Decision | Rationale |
|---|---|---|
| 0.1 | **No npm workspaces** — `web/`, `api/`, `edge-agent/` are independent packages with their own lockfiles. | Workspace hoisting breaks Azure Functions zip-deploy (the package must carry its own `node_modules`), and independent packages match the existing 10-repo estate's CI patterns. A root `package.json` has convenience scripts only. |
| 0.2 | **ORM: Prisma** (over Drizzle). | Plan allowed either; Drizzle's SQL Server support is immature, Prisma's `sqlserver` provider is stable. |
| 0.3 | **No Prisma enums** — status/type discriminators are `String` columns. | Prisma does not support enums on SQL Server. Allowed values are documented in `api/prisma/schema.prisma` comments and validated with Zod at the API boundary. Same for JSON payloads (`NVarChar(Max)` string columns) — the SQL Server connector has no `Json` type. |
| 0.4 | **JWT validation: `jsonwebtoken` + `jwks-rsa`** (over `jose`). | Stable CommonJS fit for the Functions worker; jwks caching + rate limiting built in. |
| 0.5 | **`AUTH_MODE=mock\|entra`** mirror of `D365_MODE` added. | Lets every phase run/demo locally with no tenant. Mock identities come from `x-mock-roles`/`x-mock-user` headers; role gates still execute server-side, so 401/403 paths are testable (see `api/tests/withAuth.test.ts`). Production deploys set `AUTH_MODE=entra` (the Bicep template hardcodes it). |
| 0.6 | **HashRouter** (over 404.html fallback) for the SPA. | Plan offered either; hash routing is the most robust on GitHub Pages and survives repo-path hosting without rewrite tricks. |
| 0.7 | **Pages URL assumed repo-path** (`<org>.github.io/<repo>`) until §10.7 is answered. | Deploy workflow sets `VITE_BASE=/<repo>/` automatically; switch to `/` plus custom-domain CORS/redirect URIs if a custom domain is chosen. |
| 0.8 | Single Entra **app registration pair** (SPA + API) assumed; app roles defined on the API registration and exposed scope `access_as_user`. | Standard MSAL pattern; see `SETUP.md`. |
| 0.9 | Azure SQL sku **S0** in Bicep (plan said "Basic"). | Basic's 2 GB cap is tight for trace ledgers; S0 is the cheapest sensible start. Trivial to change in `infra/main.bicep`. |
| 0.10 | ~~Vendor list is surfaced on the Contracts page in Phase 0.~~ Superseded by 0.11 — vendors now have their own pane. | Small scope addition to prove the SPA → API → `D365Client` (mock) chain end-to-end with search, ahead of Phase 1 pickers. |
| 0.11 | **In-memory deterministic demo seed** (`api/src/demo/seed.ts`): 20 West Coast/Central Valley growers + 23 items in fixtures, 1–2 contracts per vendor, ~15 receipts/day and ~15 sales orders/day for the trailing 30 days. Served by `/contracts`, `/receipts`, `/salesorders` and surfaced in Vendors/Items/Contracts/Receiving/Sales panes. | Azure SQL isn't provisioned yet and the demo needs realistic data now. Seeded RNG keeps data stable across restarts (regenerates daily, today-relative). Becomes the Prisma seed script when Phase 2 brings persistence; sales orders flow through `D365Client.getSalesOrders` so the Phase 5 live sync slots in without UI changes. Production/trace linkage deliberately omitted (product owner: "later"). |

| 0.12 | **Static data mode for the hosted demo** (`VITE_DATA_MODE=static`): the Pages deploy workflow builds the API package, exports the demo seed to `web/public/demo/*.json` (`api/src/scripts/exportDemoData.ts`), and the SPA serves all panes from those files via `web/src/api/staticClient.ts` — no backend required. Day-window filters anchor to the newest date in the dataset so the demo doesn't go stale. The API deploy workflow is skipped until `AZURE_FUNCTIONAPP_NAME` is set. | Hosting on GitHub Pages without a deployed Functions app would otherwise show API errors on every pane. When the Functions app + Entra are ready, set repo variables `VITE_DATA_MODE=api`, `VITE_API_BASE_URL`, `VITE_AUTH_MODE=entra` (+ client ids) and the SPA reverts to the real API with server-side enforcement — the static client mirrors, but cannot replace, those checks. |

| 0.13 | **Published to `RSM-D365-Sales/grower-settlement` (public repo); Pages serves at the org custom domain** `www.rsmd365.com/grower-settlement/`. This effectively answers §10.7: CORS origin for the future Functions app is `https://www.rsmd365.com`, Entra SPA redirect URI is `https://www.rsmd365.com/grower-settlement/`. `VITE_BASE=/<repo>/` still applies (project site under the domain root). | The org already had a verified Pages custom domain. Note: repo is public — keep client-identifying details out of committed docs. |

## Open items carried forward

- §10 questions 1–7 in `PLAN.md` remain open (commission cost categories, pool distribution basis, partial-sale policy, single-entity/currency confirmation, pending-invoice posting policy, X++ message processor ownership/date, Pages domain).
- D365 entity names in `PLAN.md` §6 are **unverified** — Phase 1 must diff them against the target environment's `$metadata` and record actuals here.
