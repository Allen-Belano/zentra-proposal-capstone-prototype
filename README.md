# Zentra - Proposal Capstone Prototype

UI prototype of **Zentra**, the centralized digital workspace proposed by **Aether** (RTU BSIT capstone) for **iFixz Enterprise Co.**

Everything runs in the browser with mock data. There is no backend yet: the ETL pipeline, validation rules, two-way Bitrix24 sync, and RBAC are simulated client-side so the full workflow can be demonstrated.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm run build:single # one self-contained HTML file in dist-single/ (easy to share)
```

## Demo accounts

Password for all three: `zentra2026`

| Role | Email | Can do |
|---|---|---|
| Super Admin | superadmin@ifixz.com | Enable/disable accounts, assign Department Heads, audit log |
| Department Head | depthead@ifixz.com | Modules, data pipeline, rejected records, sync center, backups, team access |
| Department Employee | employee@ifixz.com | View/add/edit/archive records in modules they're granted |

The login screen has one-click buttons for each account. Use **Reset demo data** in the user menu to start over.

## Suggested defense demo (Department Head)

1. **Overview**: role-specific metrics, pipeline throughput, items that need attention.
2. **Data pipeline → Run pipeline → Use the sample file**: watch ingest → staging → validate → transform → load. 7 rows load and 3 go to the **Rejected records** ledger instead of being dropped. Fix one and reload it.
3. **Operations**: edit an order's stage. It saves in Zentra, then writes back to Bitrix24 (`Syncing` → `Synced`).
4. **Conflict**: row menu → *Simulate Bitrix24 edit*, then edit the same order in Zentra. The write-back is held as a conflict in **Sync center**. Choose which version to keep.
5. **Outage**: Sync center → *Simulate Bitrix24 outage*, then edit an order. It retries 3 times, then fails and appears for review. Operations shows the last synced data with a warning.
6. **Sync now**: pulls new won deals from Bitrix24 through the pipeline (one has no customer and is rejected).
7. **Module registry → Register module**: paste/keep the sample JSON manifest. Procurement appears in the sidebar immediately, no redeploy.
8. **Team access**: set Jessa's Inventory access to *No access*, sign in as the employee, and see the module disappear and the URL blocked.

## RBAC

Roles and permissions are defined in `src/lib/rbac.ts`. Every page is guarded (`<Guard perm="…">`), the sidebar only lists what a role can open, and employees have per-module access (`none`, `view`, `edit`) set by their Department Head.

## Stack

React 18 + TypeScript, Vite, TanStack Router, Zustand (persisted to localStorage), Tailwind CSS, shadcn/ui components (Radix primitives), Recharts, lucide-react, Sonner.

The proposed production stack (Chapter 3) uses TanStack Start on the frontend and Laravel + MySQL on the backend. This prototype keeps the same UI layer (React, TanStack, Zustand, Tailwind, shadcn/ui) so screens can be carried over.

## Project structure

```
src/
  components/ui/     shadcn/ui components
  components/app/    app shell, sidebar, guards, shared pieces
  data/seed.ts       mock users, modules, records, runs, sync history
  lib/rbac.ts        roles, permissions, module access
  lib/validation.ts  ETL validate/transform stages and CSV parser
  store/app-store.ts state and actions (pipeline, two-way sync, audit, BAM events)
  pages/             one file per screen
```

All dates and times are shown in Philippine time (UTC+8).
