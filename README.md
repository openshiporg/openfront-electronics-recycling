# Openfront Electronics Recycling

Software for an electronics recycler or IT asset disposition (ITAD) company. It covers both halves of the business, and they share one inventory:

- **Selling.** Approved wholesale buyers sign in, look at lots with a line-by-line manifest, and bid. A lot can be sold by sealed bid (the default: buyers bid a lot total and staff award by hand), by open ascending auction, or at a fixed price. Buyers can also price each manifest line, online or by uploading the filled bid sheet, and staff can split the award between buyers. The winner gets an invoice, pays by card (Stripe) or bank transfer, and arranges pickup or freight.
- **Collecting and processing.** A client company asks for a pickup. Staff quote it, collect under a signed chain of custody, receive and weigh it, audit each asset by serial number, record data destruction for every data-bearing device, issue certificates of recycling and data destruction, and settle with the client (fee for service, or a revenue share on what the assets sold for).

One business runs one copy of the app, with as many facilities as it has.

The app keeps records. It does not certify anyone and does not make a business compliant with R2, e-Stewards, NAID or any other standard. Certificates it produces state what the recycler recorded.

## Who uses it

| Who | Where | What they do |
|---|---|---|
| Wholesale buyers | Public site: `/lots`, `/buyers/apply`, `/buyer` | Apply for an account, accept the wholesale terms, browse lots, download manifests and bid sheets, bid, pay invoices, see orders and release details |
| Client companies | Public site: `/recycle`, `/request-pickup`, `/client` | Ask for a pickup, follow a job, download certificates and settlement statements, pay service invoices |
| Anyone | `/verify` | Check a certificate number against the issuing recycler's records |
| Staff | `/dashboard` | Everything else, by role (below) |

Staff roles created by onboarding: Owner, Sales Manager, Client Manager, Dispatcher, Driver, Receiving, Technician, Compliance and Accounting. Each staff page and action checks the role's permissions on the server; the sidebar only shows what the role can use. The driver, receiving and audit screens work on a phone.

## Main flows

**Sell a lot.** Import a manifest from Excel (`.xlsx`, `.xls`, `.csv`: the app finds the header row, proposes the column mapping, shows each row's errors, lets you correct a row, then commits) or build a lot from audited assets. Group lots into a sale event, publish, take bids until the close time, award, and the order and invoice are created. Lots close on time without any scheduler to set up.

**Approve buyers.** Applications arrive with documents (resale certificate, export licence where needed). Staff approve or decline, set a spend limit and tax status, and can suspend a buyer who does not pay.

**Get paid.** Card payments go through Stripe on the invoice page when Stripe keys are set. Bank transfers (wire or ACH) are always available: the invoice shows the recycler's transfer instructions and accounting records the payment when it arrives. Refunds, invoice voids and an accounting CSV export are on the Money pages.

**Run a job.** Pickup request, quote, schedule, driver collection with signatures, receiving and weighing, per-serial audit with grades, sanitisation records (upload the erasure tool's report and match it by serial number), verification, certificates, downstream shipments, mass balance and the settlement statement. Assets that pass go to the ready-for-sale stock and can be put on a lot. A data-bearing asset cannot be sold or put on a lot until its sanitisation has passed.

`docs/FEATURE-MATRIX.md` lists every capability with the operation and page that provide it. `docs/STOREFRONT-MATRIX.md` covers the public site.

## Running it

Requirements: Node 20 or newer and a PostgreSQL database.

```bash
npm install
cp .env.example .env    # then fill in the values below
npm run dev             # builds the schema, applies migrations, starts on http://localhost:3000
```

Production:

```bash
keystone build --no-ui && next build     # build
npm run migrate && next start            # start: applies pending migrations, then serves
```

`railway.toml` uses these same two commands.

### Environment variables

Required:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | At least 32 random characters, used to sign sign-in cookies. Set it on every deployment. |

Optional:

| Variable | What it turns on |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) | Card payments on invoices. Without them the invoice page offers bank transfer only and says card is not set up. |
| `STRIPE_WEBHOOK_SECRET` | Lets Stripe confirm payments to `/api/payment-webhooks/stripe` as well as the check made when the buyer returns from paying |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Outgoing email. These can also be set on the Store settings page. Without them every notice still appears in the person's notification list, every action still works, and password-reset email is not sent. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | The assistant panel in the dashboard |
| `PUBLIC_SIGNUPS_ALLOWED=true` | Opens the dashboard sign-up page to anyone. Leave it unset: staff are invited by the owner. Buyers and clients have their own sign-up on the public site. |

No other variable is needed for any action to work. The public site address used in email links and PDFs is set during onboarding (it defaults to the address onboarding is run from) and can be changed on the Store settings page.

## First run

1. Open `/dashboard`. On an empty database it goes to `/dashboard/init`, where you create the first account. That account is the owner and has every permission.
2. Open **Settings → Onboarding** and enter the business name, support email and phone, time zone, weight unit, bank transfer instructions and the first facility's address. Tick only the certifications the business actually holds, each with its certificate number. Onboarding creates the nine staff roles, the material categories and grades, the service price list, the wholesale and service terms, and the payment providers.
3. Onboarding can also add a set of example clients, buyers, jobs, lots and a completed sale with logins for each portal, so staff can see every screen with records in it. Leave that box unticked for a business going live.
4. Invite staff from **Settings → Team and roles**, set the store rules (bid increments, buyer premium, sales tax, payment and removal days) on **Store settings**, and add Stripe keys if you take cards.

The same setup can be run from the command line on an empty database:

```bash
DATABASE_URL=... node scripts/setup.cjs --owner-email you@yourcompany.com \
  --business "Your Company" --out ~/owner-login.json
```

It writes the generated owner password only to the `--out` file (mode 600). Add `--full` for the example records. Add `--certification "R2v3|R2-12345|SERI|2028-03-31"` once per certification the business holds.

## Tests

```bash
npm test
```

The tests run against a real PostgreSQL database: set `TEST_DATABASE_URL`, or `OPENFRONT_SCRATCH_DB_BASE` (a server URL without a database name; the tests use the `scratch_openfront_electronics_recycling_tests` database on it). Without a database, the database tests are skipped and the pure rule tests still run. They cover the bidding rules and races (two buyers at once, two staff awarding at once), payments and webhook replay, the job state machine, the sanitisation gate, certificates, settlements, manifest import, onboarding, access by role, and the MCP OAuth endpoints.

## What it does not do

- No proxy (maximum) bidding in open auctions.
- No counter-offers or negotiation threads. Staff can decline and relist, or award below the reserve.
- No bidding deposits or buyer credit balances. Non-payment leads to strikes and suspension instead.
- No listing to eBay, Amazon or BrokerBin, and no unit-by-unit retail shop.
- No parts harvesting with bills of materials. Pulled drives are tracked as child assets.
- No automatic pricing or market-value feeds. Staff enter values.
- It does not erase drives and does not connect to erasure tools directly. It files the reports those tools export.
- No route optimisation and no native driver app. The driver screen is a phone-sized web page.
- No freight quotes or label printing. Buyers arrange their own freight.
- No tax engine. Sales tax is one flat rate, with exemption by resale certificate.
- One currency per deployment, and no public-holiday calendar. Due dates can be extended by hand.
- No Stripe ACH debit. Card through Stripe, plus wire and ACH recorded by accounting.
- One business per deployment. It is not multi-tenant hosting.
- No consumer mail-in kits or collection events.
- No UK waste transfer notes or EU WEEE returns. It is built for US operations first.
- It never claims to certify anyone or make a business compliant. It keeps the records an auditor asks for.

## Code layout

- `features/keystone/models`: the lists (database tables) and their field rules.
- `features/keystone/domain`: the business operations (bidding, awards, payments, jobs, certificates, settlements and so on). `features/keystone/mutations/operations.ts` exposes each one as a GraphQL operation with its permission check.
- `features/keystone/lib/rules`: pure rule functions (bid validation, money, dates, spreadsheets), tested without a database.
- `features/platform`: the staff dashboard pages. `app/dashboard` holds thin route files.
- `app/(storefront)` and `features/storefront`: the public site for buyers and clients.
- `migrations`: Prisma migrations, applied with `npm run migrate`.
