# Zentra user guide

Zentra is the centralized digital workspace for iFixz Enterprise Co. It brings orders from Bitrix24, inventory, and imported files into one place, and moves every order through the Operations team, stage by stage, until it is delivered and paid.

This guide covers how to sign in, how an order moves, what each role does, and a demo script for presenting the prototype. For a one-page version, see the [quick start](QUICK_START.md).

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
| Operations Head | Carlo Reyes | depthead@ifixz.com | Oversees Operations, Sync, the data pipeline, and team roles |
| Accounting | Jessa Cruz | jessa.accounting@ifixz.com | Order clearing and payments |
| Purchasing | Mark Dizon | mark.purchasing@ifixz.com | Vendor purchase orders |
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
| Data pipeline | Operations Head | File imports, records that need fixing, rules for checking records |
| Sync | Operations Head | What changed in Bitrix24, records that need review, **process many at once**, history |
| Integration Hub | Operations Head | Connect a new system with the guided setup or a setup file, and turn systems on or off |
| Backups | Department Head | Restore points and schedule |
| Team access | Department Head | Assign each employee their Operations role |
| Users and roles | Super Admin | Accounts, Department Heads, financial access |
| Audit log | Super Admin | Every sign-in and change |

---

## 3. How an order moves

An order starts when the client confirms it in Bitrix24. It then moves through six stages. Each stage belongs to one role, and only that role can move the order forward.

| Stage | Responsible role | What they do | Document produced |
|---|---|---|---|
| **Accounting** | Accounting | Check the client has no unpaid balance, then **Clear the order**. If they do owe money, **Put on hold**. | — |
| On hold *(if needed)* | Accounting | When the client settles the old balance, click **Balance settled**. | — |
| **Purchasing** | Purchasing | If everything is in stock: **Reserve from stock** (goes straight to Invoicing). Otherwise: **Issue vendor P.O**, or **Wait for supplier** if items are hard to source. | Vendor P.O |
| Waiting for supplier *(if needed)* | Purchasing | Wait for the supplier, then **Supplier items arrived**. | — |
| **Receiving** | Inventory | Receive the supplier delivery and **Post receiving report**. | RR |
| **Invoicing** | Invoicing | **Issue SI and WR** for the delivery. | SI and WR |
| **Delivery** | Delivery | Deliver the items and **Record delivery** once the client signs. | DR |
| **Collection** | Accounting | Only if the order was delivered unpaid. **Record payment** when the client pays. | OR |
| **Done** | — | Delivered and paid. | — |

**Paid or unpaid.** Every order shows a **Paid** or **Unpaid** badge. If the client pays before delivery, Accounting can use **Record early payment** at any stage; the order then goes straight to Completed after delivery. Otherwise it goes to the Payment stage.

**Notifications.** When an order moves to a new stage, the role responsible for that stage gets a notification. Department Heads are notified when an order goes on hold, and when a change to Bitrix24 fails or needs review.

**Bitrix24.** Every change made in Zentra is saved first and then written back to Bitrix24. The badge next to an order shows *Syncing*, *Synced*, *Conflict*, or *Failed*.

---

## 4. Guide by role

### Operations employees (all five roles)

When you sign in, your **Overview** shows:

- **Waiting on you**: orders at the stage your role completes. Start here each day.
- **Daily process summary** (Accounting only): what was done today, split into paid and unpaid orders. Pick another date to look back.
- **My performance**: your own key numbers this month. **Performance** in the sidebar shows the detail. Only you and your Department Head can see them, unless the Department Head gives someone access to the team's numbers.

To work on an order:

1. Open it from **Waiting on you**, the bell, or **Order tracking**.
2. At the top, the order page says who it's waiting on and what's needed.
3. If it's your stage, click your action button, such as **Issue vendor P.O**.
4. If the stage produces a document, Zentra suggests a number. Change it to the real document number, then click **Save**.

The order moves to the next stage, the next role is notified, and the change is sent to Bitrix24. A message tells you whether it was sent.

If it isn't your stage, you'll see *Only [role] can move this order forward.* You can still read the order, its documents, and its history.

| Role | Your stages | Extra notes |
|---|---|---|
| **Accounting** | Accounting, On hold, Collection, early payments | You can see amounts and receivables. |
| **Purchasing** | Purchasing, Waiting for supplier | Amounts are hidden (shown as ₱ ••••) unless the Super Admin grants access. |
| **Inventory** | Receiving | You are the only role that can **add, edit, or archive inventory items**. Unit costs stay hidden; when you edit an item, its cost is kept as is. |
| **Invoicing** | Invoicing | You can see amounts. |
| **Delivery** | Delivery | Amounts are hidden. |

### Department Head

Your **Overview** has three tabs:

- **Overview**: business status, the daily process summary, open orders by stage, and monthly metrics (only Department Heads see monthly metrics). Click **Customize** to choose which cards and panels appear, reorder them, and switch charts between **bar**, **line**, and **pie**. **Reset to default** restores the original layout.
- **Needs attention**: what needs a decision. It covers pending tasks by role, delayed orders, unpaid transactions, sync and batch issues, and low stock. Each section shows a green "all clear" message when nothing is wrong.
- **System health**: how many records saved, update issues, records that need fixing, Bitrix24 status, records saved each day, recent activity, and the health of each connected system.

You oversee the work rather than doing each stage. Order stages are done by the assigned role. You can still edit an order's details from the **Operations** page, and that edit is logged in the order's history.

Your other tools:

- **Team access**: give each employee their Operations role. The table shows what each role can do.
- **Sync**: review records that changed in both systems, retry changes that couldn't be sent, and **process many at once** (see [Common tasks](#5-common-tasks)).
- **Data pipeline**: import files, fix or dismiss records that need fixing, and manage the rules for checking records.
- **Integration Hub** and **Backups**.

### Super Admin

- **Overview**: account status and recent audit events.
- **Users and roles**: enable or disable sign-in, make someone a Department Head, see each employee's Operations role, and **grant financial access** to employees whose role doesn't include it (Accounting and Invoicing have it by role).
- **Audit log**: search every sign-in and change.

---

## 5. Common tasks

### Find an order

- **Order tracking → Orders** lists orders with their progress. Filter by **Waiting on** a role, or by in progress, completed, or all. Delayed orders appear first.
- **Order tracking → History** lists every completed stage across all orders, newest first, with the next action for each open order.
- In **Operations**, click an order number to open it.

### Read an order page

- **What happens next** (top): who it's waiting on, what's needed, and any delay, such as "2 days past the due date".
- **Progress track**: Accounting → Purchasing → Receiving → Invoicing → Delivery → Collection. "From stock" under Receiving means it was skipped.
- **Order activity**: every stage in order, with who did it, their role, and the date and time. The last entry shows the current stage and what's pending.
- **Documents**: supplier P.O., vendor P.O., RR, SI, WR, DR, and OR, or "Not issued yet".
- **Order details**: customer, items, amount, payment status, due date, and Bitrix24 deal number.

### Add or edit an inventory item (Inventory role, Department Head)

**Inventory → Add item**, or click a row → **Edit** or **Archive**. Every entry is checked against the rules. For example, an item code must look like `ABC-1234` and stock can't be negative.

### Confirm changes

Every action that changes data or settings asks for confirmation first, describing what will happen. Nothing is saved until you click the confirm button. **Cancel** leaves everything as it was.

### Check performance

**Performance** shows each person's key numbers for the month you pick:

- stages completed
- average handling time (from when an order reached the stage to when it was done)
- the share of stages finished within the role's target time
- orders waiting now
- one measure specific to the role

Employees see only their own numbers. The Department Head sees every employee's numbers plus the department totals. In **Team access**, the Department Head can turn on **Team performance** for an employee who needs to see them.

### Check a day's work (Accounting, Department Head)

On the **Overview**, use the date box in **Daily process summary**. It lists each order handled that day under **Paid** or **Unpaid**, with how many stages each role completed.

### Run batch processing (Department Head)

1. **Sync → Process many at once**.
2. Tick the records to process, or **Select all**. These can be changes that couldn't be sent, records that changed in both systems, and Inventory or Order records that need fixing.
3. Choose how to handle conflicts: review them individually, keep the Zentra version, or keep the Bitrix24 version.
4. Click **Process selected**.

The **Processing summary** shows what **Succeeded**, **Failed** (with the reason), and **Needs action**. Each record is still checked against validation rules and permissions.

### Assign an employee's role (Department Head)

**Team access →** pick a role in the **Role / position** column. The change applies immediately: the employee's pages, actions, and financial visibility follow the new role.

### Grant financial access (Super Admin)

**Users and roles →** turn on the **Financial data** switch for an employee. Accounting and Invoicing already have it by role.

### Register a module (Department Head)

**Integration Hub → Connect a system** opens a 3-step guided setup on its own page:

1. **Name and connection**: name the system (its address key fills in automatically), then add the owning team, what one record is called, a description, and an icon. Choose:
   - **Native**: records are entered in Zentra.
   - **External**: connects to a system you already use. Name the other system, pick the connection type (**API**, **Database**, **Upload**, or **Webhook**), fill in its connection settings, and choose **Real-time** or **Scheduled batch** updates.
   - **Upload** has no connection settings: you choose the file on the **Data pipeline** and match its columns to the fields.
2. **Schema and mapping**: start from a template (**Purchase orders**, **Repair service requests**, **Asset register**, or **Start blank**). Rename fields, change their type, mark them required, or add your own. For an external module, map each field to a column in the source system. The first field is the record's title and must be unique.
3. **Review and activate**: check everything, including the validation rules Zentra generates from your fields. A warning appears if any field isn't mapped. Leave **Activate right after registering** on to put the module in the sidebar immediately.

You can also register a module by pasting a manifest in the **JSON manifest** tab.

After registering:

- Employees start with no access. Grant it per person in **Team access**.
- Each card in the Integration Hub shows its owner, connection type, update schedule, connection, and where each field comes from.
- Filter the list by **Active**, **Deactivated**, **Native**, or **External**.
- **Deactivate** hides a module but keeps its records. **Activate** brings it back.
- You can connect up to 6 more systems, on top of Inventory and Operations.

### Import a CSV file (Department Head)

**Data pipeline → Import a file**, choose where to save the records, and upload a file or **Use the sample file**. Rows that pass your rules are saved. Rows that fail go to **Records to fix** with the reason, where you can correct them and load them again, or dismiss them.

---

## 6. Who can see and change what

| | Super Admin | Dept Head | Accounting | Purchasing | Inventory | Invoicing | Delivery |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View inventory | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Add, edit, archive inventory | — | ✓ | — | — | ✓ | — | — |
| View orders and history | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Move orders through their stage | — | — | Accounting, collection | Purchasing | Receiving | Invoicing | Delivery |
| See amounts, costs, receivables | ✓ | ✓ | ✓ | if granted | if granted | ✓ | if granted |
| Sync, pipeline, connected systems, backups | — | ✓ | — | — | — | — | — |
| Assign Operations roles | — | ✓ | — | — | — | — | — |
| Manage accounts, financial access, audit log | ✓ | — | — | — | — | — | — |

Restricted amounts show as **₱ ••••** and are left out of search. Forms don't show fields you can't see, and saving keeps their stored values. Salaries and other confidential financial records are not part of this prototype.

---

## 7. Demo script for presentations

This walkthrough takes about 10 minutes and follows one order, **ORD-1041**, from the confirmed order to payment. Before you start, open the avatar menu and click **Reset demo data**.

1. **Accounting (Jessa).** The Overview shows *Waiting on you*. Open **ORD-1041** and point out the document list and the timeline. Click **Clear the order**.
2. **Purchasing (Mark).** The bell shows "ORD-1041 is ready for purchasing." Amounts are masked for this role. Open the notification and **Issue vendor P.O**.
3. **Inventory (Ana).** Show that only this role can edit Inventory, and that unit costs are hidden. Open ORD-1041 and **Post receiving report**.
4. **Invoicing (Paolo)** → **Issue SI and WR**.
5. **Delivery (Lea)** → **Record delivery**. Because the order is unpaid, it moves to **Collection**.
6. **Accounting (Jessa)** → **Record payment**. The order is **Completed**, and its timeline shows every stage with who did it and when.
7. **Department Head (Carlo).**
   - **Overview → General**: today's summary now lists ORD-1041 as paid.
   - **Needs attention**: delayed orders, unpaid orders, and pending tasks by role.
   - **Sync → Process many at once**: select all and process. Point out the summary of succeeded, failed, and needs action.
   - **Team access**: show the role picker and the permission matrix.
8. **Super Admin (Maria).** In **Users and roles**, grant Mark financial access. Sign in as Mark again, and the amounts are visible.

Optional extras:

- **Pipeline:** Data pipeline → Import a file → Use the sample file. 7 rows load and 3 need fixing.
- **Conflict:** Operations → ⋯ → *Demo: simulate a Bitrix24 edit*, then edit the same order. It appears under **Sync** as a record that needs review.
- **Outage:** Sync → *Demo: simulate a Bitrix24 outage*, then edit an order. It tries 3 times, then fails.
- **New system:** Integration Hub → Connect a system.
  - Pick **External**, the **Database** adapter, and the **Repair service requests** template, then map the fields.
  - Step 3 shows the generated validation rules.
  - After you register it, the module appears in the sidebar without a redeploy, and Team access gains a column for it.

---

## 8. Troubleshooting

| What you see | Why | What to do |
|---|---|---|
| *Only [role] can move this order forward.* | The order is at another role's stage. | Sign in as that role, or check **Waiting on** in the order. |
| **₱ ••••** instead of an amount | Your role doesn't include financial access. | Ask the Super Admin to grant it. |
| No **Add item** button in Inventory | Only the Inventory role (and the Department Head) can change inventory. | — |
| *You don't have access to this page* | Your role can't open it. | Use the sidebar; it only lists pages you can open. |
| An order shows **Couldn't send** or **Needs review** | The change didn't reach Bitrix24, or the order changed in both places. | Department Head: open **Sync**, or use **Process many at once**. |
| A notification won't clear | It's still marked unread. | Open it, or click **Mark all as read** in the bell. |
| Old or missing data | The demo is saved in this browser only. | Avatar menu → **Reset demo data**. A different browser or a private window starts fresh. |
