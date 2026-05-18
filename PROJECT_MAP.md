# CrossGuns Snooker League - Project Map

## Goal
A lightweight, static HTML website for the CrossGuns Snooker League. No
heavy frameworks. Focus on speed, clean SEO, and simple updates. Backend
state lives in Supabase Postgres; the browser only ever talks to a single
Edge Function (`crossguns-api`) over CORS-safe GET/POST.

This repo replaces the previous Publii-built site; the deployed Publii
revision is preserved as the `pre-supabase-migration` git tag.

## Folder Structure
- `/` (root): public pages (`index.html`, `leagues.html`, `fixtures.html`,
  `results.html`, `top-breaks.html`, `handicaps.html`, `rules.html`,
  `under-development.html`, `404.html`) and admin pages (`admin-fixtures.html`,
  `admin-players.html`, `admin-league-seasons.html`, `admin.html` redirect).
- `/components/`: source HTML fragments (`header.html`, `nav.html`,
  `footer.html`, `scripts.html`). Edits here must be propagated into every
  `.html` page that ships them.
- `/assets/css/`: `style.css`, `main.css`, `editor.css`.
- `/assets/js/`: modular JavaScript:
  - `/config/`: `app-config.js` (Edge Function URL - single source of truth).
  - `/utils/`: `api-client.js`, `admin-mode.js`, `formatters.js`, `image-loader.js`,
    `nav-active.js`, `csv-parse.js`, `player-slug.js`.
  - `/components/`: `league-standings.js`.
  - `/pages/`: `index.js`, `fixtures.js`, `results.js`, `leagues.js`,
    `handicaps.js`, `top-breaks.js`, `under-development.js`,
    `admin-fixtures.js`, `admin-players.js`, `admin-league-seasons.js`.
  - `main.js`: DOM-aware page router (loaded with `defer`).
  - `scripts.js`, `scripts.min.js`, `svg-fix.js`, `svg-map.js`: legacy theme menu helpers.
- `/assets/images/`: branding assets (`crossguns-logo.png`, `crossguns-hero.png`)
  and derived favicons (`favicon-32.png`, `favicon-96.png`, `favicon-180.png`,
  `favicon-192.png`, `favicon-512.png`).
- `/supabase/`:
  - `migrations/`: SQL migrations (timestamp-prefixed).
  - `functions/crossguns-api/index.ts`: Edge Function source.
  - `config.toml`: links the project and configures the function.
- `/scripts/`: Node migration helpers
  (`migrate-sheets-to-supabase.mjs`, `verify-migration.mjs`).
- `/docs/`: `SUPABASE_SETUP.md`, `plans/`.

## Tech Stack
- HTML5/CSS3 - pure and semantic.
- Vanilla JavaScript - modular, no bundler.
- Supabase Postgres + a single Deno Edge Function as the entire API surface.
- Hosted on GitHub Pages from the same `ZarleyLtd/CrossGunsSnooker` repository.

## Backend
- **Database**: schema `crossguns` on the `Apps` project
  (`yzyipxvlsoxfphwobfkb`). Tables: `leagues`, `seasons`, `season_players`,
  `players`, `fixtures`, `handicaps`, `breaks`. Three groups seeded with
  `league_id` = 1, 2, 3 (names "Group 1" / "Group 2" / "Group 3").
- **Views**: `fixture_results_v`, `league_standings_v`, `head_to_head_v`,
  `max_adjusted_break_v` (powers the CrossGuns adjusted-break tiebreaker:
  raw break + handicap on match date, raw value >= 25).
- **API**: `crossguns-api` Edge Function. Read endpoints (`?action=...`):
  `getFixtures`, `getStandings`, `getHandicaps`, `getPlayers`,
  `getTopBreaks`, `getSeasons`, `getLeagues`, `getBreaksForFixture`.
  POST writes are admin-only (`adminLogin`, upserts, `updateFixtureResult`,
  `deleteBreak`, `deleteFixture`, `deleteHandicap`, `deletePlayer`,
  `deleteSeason`, `deleteLeague`). Admin auth uses an HMAC token derived
  from `CROSSGUNS_ADMIN_SECRET` and stored in `sessionStorage` under
  `crossgunsAdminToken`.

## Page UX (parity with the legacy Publii build)
- `index.html`: hero + 3 group leaders (`#g1-leader`, `#g2-leader`, `#g3-leader`).
  Tied leaders shown as "X & Y (tied)" when Pts/+/-/W match.
- `fixtures.html`: radio filter (All / Group 1 / 2 / 3); upcoming-only;
  grouped by Game Week. Admin "V" button opens the entry dialog.
- `results.html`: same filter; only played fixtures; winner (score = 2)
  is bolded; admin can re-open the dialog via the `[score]` button.
- `leagues.html`: three monospaced `<pre>` blocks (`#league-a`, `#league-b`,
  `#league-c`) ordered by the full CrossGuns tiebreak chain.
- `top-breaks.html`: same filter; container `#breaks-output`; entries shown
  as `<strong>Adjusted</strong> [raw plus delta]` or `[actual break]` when no
  handicap delta; only raw value >= 25.
- `handicaps.html`: simple `<table id="handicaps">` of latest handicap per
  player.
- `rules.html`: static text (league rules, fees, prize money).

## Out of Bounds (Publii Hangover)
- DO NOT create `authors/`, `tags/`, or root-level `page/` folders.
- DO NOT add absolute file paths like `C:/Users/...`.
- DO NOT add complex JavaScript frameworks. Keep it simple.
- DO NOT duplicate JS code; extract to utilities or components instead.

## Changing the Backend
To point the site at a different Supabase project or environment:
1. Open `/assets/js/config/app-config.js`.
2. Update `apiUrl` with the new Edge Function URL.
3. All pages will automatically use the new backend - no other changes needed.

For schema changes or new endpoints, see `docs/SUPABASE_SETUP.md`.
