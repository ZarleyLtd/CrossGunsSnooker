# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Public site for the CrossGuns Snooker League (GitHub repo `ZarleyLtd/CrossGunsSnooker`, published via GitHub Pages at https://zarleyltd.github.io/CrossGunsSnooker/). It's plain HTML with a small vanilla JS runtime and no build step, in front of a Supabase Postgres database. It replaced an older Publii build, which is kept at the git tag `pre-supabase-migration` (roll back with `git checkout pre-supabase-migration -- :/.`). Publii is no longer used. `PROJECT_MAP.md` maps the folders, and `docs/SUPABASE_SETUP.md` has the backend runbook and API contract.

## Dev server / port

There is no dev server script. Serve the folder statically from the project root:

```powershell
npx serve .        # http://localhost:3000
```

Opening `index.html` directly also works. Pages call the deployed Edge Function URL in `assets/js/config/app-config.js`, so local pages use live data.

## Commands

```powershell
npm install
npm run verify              # smoke test against the deployed crossguns-api
npm run migrate:dry-run     # legacy Google Sheets import (idempotent upserts)
npm run migrate
supabase functions deploy crossguns-api --no-verify-jwt
```

There are no unit tests.

## Architecture

- **HTML components:** `components/` holds `header.html`, `nav.html`, `footer.html` and `scripts.html`. They are pasted into every `.html` page; there are no runtime includes. When asked to change the header or footer, update `components/` first, then copy the same markup into every page.
- **JS:** `assets/js/config/app-config.js` (the single source of truth for the Edge Function URL) → `utils/` (`api-client.js`, `admin-mode.js`, `formatters.js`, ...) → `components/` (`league-standings.js`) → `pages/` (one module per page) → `main.js` (DOM-aware router, loaded with `defer`). Pages must load scripts in that order. Change shared utils and components first, then the page modules, and never duplicate code between pages. `scripts.js`, `scripts.min.js` and `svg-*.js` are legacy theme helpers.
- **API access:** pages call `ApiClient.get({ action })` and `ApiClient.post(...)` only. Never call PostgREST or supabase-js from the browser. To avoid CORS preflights, use GET with no custom headers, or POST with `application/x-www-form-urlencoded`. New endpoints go in `supabase/functions/crossguns-api/index.ts`. Read endpoints accept `?season=<id>`, defaulting to the `seasons` row with `is_current = true`.
- **Data model:** schema `crossguns` on the shared Supabase project "Apps" (`yzyipxvlsoxfphwobfkb`). Tables are `leagues`, `seasons`, `season_players`, `players`, `fixtures`, `handicaps` and `breaks`. There are three groups (`league_id` 1, 2 and 3). Standings are computed live by `league_standings_v`, head-to-head by `head_to_head_v`, and the adjusted-break tiebreaker by `max_adjusted_break_v` (raw break plus the handicap on the match date, counting only raw breaks of 25 or more).
- **PWA:** `manifest.json` plus `sw.js` (shell cache `crossguns-shell-vN`). When shell assets change, update the asset list and bump the cache name.
- **Admin:** admin pages (`admin-*.html`) and inline admin buttons unlock through the admin mode in `utils/admin-mode.js`. The most recent commit ("Replace passcodes with player accounts …") changed the account model, so check the code before relying on the older passcode description in the README.
- Architectural plans are in `docs/plans/`.

## Schema changes (shared database)

The "Apps" project is shared by several CursorSites apps, and its migration history is global. **Don't use `supabase db push`**, and never repair or revert other apps' remote migrations. (The old `.cursorrules` says `db push` is allowed; `../cursor-sites-shared/supabase/SHARED_DATABASE.md` supersedes it.) To change the schema:

1. Run `supabase migration new <name>` and write SQL that only touches `crossguns.*`.
2. Apply the same SQL with the MCP tool `apply_migration` on project `yzyipxvlsoxfphwobfkb`.
3. Check the result with `execute_sql`.
4. Commit the migration file.

## CrossGuns UI parity (must preserve)

- `index.html`: swipeable carousel of the current competitions, with the competition name in the carousel header. League cards show the leaders of each group, with ties shown as "X & Y (tied)". The knockout is a horizontal bracket. Linked knockout stages appear on their parent league card, not on a separate slide.
- `fixtures.html`: radio filter (All / Group 1 / Group 2 / Group 3). Shows upcoming fixtures only, grouped by game week. The admin "V" button opens the entry dialog.
- `results.html`: same radio filter. Shows only fixtures with a recorded score, with the winner (score = 2) in bold. Admins can reopen the dialog with the `[score]` button.
- `leagues.html`: three monospaced `<pre>` blocks (`league-a`, `league-b`, `league-c`), ordered by the full CrossGuns tiebreak chain.
- `top-breaks.html`: radio filter, rendered into the `breaks-output` container. Shows the raw break plus a " plus X" note when the handicap raised the value, otherwise "[actual break]". Only raw breaks of 25 or more are listed.

## Reference project

`../ierne-snooker` is the reference for competitions and knockout stages, the home carousel, admin knockout tooling for fixtures, and the related data model. Copy its behaviour and patterns, not whole files, and keep the `crossguns` schema and Edge Function. For layout and CSS of the nav, fixture rows and admin dialogs, **this repo is the UI authority**. Where ierne-snooker conflicts with CrossGuns behaviour, CrossGuns wins.

## Rules

- Use relative paths only (`assets/css/style.css`). Never use `/assets/...`, absolute URLs, `http://localhost` or drive letters.
