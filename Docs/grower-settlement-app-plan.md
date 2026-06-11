# Grower Contract & Settlement Platform — Build Plan

**Purpose of this document:** This is the master planning document for building a web application for Food & Beverage grower accounting, integrated with Dynamics 365 Finance and Supply Chain Management (D365 F&SC). It is written to be fed directly into Claude Code as the project brief. Work through it phase by phase; do not attempt to build everything in one pass.

---

## 1. Product Summary

A web application for produce buyers/packers/shippers that manages the full grower lifecycle:

1. **Contracts** with growers (vendors) — by item, commodity (D365 product category), or all items — scoped to a date range / season, for a single vendor or a vendor group, with a built-in approval workflow and enable/disable lifecycle.
2. **Receiving** against enabled contracts — generating D365 purchase orders (header + lines) so standard D365 receiving works, while optionally running receiving in-app with scale integration, label printing, and dock door / load planning.
3. **Traceability** — Contract → Receipt → Production → Sales Order, so every sales line can be tied back to the grower lot it came from.
4. **Settlement** (restricted to Accountant/Admin roles) — by vendor or by pool (group of vendors), with two settlement methods:
   - **Trade-agreement based (flat rate):** pay the grower a fixed rate per unit received (e.g., $1.00/lb of strawberries).
   - **Sales-invoice based (commission):** the company keeps a commission % of net revenue and pays the grower the remainder (e.g., 10% commission on $100 net revenue → company keeps $10, grower receives $90). Requires linking sales invoice lines back through production cost accumulation to the originating receipt/contract.
5. **Payout** — upon settlement approval, generate a **pending vendor invoice** in D365 for posting, followed by a standard D365 **vendor payment journal**.

---

## 2. Key Architecture Decision: Where Do Contracts Live?

Three options were considered:

| | Option A: App-native contracts | Option B: Custom D365 entity (X++) | Option C: D365 Purchase Agreements + customization |
|---|---|---|---|
| Dev velocity | High — iterate in TypeScript/React with Claude Code | Low — X++ dev, builds, deployments, ALM | Medium — config + extensions |
| Fit for commission settlement, seasons, pools | Excellent (you own the model) | Good (you build it) | Poor — purchase agreements model price/qty commitments, not commission %, pools, or settlement workflow |
| Workflow & approvals | Build in app (full control) | D365 workflow engine (rigid but native) | D365 workflow on purchase agreements (limited fields) |
| D365 upgrade risk | None | Moderate–high | Moderate |
| Financial control / auditability | D365 stays system of record for all financial documents (POs, receipts, invoices, payments) | Same | Same |
| Reporting in D365 | Contracts invisible to D365 unless synced | Native | Partial |

**Recommendation: Option A (app-native contracts), with D365 as the financial system of record — a "system of engagement / system of record" split.**

- The **app owns**: contract master data, workflow state, seasons, pools, settlement calculations, adjustments, receiving UX, traceability ledger.
- **D365 owns**: vendors, items, product categories, purchase orders, product receipts, production orders, sales orders/invoices, pending vendor invoices, payment journals, and the GL. Every dollar that moves does so through standard D365 documents.
- **Bridge artifacts**: when a flat-rate contract is enabled, the app can optionally push a **purchase price trade agreement journal** into D365 so PO lines price correctly using standard functionality. If commitment tracking inside D365 is later required, a purchase agreement can be created as a *shadow* of the app contract — but it is a projection, never the source of truth.

Why not B or C: a custom X++ entity (B) drags every iteration through the D365 ALM cycle and defeats the purpose of rapid AI-assisted development; purchase agreements (C) structurally cannot represent commission-based settlement, vendor pools, or the receipt→production→sales linkage, so you would end up bolting an external settlement engine on anyway — which is Option A with extra steps.

**Product receipt posting — decided:** posting *product receipts* purely via OData is limited in D365 F&SC, so in-app receipt posting will be handled by a process built on the D365 **Message Queue / Message Processor framework** (the `SysMessage` framework used by Landed cost and warehouse integrations). The app enqueues a receipt-post message; a custom message type + processor class inside D365 dequeues it and posts the product receipt asynchronously; the app polls/receives the message status to confirm. This is the one intentional D365 extension in the design, and it follows Microsoft's supported async-integration pattern (built-in retry, status tracking, and sequencing).

---

## 3. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | SPA. Component library: Fluent UI v9 (matches D365 look) or shadcn/ui. TanStack Query for data fetching, TanStack Table for grids, Zustand for client state. |
| Hosting | **GitHub Pages** (SPA) + standalone **Azure Functions** (API) | Matches the existing estate of 10 repos. Implications to build in from day one: (1) Functions must enable CORS for the GitHub Pages origin(s), including any custom domain; (2) auth is pure MSAL in the SPA — acquire tokens for the API's app registration scope and send as `Authorization: Bearer` to Functions (no SWA-style built-in auth); (3) SPA redirect URIs in Entra must include the Pages URL(s) and `localhost` for dev; (4) use hash-safe routing or a 404.html SPA fallback since Pages has no server-side rewrites; (5) Vite `base` set per repo path if not on a custom domain. |
| API | Azure Functions (TypeScript, isolated worker or v4 programming model) | HTTP-triggered API + queue/timer-triggered sync jobs. |
| App database | Azure SQL Database | Relational fits contracts/settlements/audit. Prisma or Drizzle ORM. |
| Async/integration | Azure Service Bus + D365 Business Events | Inbound events: sales invoice posted, product receipt posted, production order ended. |
| Auth (users) | Microsoft Entra ID via MSAL (`@azure/msal-react`) | Single app registration for SPA + API (or SPA + API pair). App roles defined in Entra. |
| Auth (D365) | Service-to-service: client-credentials flow | App registration added in D365 **System administration > Microsoft Entra ID applications**, mapped to a service account. User-level authorization is enforced in the app's API layer, not by D365. |
| D365 integration | OData (data entities) + custom services where OData is insufficient | All calls go through one `D365Client` module with retry, throttling-aware backoff (429/`Retry-After`), and request logging. |
| Scale / label hardware | Local "edge agent" (small Node service or Windows service) on the receiving station | Talks to scale over serial/TCP, prints ZPL to Zebra printers, communicates with cloud API via HTTPS + device key. The browser cannot reach COM ports directly. |
| CI/CD | GitHub Actions | Two workflows: build/test + deploy SPA to GitHub Pages (`actions/deploy-pages`), and build/deploy Functions to Azure (`Azure/functions-action`); IaC via Bicep. |

---

## 4. Security & Roles (Entra App Roles)

| Role | Capabilities |
|---|---|
| `Admin` | Everything, incl. configuration, user/pool management, settlement |
| `Accountant` | Run/approve settlements, adjustments, generate vendor invoices & payment journals, view all |
| `ContractManager` | Create/edit contracts, submit for approval, manage seasons |
| `ContractApprover` | Approve/reject contracts, enable/disable |
| `ReceivingClerk` | Create receipts, scale tickets, labels, dock door scheduling |
| `Viewer` | Read-only |
| *(future)* `GrowerPortal` | External vendor self-service view of own contracts/settlements |

Rules:
- Settlement screens and APIs are hard-gated to `Accountant`/`Admin` — enforced server-side in the Functions API on every request (validate the bearer token's `roles` claim), never client-side only.
- Every state change writes to an immutable `AuditLog` (who, what, before/after, timestamp).

---

## 5. Domain Model (App Database)

### Contract domain
- **Season** — code, name, start/end dates, status.
- **VendorGroup / Pool** — name, members (D365 vendor accounts), effective dates. (Pools are used for settlement; vendor groups for contract scoping — may share a table with a type flag.)
- **ContractHeader** — number, vendor or vendor group ref, season ref, date range, settlement type (`TradeAgreement` | `SalesCommission`), status (`Draft → Submitted → Approved → Enabled → Disabled/Closed`), workflow history, notes, attachments.
- **ContractLine** — scope (`Item` | `Commodity` | `AllItems`), item ref (D365 item number) or commodity ref (D365 product category), UoM, and either: rate per unit (+ optional tiered rates, effective dates) for flat-rate, or commission % (+ optional deduction rules: freight, packaging, cooling, marketing fees) for commission lines.
- **WorkflowStep / Approval** — generic engine: definition (ordered steps, role per step, threshold conditions), instances, actions (approve/reject/delegate/comment).

### Receiving domain
- **Receipt** — contract ref, vendor, date, dock door, load ref, status (`Open → Posted`), D365 PO number once pushed.
- **ReceiptLine** — contract line ref, item, qty, UoM, gross/tare/net weights, scale ticket ref, lot/batch number (this is the traceability key), grade/quality attributes.
- **ScaleTicket** — raw weights, device id, timestamps, operator.
- **DockDoor**, **Appointment/Load** — schedule slots, carrier, status board.
- **LabelTemplate** — ZPL templates with merge fields (lot, item, vendor, contract, date, weight, GS1-128 barcode).

### Traceability domain
- **TraceNode / TraceEdge** — a ledger of linkages keyed by batch/lot: receipt lot → production order consumption → finished lot → sales order line → sales invoice line. Populated by D365 sync jobs/business events. This is the backbone of commission settlement.

### Settlement domain
- **SettlementBatch** — by vendor or by pool, period, status (`Draft → Calculated → In Review → Approved → Invoiced → Paid`).
- **SettlementLine** — per receipt line (flat-rate) or per sales invoice line allocation (commission): quantities, gross revenue, allocated costs, net revenue, commission %, grower amount, links to source documents.
- **SettlementAdjustment** — manual tweaks: amount, reason code, comment, user; requires approval if over threshold.
- **PayoutDocument** — D365 pending vendor invoice id, posted invoice number, payment journal id, statuses.

---

## 6. D365 Integration Map

> **Instruction to Claude Code:** entity names below are the commonly used standard data entities; verify every name against the target environment's OData `$metadata` (`https://<env>.operations.dynamics.com/data/$metadata`) before coding. Build a thin typed client per entity. Cross-company: include `?cross-company=true` or `dataAreaId` filters as appropriate.

| Purpose | Direction | Mechanism |
|---|---|---|
| Vendors (`VendorsV2`/`VendorsV3`), payment terms | D365 → App (sync/cache) | OData GET, delta sync nightly + on-demand refresh |
| Released products (`ReleasedProductsV2`), units, conversions | D365 → App | OData |
| Product categories / commodity hierarchy (`ProductCategoryHierarchies`, assignments) | D365 → App | OData — drives "commodity" contract scope |
| Purchase price trade agreement journals | App → D365 | OData (price/discount journal header + lines entities), post journal — used when a flat-rate contract is enabled |
| Purchase order header/lines (`PurchaseOrderHeadersV2`, `PurchaseOrderLinesV2`) | App → D365 | OData create on receipt push; confirm via service if required |
| Product receipt posting | App → D365 | **Message Queue / Message Processor framework**: app enqueues a receipt-post message (via the message processor data entity / OData), custom message type + processor class in D365 posts the product receipt against the app-created PO; app polls message status entity (or receives a business event) to confirm posting and capture the product receipt number |
| Production orders, BOM consumption, batch/lot transactions | D365 → App | OData + business events; used to walk cost accumulation for traceability |
| Sales orders / sales invoice headers & lines (`SalesOrderHeadersV2`, `SalesInvoiceHeadersV2`, lines + charges) | D365 → App | Business event "sales invoice posted" triggers pull of invoice + line + cost data |
| Pending vendor invoice (`VendorInvoiceHeaders`, `VendorInvoiceLines`) | App → D365 | OData create on settlement approval; posting can remain a controlled D365 step or be automated later |
| Vendor payment journal (ledger journal header + vendor payment journal lines entities) | App → D365 | OData create; settle against the posted vendor invoice |
| Batch/lot inventory transactions | D365 → App | OData; feeds the trace ledger |

**Resilience requirements:** every outbound write is wrapped in an `IntegrationOutbox` table (intent → attempt → success/fail with payload + response), idempotency keys on creates, and a retry dashboard for Admins. Never lose a receipt or a settlement push silently.

---

## 7. Settlement Calculation Spec

### 7.1 Flat-rate (trade agreement) settlement
For each unsettled posted receipt line under the contract in the period:
```
grower_amount = net_received_qty × contract_rate(item, date)
```
Support tiered/effective-dated rates. Deduct any configured fees. Group into a SettlementBatch by vendor (or pool, summing members). Simple, deterministic, fully auditable to the receipt line.

### 7.2 Commission (sales-invoice based) settlement
For each posted sales invoice line in the period:
1. **Trace back**: sales invoice line → sales order line → finished lot(s) → production order(s) → consumed receipt lot(s) → receipt line(s) → contract line(s). One sales line may draw from multiple receipt lots (and multiple growers/pools) — allocate by consumed quantity weight.
2. **Net revenue**: `line_revenue − allocated_costs`, where allocated costs include freight, charges, production/packing costs accumulated along the trace path (configurable cost categories; pull from D365 charges and production cost data, with a manual cost-category mapping table in the app).
3. **Split**: `company_keep = net_revenue × commission_%` (from the matched contract line); `grower_amount = net_revenue − company_keep`.
4. **Pool mode**: aggregate net revenue across pool members' lots, then distribute by each vendor's contribution weight (default: net received qty; configurable to received value).
5. **Adjustments**: accountants can add line- or batch-level adjustments (reason-coded) before approval; recalculation shows a before/after diff.
6. **Approval → payout**: on approval, create pending vendor invoice(s) in D365 (one per vendor), then payment journal. Lock the batch; settled source lines are flagged to prevent double settlement.

**Edge cases to handle explicitly:** partial sales (lot not fully sold yet — settle sold portion or hold, configurable), returns/credit notes (negative settlement lines), shrink/waste between receipt and sale, mixed-grower production batches, sales lines that can't be traced (exception queue, never silent), currency (assume single currency for MVP; flag multicurrency as future), retro rate changes (recalc only unsettled lines).

---

## 8. Build Phases (work these in order with Claude Code)

### Phase 0 — Foundation (repo, auth, skeleton)
- Monorepo: `/web` (React+Vite+TS), `/api` (Azure Functions TS), `/edge-agent` (Node, stub), `/infra` (Bicep), `/docs`.
- Entra app registration(s); MSAL login; app roles wired end-to-end (token roles claim → API middleware → UI route guards).
- Azure SQL schema scaffold + migrations; CI/CD via GitHub Actions: SPA → GitHub Pages, API → Azure Functions; CORS locked to the Pages origin(s) + localhost.
- **Mock-first D365 layer:** implement `D365Client` behind an interface with a fixture-backed mock (sample vendors, items, commodities, POs, invoices) so every later phase is buildable and testable without environment access. A `D365_MODE=mock|live` switch.
- ✅ *Done when:* a user logs in with Entra, sees role-appropriate nav, API rejects missing/insufficient roles, CI deploys on merge.

### Phase 1 — D365 reference data + live connectivity
- Client-credentials auth to D365; typed clients for vendors, released products, product category hierarchies, UoM; delta sync jobs + cached lookup endpoints; metadata-verification script that diffs assumed entity/field names against `$metadata`.
- ✅ *Done when:* vendor/item/commodity pickers in the UI are populated from a live (or mock) D365 with search.

### Phase 2 — Contracts & workflow
- Contract CRUD (header/lines per the domain model), seasons, vendor groups; line scoping by item/commodity/all-items with validation (no overlapping conflicting scopes per vendor/period).
- Generic workflow engine + contract approval flow; enable/disable lifecycle; audit log; attachments.
- On **enable** of a flat-rate contract: optional push of purchase price trade agreement journal to D365 (behind a feature flag).
- ✅ *Done when:* a contract can be drafted, submitted, approved, enabled, and is visible with full history; rates/commission % validated per line type.

### Phase 3 — Receiving → purchase orders
- Receipt entry against enabled contracts (only valid items per contract scope); lot/batch assignment; on submit, create D365 PO header + lines via OData, store PO number, write outbox records.
- **Receipt posting via Message Processor:** on receipt confirmation in the app, enqueue a receipt-post message into the D365 message queue (payload: PO number, lines, quantities, lot/batch, receipt date). Track the message id; a polling job (or business event) updates receipt status to `Posted` and captures the D365 product receipt number into the trace ledger. Surface failed messages in the outbox/retry dashboard with the D365 error log text.
- **Parallel D365 workstream (X++ team):** custom message type + processor class that posts the product receipt; until it's deployed, the mock D365 layer simulates the queue so app development isn't blocked. Define the message JSON contract in `/docs/contracts/receipt-post-message.md` and treat it as a versioned interface between the two teams.
- ✅ *Done when:* a receipt in the app produces a real PO in D365 (or mock), the posted receipt-post message round-trips through the message processor (or its mock), and the receipt shows `Posted` with the D365 product receipt number and lot data in the trace ledger.

### Phase 4 — Receiving operations (scale, labels, dock doors)
- Edge agent: serial/TCP scale read, weight capture API, ZPL render + print; device registration/keys.
- Scale ticket capture in the receipt flow (gross/tare/net); label template designer-lite (merge fields + GS1-128) and print on receipt line; dock door board with appointments/loads, drag-drop scheduling, status (scheduled/arrived/unloading/done).
- ✅ *Done when:* a clerk can weigh, receive, print pallet labels, and the dock board reflects live status.

### Phase 5 — Traceability ledger
- Sync production orders/consumption and sales orders/invoices (events + pulls); build TraceNode/TraceEdge ledger; trace explorer UI: pick any contract/receipt/lot/sales line and walk the chain in both directions; exception queue for unlinkable transactions.
- ✅ *Done when:* for seeded test data, a sales invoice line resolves to its receipt lines and contract with allocation weights, and untraceable lines land in the exception queue.

### Phase 6 — Settlement engine
- Flat-rate batch calculation; commission calculation per §7.2 (allocation, cost mapping table, pool distribution); settlement workbench UI (Accountant/Admin only): batch creation by vendor/pool/period, drill-down to source docs, adjustments with reasons, recalc diff, approval flow.
- ✅ *Done when:* both settlement types compute correctly against a comprehensive fixture dataset with unit tests covering the edge cases in §7.2 (this phase must be test-heavy).

### Phase 7 — Payout to D365
- On approval: create pending vendor invoice(s) via OData with line references back to settlement lines; track posting status; create vendor payment journal; reconcile posted invoice/payment back into PayoutDocument; double-settlement guards.
- ✅ *Done when:* an approved batch yields a pending vendor invoice in D365, and the batch locks with full document linkage.

### Phase 8 — Hardening
- Throttling/backoff tuning, outbox retry dashboard, reporting/exports (settlement statements per grower as PDF), grower statement email, performance passes, pen-test checklist, telemetry (App Insights).

---

## 9. How to Run This with Claude Code (VS Code)

1. Install Claude Code and the VS Code extension (see https://docs.claude.com/en/docs/claude-code/overview for current install steps).
2. Create the repo, drop this file at `/docs/PLAN.md`.
3. Create a `CLAUDE.md` at the repo root containing: the stack choices from §3, coding conventions (TypeScript strict, Zod validation at API boundaries, no client-side-only auth checks, every D365 write goes through the outbox), the mock-first rule (`D365_MODE`), and "consult /docs/PLAN.md §<n> for the current phase."
4. Work **one phase per session/branch**. Start each phase by asking Claude Code to *plan first* (use plan mode), review the plan, then implement. Require it to write/maintain tests as it goes — especially Phases 5–7.
5. After each phase, have Claude Code update a `/docs/DECISIONS.md` with anything that diverged from this plan (e.g., actual entity names discovered from `$metadata`).
6. Keep secrets out of the repo: local `.env` + Azure Key Vault references in Functions settings.

---

## 10. Open Decisions (answer before/while starting)

*(Resolved: hosting = GitHub Pages + standalone Azure Functions; in-app product receipt posting = D365 Message Queue / Message Processor custom process.)*

1. Commission "net revenue" definition: exactly which cost categories deduct (freight in/out, packing materials, labor, cooling, marketing fees)? Provide the list for the cost mapping table.
2. Pool distribution basis: quantity vs. value? Per pool or global setting?
3. Partial-sale settlement policy: settle-as-sold vs. hold-until-lot-closed?
4. Single legal entity & currency for MVP? Multi-company comes later via `dataAreaId` handling.
5. Should pending vendor invoices auto-post, or stop at "pending" for an accountant to post in D365? (Recommend stopping at pending for MVP.)
6. Message processor contract ownership: who builds/deploys the X++ message type + processor, and what is the target deployment date? (Phase 3 app work can proceed against the mock, but live testing depends on it.)
7. GitHub Pages domain: repo-path URL (`<org>.github.io/<repo>`) or custom domain? This fixes the Entra redirect URIs, CORS origins, and Vite `base` config in Phase 0.
