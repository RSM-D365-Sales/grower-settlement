# Grower Contract & Settlement Platform

Web application for produce buyers/packers/shippers managing the full grower lifecycle — contracts, receiving, traceability, settlement, and payout — with Dynamics 365 F&SC as the financial system of record.

📘 Master plan: [Docs/PLAN.md](Docs/PLAN.md) · Decisions log: [Docs/DECISIONS.md](Docs/DECISIONS.md) · Setup: [Docs/SETUP.md](Docs/SETUP.md)

🌐 **Hosted demo:** https://rsm-d365-sales.github.io/grower-settlement/ — mock sign-in, demo data baked in at deploy time (no backend; see decision 0.12). Pushes to `main` redeploy automatically.

## Structure

| Path | What | Deploy target |
|---|---|---|
| [`web/`](web/) | React 18 + Vite + TypeScript SPA (Fluent UI v9) | GitHub Pages |
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

Open http://localhost:5174, pick a role on the mock sign-in screen, and the app shows role-appropriate navigation backed by the live API (which enforces roles server-side).

To run against real Entra ID / D365, see [Docs/SETUP.md](Docs/SETUP.md).
