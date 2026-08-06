# Internet Billing Manager

An admin-only internet billing management app backed by Google Sheets. Manage customer accounts, record charges (service, equipment, one-time, late fees), record payments, and apply automatic 20% late fees on the 10th of each month.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/billing-app run dev` — run the billing web app (port 23436)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Clerk auth
- Frontend: React + Vite + Tailwind v4 + shadcn/ui + wouter + TanStack Query
- Data: Google Sheets (via @replit/connectors-sdk) — NO database used
- Auth: Clerk (Replit-managed) with admin email restriction
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `artifacts/api-server/src/lib/googleSheets.ts` — All Google Sheets read/write logic
- `artifacts/api-server/src/middlewares/requireAdmin.ts` — Admin-only guard (restricts to rottschaferwilson@gmail.com)
- `artifacts/api-server/src/routes/` — Route handlers (customers, transactions, admin, dashboard)
- `artifacts/billing-app/src/` — React frontend
- `artifacts/api-server/data/spreadsheet_id.txt` — Auto-created file storing the Google Sheets ID

## Google Sheets structure

The app auto-creates a spreadsheet named "Internet Billing Manager" on first use.

- **Customers** sheet: id, name, address, phone, planName, monthlyRate, status, notes, createdAt
- **Transactions** sheet: id, customerId, date, type, description, amount, createdAt

Transaction types: service | equipment | one_time | late_fee | manual_late_fee | payment
- Charges = positive amounts
- Payments = negative amounts
- Balance = sum of all transaction amounts for a customer

## Architecture decisions

- **Google Sheets as database** — user explicitly wants all data in Sheets so it survives app failure. No PostgreSQL used for billing data.
- **Admin email restriction** — `requireAdmin` middleware checks Clerk user's primary email matches `rottschaferwilson@gmail.com`. Any other account gets 403.
- **Auto-created spreadsheet** — on first API call, the server creates the spreadsheet if `SPREADSHEET_ID` env var and `data/spreadsheet_id.txt` file are both absent. The URL is visible at Admin > Open Spreadsheet.
- **Late fee rule** — 20% of current balance, applied only to customers with positive balance. Skips zero or negative balances.
- **Payments stored as negative amounts** — simplifies balance computation: balance = sum(all transaction amounts).

## Product

- Landing page with Sign In / Get Started
- Dashboard with total outstanding, active customer count, recent transactions feed
- Customer list with per-row balance (red = owes, green = credit)
- Customer detail with full transaction history, running balance, and charge/payment actions
- Charge types: Service, Equipment, One-Time, Late Fee (manual), Payment
- Admin panel: Apply Late Fees button (with result summary), link to open Google Spreadsheet

## User preferences

- Admin account: rottschaferwilson@gmail.com (only this account can access the app)
- Late fee: 20% of balance on the 10th of each month, only for positive balances
- All data must be stored in Google Sheets (reliability requirement)

## Gotchas

- The Google Sheets spreadsheet ID is stored in `artifacts/api-server/data/spreadsheet_id.txt`. If this file is deleted, a new spreadsheet is created on next API call.
- You can also set `SPREADSHEET_ID` as an environment variable to override the file.
- After any OpenAPI spec change, always run codegen before editing routes: `pnpm --filter @workspace/api-spec run codegen`
- The Clerk proxy (`/api/__clerk`) only activates in production — dev uses Clerk's direct FAPI.
- `@workspace/db` and PostgreSQL are still in the workspace but not used by this app.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `clerk-auth` skill for auth setup, troubleshooting, and customization
