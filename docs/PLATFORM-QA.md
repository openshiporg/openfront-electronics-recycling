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
| Audit log | Audit log | Owner | done | | Plain-word actions, record links, before/after as key: value, no raw ids or JSON, search fits 402; local `::1` addresses hidden |
| Custody notes | Custody log | Owner | done | | Underscore values in notes shown as words |
| Storefront bid sheet (item 6) | Lot page | Buyer | done | | `previewBidSheet` → `checkBidSheet` |

## Waiting on the backend

- `editManifestRow { importId, rowNumber, line }` for S6 "fix the bad row in the preview" (sent 2026-11-22).

## Environment note

The machine is out of memory (swap 24.5 of 25.6 GB). Single page loads take up to five minutes,
which slows the walk-through; nothing is skipped because of it.
