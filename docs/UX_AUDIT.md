# UX Audit & Remediation Spec — Zentra prototype

Status: approved, in progress
Scope: `src/` (React + TypeScript + Tailwind + shadcn/ui), `docs/`

This is the reviewable list behind the UX changes. Every item is filed as
**Fitts** (target size / distance), **Hicks** (choice count), **Jakob** (familiar
patterns), **Copy** (plain language for non-technical staff), or **Bug**.

Reference documents used for the plain-language and layout decisions:
`ui-ux-pro-max` (`references/quick-reference.md`, `references/pro-rules.md`),
`frontend-design`, `frontend-ui-engineering`, `interaction-design`.

> **Note:** this file was written to `.opencode/plans/` because the `edit`
> permission currently denies writes to `docs/`. Move it to `docs/UX_AUDIT.md`
> once write access is granted.

---

## 0. Principles applied

| Principle | Meaning here | Where it bites |
|---|---|---|
| **Fitts' Law** | Bigger, closer, fewer targets reached more easily | 36px is the tallest control in the app; destructive buttons sit closer to primaries than primaries sit to content |
| **Hicks' Law** | Fewer choices per screen means faster decisions | The Overview customiser shows ~39 controls at once |
| **Jakob's Law** | Users expect the app to work like the apps they already know | Table rows need two clicks; nav labels are jargon; a plain Save asks for confirmation |
| **Plain language** | A warehouse or accounting clerk must understand the label without training | "ETL", "write-back", "adapter", "KPI", "ledger", "regex" appear with zero explanation |
| **6 stages** | The order lifecycle is six stages, not "steps" | "step" is used 30+ times in user-facing copy for what the app already calls a stage in code |
| **Dynamic identity** | The UI names the person's actual scope | The Department Head sees "Department Head" instead of "Operations Head" |

---

## 1. Plain language glossary

The app currently uses several audiences' vocabularies at once. These are the
canonical terms. Source of truth: `src/lib/terms.ts`.

### 1.1 Order stages

Six stages. Branch values are sub-states of a stage and never appear in the
progress track.

| Stored value (`ORDER_STAGES`) | Displayed | Track position |
|---|---|---|
| `Accounting` | Accounting | 1 |
| `On hold` | On hold | 1 (sub-state of Accounting) |
| `Purchasing` | Purchasing | 2 |
| `Order basis` | Waiting for supplier | 2 (sub-state of Purchasing) |
| `Receiving` | Receiving | 3 |
| `Invoicing` | Invoicing | 4 |
| `Delivery` | Delivery | 5 |
| `Collection` | Payment | 6 |
| `Done` | Completed | — |

Stored values are **never** renamed. `ORDER_STAGES` is persisted to
`localStorage` (`src/store/app-store.ts`, store version `zentra-demo-v3`), so
renaming a stored value would invalidate every saved browser. Only the display
label changes.

### 1.2 Document types

| Key | Displayed | Input label |
|---|---|---|
| `clientPo` | Supplier P.O | Supplier P.O number |
| `supplierPo` | Vendor P.O | Vendor P.O number |
| `rr` | Receiving report (RR) | Receiving report number |
| `si` | Sales invoice (SI) | Sales invoice number |
| `wr` | Sales report (WR) | Sales report number |
| `dr` | Delivery receipt (DR) | Delivery receipt number |
| `payment` | Official receipt (OR) | Official receipt number |

### 1.3 Term replacements

| Technical term | Plain replacement | Note |
|---|---|---|
| write-back | sending to Bitrix24 | appears 18× |
| sync (noun) | update | "Sync center" → "Bitrix24 updates" |
| ETL pipeline | Data pipeline | the name stays; see §2.3 |
| ingest / staging / transform / load | Read the file → Check the rows → Save to Zentra | 3 steps instead of 5 jargon verbs |
| rejected rows / ledger | records that need fixing | |
| adapter | connection type | |
| KPI / key numbers | key numbers | pick one, use everywhere |
| conflict | needs review | + tooltip explaining the two versions |
| won deal | order confirmed | |
| SKU | Item code | |
| receivable | money owed to us | |
| restore point | backup copy | |
| central database | Zentra | |
| validation rules | rules for checking records | |
| regex | Format + "must look like ABC-1234" | |
| manifest | setup file | |
| module | keep | "module" is a reasonable word for a section of the app; the adjective "baseline" is dropped |

### 1.4 Tooltip glossary

Only 3 tooltips exist in the entire app. One reusable `<HelpTip>` component
(`src/components/app/bits.tsx`) is applied to the terms that stay technical by
necessity.

| Term | Tooltip |
|---|---|
| Bitrix24 | The customer relationship system where sales deals are recorded. |
| sending to Bitrix24 | Saving a change in Zentra and pushing it to Bitrix24. |
| needs review | The same record changed in both Zentra and Bitrix24. You choose which version to keep. |
| records that need fixing | Rows from a file that didn't pass your rules. Fix one and load it again, or dismiss it. |
| key numbers | Measures that show how the work is going, such as how many orders were finished on time. |
| connection type | How Zentra connects to another system. |

---

## 2. Structure, flow and hierarchy

### 2.1 Where each role starts

| Role | Current | Proposed | Reason |
|---|---|---|---|
| Employee | `/`, H1 = position name | `/`, H1 = **My work**, "Waiting on you" becomes the full-width primary card | The only work queue currently gets 1/3 of the width (`src/pages/overview.tsx:577`) while the Accounting-only summary takes 2/3 |
| Department Head | `/`, H1 = "Department Head", default tab = General | `/`, H1 = **Operations Head**, default tab = **Needs attention** | General is a passive dashboard; every decision the role makes lives in Needs attention |
| Super Admin | `/`, H1 = "Super Admin" | `/`, H1 = **IT Administration** | No order data, no actionable item, no link to Users and roles |

### 2.2 Navigation

- The nav item for `/` and the page H1 use the **same** dynamic string, so the
  nav, the breadcrumb and the heading never disagree.
- `src/components/app/app-shell.tsx:54-55` lists two entries that both point at
  `/users` and share the same React `key`. One entry survives, labelled by
  role: "Team access" for Department Heads, "Users and roles" for Super Admins.
- `src/pages/activity.tsx:64-65` defaults the order list to "Waiting on anyone".
  Employees must know to filter by their own position. Compare Linear
  ("My Issues"), Jira ("Assigned to me"), Gmail ("Inbox").
- `src/pages/overview.tsx:597-602` tab names promise the opposite of their
  contents: "General" holds all business data, "Technical" holds diagnostics.
  Renamed to **Business summary** / **Needs attention** / **System health**.

### 2.3 Data pipeline

The name **stays**. Its purpose is stated in plain language wherever it
appears, because the page is reached by people who do not know the word:

- Page description (`src/pages/pipeline.tsx:350`):
  *"Files you upload and updates from Bitrix24 are checked against your rules
  before they're saved. Rows that don't pass are set aside for you to fix."*
- Nav tooltip: *"For files you upload and data from connected apps."*
- Stage names become three readable steps: Read the file → Check the rows →
  Save to Zentra.

### 2.4 Register module → full page

`RegisterModuleDialog` (`src/components/app/register-wizard.tsx:554-581`) is a
multi-step flow inside a modal. Shopify, HubSpot and Zendesk all use a full
page for multi-step configuration, which also makes it linkable and
bookmarkable. Promoted to route `/registry/new`; the registry page's
"Register module" button becomes a link to it.

---

## 3. Fitts' Law — target size and distance

Root cause is a single file: `src/components/ui/button.tsx:19-22`. The `lg`
size (`h-11`, 44px) is defined but never used anywhere in the codebase, so
**36px is the tallest interactive control in the app**.

| Control | Now | Proposed | File |
|---|---|---|---|
| Button `default` | `h-9` (36px) | `h-10` (40px) | `ui/button.tsx:19` |
| Button `sm` | `h-8` (32px) | `h-9` (36px) | `ui/button.tsx:20` |
| Button `icon` | `h-9 w-9` | `h-10 w-10` | `ui/button.tsx:22` |
| Tab trigger | `h-8` (32px) | `h-9` | `ui/tabs.tsx:62` |
| Switch | `h-5` (20px) | `h-6` (24px, WCAG floor) | `ui/switch.tsx:12` |
| Checkbox | `h-4 w-4` (16px) | `h-5 w-5` | `pages/sync.tsx:207,215` |
| Dialog close | `h-8 w-8` | `h-10 w-10` | `ui/dialog.tsx:25` |
| Sheet close | `h-8 w-8` | `h-10 w-10` | `ui/sheet.tsx:25` |
| Chart-type radio | `h-7 w-7` (28px) | `h-9 w-9` | `components/app/dashboard.tsx:362` |
| Move up / down | `h-8 w-8` | `h-10 w-10` | `components/app/dashboard.tsx:369-370` |
| "Mark all as read" | bare text button, ~17px | `min-h-9 py-1.5` | `components/app/app-shell.tsx:212` |
| Theme segments | `py-1.5` (~28px) | `min-h-9` | `components/app/app-shell.tsx:161-172` |

### Destructive vs. primary

| Issue | Fix |
|---|---|
| `components/app/confirm.tsx:82` — `autoFocus` lands on the **destructive** button | Focus lands on Cancel; the destructive button is not focused by default |
| `pages/pipeline.tsx:212-216` — a 36px destructive "Dismiss" X sits 4px from a 32px primary "Fix"; the destructive target is *larger* than the primary one | Separate the actions; the destructive one moves out of the primary row |
| `pages/registry.tsx:72-77` — a 32px destructive "Deactivate" sits 8px from a 32px frequency dropdown | Destructive action moves to the card's action menu, away from the inline dropdown |

### Distance

| Issue | Fix |
|---|---|
| `pages/users.tsx:131-141` — the person's name is in column 1, a 20×36px switch in column 6, roughly 900px away at 1440px | Group the row's controls together next to the name |
| `pages/backups.tsx:66-82` — a 32px "Test restore" in the last column, ~400px from the row's date | Move the action next to the row's identity |
| `pages/pipeline.tsx:209-219` — a 32px "Fix" and a 36px "Dismiss" ~400px from the row's identity | Same |

---

## 4. Hicks' Law — choice count

| Screen | Controls on screen | Fix |
|---|---|---|
| Overview customiser (`components/app/dashboard.tsx:379-404`) | ~39 (15 switches + 7 chart groups + 14 arrow buttons + 3 footer) | Each 3-button chart radiogroup becomes a single `<Select>`; the arrow buttons appear on row hover/focus |
| Users and roles (`pages/users.tsx:119-177`) | ~22 (7 users × 3 controls) | Row controls grouped into one overflow menu |
| Register module, step 1 (`components/app/register-wizard.tsx:208-289`) | ~26 | Adapter choice becomes a `<Select>`; icon picker becomes searchable |

---

## 5. Jakob's Law — familiar patterns

| Deviation | Familiar apps | Fix |
|---|---|---|
| Table rows are not clickable; Edit needs the ⋮ menu (`pages/records.tsx:201-213`) | Gmail, Drive, Linear, Jira, Notion, Stripe — the row is the link | The whole row navigates |
| Nav labels are jargon ("Data pipeline", "Sync center", "Module registry") | Jira, Shopify, QuickBooks use business language | "Sync", "Integration Hub"; "Data pipeline" keeps its name but gains a tooltip |
| A plain **Save** asks for confirmation (`pages/records.tsx:280-285`) — a modal inside a modal | HubSpot, QuickBooks: inline validation plus a toast | Save-confirm removed |
| Reversible toggles ask for confirmation (`pages/users.tsx:92,107,233`, `pages/pipeline.tsx:280`) | Gmail, Linear, Notion: optimistic update, toast, Undo | Confirm removed, toast with Undo added |
| "Reset demo data" sits beside "Sign out" in the avatar menu | Slack, Google: destructive actions live in a separate area | Moved out of the avatar menu, still confirmed |
| Empty states have no action (`components/app/bits.tsx:66` supports it; ~8 call sites skip it) | Every mainstream app puts the create action in the empty state | `action` passed at each call site |
| Demo controls look like production controls | — | "Simulate Bitrix24 edit/outage" and "Reset demo data" get an explicit **Demo** label |
| The order's primary action sits in a body card, not the page header (`pages/order-detail.tsx:174-179`) | Jira, Linear, Shopify, HubSpot: primary action in the detail-page header | Primary action mirrored into the page header |

---

## 6. Feedback: toasts, confirms and sync state

1. **Confirm dialog gains a pending state.** The confirm button shows a
   spinner and disables while the action runs; the dialog closes on success and
   a toast reports the result.
2. **`toast.promise` for anything that reaches Bitrix24.** Today
   `pages/records.tsx:263` and `pages/order-detail.tsx:92` show "Writing back to
   {source}…" as the *description* of a success toast, so the user never learns
   whether it sent. Replaced with loading → success / error states:
   *"Sending to Bitrix24…"* → *"Sent to Bitrix24"* / *"Couldn't reach Bitrix24 —
   saved in Zentra, we'll retry"*.
3. **A toast on every action that currently has none**: sign-in toggle
   (`pages/users.tsx:96`), financial access (`:110`), team-KPI grant (`:237`),
   backup created (`pages/backups.tsx:40`), restore tested (`:78`), rule toggled
   (`pages/pipeline.tsx:280`).
4. **Confirms stay** for destructive work (archive, deactivate, remove rule,
   reset data) and for order stage transitions.

---

## 7. Redundancy removal

| Issue | Location |
|---|---|
| Page title repeated three times (nav → breadcrumb → H1) for 8 pages | `src/components/app/app-shell.tsx`, `src/pages/*.tsx` |
| Overview H1 is a role name | `src/pages/overview.tsx:555,569,594` |
| "KPI" and "Key numbers" used for the same thing in one dialog | `components/app/dashboard.tsx:384,388` |
| Widget hints restate their own label | `components/app/dashboard.tsx:44,45,48,193,195,196,198` |
| "Unpaid transactions" — the app says "order" everywhere else | `src/pages/overview.tsx:304` |
| "avg" / "Avg handling" — every other stat spells it out | `components/app/dashboard.tsx:237`, `src/pages/performance.tsx:132` |
| Badge "Low" on a stock table | `src/pages/records.tsx:37` |
| "Sign-ins today" hinted "Last 24 hours" | `src/pages/overview.tsx:505-506` |
| "Confirm" as the default confirm-button label | `components/app/confirm.tsx:83` |

---

## 8. Bugs found during the audit

| # | Bug | Location | Severity |
|---|---|---|---|
| B1 | `hideOnTablet` maps to `hidden 2xl:table-cell` (1536px), so on a standard 1440px laptop the Operations list permanently hides **Client PO**, **Items** and **Location** | `src/pages/records.tsx:25` | High |
| B2 | "All {label}s" with a `/y$/ → "ie"` regex renders **"All statuss"** | `src/pages/records.tsx:166` | Medium |
| B3 | Write-back and conflict notifications deep-link non-order records to `/orders/:id`, landing on "This order doesn't exist" | `src/store/app-store.ts:150,158` | Medium |
| B4 | Log text renders "Payment collected (OR OR-8820)" — doubled prefix | `src/data/seed.ts:100,122,125,142,148` | Low |
| B5 | The Guard message tells a Super Admin to "Ask your Department Head" | `src/components/app/guard.tsx:15` | Low |
| B6 | Two nav entries share the route `/users` and the same React `key` | `src/components/app/app-shell.tsx:54-55` | Medium |
| B7 | `records.view` and `records.edit` are declared but never checked — dead configuration | `src/lib/rbac.ts:46,48` | Low |
| B8 | The "Order basis" stage notifies nobody, so the person who must chase the supplier is never told | `src/store/app-store.ts:22-29` | Medium |

---

## 9. Execution order

1. `src/lib/terms.ts` — the terminology layer (glossary, stage and document labels, tooltip text)
2. Dynamic titles — `src/lib/rbac.ts`, `src/pages/overview.tsx`, `src/components/app/app-shell.tsx`, `src/components/app/guard.tsx`
3. Copy sweep — "step" → "stage", and every replacement in §1.3 across `src/`
4. Toasts, confirm pending state, sync feedback — §6
5. Tooltips and redundancy removal — §1.4 and §7
6. Fitts sizing, Hicks and Jakob's Law — §3, §4, §5
7. Register module → full page — §2.4
8. Bugs — §8
9. `docs/USER_GUIDE.md` and `docs/QUICK_START.md` updated to the new vocabulary

---

## 10. What shipped

All nine steps are done. New files:

| File | Purpose |
|---|---|
| `src/lib/terms.ts` | The single place every user-facing name for a stage, a document, and a technical term is defined |
| `src/pages/register-module.tsx` | The wizard's own page at `/registry/new` |
| `docs/UX_AUDIT.md` | This document |

### Bugs — all fixed

| # | Fix |
|---|---|
| B1 | `hideOnTablet` now maps to `hidden xl:table-cell` (1280px), so Client PO, Items and Location are visible on a standard laptop |
| B2 | The filter reads "Any category" / "Any status" — the broken plural hack is gone |
| B3 | Notifications carry the module id, so a non-order record opens its own list instead of a dead "order doesn't exist" page |
| B4 | "Payment collected (OR-8820)" — the doubled prefix is gone |
| B5 | The Guard points at whoever can actually grant access: a Super Admin is told to ask another administrator, a Department Head is told to ask a Super Admin |
| B6 | The two `/users` nav entries now use a unique key, so a role holding both permissions cannot render a duplicate |
| B7 | `records.view` and `records.edit` are removed — they were never checked; module access is decided by `moduleAccess()` |
| B8 | The "Waiting for supplier" stage now notifies Purchasing |

### Verified

- `tsc -b` and `vite build` both pass.
- A headless-browser pass visited all 11 routes as three different roles (Operations Head, IT Administration, Delivery employee) and recorded **0 console errors, 0 exceptions and 0 failed requests**.

---

## 11. Open questions

- **"Waiting for supplier"** — the plain-language name chosen for the
  `Order basis` stage. Confirm this matches what the business calls it; it
  appears in the stage badge, the progress track, and the order timeline.
- **"Sync"** — the nav label for the sync page.
  Bitrix24 is the real CRM, so the name is honest, but a generic alternative
  ("External system updates") is possible.
- **Employee H1** — "My work" is used for all employees, with the position in
  the page description ("Your delivery tasks and today's numbers"). An
  alternative is to title the page after the position ("Delivery").
- **Two names still use the older wording** and were left alone on purpose:
  the stored stage value `Order basis` and the audit-log action names, which
  are a historical record rather than interface copy.

