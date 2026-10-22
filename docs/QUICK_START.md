# Zentra quick start

Zentra is where iFixz orders, inventory, and Bitrix24 deals come together. Each order moves through the Operations team, one stage at a time, until it's delivered and paid.

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
| Operations Department Head | depthead@ifixz.com |
| IT Administration | superadmin@ifixz.com |

## 2. Your job in Zentra

| Role | You handle | Your button |
|---|---|---|
| **Accounting** | Order clearing and payments | **Clear the order**, **Put on hold**, **Record payment** |
| **Purchasing** | Buying missing items | **Reserve from stock**, **Issue vendor P.O** |
| **Inventory** | Supplier deliveries and stock | **Post receiving report**. Only you can add or edit inventory items. |
| **Invoicing** | Sales invoices | **Issue sales invoice and report** |
| **Delivery** | Getting items to the client | **Record delivery** |
| **Operations Department Head** | Watching everything, fixing problems | Overview, **Bitrix24 updates**, **Team access**, **Integration Hub** |
| **IT Administration** | Accounts and access | **Users and roles**, **Audit log** |

## 3. Move an order forward

1. Open your home page and look at **Waiting on you**, or click the 🔔 bell.
2. Click an order.
3. Click your button at the top of the order page.
4. If it asks for a document number (purchase order, receiving report, sales invoice, sales report, delivery receipt, or official receipt), type it in and click **Save**.

That's it. The order moves to the next role, that role gets notified, and a message tells you whether Bitrix24 was updated.

> If you see *Only [role] can move this order forward*, the order is at someone else's stage. You can still read it.

## 4. The order stages

**Accounting** (Accounting) → **Purchasing** (Purchasing) → **Receiving** (Inventory) → **Invoicing** (Invoicing) → **Delivery** (Delivery) → **Collection** (Accounting) → **Collection done**

- **On hold**: the client owes money. Accounting releases the order once it's paid.
- **From stock**: Purchasing found everything in stock, so Receiving is skipped.
- **Payment**: the order was delivered but not yet paid. Accounting collects.

## 5. Where things are

| Need to… | Go to |
|---|---|
| See what's waiting on you | **Overview** |
| Find any order | **Order tracking** |
| Check today's work, paid and unpaid | **Overview → Daily process summary** (Accounting and Operations Department Head only) |
| See your performance | **Overview → My performance**, or **Performance** |
| Look up stock | **Inventory** |
| Change the theme or sign out | Your avatar, top right |

## 6. Good to know

- Zentra asks you to **confirm** before a change that can't be undone. Check the summary, then click the confirm button, or **Cancel** to leave things as they are. Small changes happen straight away and give you an **Undo** button.
- **₱ ••••** means amounts are hidden for your role. Ask the Super Admin if you need access.
- Orders marked **Overdue**, **On hold**, or **No progress** are delayed. Handle those first.
- **Sending…** next to an order means it's on its way to Bitrix24. **Couldn't send** or **Needs review** means the Operations Department Head needs to check **Bitrix24 updates**.
- This is a prototype. Data is saved in your browser only. To start over, open your avatar menu and click **Reset demo data**.
- Not sure what a word means? Click the **?** next to the page title.
