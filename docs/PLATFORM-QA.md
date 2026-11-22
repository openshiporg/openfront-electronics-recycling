# Platform QA: staff pages, done as the role that uses them

Branch `platform-qa`. Spec: dissertation §2, §3, §4.7, §4.10, §5.4 (§5 wins).
Local dev server on the shared scratch database; screenshots in
`~/Code/Euler/state/screenshots/b7-e-recycling/platform/` (named page-width).

Roles used: Owner (Jordan Hale), Sales manager, Client manager, Dispatcher, Driver (Marcus Bell),
Receiving, Technician (Priya Natarajan), Compliance, Accounting. Six staff logins did not take the
starter password; the owner set a new one for each on the Team page (stored outside the repo).

## Shell and every page

| Check | Role | Done | Fixed |
| --- | --- | --- | --- |
| All 35 routes load at 1440 and 402 | Owner | done | Nothing overflows at 402 after the fixes below |
| Sidebar per role | all 9 | done | The raw record browser ("Records", every Keystone list incl. Users, Roles, Store settings) was shown to every role. Now only roles that manage settings see it; others opening `/dashboard/users`, `/dashboard/roles`, `/dashboard/store-settings` by URL get a plain "not part of your role" page with a link to Today (checked as Driver) |
| Home | all | done | `/dashboard` was a "Data Models" grid; it now opens Today |
| Branding | all | done | Sidebar and sign-in logo read "keystone x next"; now the business name from store settings (Riverbend ITAD) |
| Breadcrumbs | all | done | "Today › Today" repeated; group shown only when it differs |
| Dates | all | done | Times now in the store time zone and name it (EST); plain dates no longer shift a day |
| Admin meta | all | done | Query asked for fields Keystone 6.5.1 does not have; fixed |
| Hydration | Owner | done | Nested `<p>` in empty states and notices (manifest imports, payments) |

## §5.4 rows

| Row | Page | Role | Done | Record | Notes / fixed |
| --- | --- | --- | --- | --- | --- |
| S6 upload + map | Manifest imports | Sales manager | done (402) | import `Meridian-Health-ITAD-manifest-Nov-2026.xlsx` | Title block above the header: header row 4 found, all 12 columns proposed correctly; 14 lines, 13 ready, row 17 refused in plain words (quantity "twelve", no description) |
| S6 fix bad row in preview | Manifest imports | Sales manager | waiting on backend | | No operation edits one row; asked the backend builder for `editManifestRow` |
| S6 commit | Manifest imports | Sales manager | done (402) | lot L-2026-1009 `cmwrzjgyj0005uzg572smdiqt` | Committed skipping row 17 into the November enterprise IT sale |
| S8/S10 terms + details | Lot page | Sales manager | done (402) | L-2026-1009 | Weight is now a decimal field labelled "Weight (lb)" (was refused: "Decimal only accepts strings"); close time typed and shown in store time ("Closes (EST)") instead of the browser zone; Closes readout wrapped instead of cut off |
| S11 publish | Lot page | Sales manager | done (402) | L-2026-1009 | |
| S12 phoned-in bid | Lot page | Sales manager | done (402) | Northgate $11,850 | Sales sees "1 sealed bid" only; Owner (sealed-amount permission) sees the row |
| Close | (clock) | — | done | closed 16:24:26Z | Closed itself on time |
| S13 award | Lot page | Sales manager | done (402) | order SO-001005, invoice INV-001006 | Confirm names the buyer, amount and that an invoice goes out |
| M2 offline payment | Payments | Accounting | done (402) | wire $11,850 on INV-001006 | Invoice and amount preselected from the order link; "Received on" defaulted to the server's UTC day, now today at the store (also dock, export, certifications, downstream); "Ach" now "ACH" |
| S15 dock booking | Dock calendar | Sales manager | done (402) | SO-001005, Nov 23 10:30 AM | Booked from the slot's own Book button. The top "Book a slot" default (9:00) is a wall-clock value and is now kept as store time rather than read in the browser's zone; footnote names the zone in words |
| S17/S18 ready + release | Order page | Sales manager | done (402) | SO-001005 released to Luis Ortega, BOL NGR-BOL-112263, signed | |
| S19 claim | Claims | Sales manager | done (402) | CLM-01001, $98.74 partial refund succeeded | Refund-against now preselects the only payment; facts two columns at 402, undecided fields hidden until decided, lines read "Line 6, 2 units: …" |
| Audit log | Audit log | Owner | done | | Plain-word actions, record links, before/after as key: value, no raw ids or JSON, search fits 402; local `::1` addresses hidden |
| Custody notes | Custody log | Owner | done | | Underscore values in notes shown as words |
| Storefront bid sheet (item 6) | Lot page | Buyer | done | | `previewBidSheet` → `checkBidSheet` |

## Waiting on the backend

- `editManifestRow { importId, rowNumber, line }` for S6 "fix the bad row in the preview" (sent 2026-11-22).

## Environment note

The machine is out of memory (swap 24.5 of 25.6 GB). Single page loads take up to five minutes,
which slows the walk-through; nothing is skipped because of it.
