# Zentra quick start

Zentra is where iFixz orders, inventory, and Bitrix24 deals come together. Each order moves through the Operations team one step at a time until it's delivered and paid.

For more detail, see the [full user guide](USER_GUIDE.md).

## 1. Sign in

Go to http://localhost:5173 and click your account. The password for every account is **`zentra2026`**.

| You are | Sign in as |
|---|---|
| Accounting | jessa.accounting@ifixz.com |
| Purchasing | mark.purchasing@ifixz.com |
| Inventory | ana.inventory@ifixz.com |
| Invoicing | paolo.invoicing@ifixz.com |
| Delivery | lea.delivery@ifixz.com |
| Department Head | depthead@ifixz.com |
| Super Admin | superadmin@ifixz.com |

## 2. Your job in Zentra

| Role | You handle | Your button |
|---|---|---|
| **Accounting** | Credit checks and payments | **Clear credit check**, **Put on hold**, **Record payment** |
| **Purchasing** | Buying missing items | **Reserve from stock**, **Issue supplier PO** |
| **Inventory** | Supplier deliveries and stock | **Post receiving report**. Only you can add or edit inventory items. |
| **Invoicing** | Sales invoices | **Issue SI and WR** |
| **Delivery** | Getting items to the client | **Record delivery** |
| **Department Head** | Watching everything, fixing problems | Overview, **Sync center**, **Team access**, **Module registry** |
| **Super Admin** | Accounts and access | **Users and roles**, **Audit log** |

## 3. Move an order forward

1. Open **Overview** and look at **Waiting on you**, or click the 🔔 bell.
2. Click an order.
3. Click your button at the top of the order page.
4. If it asks for a document number (PO, RR, SI, WR, DR, or OR), type it in and click **Confirm**.

That's it. The order moves to the next role, that role gets notified, and Bitrix24 is updated.

> If you see *Only [role] can move this order forward*, the order is at someone else's step. You can still read it.

## 4. The order steps

**Credit check** (Accounting) → **Purchasing** (Purchasing) → **Receiving** (Inventory) → **Invoicing** (Invoicing) → **Delivery** (Delivery) → **Payment** (Accounting) → **Done**

- **On hold**: the client owes money. Accounting releases the order once it's paid.
- **From stock**: Purchasing found everything in stock, so Receiving is skipped.
- **Collection**: the order was delivered but not yet paid. Accounting collects.

## 5. Where things are

| Need to… | Go to |
|---|---|
| See what's waiting on you | **Overview** |
| Find any order | **Order tracking** |
| Check today's work, paid and unpaid | **Overview → Daily process summary** (Accounting and Department Head only) |
| See your KPIs | **Overview → My KPIs**, or **Performance** |
| Look up stock | **Inventory** |
| Change the theme or sign out | Your avatar, top right |

## 6. Good to know

- Zentra asks you to **confirm** before any change is saved. Check the summary, then click the confirm button, or **Cancel** to leave things as they are.
- **₱ ••••** means amounts are hidden for your role. Ask the Super Admin if you need access.
- Orders marked **Overdue**, **On hold**, or **No progress** are delayed. Handle those first.
- **Syncing** next to an order means it's being sent to Bitrix24. **Failed** or **Conflict** means the Department Head needs to check the Sync center.
- This is a prototype. Data is saved in your browser only. To start over, open your avatar menu and click **Reset demo data**.
