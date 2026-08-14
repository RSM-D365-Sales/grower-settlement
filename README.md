# Grower Contract & Settlement Platform

Web application for produce buyers/packers/shippers managing the full grower lifecycle — contracts, receiving, traceability, settlement, and payout — with Dynamics 365 F&SC as the financial system of record.

📘 Master plan: [Docs/PLAN.md](Docs/PLAN.md) · Decisions log: [Docs/DECISIONS.md](Docs/DECISIONS.md) · Setup: [Docs/SETUP.md](Docs/SETUP.md)

🌐 **Hosted demo:** https://grower-settlement.rsmd365.com/ (Git-connected Cloudflare Pages) — opens straight on the settlement dashboard as an auto-signed-in demo identity, demo data baked in at deploy time (no backend; see decisions 0.12/0.14/0.17). Pushes to `main` redeploy automatically. **All data is synthetic** — the North Bay Produce branding is presales demo theming only (decision 0.17).

## Structure

| Path | What | Deploy target |
|---|---|---|
| [`web/`](web/) | React 18 + Vite + TypeScript SPA (Fluent UI v9) | Cloudflare Pages |
| [`api/`](api/) | Azure Functions v4 (TypeScript) HTTP API + sync jobs | Azure Functions |
| [`edge-agent/`](edge-agent/) | Node service stub for scale / Zebra label printers (Phase 4) | Receiving-station hardware |
| [`infra/`](infra/) | Bicep IaC | Azure |

## Quickstart (local, no Azure or D365 needed)

Everything runs in **mock mode** out of the box (`AUTH_MODE=mock`, `D365_MODE=mock`).

```bash
# Terminal 1 — API
cd api
npm install
copy local.settings.sample.json local.settings.json
npm run dev          # http://localhost:7071

# Terminal 2 — Web
cd web
npm install
npm run dev          # http://localhost:5174
```

Open http://localhost:5174 — mock mode auto-signs-in a demo identity (full access) and lands on the dashboard. The API still enforces roles server-side on every request.

To run against real Entra ID / D365, see [Docs/SETUP.md](Docs/SETUP.md).
