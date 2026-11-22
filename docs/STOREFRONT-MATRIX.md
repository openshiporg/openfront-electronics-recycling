# Storefront matrix (dissertation §5.1–§5.3)

Run on a **local** dev server (`next dev -p 3471`) against the repo's own database, 2026-11-22.
Nothing here is deployed yet. Card payments use Stripe **test keys** (card 4242) through the
real adapter. Screenshots are in `Euler/state/screenshots/b7-e-recycling/` (`c-*`, `run-*`).

**Proof** means:
- **Action:** done in a browser as that person, and the record was then checked in the database.
- **Rendered:** the page was loaded and checked at 402 and 1440 px, but there was no write to do.

People used:
- Sofia Reyes, Reyes Refurb & Liquidation LLC: a new buyer, signed up through the UI.
- Seeded buyers: Northgate Refurbishing, Bluewater IT Asset Trading, and Copperline (submitted, not approved).
- Seeded client: Meridian Health Partners.
- New client: Daniel Okafor, Okafor & Lindqvist CPAs, who signed up through the pickup form.
- Staff: the owner.

## 5.1 Public

| Row | Route | Proof | Record / why |
|---|---|---|---|
| P1 | `/` | Rendered | Reads `storefrontSettings`, `publicLots` and `publicCertifications`. The closing band reads "Every device accounted for", with the operator's certifications listed beside it. |
| P2 | `/recycle` | Rendered | Accepted items with fees, and facilities with hours, from the ops. |
| P3 | `/request-pickup` (signed out) | **Action** | Daniel Okafor at Okafor & Lindqvist CPAs created job **JOB-001005** (`cmwric764003c8czrlyys5mhh`), status requested. This also created his client login, and he landed on the job page. |
| P4 | `/lots` | Rendered | Lots grouped by sale event. A visitor who is not approved sees no prices. |
| P5 | `/lots/[lotNumber]` | Rendered | Teaser page with a "Sign in to see the manifest and bid" link. Copperline (not approved) sees "Not approved yet". |
| P6 | `/buyers` | Rendered | Steps and rules read from settings, plus the grade guide. |
| P7 | `/buyers/apply` | **Action** | Sofia's application, with a resale certificate upload. The owner approved it, creating BuyerCompany `cmwrgpcye00008cmav8aetpwq`. |
| P8 | `/verify`, `/verify/[code]` | **Action** | Code FBPGW7E3YUSA returns CERT-2026-01002 as valid (screenshot `verify-ok`). |
| P9 | `/terms` | Rendered | Wholesale and service terms, with version numbers from settings. |
| P10 | `/signin`, `/signup`, `/reset-password` | **Action** | Sign-in and sign-up were used throughout. Reset was tested after backend fix e12dedf: Sofia asked for a link, the email "Reset your Riverbend ITAD password" carried `/reset-password?token=…&email=…`, and she set a new password and was signed in at `/buyer`. No SMTP is configured, so this needed a mail listener on 127.0.0.1 set in Settings for the run only; it was removed afterwards. |

## 5.2 Buyer account

| Row | Route | Proof | Record / why |
|---|---|---|---|
| U1 | `/buyer` | Rendered | Application status, standing, bids in play and invoices due, for Sofia, Northgate and Atlas (needs info, with a reply box). |
| U2 | `/lots` (approved) | Rendered | Prices shown, with filters for category, format and closing time. |
| U3 | `/lots/[lotNumber]` | **Action** | Manifest search (including serials) and sort, tested on L-2026-1002 (commit 87b3bbf). Specs read as plain labels, e.g. "Intel Xeon Gold 6130 · 256 GB RAM". |
| U4 | `/lots/[lotNumber]` | **Action** | `L-2026-1002-manifest.xlsx` downloaded and opened: 6 rows. The column headers are made by the backend export and still show the raw keys `cpu` and `ramGb`. |
| U5 | `/lots/L-2026-1001` | **Action** | Sofia bid $10,500 (`cmwrhvfk6000j8czrphvg1ld0`, now superseded), revised it to $11,250 (`cmwrhvnzg000o8czrudcuro1w`), then withdrew it (status withdrawn). |
| U6 | `/lots/L-2026-1002` | **Action** | First, Sofia typed prices for 2 lines online: $39,000 (`cmwri29ag001g8czr9nmadihi`, source web, later superseded). Then she downloaded the bid sheet, filled it in, uploaded it, checked the preview (3 lines, $55,770) and placed it: `cmwri2j2o001q8czr0mc5hga0`, source bid_sheet, active. |
| U7 | `/lots/L-2026-1003` | **Action** | Bluewater was not leading. It bid $16,500 (`cmwrhwaml000v8czrcfcz950o`) and later $17,050 with a double-clicked Confirm (`cmwri104h00198czrv5v2y9en`). Each produced exactly one bid row. The panel showed "You are the highest bidder" with the new minimum. |
| U8 | `/lots/L-2026-1004` | **Action** | Sofia used Buy now at $3,600, creating bid `cmwri3r1c00218czr73qnn6hs`, order SO-001003 (`cmwri3the00278czrjf3ad2b0`) and invoice INV-001003 (`cmwri3ujl002a8czrnvvkz2on`). The lot is now awarded. |
| U9 | `/buyer/bids` | Rendered | Sofia's list shows Won (L-2026-1004), In play (L-2026-1002 via bid sheet), Withdrawn (L-2026-1001) and Won (L-2026-1007). |
| U10 | `/buyer/invoices/...` | **Action** | `INV-001002.pdf` was downloaded. It is a real PDF (`%PDF-`) showing Reyes Refurb, the lot line at $2,150.00, the card fee of $64.50, a total of $2,214.50, paid, a balance of $0.00, and "Tax exempt: resale certificate". |
| U11 | `/buyer/invoices/INV-001002` | **Action** | Card 4242: PaymentSession `cmwrhe55v00018czrf92zxfb9` captured with `pi_3UeUf4KRV4CgoLll0Jy0B4LP`, for $2,214.50. |
| U12 | `/buyer/invoices/INV-001003` | **Action** | Sofia reported a wire, creating Payment `cmwri7bwx002w8czrm6wydiis` (wire, reported, $3,600, her reference). The owner ran `confirmBankTransfer`. INV-001003 is now paid, SO-001003 is paid, and the page reads "Paid in full". |
| U13 | `/buyer/orders/SO-001002` | **Action** | Release form: pickup by driver Luis Ortega on 25 Nov, saved. |
| U14 | `/buyer/orders/SO-001002` | **Action** | `SO-001002-packing-list.pdf` and `SO-001002-bill-of-lading.pdf` downloaded and opened. Both are real PDFs showing lot L-2026-1007, 14 units, 40.6 lb, the ship-from facility, the buyer's address and driver Luis Ortega; the packing list also lists the OptiPlex serials. |
| U15 | prompted on a lot page | **Action** | The owner set `wholesaleTermsVersion` to 2 with `updateStoreSettings`. Sofia, Northgate and Bluewater were each stopped by the "Wholesale terms, version 2" prompt, accepted, then bid or bought. For example, Northgate's bid `cmwri59p4002k8czrsjyozf51` ($11,400 on L-2026-1001). The version is still 2. |

## 5.3 Client account

| Row | Route | Proof | Record / why |
|---|---|---|---|
| C1 | `/client`, `/request-pickup` (signed in) | **Action** | Meridian used a saved site (Westside) for **JOB-001006** (`cmwricgae003k8czrzanum0hg`), status requested. |
| C2 | `/client/jobs/JOB-001001` | Rendered | Timeline, chain of custody (grouped by type and day), and containers with weights. |
| C3 | `/client/jobs/JOB-001004` | **Action** | Laura Chen at Meridian accepted the quote, signing by typed name. JOB-001004 (`cmwrfdsxg01b88c0fej49fger`) is now accepted. Declining was not run. |
| C4 | `/client/jobs/JOB-001001` | Action, partly | `CERT-2026-01002.pdf` was downloaded: a real PDF with verification code FBPGW7E3YUSA, Meridian, JOB-001001, weights by category and a total of 372.0 lb. There is no settlement statement: the database has no Settlement for any job, so the button is (correctly) not shown. |
| C5 | `/client/invoices/INV-001004` | **Action** | The owner ran `invoiceJob` on JOB-001004, creating INV-001004 (`cmwriezd2003w8czr6v0xcvaa`, $140). Meridian paid $144.20 by card 4242: PaymentSession `cmwrifggm00448czrmqyt1cty` captured with `pi_3UeV79KRV4CgoLll0cJBnQJC`, and the invoice is now paid. |

## Refusals shown in plain words

| Case | Result |
|---|---|
| Bid below the minimum | In the browser: "Your bid must be at least $16,500.00." Sent straight to `placeBid` as Northgate at $10,000: the server refuses with "Your bid must be at least 17300.00." That server message has no currency symbol or thousands separator. |
| Buyer not approved | Copperline's lot panel says "Not approved yet. Prices and bidding open when we approve your company." Sent straight to `placeBid`: "Your company must be approved before it can bid." |
| Double click on Confirm | Bluewater's $17,050 on L-2026-1003 left one bid row (`cmwri104h00198czrv5v2y9en`), thanks to the idempotency key plus the disabled button. |
