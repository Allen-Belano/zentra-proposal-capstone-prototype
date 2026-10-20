# Zentra user guide

Zentra is the centralized digital workspace for iFixz Enterprise Co. It brings orders from Bitrix24, inventory, and imported files into one place, and moves every order through the Operations team step by step until it is delivered and paid.

This guide covers how to sign in, how an order moves, what each role does, and a demo script for presenting the prototype.

> **Prototype note:** everything runs in your browser with sample data. Nothing is sent to a real Bitrix24 or database. Changes are saved in this browser only, and **Reset demo data** puts everything back.

## Contents

1. [Getting started](#1-getting-started)
2. [Finding your way around](#2-finding-your-way-around)
3. [How an order moves](#3-how-an-order-moves)
4. [Guide by role](#4-guide-by-role)
5. [Common tasks](#5-common-tasks)
6. [Who can see and change what](#6-who-can-see-and-change-what)
7. [Demo script for presentations](#7-demo-script-for-presentations)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Getting started

### Run the app

```bash
npm install
npm run dev
```

Open http://localhost:5173.

### Sign in

Every account uses the password **`zentra2026`**. On the sign-in page you can also click any demo account to sign in with one click.

| Account | Name | Email | Role |
|---|---|---|---|
| Super Admin | Maria Santos | superadmin@ifixz.com | Manages accounts, roles, financial access, and the audit log |
| Department Head | Carlo Reyes | depthead@ifixz.com | Oversees Operations, sync, the data pipeline, and team roles |
| Accounting | Jessa Cruz | jessa.accounting@ifixz.com | Credit checks and payments |
| Purchasing | Mark Dizon | mark.purchasing@ifixz.com | Supplier purchase orders |
| Inventory | Ana Lim | ana.inventory@ifixz.com | Stock and receiving reports |
| Invoicing | Paolo Garcia | paolo.invoicing@ifixz.com | Sales invoices and written reports |
| Delivery | Lea Mendoza | lea.delivery@ifixz.com | Deliveries and delivery receipts |

The last five are **Department Employees** in Operations. Each holds exactly one Operations role, and that role decides what they can see and do.

---

## 2. Finding your way around

| Area | What it's for |
|---|---|
| **Sidebar** (left) | The pages your role can open. It stays in place while you scroll. **Collapse** at the bottom shrinks it to icons. |
| **Title bar** (top) | Where you are, e.g. *Monitoring › Order tracking*. On phones, the ☰ button opens the menu. |
| **Bell** 🔔 | Notifications for you or your role, such as "ORD-1041 is ready for purchasing." Click one to open that order. |
| **Avatar menu** | Your name and role, the **Theme** switch (Light, Dark, System), **Reset demo data**, and **Sign out**. |

### Pages

| Page | Who sees it | What it shows |
|---|---|---|
| Overview | Everyone | Your dashboard. Department Heads get **General**, **Needs attention**, and **Technical** tabs. |
| Inventory | Everyone in Operations | Stock levels, reorder points, and locations |
| Operations | Everyone in Operations | All orders as a table |
| Order tracking | Everyone | Order cards with progress, plus an **Order activity** timeline |
| Data pipeline | Department Head | CSV imports, rejected records, validation rules |
| Sync center | Department Head | Bitrix24 sync status, conflicts, **Batch processing**, history |
| Module registry | Department Head | Register modules with the guided setup or a JSON manifest, and turn them on or off |
| Backups | Department Head | Restore points and schedule |
| Team access | Department Head | Assign each employee their Operations role |
| Users and roles | Super Admin | Accounts, Department Heads, financial access |
| Audit log | Super Admin | Every sign-in and change |

---

## 3. How an order moves

An order starts when a deal is won in Bitrix24. It then moves through these steps. Each step belongs to one role, and only that role can move the order forward.

| Step | Responsible role | What they do | Document produced |
|---|---|---|---|
| **Credit check** | Accounting | Check the client has no unpaid balance, then **Clear credit check**. If they do owe money, **Put on hold**. | — |
| On hold *(if needed)* | Accounting | When the client settles the old balance, click **Balance settled**. | — |
| **Purchasing** | Purchasing | If everything is in stock: **Reserve from stock** (goes straight to Invoicing). Otherwise: **Issue supplier PO**, or **Order basis** if items are hard to source. | Supplier P.O. |
| Order basis *(if needed)* | Purchasing | Wait for the supplier, then **Supplier items arrived**. | — |
| **Receiving** | Inventory | Receive the supplier delivery and **Post receiving report**. | RR |
| **Invoicing** | Invoicing | **Issue SI and WR** for the delivery. | SI and WR |
| **Delivery** | Delivery | Deliver the items and **Record delivery** once the client signs. | DR |
| **Collection** | Accounting | Only if the order was delivered unpaid. **Record payment** when the client pays. | OR |
| **Done** | — | Delivered and paid. | — |

**Paid or unpaid.** Every order shows a **Paid** or **Unpaid** badge. If the client pays before delivery, Accounting can use **Record early payment** at any step; the order then goes straight to Done after delivery. Otherwise it goes to Collection.

**Notifications.** When an order moves to a new step, the role responsible for that step gets a notification. Department Heads are notified when an order goes on hold and when a sync fails or conflicts.

**Bitrix24.** Every change made in Zentra is saved first and then written back to Bitrix24. The badge next to an order shows *Syncing*, *Synced*, *Conflict*, or *Failed*.

---

## 4. Guide by role

### Operations employees (all five roles)

When you sign in, your **Overview** shows:

- **Waiting on you**: orders at a step your role completes. Start here each day.
- **Daily process summary**: what was done today, split into paid and unpaid orders. Pick another date to look back.
- **Monthly metrics**: shared numbers for the month, such as orders received and completed, on-time deliveries, and average time to complete.

To work on an order:

1. Open it from **Waiting on you**, the bell, or **Order tracking**.
2. At the top, the order page says who it's waiting on and what's needed.
3. If it's your step, click your action button, such as **Issue supplier PO**.
4. If the step produces a document, Zentra suggests a number. Change it to the real document number, then click **Confirm**.

The order moves to the next step, the next role is notified, and the change is sent to Bitrix24.

If it isn't your step, you'll see *Only [role] can move this order forward.* You can still read the order, its documents, and its history.

| Role | Your steps | Extra notes |
|---|---|---|
| **Accounting** | Credit check, On hold, Collection, early payments | You can see amounts and receivables. |
| **Purchasing** | Purchasing, Order basis | Amounts are hidden (shown as ₱ ••••) unless the Super Admin grants access. |
| **Inventory** | Receiving | You are the only role that can **add, edit, or archive inventory items**. Unit costs stay hidden; when you edit an item, its cost is kept as is. |
| **Invoicing** | Invoicing | You can see amounts. |
| **Delivery** | Delivery | Amounts are hidden. |

### Department Head

Your **Overview** has three tabs:

- **General**: business status, the daily process summary, open orders by step, and monthly metrics.
- **Needs attention**: what needs a decision. It covers pending tasks by role, delayed orders, unpaid transactions, sync and batch issues, and low stock. Each section shows a green "all clear" message when nothing is wrong.
- **Technical**: pipeline success, sync issues, rejected rows, Bitrix24 status, pipeline throughput, system activity, and module health.

You oversee the work rather than doing each step. Order steps are done by the assigned role. You can still edit an order's details from the **Operations** page, and that edit is logged in the order's history.

Your other tools:

- **Team access**: give each employee their Operations role. The table shows what each role can do.
- **Sync center**: resolve conflicts, retry failed write-backs, and run **Batch processing** (see [Common tasks](#5-common-tasks)).
- **Data pipeline**: import CSV files, fix or dismiss rejected rows, and manage validation rules.
- **Module registry** and **Backups**.

### Super Admin

- **Overview**: account status and recent audit events.
- **Users and roles**: enable or disable sign-in, make someone a Department Head, see each employee's Operations role, and **grant financial access** to employees whose role doesn't include it (Accounting and Invoicing have it by role).
- **Audit log**: search every sign-in and change.

---

## 5. Common tasks

### Find an order

- **Order tracking → Orders** lists orders with their progress. Filter by **Waiting on** a role, or by in progress, completed, or all. Delayed orders appear first.
- **Order tracking → Order activity** lists every completed step across all orders, newest first, with the next action for each open order.
- In **Operations**, click an order number to open it.

### Read an order page

- **Next step** (top): who it's waiting on, what's needed, and any delay, such as "2 days past the due date".
- **Progress track**: Credit check → Purchasing → Receiving → Invoicing → Delivery → Payment. "From stock" under Receiving means it was skipped.
- **Order activity**: every step in order, with who did it, their role, and the date and time. The last entry shows the current step and the pending action.
- **Documents**: client P.O., supplier P.O., RR, SI, WR, DR, and OR, or "Not issued yet".
- **Order details**: customer, items, amount, payment status, due date, and Bitrix24 deal number.

### Add or edit an inventory item (Inventory role, Department Head)

**Inventory → Add item**, or use the **⋯** menu on a row → **Edit** or **Archive**. Every entry is checked against the validation rules. For example, a SKU must look like `ABC-1234` and stock can't be negative.

### Check a day's work

On the **Overview**, use the date box in **Daily process summary**. It lists each order handled that day under **Paid** or **Unpaid**, with how many steps each role completed.

### Run batch processing (Department Head)

1. **Sync center → Batch processing**.
2. Tick the records to process, or **Select all**. These can be failed write-backs, sync conflicts, and rejected Inventory or Order rows.
3. Choose how to handle conflicts: review them individually, keep the Zentra version, or keep the Bitrix24 version.
4. Click **Process selected**.

The **Processing summary** shows what **Succeeded**, **Failed** (with the reason), and **Needs action**. Each record is still checked against validation rules and permissions.

### Assign an employee's role (Department Head)

**Team access →** pick a role in the **Role / position** column. The change applies immediately: the employee's pages, actions, and financial visibility follow the new role.

### Grant financial access (Super Admin)

**Users and roles →** turn on the **Financial data** switch for an employee. Accounting and Invoicing already have it by role.

### Register a module (Department Head)

**Module registry → Register module** opens a 3-step guided setup:

1. **Identity and adapter**: name the module (its key fills in automatically), then add the owning team, what one record is called, a description, and an icon. Choose:
   - **Native**: records are entered in Zentra.
   - **External**: connects to another system. Name the source system, pick an adapter (**API**, **Database**, **File**, or **Webhook**), fill in its connection settings, and choose **Real-time** or **Scheduled batch** sync.
2. **Schema and mapping**: start from a template (**Purchase orders**, **Repair service requests**, **Asset register**, or **Start blank**). Rename fields, change their type, mark them required, or add your own. For an external module, map each field to a column in the source system. The first field is the record's title and must be unique.
3. **Review and activate**: check everything, including the validation rules Zentra generates from your fields. A warning appears if any field isn't mapped. Leave **Activate right after registering** on to put the module in the sidebar immediately.

You can also register a module by pasting a manifest in the **JSON manifest** tab.

After registering:

- Employees start with no access. Grant it per person in **Team access**.
- Each module card in the registry shows its owner, adapter, sync, connection, and field mapping.
- Filter the list by **Active**, **Deactivated**, **Native**, or **External**.
- **Deactivate** hides a module but keeps its records. **Activate** brings it back.
- The registry holds up to 6 modules beyond Inventory and Operations.

### Import a CSV file (Department Head)

**Data pipeline → Run pipeline**, choose a module, and upload a file or **Use the sample file**. Valid rows are loaded. Invalid rows go to **Rejected records** with the reason, where you can fix and reload them or dismiss them.

---

## 6. Who can see and change what

| | Super Admin | Dept Head | Accounting | Purchasing | Inventory | Invoicing | Delivery |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View inventory | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Add, edit, archive inventory | — | ✓ | — | — | ✓ | — | — |
| View orders and history | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Move orders through their step | — | — | Credit check, payment | Purchasing | Receiving | Invoicing | Delivery |
| See amounts, costs, receivables | ✓ | ✓ | ✓ | if granted | if granted | ✓ | if granted |
| Sync center, pipeline, registry, backups | — | ✓ | — | — | — | — | — |
| Assign Operations roles | — | ✓ | — | — | — | — | — |
| Manage accounts, financial access, audit log | ✓ | — | — | — | — | — | — |

Restricted amounts show as **₱ ••••** and are left out of search. Forms don't show fields you can't see, and saving keeps their stored values. Salaries and other confidential financial records are not part of this prototype.

---

## 7. Demo script for presentations

This walkthrough takes about 10 minutes and follows one order, **ORD-1041**, from the won deal to payment. Before you start, open the avatar menu and click **Reset demo data**.

1. **Accounting (Jessa).** The Overview shows *Waiting on you*. Open **ORD-1041** and point out the document list and the timeline. Click **Clear credit check**.
2. **Purchasing (Mark).** The bell shows "ORD-1041 is ready for purchasing." Amounts are masked for this role. Open the notification and **Issue supplier PO**.
3. **Inventory (Ana).** Show that only this role can edit Inventory, and that unit costs are hidden. Open ORD-1041 and **Post receiving report**.
4. **Invoicing (Paolo)** → **Issue SI and WR**.
5. **Delivery (Lea)** → **Record delivery**. Because the order is unpaid, it moves to **Collection**.
6. **Accounting (Jessa)** → **Record payment**. The order is **Done**, and its timeline shows every step with who did it and when.
7. **Department Head (Carlo).**
   - **Overview → General**: today's summary now lists ORD-1041 as paid.
   - **Needs attention**: delayed orders, unpaid orders, and pending tasks by role.
   - **Sync center → Batch processing**: select all and process. Point out the summary of succeeded, failed, and needs action.
   - **Team access**: show the role picker and the permission matrix.
8. **Super Admin (Maria).** In **Users and roles**, grant Mark financial access. Sign in as Mark again, and the amounts are visible.

Optional extras:

- **Pipeline:** Data pipeline → Run pipeline → Use the sample file. 7 rows load and 3 are rejected.
- **Conflict:** Operations → ⋯ → *Simulate Bitrix24 edit*, then edit the same order. It appears in the Sync center as a conflict.
- **Outage:** Sync center → *Simulate Bitrix24 outage*, then edit an order. It retries 3 times, then fails.
- **New module:** Module registry → Register module.
  - Pick **External**, the **Database** adapter, and the **Repair service requests** template, then map the fields.
  - Step 3 shows the generated validation rules.
  - After you register it, the module appears in the sidebar without a redeploy, and Team access gains a column for it.

---

## 8. Troubleshooting

| What you see | Why | What to do |
|---|---|---|
| *Only [role] can move this order forward.* | The order is at another role's step. | Sign in as that role, or check **Waiting on** in the order. |
| **₱ ••••** instead of an amount | Your role doesn't include financial access. | Ask the Super Admin to grant it. |
| No **Add item** button in Inventory | Only the Inventory role (and the Department Head) can change inventory. | — |
| *You don't have access to this page* | Your role can't open it. | Use the sidebar; it only lists pages you can open. |
| An order shows **Failed** or **Conflict** | The write-back to Bitrix24 didn't go through, or the order changed in both places. | Department Head: open the **Sync center** or use **Batch processing**. |
| A notification won't clear | It's still marked unread. | Open it, or click **Mark all as read** in the bell. |
| Old or missing data | The demo is saved in this browser only. | Avatar menu → **Reset demo data**. A different browser or a private window starts fresh. |
