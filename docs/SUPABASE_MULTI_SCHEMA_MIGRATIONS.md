# Multi-schema migrations on a shared Supabase project

> **Status:** Long-term consolidation not yet done. CrossGuns pending migrations
> (`20260602140000_parent_season_id.sql`, `20260602140100_knockout_round_codes.sql`)
> were applied manually in the Supabase dashboard (June 2026). Edge function
> `crossguns-api` was deployed separately.

The **Apps** Supabase project (`yzyipxvlsoxfphwobfkb`) hosts multiple
independent apps, each in its own Postgres schema:

| Schema           | App repo        | Edge function   |
| ---------------- | --------------- | --------------- |
| `crossguns`      | PubliiCrossguns | `crossguns-api` |
| `ierne_snooker`  | ierne-snooker   | (ierne API)     |

App code and Edge Functions stay in each app repo. The problem is **database
migrations**: Supabase tracks **one global migration history per project**
(`supabase_migrations.schema_migrations`), not one history per schema.

When `supabase db push` runs from PubliiCrossguns, the CLI expects every
migration ever applied to that project to exist locally. Remote history
includes ierne-only versions that are not in this repo (and vice versa),
which produces:

```
Remote migration versions not found in local migrations directory.
```

This is structural, not a one-off mistake. It will keep happening while each
app repo owns its own `supabase/migrations/` folder.

---

## Recommended long-term approach

**One canonical owner for all DDL on the shared project.**

Create a small platform repo (e.g. `Apps-supabase` or `supabase-platform`)
whose only job is the shared Supabase project:

```
Apps-supabase/
  supabase/
    config.toml          # linked to yzyipxvlsoxfphwobfkb
    migrations/
      20260504220000_ierne_....sql
      20260518161615_crossguns_create_schema.sql
      20260602140000_crossguns_parent_season_id.sql
      20260602130000_ierne_....sql
  docs/
    SCHEMAS.md           # which app owns which schema
  scripts/
    db-push.ps1          # the ONLY script anyone runs for DDL
```

### File naming

Prefix every migration with the schema it touches:

- `*_crossguns_*`
- `*_ierne_*`

Every migration must use fully qualified object names (`crossguns.seasons`,
`ierne_snooker.fixtures`). Migrations should not assume they own the whole
database.

### What stays in each app repo

- Edge Functions (`supabase functions deploy crossguns-api`, etc.)
- Static frontend and admin UI
- App-specific docs and scripts

### What moves out of app repos

- `supabase/migrations/` (or replace with a README pointing at the platform
  repo)
- Any per-app `supabase db push` workflow

### Day-to-day workflow

| Task                         | Where                                      |
| ---------------------------- | ------------------------------------------ |
| Add column to `crossguns`    | New file in platform repo → `db push` there |
| Add column to `ierne_snooker`| Same                                       |
| Deploy Edge Function         | App repo (`supabase functions deploy …`)   |
| View / edit data             | Supabase dashboard, filter by schema       |

**Rule:** only the platform repo runs `supabase db push`. App repos never
push migrations.

That keeps local and remote migration history aligned permanently.

---

## What to avoid long term

1. **Per-app `migration repair` scripts**  
   ierne-snooker has `scripts/reconcile-supabase-migrations.ps1` as a
   band-aid. It works for one repo in isolation but breaks down when both
   projects add migrations around the same time.

2. **Dashboard or MCP SQL without recording in git**  
   Creates remote version IDs that do not match any repo (e.g. ierne remote
   IDs `20260517120000`, `20260517130000`, `20260523120000` that differ from
   git baselines). Remote and git diverge again.

3. **`supabase db pull` from an app repo**  
   Pulls the whole project and mixes schemas; does not fix two repos sharing
   one ledger.

4. **Duplicate migration folders in each app**  
   Current setup; source of repeated `db push` failures.

---

## One-time consolidation (when ready)

1. **Merge** all migration files from PubliiCrossguns and ierne-snooker into
   the platform repo. Deduplicate by SQL content, not just filename (some
   ierne remote IDs differ from git).

2. **Align remote history once** with `supabase migration repair` so remote
   matches the merged canonical list (mark baselines as `applied`, reconcile
   phantom MCP-only versions if needed).

3. **Remove or empty** `supabase/migrations/` in app repos, or add a README
   redirecting to the platform repo.

4. **Update** `.cursorrules` and `docs/SUPABASE_SETUP.md` in each app:
   DDL changes go to the platform repo; functions deploy from the app repo.

After cutover, new changes are: add migration file → push from platform repo
→ deploy function from app repo if the API changed.

---

## Optional hardening

- **CI on the platform repo:** run `supabase db push` on merge to `main`.
- **Schema registry:** short doc listing schema → app → Edge Function.
- **Git submodule:** if migrations should appear inside app repos without
  copying, submodule the platform `migrations/` folder — still only push from
  the platform repo.

---

## Short-term workarounds (until consolidation)

When `db push` fails and a migration only touches one schema:

1. Run the SQL manually in the Supabase SQL editor (dashboard).
2. Optionally record the version on remote so future pushes know it ran:
   ```powershell
   supabase migration repair --status applied 20260602140000 20260602140100 --linked
   ```
   (Only if you intend to keep using this repo’s migration folder; repair
   alone does not fix cross-repo history mismatch.)

Edge Functions are independent of the migration ledger — deploy them from
the app repo as usual.

---

## Why not separate Supabase projects?

Separate projects give each app its own migration ledger with zero
coordination. One project (single dashboard, single bill) is fine; the
tradeoff is **centralize migrations, decentralize app code**. Edge Functions
and schema-qualified SQL already isolate apps; the shared choke point is
only `schema_migrations`.

---

## Current CrossGuns migration files (this repo)

For reference when consolidating:

| Version            | File                                              |
| ------------------ | ------------------------------------------------- |
| `20260518161615`   | `create_crossguns_schema.sql`                     |
| `20260518171112`   | `fix_max_adjusted_break_handicap_floor.sql`       |
| `20260518181622`   | `pts_per_frame_won.sql`                           |
| `20260524120000`   | `multi_current_competitions.sql`                  |
| `20260525120000`   | `season_groups.sql`                               |
| `20260602140000`   | `parent_season_id.sql` (applied manually, Jun 2026) |
| `20260602140100`   | `knockout_round_codes.sql` (applied manually, Jun 2026) |

Related ierne migrations live in `C:\CursorSites\ierne-snooker\supabase\migrations\`.
