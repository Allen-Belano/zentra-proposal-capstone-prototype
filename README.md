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

Password for all accounts: `zentra2026`. The sign-in page has one-click buttons for each.

| Account | Email | Does |
|---|---|---|
| Super Admin | superadmin@ifixz.com | Accounts, Department Heads, financial access, audit log |
| Department Head | depthead@ifixz.com | Business overview, sync and batch processing, pipeline, registry, backups, team roles |
| Accounting | jessa.accounting@ifixz.com | Order clearing and payments |
| Purchasing | mark.purchasing@ifixz.com | Vendor P.Os |
| Inventory | ana.inventory@ifixz.com | Inventory changes and receiving reports |
| Invoicing | paolo.invoicing@ifixz.com | Sales invoices and written reports |
| Delivery | lea.delivery@ifixz.com | Deliveries and delivery receipts |

Use **Reset demo data** in the avatar menu to start over.

## User guide

New to Zentra? Start with **[docs/QUICK_START.md](docs/QUICK_START.md)**, a one-page guide: sign in, what your role does, and how to move an order.

**[docs/USER_GUIDE.md](docs/USER_GUIDE.md)** has the full detail:

- how an order moves from the won deal to payment, and which role owns each stage
- what each role sees and does
- common tasks: order pages, batch processing, assigning roles, granting financial access
- who can see and change what
- a 10-minute demo script for presentations
- troubleshooting

## Access control

Roles, positions, and permissions are defined in `src/lib/rbac.ts`, and the order flow in `src/lib/orders.ts`.

- Every page is guarded (`<Guard perm="…">`), and the sidebar lists only what a role can open.
- Each Department Employee holds one Operations role (Accounting, Purchasing, Inventory, Invoicing, or Delivery). It decides their module access, the order steps they can perform, and whether they see amounts.
- The store re-checks these rules on every action (`src/store/app-store.ts`), so hiding a button is never the only protection.

In production, the Laravel API must apply the same rules, including leaving financial fields out of responses for roles without access.

## Stack

React 18 + TypeScript, Vite, TanStack Router, Zustand (persisted to localStorage), Tailwind CSS, shadcn/ui components (Radix primitives), Recharts, lucide-react, Sonner.

The proposed production stack (Chapter III of the paper) uses Next.js on the frontend and Laravel + MySQL on AWS RDS on the backend, with a Python ETL pipeline. This prototype uses the same UI layer (React, Zustand, Tailwind, shadcn/ui), so screens can be carried over.

## Project structure

```
src/
  components/ui/     shadcn/ui components
  components/app/    app shell, sidebar, guards, shared pieces, module registration wizard
  data/seed.ts       mock users, modules, orders with stage histories, runs, sync history
  lib/orders.ts      order flow: steps, responsible roles, actions, documents
  lib/adapters.ts    adapter types, connection fields, module templates, rule generator
  lib/rbac.ts        roles, Operations positions, permissions, financial access
  lib/validation.ts  ETL validate/transform stages and CSV parser
  store/app-store.ts state and actions (order steps, notifications, pipeline, two-way sync, batches, audit)
  pages/             one file per screen (order-detail.tsx is the order page)
docs/USER_GUIDE.md   how to use Zentra, by role, with a demo script
```

All dates and times are shown in Philippine time (UTC+8).
