# CrossGuns Snooker League website

Public site for the CrossGuns Snooker League. Plain HTML + a tiny vanilla
JavaScript runtime in front of a Supabase Postgres database. The whole
site is published statically from this repo via GitHub Pages
(`https://zarleyltd.github.io/CrossGunsSnooker/`).

This codebase replaces an older Publii build of the same site; the
deployed Publii revision is preserved as the `pre-supabase-migration`
git tag for emergency rollback.

## Layout

```
.
|-- index.html / leagues.html / fixtures.html / results.html /
|   top-breaks.html / handicaps.html / rules.html / under-development.html /
|   404.html                                  -- public pages
|-- admin-fixtures.html / admin-players.html /
|   admin-league-seasons.html / admin.html    -- admin (unlock via PIN)
|-- components/                               -- shared header / footer / nav / scripts
|-- assets/
|   |-- css/                                  -- style.css, main.css
|   |-- images/                               -- crossguns-logo.png, crossguns-hero.png, favicons
|   `-- js/
|       |-- config/app-config.js              -- Edge Function URL
|       |-- utils/                            -- api-client, admin-mode, formatters, ...
|       |-- components/                       -- league-standings
|       |-- pages/                            -- per-page modules
|       `-- main.js                           -- DOM-aware page router (deferred)
|-- supabase/
|   |-- migrations/                           -- SQL DDL (timestamp-prefixed)
|   |-- functions/crossguns-api/index.ts      -- Edge Function source
|   `-- config.toml
|-- scripts/
|   |-- migrate-sheets-to-supabase.mjs        -- one-shot legacy data import
|   `-- verify-migration.mjs                  -- smoke test against the deployed function
|-- docs/
|   |-- SUPABASE_SETUP.md                     -- backend runbook
|   `-- plans/standalone-migration.md         -- the architectural decision record
|-- PROJECT_MAP.md / .cursorrules             -- shared editor guidance
`-- .env.example
```

## Run / edit locally

There is no build step. To preview, just open `index.html` in a browser
(or run any static file server). The site fetches data from the deployed
Supabase Edge Function configured in
[`assets/js/config/app-config.js`](assets/js/config/app-config.js).

## Editing data

You have three options:

1. **Admin Mode in the browser.** Click "Unlock Admin Mode" at the
   bottom of the nav and enter the same value as
   `CROSSGUNS_ADMIN_SECRET`. Admin links then appear, including in-line
   "V" / "[score]" buttons on `fixtures.html` and `results.html`, and the
   three master-data pages
   ([`admin-fixtures.html`](admin-fixtures.html),
   [`admin-players.html`](admin-players.html),
   [`admin-league-seasons.html`](admin-league-seasons.html)).
   Tokens live in `sessionStorage` under `crossgunsAdminToken`.
2. **Supabase Dashboard.** Edit rows directly in the `crossguns` schema.
3. **Re-run the migration script** if you've updated the legacy Google
   Sheets (`npm run migrate:dry-run` then `npm run migrate`). Upserts
   are keyed on stable identifiers, so re-runs are idempotent.

See [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) for the full API
contract and operational runbook.

## Adding code

Read [`.cursorrules`](.cursorrules) before editing -- it captures the
component / module conventions the AI follows. In short:

- HTML fragments live in [`components/`](components) and are pasted into
  the final `.html` files (no runtime includes; Publii is gone).
- JS is modular and loaded in the order
  config -> utils -> components -> pages -> `main.js`.
- All API calls go through `ApiClient.get(...)` / `ApiClient.post(...)`
  in [`assets/js/utils/api-client.js`](assets/js/utils/api-client.js).
  Never call PostgREST or `supabase-js` directly from the browser.
- New schema goes in a timestamped migration under
  [`supabase/migrations/`](supabase/migrations) and is applied via
  `supabase db push` or the `apply_migration` MCP tool.

## Rollback

```
git checkout pre-supabase-migration -- :/.
```

This restores the entire Publii export. The Supabase data is not
affected.
