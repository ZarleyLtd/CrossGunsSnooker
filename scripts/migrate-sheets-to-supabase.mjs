#!/usr/bin/env node
/**
 * Migrate CrossGuns Snooker League data from the legacy Google Sheets CSVs
 * into the Supabase `crossguns` schema. Idempotent: re-running rewrites
 * fixtures/handicaps/breaks for the same season without duplicating rows.
 *
 * Required env (load via .env or shell):
 * - SUPABASE_DB_URL  (postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres)
 *
 * Optional env (defaults match the current CrossGuns sheet):
 * - SHEET_BASE_ID
 * - SHEET_GID_FIXTURES      (default 2003970244)
 * - SHEET_GID_LEAGUES       (default 902750162)
 * - SHEET_GID_HANDICAPS     (default 945321474)
 * - SEASON_ID               (default 'spring-26')
 * - SEASON_NAME             (default 'Spring League 2026')
 * - SEASON_STARTS_ON        (default '2026-01-01')
 * - SEASON_ENDS_ON          (default '2026-06-30')
 *
 * Usage:
 *   npm install                                                 # one-time, installs pg
 *   node scripts/migrate-sheets-to-supabase.mjs --dry-run
 *   node scripts/migrate-sheets-to-supabase.mjs
 *
 * Notes:
 * - Talks directly to Postgres (not PostgREST) so the `crossguns` schema
 *   doesn't need to be added to the project's Exposed Schemas list.
 * - The fixtures sheet has a `League` column with values "One"/"Two"/"Three"
 *   which map to league_id "1"/"2"/"3". Knockout rounds (`Game Week` in
 *   KNOCKOUT_LABELS or matching common knockout regex) are tagged
 *   stage='knockout' and league_id=null.
 * - The leagues sheet has three side-by-side blocks (cols 0-5 = Group 1,
 *   7-12 = Group 2, 14-19 = Group 3) after 3 leading rows.
 * - Per-fixture breaks live in the `aBreaks` / `bBreaks` columns as
 *   comma-separated integers. We extract them into `crossguns.breaks`.
 * - Player IDs are deterministic slugs of the player name so reruns are
 *   idempotent.
 */

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || "";
const SHEET_BASE_ID = process.env.SHEET_BASE_ID
  || "2PACX-1vTD5fxz45LksV_LJgjEdWpFSHeLNHRmxLc9NKBj8P7xun1822ltfPVM2bbGfUrjtyfZwRNSjGxlnyY6";
const SHEET_GID_FIXTURES = process.env.SHEET_GID_FIXTURES || "2003970244";
const SHEET_GID_LEAGUES = process.env.SHEET_GID_LEAGUES || "902750162";
const SHEET_GID_HANDICAPS = process.env.SHEET_GID_HANDICAPS || "945321474";

const SEASON_ID = process.env.SEASON_ID || "spring-26";
const SEASON_NAME = process.env.SEASON_NAME || "Spring League 2026";
const SEASON_STARTS_ON = process.env.SEASON_STARTS_ON || "2026-01-01";
const SEASON_ENDS_ON = process.env.SEASON_ENDS_ON || "2026-06-30";

const KNOCKOUT_LABELS = new Set(["CS", "CF", "PQ", "PS", "PF"]);
const KO_REGEX = /\bknockout\b|\bko\b|\bsemi\b|semi-?final|quarter|playoff|\bfinals?\b/i;
const LEAGUE_NAME_TO_ID = { one: "1", two: "2", three: "3" };
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_DB_URL && !DRY_RUN) {
  console.error("Missing required env: SUPABASE_DB_URL (set it or pass --dry-run)");
  process.exit(1);
}

const reportDir = path.resolve(process.cwd(), "scripts", "migration-reports");
await fs.mkdir(reportDir, { recursive: true });

function sheetUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_BASE_ID}/pub?gid=${gid}&single=true&output=csv`;
}

async function fetchCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

/** Minimal CSV parser handling double-quoted fields with embedded commas/quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h || "").trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  });
}

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "player";
}

function toInt(v, fallback = 0) {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function normDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try DD/MM/YYYY (Irish date format used in the sheet)
  const irishMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (irishMatch) {
    const [, d, m, y] = irishMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseResult(raw) {
  const s = String(raw || "").trim();
  if (!s) return { scoreA: null, scoreB: null };
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return { scoreA: null, scoreB: null };
  return { scoreA: parseInt(m[1], 10), scoreB: parseInt(m[2], 10) };
}

function parseBreaksList(raw) {
  if (raw == null) return [];
  return String(raw)
    .split(/[\s,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 155);
}

const report = {
  dryRun: DRY_RUN,
  seasonId: SEASON_ID,
  startedAt: new Date().toISOString(),
  counts: {},
  warnings: [],
};

console.log(`Fetching CSVs (dryRun=${DRY_RUN}, season=${SEASON_ID})...`);

const [fixturesCsv, leaguesCsv, handicapsCsv] = await Promise.all([
  fetchCsv(sheetUrl(SHEET_GID_FIXTURES)),
  fetchCsv(sheetUrl(SHEET_GID_LEAGUES)),
  fetchCsv(sheetUrl(SHEET_GID_HANDICAPS)),
]);

const fixturesRows = rowsToObjects(parseCsv(fixturesCsv));
const leaguesRowsRaw = parseCsv(leaguesCsv);
const handicapsRows = rowsToObjects(parseCsv(handicapsCsv));

// ---- Build players + per-season league membership from leagues sheet ----
// Cols 0-5 = Group 1, 7-12 = Group 2, 14-19 = Group 3. First 3 rows are
// blank / blank / header.

const playersByName = new Map();
const seasonMembership = []; // [{ league_id, player_id }]

function addPlayer(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const existing = playersByName.get(trimmed);
  if (existing) return existing;
  const player = { player_id: slugify(trimmed), player_name: trimmed };
  playersByName.set(trimmed, player);
  return player;
}

function isKnockoutSectionRow(row) {
  const cells = [row[0], row[7], row[14]];
  return cells.some((c) => c && KO_REGEX.test(String(c)));
}

const leaguesDataRows = leaguesRowsRaw.slice(3);
for (const row of leaguesDataRows) {
  if (isKnockoutSectionRow(row)) break;
  const blocks = [
    { col: 0, league: "1" },
    { col: 7, league: "2" },
    { col: 14, league: "3" },
  ];
  for (const b of blocks) {
    const name = (row[b.col] || "").trim();
    if (!name) continue;
    const p = addPlayer(name);
    seasonMembership.push({ league_id: b.league, player_id: p.player_id });
  }
}

// Also create player rows for fixture/handicap players who might not appear
// in the leagues sheet.
for (const f of fixturesRows) {
  const a = (f["Player A"] || "").trim();
  const b = (f["Player B"] || "").trim();
  if (a) addPlayer(a);
  if (b) addPlayer(b);
}
for (const h of handicapsRows) {
  const name = (h["Player Name"] || "").trim();
  if (name) addPlayer(name);
}

// Resolve fixtures.
const fixtureRows = [];
const breaksToInsert = []; // [{ round_label, player_a_id, player_b_id, player_id, value }]

fixturesRows.forEach((f, idx) => {
  const a = (f["Player A"] || "").trim();
  const b = (f["Player B"] || "").trim();
  const round = (f["Game Week"] || "").trim();
  if (!a || !b || !round) return;
  const playerA = playersByName.get(a);
  const playerB = playersByName.get(b);
  if (!playerA || !playerB) {
    report.warnings.push(`Skipping fixture (missing player): "${a}" vs "${b}"`);
    return;
  }
  const leagueRaw = (f["League"] || "").trim().toLowerCase();
  const leagueId = LEAGUE_NAME_TO_ID[leagueRaw] || null;
  let stage = "league";
  if (KNOCKOUT_LABELS.has(round) || KO_REGEX.test(round)) stage = "knockout";
  if (!leagueId && stage === "league") {
    report.warnings.push(`League fixture has no recognisable league value: "${a}" vs "${b}" round=${round} league=${leagueRaw}`);
  }
  const { scoreA, scoreB } = parseResult(f["Result"]);
  fixtureRows.push({
    season_id: SEASON_ID,
    league_id: stage === "knockout" ? null : leagueId,
    stage,
    round_label: round,
    player_a_id: playerA.player_id,
    player_b_id: playerB.player_id,
    match_date: normDate(f["Match Date"]),
    score_a: scoreA,
    score_b: scoreB,
    sort_order: idx,
  });

  // Breaks come from aBreaks / bBreaks columns.
  for (const val of parseBreaksList(f["aBreaks"])) {
    breaksToInsert.push({
      round_label: round,
      player_a_id: playerA.player_id,
      player_b_id: playerB.player_id,
      player_id: playerA.player_id,
      value: val,
    });
  }
  for (const val of parseBreaksList(f["bBreaks"])) {
    breaksToInsert.push({
      round_label: round,
      player_a_id: playerA.player_id,
      player_b_id: playerB.player_id,
      player_id: playerB.player_id,
      value: val,
    });
  }
});

const handicapInputs = [];
for (const h of handicapsRows) {
  const name = (h["Player Name"] || "").trim();
  if (!name) continue;
  const player = playersByName.get(name);
  if (!player) continue;
  const date = normDate(h["Handicap Date"]);
  const handicap = h["Handicap"];
  if (!date || handicap === "" || handicap == null) {
    report.warnings.push(`Skipping handicap row (bad date or value): ${JSON.stringify(h)}`);
    continue;
  }
  handicapInputs.push({
    player_id: player.player_id,
    handicap: toInt(handicap, 0),
    effective_date: date,
  });
}

// Dedupe by (player_id, effective_date) -- last write wins.
const handicapMap = new Map();
for (const row of handicapInputs) {
  handicapMap.set(`${row.player_id}|${row.effective_date}`, row);
}
const handicapRows = Array.from(handicapMap.values());

// Dedupe season membership: last write wins (a player can only be in one league per season).
const memberMap = new Map();
for (const m of seasonMembership) memberMap.set(m.player_id, m);
const memberRows = Array.from(memberMap.values());

const playerRows = Array.from(playersByName.values());

console.log(`Players: ${playerRows.length}`);
console.log(`Season members: ${memberRows.length}`);
console.log(`Fixtures: ${fixtureRows.length}`);
console.log(`Handicaps: ${handicapRows.length}`);
console.log(`Breaks: ${breaksToInsert.length}`);
if (report.warnings.length) console.warn(`Warnings: ${report.warnings.length}`);

if (!DRY_RUN) {
  const client = new pg.Client({ connectionString: SUPABASE_DB_URL });
  await client.connect();
  try {
    await client.query("begin");

    // Ensure the season exists. Leagues 1/2/3 are seeded by the schema
    // migration -- we don't touch them here.
    await client.query(
      `insert into crossguns.seasons
         (season_id, name, starts_on, ends_on, is_current)
       values ($1, $2, $3, $4, true)
       on conflict (season_id) do update
         set name = excluded.name,
             starts_on = excluded.starts_on,
             ends_on = excluded.ends_on,
             updated_at = now()`,
      [SEASON_ID, SEASON_NAME, SEASON_STARTS_ON, SEASON_ENDS_ON],
    );
    // Make sure no other season is "current" alongside this one.
    await client.query(
      `update crossguns.seasons set is_current = false, updated_at = now()
       where season_id <> $1`,
      [SEASON_ID],
    );

    for (const p of playerRows) {
      await client.query(
        `insert into crossguns.players (player_id, player_name)
         values ($1, $2)
         on conflict (player_id) do update
           set player_name = excluded.player_name,
               updated_at = now()`,
        [p.player_id, p.player_name],
      );
    }

    for (const m of memberRows) {
      await client.query(
        `insert into crossguns.season_players
           (season_id, league_id, player_id)
         values ($1, $2, $3)
         on conflict (season_id, player_id) do update
           set league_id = excluded.league_id,
               updated_at = now()`,
        [SEASON_ID, m.league_id, m.player_id],
      );
    }

    // Cache fixture_id by (round_label, player_a_id, player_b_id) so we
    // can attach breaks afterwards.
    const fixtureIdByKey = new Map();
    for (const f of fixtureRows) {
      const res = await client.query(
        `insert into crossguns.fixtures
           (season_id, league_id, stage, round_label,
            player_a_id, player_b_id, match_date,
            score_a, score_b, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (season_id, stage, round_label, player_a_id, player_b_id) do update
           set league_id = excluded.league_id,
               match_date = excluded.match_date,
               score_a = excluded.score_a,
               score_b = excluded.score_b,
               sort_order = excluded.sort_order,
               updated_at = now()
         returning fixture_id`,
        [f.season_id, f.league_id, f.stage, f.round_label,
         f.player_a_id, f.player_b_id, f.match_date,
         f.score_a, f.score_b, f.sort_order],
      );
      const fixtureId = res.rows[0].fixture_id;
      fixtureIdByKey.set(`${f.round_label}|${f.player_a_id}|${f.player_b_id}`, fixtureId);
    }

    // Replace any existing breaks for these fixtures (idempotent).
    const fixtureIds = Array.from(fixtureIdByKey.values());
    if (fixtureIds.length) {
      await client.query(
        `delete from crossguns.breaks where fixture_id = any($1::uuid[])`,
        [fixtureIds],
      );
    }
    for (const br of breaksToInsert) {
      const key = `${br.round_label}|${br.player_a_id}|${br.player_b_id}`;
      const fixtureId = fixtureIdByKey.get(key);
      if (!fixtureId) {
        report.warnings.push(`No fixture_id resolved for break: ${key} (skipped)`);
        continue;
      }
      await client.query(
        `insert into crossguns.breaks (fixture_id, player_id, value)
         values ($1, $2, $3)`,
        [fixtureId, br.player_id, br.value],
      );
    }

    for (const h of handicapRows) {
      await client.query(
        `insert into crossguns.handicaps (player_id, handicap, effective_date)
         values ($1,$2,$3)
         on conflict (player_id, effective_date) do update
           set handicap = excluded.handicap,
               updated_at = now()`,
        [h.player_id, h.handicap, h.effective_date],
      );
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    await client.end();
  }
}

report.counts = {
  players: playerRows.length,
  members: memberRows.length,
  fixtures: fixtureRows.length,
  handicaps: handicapRows.length,
  breaks: breaksToInsert.length,
};
report.completedAt = new Date().toISOString();

const reportFile = path.join(reportDir, `migration-report-${Date.now()}.json`);
await fs.writeFile(reportFile, JSON.stringify(report, null, 2), "utf8");
console.log(`Migration ${DRY_RUN ? "dry-run " : ""}complete. Report: ${reportFile}`);
