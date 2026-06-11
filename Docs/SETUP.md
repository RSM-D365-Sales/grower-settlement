# Setup

## Local development (no Azure / Entra / D365 required)

```bash
# API
cd api
npm install
copy local.settings.sample.json local.settings.json   # AUTH_MODE=mock, D365_MODE=mock
npm run dev                                           # http://localhost:7071

# Web (second terminal)
cd web
npm install
npm run dev                                           # http://localhost:5174
```

Sign in on the mock screen with any name and a set of roles. The SPA sends `x-mock-user`/`x-mock-roles` headers; the API authenticates them in mock mode but **still enforces role gates** — e.g. `/api/settlement/batches` returns 403 unless you picked Accountant or Admin.

Run tests with `npm test` in `api/` and `web/`.

## Entra ID app registrations (for real sign-in)

Two registrations, one tenant:

1. **API registration** (`grower-api`)
   - Expose an API → set Application ID URI `api://<api-client-id>` → add scope `access_as_user`.
   - App roles (allowed member types: Users/Groups): `Admin`, `Accountant`, `ContractManager`, `ContractApprover`, `ReceivingClerk`, `Viewer` — exact strings, they are validated by `api/src/auth/roles.ts`.
   - Assign users/groups to roles via Enterprise Applications → grower-api → Users and groups.
2. **SPA registration** (`grower-web`)
   - Platform: Single-page application. Redirect URIs: `http://localhost:5174/` and `https://<org>.github.io/<repo>/` (add the custom domain later if §10.7 changes).
   - API permissions: delegated permission to `grower-api / access_as_user`; grant admin consent.

Then configure:

- **API** (`local.settings.json` or Function App settings): `AUTH_MODE=entra`, `ENTRA_TENANT_ID`, `API_CLIENT_ID=<api-client-id>`.
- **Web** (`web/.env.local` or repo Actions variables): `VITE_AUTH_MODE=entra`, `VITE_ENTRA_CLIENT_ID=<spa-client-id>`, `VITE_ENTRA_TENANT_ID`, `VITE_API_SCOPE=api://<api-client-id>/access_as_user`, `VITE_API_BASE_URL`.

> Note: app roles arrive in the **API access token** requested with the `access_as_user` scope; the SPA also reads roles from its ID token for navigation. Assign the same app roles on both registrations *or* (simpler) add the SPA as an authorized client application of the API registration and define roles only on the API — the API token is what matters for authorization.

## D365 F&SC connection (Phase 1)

1. Create an app registration (`grower-d365-s2s`) with a client secret.
2. In D365: System administration → Setup → **Microsoft Entra ID applications** → add the client id, map to a service account user with appropriate security roles.
3. API settings: `D365_MODE=live`, `D365_BASE_URL=https://<env>.operations.dynamics.com`, `D365_CLIENT_ID`, `D365_CLIENT_SECRET` (Key Vault reference in Azure).

## Azure infrastructure

```bash
az group create -n rg-grower-settlement -l eastus2
az deployment group create -g rg-grower-settlement -f infra/main.bicep -p infra/main.parameters.json
```

Outputs the Function App name/hostname, SQL FQDN, and Service Bus namespace. Then:

1. Save the Function App publish profile as repo secret `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` and its name as variable `AZURE_FUNCTIONAPP_NAME` (used by `.github/workflows/deploy-api.yml`).
2. Enable GitHub Pages (Settings → Pages → Source: GitHub Actions). `deploy-web.yml` publishes on pushes to `main`.
3. Set `DATABASE_URL` on the Function App as a Key Vault reference, then run `npx prisma migrate deploy` from `api/` against the database.

## Database

Prisma schema: `api/prisma/schema.prisma` (scaffolds the full Docs/PLAN.md §5 domain model).

```bash
cd api
# local dev against any SQL Server / Azure SQL:
set DATABASE_URL=sqlserver://<host>:1433;database=<db>;user=<u>;password=<p>;encrypt=true
npx prisma migrate dev --name init
```
