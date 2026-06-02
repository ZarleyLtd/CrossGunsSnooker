// CrossGuns Snooker League API
// Single Edge Function exposing JSON read endpoints backed by the
// `crossguns` schema, plus authenticated POST writes.
//
// We connect directly to Postgres (not PostgREST / supabase-js .schema)
// because the `crossguns` schema is not on the project's Exposed Schemas
// list, so it stays private to this app.
//
// Read actions (GET):
//   ?action=getFixtures   [&season=<id>]
//   ?action=getStandings  [&season=<id>]
//   ?action=getHandicaps
//   ?action=getPlayers    [&season=<id>] [&league=<id>]  (no params -> seasonCount, matchCount per player)
//   ?action=getTopBreaks  [&season=<id>] [&league=<id>] [&limit=<n>]
//   ?action=getSeasons
//   ?action=getPlayerSeasons  &playerId=<id>
//   ?action=getSeasonGroups  &seasonId=<id>
//   ?action=getLeagues
//   ?action=getBreaksForFixture  &fixtureId=<uuid>
//
// Default season: the row in `seasons` with `is_current = true`.
//
// Authenticated POST (Content-Type: application/x-www-form-urlencoded,
// body field `data` JSON):
//   { "action": "...", "data": { ... }, "adminToken": "<HMAC token>" }
// Env CROSSGUNS_ADMIN_SECRET required for admin. Actions:
//   adminLogin (pin only), upsertPlayer, upsertSeasonPlayer, upsertHandicap,
//   upsertSeason, upsertLeague, upsertFixture, updateFixtureResult,
//   upsertBreak, deleteBreak, deleteFixture, deleteHandicap, deletePlayer,
//   deleteSeason, deleteLeague, upsertSeasonGroup
//
// Standings ordering = the full CrossGuns tiebreak chain:
//   1. points desc
//   2. frame_diff desc
//   3. wins desc
//   4. head-to-head among the tied players (match wins, then frame diff)
//   5. max adjusted break (raw value + handicap on match_date, value >= 25)
//   6. alphabetical (stable)

import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

function unauthorizedResponse(message = "Unauthorized"): Response {
  return jsonResponse({ success: false, error: message }, 401);
}

// Module-scoped pool (reused across warm invocations).
let _sql: ReturnType<typeof postgres> | null = null;
function db() {
  if (_sql) return _sql;
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")
    || Deno.env.get("DB_URL")
    || Deno.env.get("POSTGRES_URL");
  if (!dbUrl) throw new Error("Missing required env: SUPABASE_DB_URL");
  _sql = postgres(dbUrl, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return _sql;
}

// ---------- Types -----------------------------------------------------------

type PlayerRow = { player_id: string; player_name: string; active: boolean };
type LeagueRow = { league_id: string; name: string; display_order: number };
type SeasonRow = {
  season_id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  is_current: boolean;
  competition_type: "league" | "knockout";
  parent_season_id: string | null;
};
type SeasonPlayerRow = { season_id: string; league_id: string; player_id: string };
type FixtureRow = {
  fixture_id: string;
  season_id: string;
  league_id: string | null;
  stage: "league" | "knockout";
  round_label: string;
  player_a_id: string;
  player_b_id: string;
  match_date: string | null;
  score_a: number | null;
  score_b: number | null;
  sort_order: number;
};
type StandingRow = {
  season_id: string;
  league_id: string;
  player_id: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  frame_diff: number;
  points: number;
};
type HeadToHeadRow = {
  season_id: string;
  league_id: string;
  player_id: string;
  opponent_id: string;
  played: number;
  h2h_wins: number;
  h2h_losses: number;
  h2h_frame_diff: number;
  h2h_points: number;
};
type HandicapRow = {
  handicap_id: string;
  player_id: string;
  handicap: number;
  effective_date: string;
};
type MaxBreakRow = {
  season_id: string;
  league_id: string;
  player_id: string;
  max_adjusted: number;
};
type BreakLeaderRow = {
  break_id: string;
  fixture_id: string;
  value: number;
  player_id: string;
  player_name: string;
  league_id: string | null;
  round_label: string;
  stage: string;
  match_date: string | null;
  handicap: number | null;
  player_a_id: string;
  player_b_id: string;
  player_a_name: string;
  player_b_name: string;
};

// ---------- Helpers ---------------------------------------------------------

function buildPlayerMap(players: PlayerRow[]): Map<string, PlayerRow> {
  const map = new Map<string, PlayerRow>();
  for (const p of players) map.set(p.player_id, p);
  return map;
}

async function loadAllPlayers(): Promise<PlayerRow[]> {
  const sql = db();
  const rows = await sql<PlayerRow[]>`
    select player_id, player_name, active
    from crossguns.players
    order by player_name asc
  `;
  return rows as unknown as PlayerRow[];
}

async function resolveSeasonId(requested: string | null): Promise<string> {
  const sql = db();
  if (requested) {
    const found = await sql<SeasonRow[]>`
      select season_id, name, starts_on, ends_on, is_current, competition_type, parent_season_id
      from crossguns.seasons
      where season_id = ${requested}
    `;
    if (!found.length) throw new Error(`Unknown season: ${requested}`);
    return (found[0] as unknown as SeasonRow).season_id;
  }
  const current = await sql<SeasonRow[]>`
    select season_id, name, starts_on, ends_on, is_current, competition_type, parent_season_id
    from crossguns.seasons
    where is_current = true
    order by competition_type asc, starts_on desc nulls last, season_id asc
    limit 1
  `;
  if (!current.length) throw new Error("No current season is set");
  return (current[0] as unknown as SeasonRow).season_id;
}

async function loadLeagues(): Promise<LeagueRow[]> {
  const sql = db();
  const rows = await sql<LeagueRow[]>`
    select league_id, name, display_order
    from crossguns.leagues
    order by display_order asc, league_id asc
  `;
  return rows as unknown as LeagueRow[];
}

async function loadSeasonGroups(seasonId: string): Promise<LeagueRow[]> {
  const sql = db();
  const rows = await sql<LeagueRow[]>`
    select sg.league_id, l.name, sg.display_order
      from crossguns.season_groups sg
      join crossguns.leagues l on l.league_id = sg.league_id
     where sg.season_id = ${seasonId}
       and sg.league_id <> ${KNOCKOUT_GROUP_ID}
     order by sg.display_order asc, sg.league_id asc
  `;
  return rows as unknown as LeagueRow[];
}

const KNOCKOUT_GROUP_ID = "ko";
const WINNER_OF_PREFIX = "wo:";

const KNOCKOUT_ROUND_LABELS: Record<string, string> = {
  QF1: "Quarter-final 1",
  QF2: "Quarter-final 2",
  QF3: "Quarter-final 3",
  QF4: "Quarter-final 4",
  SF1: "Semi-final 1",
  SF2: "Semi-final 2",
  F: "Final",
  "F-P": "Plate Final",
  "F-C": "Championship Final",
};

function knockoutRoundLabel(code: string): string {
  const c = code.trim();
  if (!c) return "";
  if (KNOCKOUT_ROUND_LABELS[c]) return KNOCKOUT_ROUND_LABELS[c];

  const l32 = c.match(/^L32-(\d+)$/i);
  if (l32) return `Last 32 — match ${l32[1]}`;

  const l16 = c.match(/^L16-(\d+)$/i);
  if (l16) return `Last 16 — match ${l16[1]}`;

  const qf = c.match(/^QF(\d+)$/i);
  if (qf) return `Quarter-final ${qf[1]}`;

  const sf = c.match(/^SF(\d+)$/i);
  if (sf) return `Semi-final ${sf[1]}`;

  const koLast = c.match(/^KO Last (\d+)$/i);
  if (koLast) {
    const n = parseInt(koLast[1], 10);
    if (n === 2) return "Final";
    if (n === 4) return "Semi-finals";
    if (n === 8) return "Quarter-finals";
    if (n === 16) return "Last 16";
    if (n === 32) return "Last 32";
    return `Last ${n}`;
  }
  if (/^KO Pre-/i.test(c)) return "Preliminary";
  return c;
}

function winnerOfPlayerName(roundCode: string): string {
  const label = knockoutRoundLabel(roundCode);
  const base = label || roundCode.trim();
  // players.player_name is unique — include round code so labels like "Final"
  // (F vs KO Last 2) never collide and block wo:* row creation.
  if (!base) return `Winner (${roundCode})`;
  return `${base} Winner (${roundCode})`;
}

function isWinnerOfPlayerId(playerId: string): boolean {
  return String(playerId).startsWith(WINNER_OF_PREFIX);
}

async function ensureWinnerOfPlayers(
  sql: ReturnType<typeof postgres>,
  ...playerIds: string[]
): Promise<void> {
  for (const rawId of playerIds) {
    const playerId = String(rawId ?? "").trim();
    if (!isWinnerOfPlayerId(playerId)) continue;
    const roundCode = playerId.slice(WINNER_OF_PREFIX.length).trim();
    if (!roundCode) continue;
    const playerName = winnerOfPlayerName(roundCode);
    await sql`
      insert into crossguns.players (player_id, player_name, active, updated_at)
      values (${playerId}, ${playerName}, false, now())
      on conflict (player_id) do update set
        player_name = excluded.player_name,
        updated_at = now()
    `;
  }
}

async function assertFixturePlayersExist(
  sql: ReturnType<typeof postgres>,
  ...playerIds: string[]
): Promise<void> {
  for (const rawId of playerIds) {
    const playerId = String(rawId ?? "").trim();
    if (!playerId) continue;
    const found = await sql<{ ok: boolean }[]>`
      select exists(
        select 1 from crossguns.players where player_id = ${playerId}
      ) as ok
    `;
    if (!found.length || !(found[0] as { ok: boolean }).ok) {
      const hint = isWinnerOfPlayerId(playerId)
        ? " Knockout placeholder player could not be created — redeploy crossguns-api or pick the player again."
        : "";
      throw new Error(`Unknown player id: ${playerId}.${hint}`);
    }
  }
}

function inferParentSeasonIdFromKnockoutSeasonId(seasonId: string): string | null {
  const m = seasonId.match(/^(.+)-(ko|knockout)$/i);
  return m ? m[1] : null;
}

function resolvedParentSeasonId(r: SeasonRow): string | null {
  if (r.parent_season_id) return r.parent_season_id;
  if (r.competition_type !== "knockout") return null;
  return inferParentSeasonIdFromKnockoutSeasonId(r.season_id);
}

function mapSeasonRow(r: SeasonRow) {
  const parentSeasonId = r.parent_season_id ?? null;
  return {
    seasonId: r.season_id,
    compId: r.season_id,
    name: r.name,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    isCurrent: r.is_current,
    competitionType: r.competition_type,
    parentSeasonId,
    parentCompId: parentSeasonId,
  };
}

// ---------- CrossGuns tiebreaker -------------------------------------------
//
// Crossguns ordering:
//   1. points desc
//   2. frame_diff desc
//   3. wins desc
//   4. head-to-head among the tied players (match wins, then frame diff)
//   5. max adjusted break (value + handicap on match_date, value >= 25)
//   6. alphabetical (stable)
//
// We resolve ties in groups: after sorting by (points, frame_diff, wins),
// every contiguous run of rows tied on all three goes through H2H. If
// still tied, max_adjusted_break breaks it. Otherwise alphabetical.

type ShapedRow = {
  playerId: string;
  playerName: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  frameDiff: number;
  points: number;
  /** Fingerprint after the full tiebreak chain; equal keys => joint display rank. */
  tieKey: string;
};

function tieKeyForPlayer(
  row: ShapedRow,
  miniStats: Map<string, { miniMatchWins: number; miniFrameDiff: number }>,
  maxBreakByPlayer: Map<string, number>,
): string {
  const mini = miniStats.get(row.playerId) ?? { miniMatchWins: 0, miniFrameDiff: 0 };
  const maxBreak = maxBreakByPlayer.get(row.playerId) ?? -Infinity;
  return [
    row.points,
    row.frameDiff,
    row.won,
    mini.miniMatchWins,
    mini.miniFrameDiff,
    maxBreak,
  ].join("|");
}

function applyCrossgunsTiebreak(
  rows: ShapedRow[],
  h2h: HeadToHeadRow[],
  maxBreakByPlayer: Map<string, number>,
): ShapedRow[] {
  if (rows.length < 2) {
    return rows.map((r) => ({
      ...r,
      tieKey: tieKeyForPlayer(r, new Map(), maxBreakByPlayer),
    }));
  }

  // Primary sort: points, frame_diff, wins, then alphabetical as a stable anchor.
  const sorted = rows.map((r) => ({ ...r, tieKey: "" }));
  sorted.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.frameDiff !== a.frameDiff) return b.frameDiff - a.frameDiff;
    if (b.won !== a.won) return b.won - a.won;
    return a.playerName.localeCompare(b.playerName);
  });

  const h2hKey = (a: string, b: string) => `${a}|${b}`;
  const h2hMap = new Map<string, HeadToHeadRow>();
  for (const r of h2h) h2hMap.set(h2hKey(r.player_id, r.opponent_id), r);

  const result: ShapedRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (
      j < sorted.length
      && sorted[j].points === sorted[i].points
      && sorted[j].frameDiff === sorted[i].frameDiff
      && sorted[j].won === sorted[i].won
    ) {
      j++;
    }
    const group = sorted.slice(i, j);
    if (group.length === 1) {
      const solo = group[0];
      solo.tieKey = tieKeyForPlayer(solo, new Map(), maxBreakByPlayer);
      result.push(solo);
      i = j;
      continue;
    }

    // Mini-league H2H among the tied players only.
    const tiedIds = group.map((g) => g.playerId);
    const tiedSet = new Set(tiedIds);
    const miniStats = new Map<string, { miniMatchWins: number; miniFrameDiff: number }>();
    for (const id of tiedIds) miniStats.set(id, { miniMatchWins: 0, miniFrameDiff: 0 });
    for (const a of tiedIds) {
      for (const b of tiedIds) {
        if (a === b) continue;
        if (!tiedSet.has(b)) continue;
        const row = h2hMap.get(h2hKey(a, b));
        if (!row) continue;
        const stats = miniStats.get(a)!;
        stats.miniMatchWins += Number(row.h2h_wins) || 0;
        stats.miniFrameDiff += Number(row.h2h_frame_diff) || 0;
      }
    }

    group.sort((a, b) => {
      const sa = miniStats.get(a.playerId)!;
      const sb = miniStats.get(b.playerId)!;
      if (sb.miniMatchWins !== sa.miniMatchWins) return sb.miniMatchWins - sa.miniMatchWins;
      if (sb.miniFrameDiff !== sa.miniFrameDiff) return sb.miniFrameDiff - sa.miniFrameDiff;
      const ba = maxBreakByPlayer.get(a.playerId) ?? -Infinity;
      const bb = maxBreakByPlayer.get(b.playerId) ?? -Infinity;
      if (bb !== ba) return bb - ba;
      return a.playerName.localeCompare(b.playerName);
    });
    for (const row of group) {
      row.tieKey = tieKeyForPlayer(row, miniStats, maxBreakByPlayer);
    }
    result.push(...group);
    i = j;
  }
  return result;
}

/** Joint rank only when the full tiebreak chain leaves players equal (legacy sortFn === 0). */
function assignDisplayRanks(ordered: ShapedRow[]): number[] {
  const ranks: number[] = [];
  let lastRank = 0;
  let lastKey = "";
  ordered.forEach((row, idx) => {
    if (idx > 0 && row.tieKey === lastKey) {
      ranks.push(lastRank);
    } else {
      const rank = idx + 1;
      lastRank = rank;
      ranks.push(rank);
    }
    lastKey = row.tieKey;
  });
  return ranks;
}

// ---------- Action handlers ------------------------------------------------

async function handleGetPlayers(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const seasonParam = url.searchParams.get("season");
  const leagueParam = url.searchParams.get("league");

  if (!seasonParam && !leagueParam) {
    const sql = db();
    const rows = await sql<{
      player_id: string;
      player_name: string;
      season_count: number;
      match_count: number;
    }[]>`
      select p.player_id,
             p.player_name,
             coalesce(sc.season_count, 0)::int as season_count,
             coalesce(mc.match_count, 0)::int as match_count
        from crossguns.players p
        left join lateral (
          select count(*)::int as season_count
            from (
              select sp.season_id
                from crossguns.season_players sp
               where sp.player_id = p.player_id
              union
              select f.season_id
                from crossguns.fixtures f
               where f.player_a_id = p.player_id or f.player_b_id = p.player_id
            ) combined
        ) sc on true
        left join lateral (
          select count(*)::int as match_count
            from crossguns.fixtures f
           where (f.player_a_id = p.player_id or f.player_b_id = p.player_id)
             and f.score_a is not null
             and f.score_b is not null
        ) mc on true
       where p.player_id not like ${WINNER_OF_PREFIX + "%"}
       order by p.player_name asc
    `;
    return jsonResponse({
      success: true,
      players: (rows as unknown as Array<{
        player_id: string;
        player_name: string;
        season_count: number;
        match_count: number;
      }>).map((p) => ({
        playerId: p.player_id,
        playerName: p.player_name,
        seasonCount: p.season_count,
        matchCount: p.match_count,
      })),
    });
  }

  const seasonId = await resolveSeasonId(seasonParam);
  const sql = db();
  const rows = await sql<(SeasonPlayerRow & { player_name: string; active: boolean })[]>`
    select sp.season_id, sp.league_id, sp.player_id, p.player_name, p.active
    from crossguns.season_players sp
    join crossguns.players p on p.player_id = sp.player_id
    where sp.season_id = ${seasonId}
      and (${leagueParam}::text is null or sp.league_id = ${leagueParam})
    order by p.player_name asc
  `;
  return jsonResponse({
    success: true,
    season: seasonId,
    players: (rows as unknown as Array<SeasonPlayerRow & { player_name: string; active: boolean }>).map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      league: r.league_id,
      active: r.active,
    })),
  });
}

async function handleGetFixtures(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const seasonParam = url.searchParams.get("season");
  const seasonId = await resolveSeasonId(seasonParam);

  const sql = db();
  const [players, fixtureRows] = await Promise.all([
    loadAllPlayers(),
    sql<FixtureRow[]>`
      select fixture_id, season_id, league_id, stage, round_label,
             player_a_id, player_b_id,
             to_char(match_date, 'YYYY-MM-DD') as match_date,
             score_a, score_b, sort_order
      from crossguns.fixtures
      where season_id = ${seasonId}
      order by sort_order asc, round_label asc
    `,
  ]);
  const playerMap = buildPlayerMap(players);

  const fixtures = (fixtureRows as unknown as FixtureRow[]).map((r) => {
    const a = playerMap.get(r.player_a_id);
    const b = playerMap.get(r.player_b_id);
    const nameA = isWinnerOfPlayerId(r.player_a_id)
      ? winnerOfPlayerName(r.player_a_id.slice(WINNER_OF_PREFIX.length))
      : (a?.player_name ?? "");
    const nameB = isWinnerOfPlayerId(r.player_b_id)
      ? winnerOfPlayerName(r.player_b_id.slice(WINNER_OF_PREFIX.length))
      : (b?.player_name ?? "");
    const result = r.score_a != null && r.score_b != null
      ? `${r.score_a}-${r.score_b}`
      : "";
    return {
      fixtureId: r.fixture_id,
      "Game Week": r.round_label,
      "League": r.league_id,
      "Stage": r.stage,
      "Player A": nameA,
      "Player B": nameB,
      "Match Date": r.match_date ?? "",
      "Result": result,
      scoreA: r.score_a,
      scoreB: r.score_b,
      sortOrder: r.sort_order,
      playerAId: r.player_a_id,
      playerBId: r.player_b_id,
    };
  });

  return jsonResponse({ success: true, season: seasonId, fixtures });
}

async function handleGetStandings(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const seasonParam = url.searchParams.get("season");
  const seasonId = await resolveSeasonId(seasonParam);

  const sql = db();
  const [players, leagues, members, standings, h2h, maxBreaks] = await Promise.all([
    loadAllPlayers(),
    loadSeasonGroups(seasonId),
    sql<SeasonPlayerRow[]>`
      select season_id, league_id, player_id
      from crossguns.season_players
      where season_id = ${seasonId}
    `,
    sql<StandingRow[]>`
      select season_id, league_id, player_id, played, won, lost, drawn,
             frame_diff, points
      from crossguns.league_standings_v
      where season_id = ${seasonId}
    `,
    sql<HeadToHeadRow[]>`
      select season_id, league_id, player_id, opponent_id,
             played, h2h_wins, h2h_losses, h2h_frame_diff, h2h_points
      from crossguns.head_to_head_v
      where season_id = ${seasonId}
    `,
    sql<MaxBreakRow[]>`
      select season_id, league_id, player_id, max_adjusted
      from crossguns.max_adjusted_break_v
      where season_id = ${seasonId}
    `,
  ]);
  const playerMap = buildPlayerMap(players);
  const standingsMap = new Map<string, StandingRow>();
  for (const s of (standings as unknown as StandingRow[])) {
    standingsMap.set(`${s.league_id}|${s.player_id}`, s);
  }
  const breakMap = new Map<string, number>(); // key: leagueId|playerId
  for (const r of (maxBreaks as unknown as MaxBreakRow[])) {
    breakMap.set(`${r.league_id}|${r.player_id}`, Number(r.max_adjusted) || 0);
  }

  // Group members by league.
  const membersByLeague = new Map<string, SeasonPlayerRow[]>();
  for (const m of (members as unknown as SeasonPlayerRow[])) {
    const list = membersByLeague.get(m.league_id) ?? [];
    list.push(m);
    membersByLeague.set(m.league_id, list);
  }

  const h2hAll = h2h as unknown as HeadToHeadRow[];

  const leaguesOut = (leagues as LeagueRow[]).map((lg) => {
    const memberRows = membersByLeague.get(lg.league_id) ?? [];
    const shaped: ShapedRow[] = memberRows.map((m) => {
      const s = standingsMap.get(`${lg.league_id}|${m.player_id}`);
      const player = playerMap.get(m.player_id);
      return {
        playerId: m.player_id,
        playerName: player?.player_name ?? m.player_id,
        played: Number(s?.played ?? 0),
        won: Number(s?.won ?? 0),
        lost: Number(s?.lost ?? 0),
        drawn: Number(s?.drawn ?? 0),
        frameDiff: Number(s?.frame_diff ?? 0),
        points: Number(s?.points ?? 0),
      };
    });
    const leagueH2h = h2hAll.filter((r) => r.league_id === lg.league_id);
    const leagueBreaks = new Map<string, number>();
    for (const [key, val] of breakMap.entries()) {
      const [lid, pid] = key.split("|");
      if (lid === lg.league_id) leagueBreaks.set(pid, val);
    }
    const ordered = applyCrossgunsTiebreak(shaped, leagueH2h, leagueBreaks);
    const ranks = assignDisplayRanks(ordered);
    const rows = ordered.map((r, idx) => ({
      Rank: ranks[idx],
      "Player Name": r.playerName,
      P: r.played,
      W: r.won,
      L: r.lost,
      D: r.drawn,
      "+/-": r.frameDiff,
      Pts: r.points,
    }));
    return { leagueId: lg.league_id, groupId: lg.league_id, name: lg.name, rows };
  }).filter((lg) => lg.rows.length > 0);

  return jsonResponse({
    success: true,
    season: seasonId,
    compId: seasonId,
    leagues: leaguesOut,
    groups: leaguesOut,
  });
}

async function handleGetHandicaps(): Promise<Response> {
  const sql = db();
  const [players, handicapRows] = await Promise.all([
    loadAllPlayers(),
    sql<HandicapRow[]>`
      select handicap_id, player_id, handicap,
             to_char(effective_date, 'YYYY-MM-DD') as effective_date
      from crossguns.handicaps
      order by effective_date desc
    `,
  ]);
  const playerMap = buildPlayerMap(players);
  const rows = handicapRows as unknown as HandicapRow[];

  const all = rows.map((r) => ({
    handicapId: r.handicap_id,
    playerId: r.player_id,
    "Player Name": playerMap.get(r.player_id)?.player_name ?? "",
    "Handicap": r.handicap,
    "Handicap Date": r.effective_date,
  }));

  const seen = new Set<string>();
  const latest: typeof all = [];
  for (const r of rows) {
    if (seen.has(r.player_id)) continue;
    seen.add(r.player_id);
    latest.push({
      handicapId: r.handicap_id,
      playerId: r.player_id,
      "Player Name": playerMap.get(r.player_id)?.player_name ?? "",
      "Handicap": r.handicap,
      "Handicap Date": r.effective_date,
    });
  }
  latest.sort((a, b) => String(a["Player Name"]).localeCompare(String(b["Player Name"])));

  return jsonResponse({ success: true, handicaps: all, latest });
}

async function handleGetTopBreaks(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const seasonParam = url.searchParams.get("season");
  const leagueParam = url.searchParams.get("league");
  const limitParam = url.searchParams.get("limit");

  const limitRaw = limitParam ? parseInt(limitParam, 10) : 50;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 500
    ? limitRaw
    : 50;
  const seasonId = await resolveSeasonId(seasonParam);

  const sql = db();
  // Join breaks → fixtures → players, plus the handicap-as-of helper for
  // each break. We want every break (no >=25 filter at this layer; the
  // page applies its own threshold for display) so the response can show
  // the full CrossGuns "adjusted break" list.
  const rows = await sql<BreakLeaderRow[]>`
    select b.break_id,
           b.fixture_id,
           b.value,
           b.player_id,
           p.player_name,
           f.league_id,
           f.round_label,
           f.stage,
           to_char(f.match_date, 'YYYY-MM-DD') as match_date,
           h.handicap as handicap,
           f.player_a_id,
           f.player_b_id,
           pa.player_name as player_a_name,
           pb.player_name as player_b_name
      from crossguns.breaks b
      join crossguns.fixtures f on f.fixture_id = b.fixture_id
      join crossguns.players  p on p.player_id  = b.player_id
      join crossguns.players  pa on pa.player_id = f.player_a_id
      join crossguns.players  pb on pb.player_id = f.player_b_id
      left join lateral (
        select h2.handicap
        from crossguns.handicaps h2
        where h2.player_id = b.player_id
          and (f.match_date is null or h2.effective_date <= f.match_date)
        order by h2.effective_date desc
        limit 1
      ) h on true
     where f.season_id = ${seasonId}
       and (${leagueParam}::text is null or f.league_id = ${leagueParam})
     order by (b.value + greatest(0, coalesce(h.handicap, 0))) desc,
              b.value desc,
              f.match_date asc nulls last,
              p.player_name asc
     limit ${limit}
  `;

  const breaks = (rows as unknown as BreakLeaderRow[]).map((r) => {
    const opponentName = r.player_id === r.player_a_id
      ? r.player_b_name
      : r.player_a_name;
    const handicap = r.handicap == null ? 0 : Number(r.handicap);
    const value = Number(r.value);
    const handicapBonus = Math.max(0, handicap);
    return {
      breakId: r.break_id,
      playerId: r.player_id,
      fixtureId: r.fixture_id,
      "Player Name": r.player_name,
      "Break": value,
      "Handicap": handicap,
      "Adjusted": value + handicapBonus,
      adjustedValue: value + handicapBonus,
      "League": r.league_id,
      "Stage": r.stage,
      "Round": r.round_label,
      "Match Date": r.match_date ?? "",
      "Opponent": opponentName,
    };
  });

  return jsonResponse({ success: true, season: seasonId, breaks });
}

async function handleGetSeasons(): Promise<Response> {
  const sql = db();
  const rows = await sql<SeasonRow[]>`
    select season_id, name,
           to_char(starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(ends_on, 'YYYY-MM-DD') as ends_on,
           is_current,
           competition_type,
           parent_season_id
      from crossguns.seasons
      order by starts_on desc nulls last, season_id desc
  `;
  return jsonResponse({
    success: true,
    seasons: (rows as unknown as SeasonRow[]).map(mapSeasonRow),
    competitions: (rows as unknown as SeasonRow[]).map(mapSeasonRow),
  });
}

async function handleGetPlayerSeasons(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const playerId = String(url.searchParams.get("playerId") ?? "").trim();
  if (!playerId) return errorResponse("playerId required");

  const sql = db();
  const rows = await sql<{
    season_id: string;
    name: string;
    is_current: boolean;
    competition_type: string;
    parent_season_id: string | null;
  }[]>`
    select season_id, name, is_current, competition_type, parent_season_id
    from (
      select s.season_id, s.name, s.is_current, s.competition_type, s.parent_season_id, s.starts_on
        from crossguns.season_players sp
        join crossguns.seasons s on s.season_id = sp.season_id
       where sp.player_id = ${playerId}
      union
      select s.season_id, s.name, s.is_current, s.competition_type, s.parent_season_id, s.starts_on
        from crossguns.fixtures f
        join crossguns.seasons s on s.season_id = f.season_id
       where f.player_a_id = ${playerId} or f.player_b_id = ${playerId}
    ) combined
    order by starts_on desc nulls last, season_id desc
  `;
  return jsonResponse({
    success: true,
    playerId,
    seasons: rows.map((r) => ({
      seasonId: r.season_id,
      compId: r.season_id,
      name: r.name,
      isCurrent: r.is_current,
      competitionType: r.competition_type,
      parentSeasonId: r.parent_season_id,
      parentCompId: r.parent_season_id,
    })),
    competitions: rows.map((r) => ({
      seasonId: r.season_id,
      compId: r.season_id,
      name: r.name,
      isCurrent: r.is_current,
      competitionType: r.competition_type,
      parentSeasonId: r.parent_season_id,
      parentCompId: r.parent_season_id,
    })),
  });
}

async function handleGetLeaguesPublic(): Promise<Response> {
  const leagues = await loadLeagues();
  return jsonResponse({
    success: true,
    leagues: leagues.map((l) => ({
      leagueId: l.league_id,
      name: l.name,
      displayOrder: l.display_order,
    })),
  });
}


async function ensureKnockoutSeasonGroup(seasonId: string): Promise<void> {
  const sql = db();
  await sql`
    insert into crossguns.season_groups (season_id, league_id, display_order)
    values (${seasonId}, ${KNOCKOUT_GROUP_ID}, 0)
    on conflict (season_id, league_id) do nothing
  `;
}

/** Remove the internal knockout pool group when a season is no longer knockout. */
async function removeKnockoutSeasonGroupIfSafe(seasonId: string): Promise<void> {
  const sql = db();
  const [fx, sp] = await Promise.all([
    sql<{ ok: boolean }[]>`
      select exists(
        select 1 from crossguns.fixtures
         where season_id = ${seasonId} and league_id = ${KNOCKOUT_GROUP_ID}
      ) as ok
    `,
    sql<{ ok: boolean }[]>`
      select exists(
        select 1 from crossguns.season_players
         where season_id = ${seasonId} and league_id = ${KNOCKOUT_GROUP_ID}
      ) as ok
    `,
  ]);
  if (Boolean((fx[0] as { ok: boolean }).ok) || Boolean((sp[0] as { ok: boolean }).ok)) {
    return;
  }
  await sql`
    delete from crossguns.season_groups
     where season_id = ${seasonId} and league_id = ${KNOCKOUT_GROUP_ID}
  `;
}

async function handleGetSeasonGroups(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const seasonId = String(url.searchParams.get("seasonId") ?? "").trim();
  if (!seasonId) return errorResponse("seasonId required");
  const sql = db();
  const seasonRows = await sql<SeasonRow[]>`
    select season_id, name, competition_type, is_current
      from crossguns.seasons
     where season_id = ${seasonId}
  `;
  if (!seasonRows.length) return errorResponse("Season not found", 404);
  const season = seasonRows[0] as unknown as SeasonRow;
  if (season.competition_type === "knockout") {
    await ensureKnockoutSeasonGroup(seasonId);
  }
  const rows = await sql<{
    league_id: string;
    name: string;
    display_order: number;
    player_count: number;
  }[]>`
    select sg.league_id,
           l.name,
           sg.display_order,
           coalesce(pc.cnt, 0)::int as player_count
      from crossguns.season_groups sg
      join crossguns.leagues l on l.league_id = sg.league_id
      left join lateral (
        select count(*)::int as cnt
          from crossguns.season_players sp
         where sp.season_id = sg.season_id
           and sp.league_id = sg.league_id
      ) pc on true
     where sg.season_id = ${seasonId}
       and (
         ${season.competition_type} = 'knockout'
         or sg.league_id <> ${KNOCKOUT_GROUP_ID}
       )
     order by sg.display_order asc, sg.league_id asc
  `;
  return jsonResponse({
    success: true,
    season: {
      seasonId: season.season_id,
      name: season.name,
      competitionType: season.competition_type,
      isCurrent: season.is_current,
    },
    groups: rows.map((r) => ({
      leagueId: r.league_id,
      name: r.name,
      displayOrder: r.display_order,
      playerCount: r.player_count,
    })),
  });
}

async function handleUpsertSeasonGroup(data: Record<string, unknown>): Promise<Response> {
  const remove = Boolean(data.remove);
  const seasonId = String(data.seasonId ?? "").trim();
  const leagueId = String(data.leagueId ?? "").trim();
  if (!seasonId || !leagueId) return errorResponse("seasonId and leagueId required");
  const sql = db();

  if (remove) {
    const [fx, sp] = await Promise.all([
      sql<{ ok: boolean }[]>`
        select exists(
          select 1 from crossguns.fixtures
           where season_id = ${seasonId} and league_id = ${leagueId}
        ) as ok
      `,
      sql<{ ok: boolean }[]>`
        select exists(
          select 1 from crossguns.season_players
           where season_id = ${seasonId} and league_id = ${leagueId}
        ) as ok
      `,
    ]);
    if (Boolean((fx[0] as { ok: boolean }).ok) || Boolean((sp[0] as { ok: boolean }).ok)) {
      return errorResponse(
        "Cannot remove group: players or fixtures still reference it for this season.",
        409,
      );
    }
    await sql`
      delete from crossguns.season_groups
       where season_id = ${seasonId} and league_id = ${leagueId}
    `;
    return jsonResponse({ success: true });
  }

  const name = data.name ? String(data.name).trim() : "";
  const displayOrderRaw = data.displayOrder;
  const displayOrder = displayOrderRaw !== undefined && displayOrderRaw !== ""
    ? Number(displayOrderRaw)
    : 0;
  if (!Number.isFinite(displayOrder)) return errorResponse("displayOrder must be a number");

  if (name) {
    await sql`
      insert into crossguns.leagues (league_id, name, display_order)
      values (${leagueId}, ${name}, ${Math.trunc(displayOrder)})
      on conflict (league_id) do update set
        name = excluded.name,
        display_order = excluded.display_order,
        updated_at = now()
    `;
  }

  await sql`
    insert into crossguns.season_groups (season_id, league_id, display_order)
    values (${seasonId}, ${leagueId}, ${Math.trunc(displayOrder)})
    on conflict (season_id, league_id) do update set
      display_order = excluded.display_order
  `;
  return jsonResponse({ success: true });
}

async function handleGetBreaksForFixture(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const fixtureId = url.searchParams.get("fixtureId")?.trim();
  if (!fixtureId) return errorResponse("fixtureId required");
  const sql = db();
  const rows = await sql<{ break_id: string; player_id: string; value: number }[]>`
    select break_id, player_id, value
      from crossguns.breaks
     where fixture_id = ${fixtureId}::uuid
     order by value desc, break_id asc
  `;
  return jsonResponse({
    success: true,
    fixtureId,
    breaks: rows.map((r) => ({
      breakId: r.break_id,
      playerId: r.player_id,
      value: Number(r.value),
    })),
  });
}

// ---------- Admin auth & POST payloads ------------------------------------

type PostEnvelope = {
  action: string;
  data: Record<string, unknown>;
  adminToken?: string;
};

const ADMIN_TOKEN_TTL_SEC = 24 * 60 * 60;

const ADMIN_POST_ACTIONS = new Set([
  "adminLogin",
  "upsertPlayer",
  "upsertSeasonPlayer",
  "upsertHandicap",
  "upsertSeason",
  "upsertLeague",
  "upsertFixture",
  "updateFixtureResult",
  "upsertBreak",
  "deleteBreak",
  "deleteFixture",
  "deleteHandicap",
  "deletePlayer",
  "deleteSeason",
  "deleteLeague",
  "upsertSeasonGroup",
]);

function getAdminSecret(): string {
  return (Deno.env.get("CROSSGUNS_ADMIN_SECRET") ?? "").trim();
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  return timingSafeEqualBytes(ea, eb);
}

async function signAdminPayload(secret: string, payloadB64: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );
  return base64UrlEncode(new Uint8Array(sig));
}

async function mintAdminToken(): Promise<{ token: string; expiresAt: string }> {
  const secret = getAdminSecret();
  if (!secret) throw new Error("Admin login unavailable");
  const exp = Math.floor(Date.now() / 1000) + ADMIN_TOKEN_TTL_SEC;
  const payload = JSON.stringify({ exp });
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payload));
  const sig = await signAdminPayload(secret, payloadB64);
  return {
    token: `${payloadB64}.${sig}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  const secret = getAdminSecret();
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const payloadB64 = parts[0]!;
  const sigB64 = parts[1]!;
  try {
    const expectedSigB64 = await signAdminPayload(secret, payloadB64);
    const expectedBytes = base64UrlDecode(expectedSigB64);
    const actualBytes = base64UrlDecode(sigB64);
    if (!timingSafeEqualBytes(expectedBytes, actualBytes)) return false;
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson) as { exp?: number };
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp)) return false;
    return exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function parsePostEnvelope(req: Request): Promise<PostEnvelope | null> {
  if (req.method !== "POST") return null;
  const form = await req.formData().catch(() => null);
  const dataStr = form?.get("data");
  if (typeof dataStr !== "string") return null;
  try {
    const parsed = JSON.parse(dataStr) as Record<string, unknown>;
    const action = String(parsed.action ?? "");
    const rawData = parsed.data;
    const data = typeof rawData === "object" && rawData !== null && !Array.isArray(rawData)
      ? rawData as Record<string, unknown>
      : {};
    const adminToken = typeof parsed.adminToken === "string" ? parsed.adminToken : undefined;
    return { action, data, adminToken };
  } catch {
    return null;
  }
}

async function requireAdmin(envelope: PostEnvelope): Promise<Response | null> {
  const raw = envelope.adminToken;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    return unauthorizedResponse(
      "Missing admin token. Unlock Admin Mode from the site menu, then try again.",
    );
  }
  if (await verifyAdminToken(token)) return null;
  return unauthorizedResponse(
    "Invalid or expired admin session. Unlock Admin Mode again from the menu.",
  );
}

async function handleAdminLogin(data: Record<string, unknown>): Promise<Response> {
  const secret = getAdminSecret();
  if (!secret) return errorResponse("Admin login not configured", 503);
  const pin = String(data.pin ?? data.secret ?? "");
  if (!timingSafeEqualStr(pin, secret)) return unauthorizedResponse("Invalid PIN");
  const { token, expiresAt } = await mintAdminToken();
  return jsonResponse({ success: true, token, expiresAt });
}

async function handleUpsertPlayer(data: Record<string, unknown>): Promise<Response> {
  const playerId = String(data.playerId ?? "").trim();
  const playerName = String(data.playerName ?? "").trim();
  if (!playerId || !playerName) return errorResponse("playerId and playerName required");
  const active = data.active === undefined ? true : Boolean(data.active);
  const sql = db();
  await sql`
    insert into crossguns.players (player_id, player_name, active, updated_at)
    values (${playerId}, ${playerName}, ${active}, now())
    on conflict (player_id) do update set
      player_name = excluded.player_name,
      active = excluded.active,
      updated_at = now()
  `;
  return jsonResponse({ success: true });
}

async function handleUpsertSeasonPlayer(data: Record<string, unknown>): Promise<Response> {
  const remove = Boolean(data.remove);
  const seasonId = String(data.seasonId ?? "").trim();
  const playerId = String(data.playerId ?? "").trim();
  if (!seasonId || !playerId) return errorResponse("seasonId and playerId required");
  const sql = db();
  if (remove) {
    await sql`
      delete from crossguns.season_players
      where season_id = ${seasonId} and player_id = ${playerId}
    `;
    return jsonResponse({ success: true });
  }
  const leagueId = String(data.leagueId ?? "").trim();
  if (!leagueId) return errorResponse("leagueId required when not removing");
  const [grp] = await sql<{ ok: boolean }[]>`
    select exists(
      select 1 from crossguns.season_groups
       where season_id = ${seasonId} and league_id = ${leagueId}
    ) as ok
  `;
  if (!Boolean((grp as { ok: boolean }).ok)) {
    return errorResponse("That group is not part of this season. Add the group to the season first.");
  }
  await sql`
    insert into crossguns.season_players (season_id, league_id, player_id, updated_at)
    values (${seasonId}, ${leagueId}, ${playerId}, now())
    on conflict (season_id, player_id) do update set
      league_id = excluded.league_id,
      updated_at = now()
  `;
  return jsonResponse({ success: true });
}

async function handleUpsertHandicap(data: Record<string, unknown>): Promise<Response> {
  const handicapId = data.handicapId ? String(data.handicapId).trim() : "";
  const playerId = String(data.playerId ?? "").trim();
  const handicapVal = Number(data.handicap);
  const effectiveDate = String(data.effectiveDate ?? "").trim();
  if (!effectiveDate) return errorResponse("effectiveDate required");
  if (!Number.isFinite(handicapVal)) return errorResponse("handicap must be a number");
  const hInt = Math.trunc(handicapVal);
  const sql = db();
  if (handicapId) {
    if (!playerId) return errorResponse("playerId required when updating handicap");
    await sql`
      update crossguns.handicaps
      set player_id = ${playerId},
          handicap = ${hInt},
          effective_date = ${effectiveDate},
          updated_at = now()
      where handicap_id = ${handicapId}::uuid
    `;
    return jsonResponse({ success: true });
  }
  if (!playerId) return errorResponse("playerId required");
  await sql`
    insert into crossguns.handicaps (player_id, handicap, effective_date)
    values (${playerId}, ${hInt}, ${effectiveDate})
    on conflict (player_id, effective_date) do update set
      handicap = excluded.handicap,
      updated_at = now()
  `;
  return jsonResponse({ success: true });
}

async function handleUpsertSeason(data: Record<string, unknown>): Promise<Response> {
  const seasonId = String(data.seasonId ?? "").trim();
  const name = String(data.name ?? "").trim();
  if (!seasonId || !name) return errorResponse("seasonId and name required");
  const startsOn = data.startsOn ? String(data.startsOn) : null;
  const endsOn = data.endsOn ? String(data.endsOn) : null;
  const isCurrent = Boolean(data.isCurrent);
  const competitionTypeRaw = String(
    data.competitionType ?? data.competition_type ?? "league",
  ).trim();
  const competitionType = competitionTypeRaw === "knockout" ? "knockout" : "league";
  const parentSeasonId = data.parentSeasonId != null && data.parentSeasonId !== ""
    ? String(data.parentSeasonId).trim()
    : (data.parentCompId != null && data.parentCompId !== ""
      ? String(data.parentCompId).trim()
      : null);

  const sql = db();
  if (competitionType === "knockout" && parentSeasonId) {
    const conflict = await sql<{ season_id: string }[]>`
      select season_id
        from crossguns.seasons
       where parent_season_id = ${parentSeasonId}
         and season_id <> ${seasonId}
       limit 1
    `;
    if ((conflict as unknown as { season_id: string }[]).length) {
      return errorResponse("This league already has a linked knockout comp.");
    }
  }
  await sql`
    insert into crossguns.seasons (season_id, name, starts_on, ends_on, is_current, competition_type, parent_season_id)
    values (${seasonId}, ${name}, ${startsOn}, ${endsOn}, ${isCurrent}, ${competitionType}, ${parentSeasonId})
    on conflict (season_id) do update set
      name = excluded.name,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      is_current = excluded.is_current,
      competition_type = excluded.competition_type,
      parent_season_id = excluded.parent_season_id,
      updated_at = now()
  `;
  if (competitionType === "knockout") {
    await ensureKnockoutSeasonGroup(seasonId);
  } else {
    await removeKnockoutSeasonGroupIfSafe(seasonId);
  }
  return jsonResponse({ success: true });
}

async function handleUpsertLeague(data: Record<string, unknown>): Promise<Response> {
  const leagueId = String(data.leagueId ?? "").trim();
  const name = String(data.name ?? "").trim();
  const displayOrderRaw = data.displayOrder;
  const displayOrder = displayOrderRaw !== undefined && displayOrderRaw !== ""
    ? Number(displayOrderRaw)
    : 0;
  if (!leagueId || !name) return errorResponse("leagueId and name required");
  if (!Number.isFinite(displayOrder)) return errorResponse("displayOrder must be a number");
  const sql = db();
  await sql`
    insert into crossguns.leagues (league_id, name, display_order)
    values (${leagueId}, ${name}, ${Math.trunc(displayOrder)})
    on conflict (league_id) do update set
      name = excluded.name,
      display_order = excluded.display_order,
      updated_at = now()
  `;
  return jsonResponse({ success: true });
}

function parseNullableScore(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

const KO_STAGE_CAPS: Record<string, { max: number; label: string }> = {
  L32: { max: 16, label: "Last 32" },
  L16: { max: 8, label: "Last 16" },
  QF: { max: 4, label: "Quarter-finals" },
  SF: { max: 2, label: "Semi-finals" },
  F: { max: 1, label: "Final" },
};

function parseKnockoutStageMatch(code: string): { stageId: string; matchNum: number } {
  const c = code.trim();
  if (!c) return { stageId: "", matchNum: 0 };

  if (c === "F" || c === "F-P" || c === "F-C" || c === "KO Last 2") {
    return { stageId: "F", matchNum: 1 };
  }

  const l32 = c.match(/^L32-(\d+)$/i);
  if (l32) return { stageId: "L32", matchNum: parseInt(l32[1], 10) };

  const l16 = c.match(/^L16-(\d+)$/i);
  if (l16) return { stageId: "L16", matchNum: parseInt(l16[1], 10) };

  const qf = c.match(/^QF(\d+)$/i);
  if (qf) return { stageId: "QF", matchNum: parseInt(qf[1], 10) };

  const sf = c.match(/^SF(\d+)$/i);
  if (sf) return { stageId: "SF", matchNum: parseInt(sf[1], 10) };

  if (c === "KO Last 8") return { stageId: "QF", matchNum: 1 };
  if (c === "KO Last 4") return { stageId: "SF", matchNum: 1 };
  if (c === "KO Last 16") return { stageId: "L16", matchNum: 1 };

  const koLast = c.match(/^KO Last (\d+)$/i);
  if (koLast) {
    const n = parseInt(koLast[1], 10);
    if (n === 16) return { stageId: "L16", matchNum: 1 };
    if (n === 8) return { stageId: "QF", matchNum: 1 };
    if (n === 4) return { stageId: "SF", matchNum: 1 };
    if (n === 2) return { stageId: "F", matchNum: 1 };
  }

  const po = c.match(/^PO(\d+)$/i);
  if (po) return { stageId: "L32", matchNum: parseInt(po[1], 10) };
  if (/^KO Pre-/i.test(c)) return { stageId: "L32", matchNum: 1 };

  return { stageId: "", matchNum: 0 };
}

function codeForKnockoutStageMatch(stageId: string, matchNum: number): string {
  const stage = stageId.trim();
  const n = Math.trunc(matchNum);
  if (!stage || !Number.isFinite(n) || n < 1) return "";
  if (stage === "F") return "F";
  if (stage === "SF") return `SF${n}`;
  if (stage === "QF") return `QF${n}`;
  if (stage === "L16") return `L16-${n}`;
  if (stage === "L32") return `L32-${n}`;
  return "";
}

async function validateKnockoutFixtureRound(
  sql: ReturnType<typeof postgres>,
  seasonId: string,
  roundLabel: string,
  fixtureId: string,
): Promise<Response | null> {
  const parsed = parseKnockoutStageMatch(roundLabel);
  if (!parsed.stageId) {
    return errorResponse(`Unknown knockout round code: ${roundLabel}`);
  }
  const cap = KO_STAGE_CAPS[parsed.stageId];
  if (!cap) {
    return errorResponse(`Unknown knockout stage: ${parsed.stageId}`);
  }
  if (parsed.matchNum < 1 || parsed.matchNum > cap.max) {
    return errorResponse(`${cap.label} only allows match numbers 1–${cap.max}.`);
  }

  const canonical = codeForKnockoutStageMatch(parsed.stageId, parsed.matchNum);
  if (!canonical || canonical !== roundLabel) {
    return errorResponse(
      `Round code must be ${canonical} for ${cap.label} match ${parsed.matchNum}.`,
    );
  }

  const rows = await sql<{ fixture_id: string; round_label: string }[]>`
    select fixture_id, round_label
      from crossguns.fixtures
     where season_id = ${seasonId}
       and stage = 'knockout'
  `;

  let countInStage = 0;
  for (const r of rows as unknown as { fixture_id: string; round_label: string }[]) {
    if (fixtureId && r.fixture_id === fixtureId) continue;
    if (r.round_label === roundLabel) {
      return errorResponse(`A fixture already exists for ${roundLabel}.`);
    }
    const other = parseKnockoutStageMatch(r.round_label);
    if (other.stageId !== parsed.stageId) continue;
    countInStage++;
    if (other.matchNum === parsed.matchNum) {
      return errorResponse(`${cap.label} match ${parsed.matchNum} is already used.`);
    }
  }

  if (!fixtureId && countInStage >= cap.max) {
    return errorResponse(
      `Maximum ${cap.max} fixture${cap.max === 1 ? "" : "s"} allowed for ${cap.label}.`,
    );
  }

  return null;
}

async function handleUpsertFixture(data: Record<string, unknown>): Promise<Response> {
  const fixtureId = data.fixtureId ? String(data.fixtureId).trim() : "";
  const seasonId = String(data.seasonId ?? "").trim();
  const stage = String(data.stage ?? "").trim();
  const roundLabel = String(data.roundLabel ?? "").trim();
  const playerAId = String(data.playerAId ?? "").trim();
  const playerBId = String(data.playerBId ?? "").trim();
  const leagueIdRaw = data.leagueId;
  const leagueId = leagueIdRaw === undefined || leagueIdRaw === null || leagueIdRaw === ""
    ? null
    : String(leagueIdRaw);
  const matchDate = data.matchDate ? String(data.matchDate) : null;
  const sortOrderRaw = data.sortOrder;
  const sortOrder = sortOrderRaw !== undefined && sortOrderRaw !== ""
    ? Number(sortOrderRaw)
    : 0;

  const scoreA = parseNullableScore(data.scoreA);
  const scoreB = parseNullableScore(data.scoreB);
  const rawScoreA = data.scoreA;
  const rawScoreB = data.scoreB;
  if (rawScoreA !== undefined && rawScoreA !== null && rawScoreA !== "" && scoreA === null) {
    return errorResponse("Invalid scoreA");
  }
  if (rawScoreB !== undefined && rawScoreB !== null && rawScoreB !== "" && scoreB === null) {
    return errorResponse("Invalid scoreB");
  }

  if (!seasonId || !roundLabel || !playerAId || !playerBId) {
    return errorResponse("seasonId, roundLabel, playerAId, playerBId required");
  }
  if (stage !== "league" && stage !== "knockout") {
    return errorResponse("stage must be league or knockout");
  }
  if (stage === "league" && !leagueId) return errorResponse("leagueId required for league stage");
  if (playerAId === playerBId) return errorResponse("Players must be different");
  if (!Number.isFinite(sortOrder)) return errorResponse("sortOrder must be a number");

  const sql = db();
  if (stage === "knockout") {
    const koErr = await validateKnockoutFixtureRound(sql, seasonId, roundLabel, fixtureId);
    if (koErr) return koErr;
  }
  await ensureWinnerOfPlayers(sql, playerAId, playerBId);
  await assertFixturePlayersExist(sql, playerAId, playerBId);
  const sa = scoreA === null ? null : Math.trunc(scoreA);
  const sb = scoreB === null ? null : Math.trunc(scoreB);
  const so = Math.trunc(sortOrder);

  if (fixtureId) {
    await sql`
      update crossguns.fixtures set
        season_id = ${seasonId},
        league_id = ${leagueId},
        stage = ${stage},
        round_label = ${roundLabel},
        player_a_id = ${playerAId},
        player_b_id = ${playerBId},
        match_date = ${matchDate},
        score_a = ${sa},
        score_b = ${sb},
        sort_order = ${so},
        updated_at = now()
      where fixture_id = ${fixtureId}::uuid
    `;
    return jsonResponse({ success: true });
  }

  await sql`
    insert into crossguns.fixtures (
      season_id, league_id, stage, round_label,
      player_a_id, player_b_id, match_date, score_a, score_b, sort_order
    ) values (
      ${seasonId}, ${leagueId}, ${stage}, ${roundLabel},
      ${playerAId}, ${playerBId}, ${matchDate}, ${sa}, ${sb}, ${so}
    )
  `;
  return jsonResponse({ success: true });
}

async function handleUpdateFixtureResult(data: Record<string, unknown>): Promise<Response> {
  const fixtureId = String(data.fixtureId ?? "").trim();
  if (!fixtureId) return errorResponse("fixtureId required");
  const scoreA = parseNullableScore(data.scoreA);
  const scoreB = parseNullableScore(data.scoreB);
  const rawA = data.scoreA;
  const rawB = data.scoreB;
  if (rawA !== undefined && rawA !== null && rawA !== "" && scoreA === null) {
    return errorResponse("Invalid scoreA");
  }
  if (rawB !== undefined && rawB !== null && rawB !== "" && scoreB === null) {
    return errorResponse("Invalid scoreB");
  }
  const hasMatchDate = Object.prototype.hasOwnProperty.call(data, "matchDate");
  let matchDateVal: string | null | undefined;
  if (hasMatchDate) {
    const md = data.matchDate;
    if (md === null || md === "") matchDateVal = null;
    else matchDateVal = String(md).trim();
  }

  const sql = db();
  if (hasMatchDate) {
    await sql`
      update crossguns.fixtures
      set score_a = ${scoreA === null ? null : Math.trunc(scoreA)},
          score_b = ${scoreB === null ? null : Math.trunc(scoreB)},
          match_date = ${matchDateVal},
          updated_at = now()
      where fixture_id = ${fixtureId}::uuid
    `;
  } else {
    await sql`
      update crossguns.fixtures
      set score_a = ${scoreA === null ? null : Math.trunc(scoreA)},
          score_b = ${scoreB === null ? null : Math.trunc(scoreB)},
          updated_at = now()
      where fixture_id = ${fixtureId}::uuid
    `;
  }
  return jsonResponse({ success: true });
}

async function handleUpsertBreak(data: Record<string, unknown>): Promise<Response> {
  const breakId = data.breakId ? String(data.breakId).trim() : "";
  const fixtureId = String(data.fixtureId ?? "").trim();
  const playerId = String(data.playerId ?? "").trim();
  const value = Number(data.value);
  if (!fixtureId || !playerId) return errorResponse("fixtureId and playerId required");
  if (!Number.isFinite(value)) return errorResponse("value must be a number");
  const vInt = Math.trunc(value);
  if (vInt < 1 || vInt > 155) return errorResponse("value must be 1..155");
  const sql = db();
  if (breakId) {
    await sql`
      update crossguns.breaks
      set fixture_id = ${fixtureId}::uuid,
          player_id = ${playerId},
          value = ${vInt},
          updated_at = now()
      where break_id = ${breakId}::uuid
    `;
  } else {
    await sql`
      insert into crossguns.breaks (fixture_id, player_id, value)
      values (${fixtureId}::uuid, ${playerId}, ${vInt})
    `;
  }
  return jsonResponse({ success: true });
}

async function handleDeleteBreak(data: Record<string, unknown>): Promise<Response> {
  const breakId = String(data.breakId ?? "").trim();
  if (!breakId) return errorResponse("breakId required");
  const sql = db();
  await sql`delete from crossguns.breaks where break_id = ${breakId}::uuid`;
  return jsonResponse({ success: true });
}

async function handleDeleteFixture(data: Record<string, unknown>): Promise<Response> {
  const fixtureId = String(data.fixtureId ?? "").trim();
  if (!fixtureId) return errorResponse("fixtureId required");
  const sql = db();
  await sql`delete from crossguns.fixtures where fixture_id = ${fixtureId}::uuid`;
  return jsonResponse({ success: true });
}

async function handleDeleteHandicap(data: Record<string, unknown>): Promise<Response> {
  const handicapId = String(data.handicapId ?? "").trim();
  if (!handicapId) return errorResponse("handicapId required");
  const sql = db();
  await sql`delete from crossguns.handicaps where handicap_id = ${handicapId}::uuid`;
  return jsonResponse({ success: true });
}

async function handleDeletePlayer(data: Record<string, unknown>): Promise<Response> {
  const playerId = String(data.playerId ?? "").trim();
  if (!playerId) return errorResponse("playerId required");
  const sql = db();
  const [fx, br] = await Promise.all([
    sql<{ ok: boolean }[]>`
      select exists(
        select 1 from crossguns.fixtures
        where player_a_id = ${playerId} or player_b_id = ${playerId}
      ) as ok
    `,
    sql<{ ok: boolean }[]>`
      select exists(
        select 1 from crossguns.breaks where player_id = ${playerId}
      ) as ok
    `,
  ]);
  const inFixtures = Boolean((fx[0] as { ok: boolean }).ok);
  const inBreaks = Boolean((br[0] as { ok: boolean }).ok);
  if (inFixtures || inBreaks) {
    return errorResponse(
      "Cannot delete player: still referenced by fixtures or breaks. Remove or reassign those first.",
      409,
    );
  }
  await sql`delete from crossguns.players where player_id = ${playerId}`;
  return jsonResponse({ success: true });
}

async function handleDeleteSeason(data: Record<string, unknown>): Promise<Response> {
  const seasonId = String(data.seasonId ?? "").trim();
  if (!seasonId) return errorResponse("seasonId required");
  const sql = db();
  const [fx, sp] = await Promise.all([
    sql<{ ok: boolean }[]>`
      select exists(
        select 1 from crossguns.fixtures where season_id = ${seasonId}
      ) as ok
    `,
    sql<{ ok: boolean }[]>`
      select exists(
        select 1 from crossguns.season_players where season_id = ${seasonId}
      ) as ok
    `,
  ]);
  if (Boolean((fx[0] as { ok: boolean }).ok)) {
    return errorResponse(
      "Cannot delete season: fixtures still exist for this season. Delete or move those fixtures first.",
      409,
    );
  }
  if (Boolean((sp[0] as { ok: boolean }).ok)) {
    return errorResponse(
      "Cannot delete season: players are still on the roster. Remove roster entries first.",
      409,
    );
  }
  await sql`delete from crossguns.seasons where season_id = ${seasonId}`;
  return jsonResponse({ success: true });
}

async function handleDeleteLeague(data: Record<string, unknown>): Promise<Response> {
  const leagueId = String(data.leagueId ?? "").trim();
  if (!leagueId) return errorResponse("leagueId required");
  const sql = db();
  const [fx, sp] = await Promise.all([
    sql<{ ok: boolean }[]>`
      select exists(
        select 1 from crossguns.fixtures where league_id = ${leagueId}
      ) as ok
    `,
    sql<{ ok: boolean }[]>`
      select exists(
        select 1 from crossguns.season_players where league_id = ${leagueId}
      ) as ok
    `,
  ]);
  const inFixtures = Boolean((fx[0] as { ok: boolean }).ok);
  const inRoster = Boolean((sp[0] as { ok: boolean }).ok);
  if (inFixtures || inRoster) {
    return errorResponse(
      "Cannot delete league: still referenced by fixtures or season_players. Reassign or remove those rows first.",
      409,
    );
  }
  await sql`delete from crossguns.leagues where league_id = ${leagueId}`;
  return jsonResponse({ success: true });
}

async function dispatchPost(envelope: PostEnvelope): Promise<Response> {
  if (!ADMIN_POST_ACTIONS.has(envelope.action)) {
    return errorResponse(`Unknown action: ${envelope.action}`, 400);
  }
  if (envelope.action !== "adminLogin") {
    const denied = await requireAdmin(envelope);
    if (denied) return denied;
  }
  switch (envelope.action) {
    case "adminLogin":         return handleAdminLogin(envelope.data);
    case "upsertPlayer":       return handleUpsertPlayer(envelope.data);
    case "upsertSeasonPlayer": return handleUpsertSeasonPlayer(envelope.data);
    case "upsertHandicap":     return handleUpsertHandicap(envelope.data);
    case "upsertSeason":       return handleUpsertSeason(envelope.data);
    case "upsertLeague":       return handleUpsertLeague(envelope.data);
    case "upsertFixture":      return handleUpsertFixture(envelope.data);
    case "updateFixtureResult":return handleUpdateFixtureResult(envelope.data);
    case "upsertBreak":        return handleUpsertBreak(envelope.data);
    case "deleteBreak":        return handleDeleteBreak(envelope.data);
    case "deleteFixture":      return handleDeleteFixture(envelope.data);
    case "deleteHandicap":     return handleDeleteHandicap(envelope.data);
    case "deletePlayer":       return handleDeletePlayer(envelope.data);
    case "deleteSeason":       return handleDeleteSeason(envelope.data);
    case "deleteLeague":       return handleDeleteLeague(envelope.data);
    case "upsertSeasonGroup":  return handleUpsertSeasonGroup(envelope.data);
    default: return errorResponse(`Unknown action: ${envelope.action}`, 400);
  }
}

// ---------- Server ---------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let action = "";
  try {
    if (req.method === "POST") {
      const env = await parsePostEnvelope(req);
      if (!env?.action) return errorResponse("Missing required parameter: action");
      action = env.action;
      return await dispatchPost(env);
    }

    const url = new URL(req.url);
    action = url.searchParams.get("action") ?? "";
    if (!action) return errorResponse("Missing required parameter: action");

    switch (action) {
      case "getFixtures":         return await handleGetFixtures(req);
      case "getStandings":        return await handleGetStandings(req);
      case "getHandicaps":        return await handleGetHandicaps();
      case "getPlayers":          return await handleGetPlayers(req);
      case "getTopBreaks":        return await handleGetTopBreaks(req);
      case "getSeasons":          return await handleGetSeasons();
      case "getPlayerSeasons":    return await handleGetPlayerSeasons(req);
      case "getSeasonGroups":     return await handleGetSeasonGroups(req);
      case "getLeagues":          return await handleGetLeaguesPublic();
      case "getBreaksForFixture": return await handleGetBreaksForFixture(req);
      default: return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`crossguns-api error (action=${action}):`, message);
    return errorResponse(message, 500);
  }
});
