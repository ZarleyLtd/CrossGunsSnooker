-- CrossGuns Snooker League: initial schema
--
-- Creates the `crossguns` schema with leagues, seasons, season_players,
-- players, fixtures, handicaps, and breaks. Browsers never talk to these
-- tables directly: access goes through the `crossguns-api` Edge Function
-- (direct Postgres connection from inside the function). The schema is
-- not added to the project's Exposed Schemas list, so anon clients cannot
-- query it via PostgREST.
--
-- Three leagues seeded (id=1,2,3 displayed as Group 1/2/3), one current
-- season seeded (Spring League 2026).
--
-- Views:
--   fixture_results_v    -- one row per (fixture, player) for completed league play
--   league_standings_v   -- aggregated P/W/L/D/+-/Pts per (season, league, player)
--   head_to_head_v       -- record between every ordered pair (used for tiebreaks)
--   handicap_as_of_v     -- latest handicap for each (player, date) pair
--   max_adjusted_break_v -- per (season, league, player), max of break+handicap
--                          where the player's break >= 25 (used for the Crossguns
--                          adjusted-break tiebreaker)

begin;

create schema if not exists crossguns;

-- 1) Reference tables ------------------------------------------------------

create table if not exists crossguns.leagues (
  league_id text primary key,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crossguns.seasons (
  season_id text primary key,
  name text not null,
  starts_on date null,
  ends_on date null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one season can be the current one.
create unique index if not exists seasons_only_one_current
  on crossguns.seasons (is_current) where is_current;

-- 2) Players ---------------------------------------------------------------

create table if not exists crossguns.players (
  player_id text primary key,
  player_name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crossguns.season_players (
  season_id text not null references crossguns.seasons (season_id) on delete cascade,
  league_id text not null references crossguns.leagues (league_id) on update cascade,
  player_id text not null references crossguns.players (player_id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id),
  unique (season_id, league_id, player_id)
);

create index if not exists idx_season_players_league
  on crossguns.season_players (season_id, league_id);

-- 3) Fixtures --------------------------------------------------------------

create table if not exists crossguns.fixtures (
  fixture_id uuid primary key default gen_random_uuid(),
  season_id text not null references crossguns.seasons (season_id) on update cascade,
  league_id text null references crossguns.leagues (league_id) on update cascade,
  stage text not null default 'league' check (stage in ('league','knockout')),
  round_label text not null,
  player_a_id text not null references crossguns.players (player_id) on update cascade,
  player_b_id text not null references crossguns.players (player_id) on update cascade,
  match_date date null,
  score_a integer null,
  score_b integer null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixtures_unique_pairing
    unique (season_id, stage, round_label, player_a_id, player_b_id),
  constraint fixtures_league_required_when_league_stage
    check (stage = 'knockout' or league_id is not null),
  constraint fixtures_players_distinct check (player_a_id <> player_b_id)
);

create index if not exists idx_fixtures_season on crossguns.fixtures (season_id);
create index if not exists idx_fixtures_season_league on crossguns.fixtures (season_id, league_id);
create index if not exists idx_fixtures_round on crossguns.fixtures (season_id, round_label);
create index if not exists idx_fixtures_sort on crossguns.fixtures (sort_order);
create index if not exists idx_fixtures_players on crossguns.fixtures (player_a_id, player_b_id);

-- 4) Handicaps -------------------------------------------------------------

create table if not exists crossguns.handicaps (
  handicap_id uuid primary key default gen_random_uuid(),
  player_id text not null references crossguns.players (player_id) on update cascade on delete cascade,
  handicap integer not null,
  effective_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint handicaps_unique_player_date unique (player_id, effective_date)
);

create index if not exists idx_handicaps_player_date
  on crossguns.handicaps (player_id, effective_date desc);

-- 5) Breaks ----------------------------------------------------------------

create table if not exists crossguns.breaks (
  break_id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references crossguns.fixtures (fixture_id) on delete cascade,
  player_id text not null references crossguns.players (player_id) on update cascade,
  value integer not null check (value > 0 and value <= 155),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_breaks_fixture on crossguns.breaks (fixture_id);
create index if not exists idx_breaks_value on crossguns.breaks (value desc);
create index if not exists idx_breaks_player on crossguns.breaks (player_id);

-- 6) Row Level Security ----------------------------------------------------
-- RLS on with no policies = anon/authenticated denied; service role bypasses
-- RLS, so only the Edge Function (and direct admin tooling) can read/write.

alter table crossguns.leagues enable row level security;
alter table crossguns.seasons enable row level security;
alter table crossguns.players enable row level security;
alter table crossguns.season_players enable row level security;
alter table crossguns.fixtures enable row level security;
alter table crossguns.handicaps enable row level security;
alter table crossguns.breaks enable row level security;

-- 7) Seed data -------------------------------------------------------------

insert into crossguns.leagues (league_id, name, display_order) values
  ('1', 'Group 1', 1),
  ('2', 'Group 2', 2),
  ('3', 'Group 3', 3)
on conflict (league_id) do nothing;

insert into crossguns.seasons (season_id, name, starts_on, ends_on, is_current) values
  ('spring-26', 'Spring League 2026', '2026-01-01', '2026-06-30', true)
on conflict (season_id) do nothing;

-- 8) Views -----------------------------------------------------------------

-- One row per (fixture, player) for league fixtures with a recorded score.
-- Walkovers are recorded as 2-0; double-walkovers as 0-0 (zero points to both).
create or replace view crossguns.fixture_results_v as
  select f.season_id,
         f.league_id,
         f.fixture_id,
         f.player_a_id as player_id,
         f.player_b_id as opponent_id,
         f.match_date,
         f.score_a as frames_for,
         f.score_b as frames_against
    from crossguns.fixtures f
   where f.stage = 'league'
     and f.score_a is not null
     and f.score_b is not null
  union all
  select f.season_id,
         f.league_id,
         f.fixture_id,
         f.player_b_id,
         f.player_a_id,
         f.match_date,
         f.score_b,
         f.score_a
    from crossguns.fixtures f
   where f.stage = 'league'
     and f.score_a is not null
     and f.score_b is not null;

-- Standings derived from fixture_results_v.
-- Win = 2 pts, draw = 0 pts (double-walkover 0-0 awards zero to both),
-- loss = 0 pts.
create or replace view crossguns.league_standings_v as
  select r.season_id,
         r.league_id,
         r.player_id,
         count(*) as played,
         count(*) filter (where r.frames_for > r.frames_against) as won,
         count(*) filter (where r.frames_for < r.frames_against) as lost,
         count(*) filter (where r.frames_for = r.frames_against) as drawn,
         coalesce(sum(r.frames_for), 0) - coalesce(sum(r.frames_against), 0) as frame_diff,
         count(*) filter (where r.frames_for > r.frames_against) * 2 as points
    from crossguns.fixture_results_v r
   group by r.season_id, r.league_id, r.player_id;

-- Per-pair head-to-head record (used for the Crossguns H2H tiebreak).
create or replace view crossguns.head_to_head_v as
  select r.season_id,
         r.league_id,
         r.player_id,
         r.opponent_id,
         count(*) as played,
         count(*) filter (where r.frames_for > r.frames_against) as h2h_wins,
         count(*) filter (where r.frames_for < r.frames_against) as h2h_losses,
         coalesce(sum(r.frames_for), 0) - coalesce(sum(r.frames_against), 0) as h2h_frame_diff,
         count(*) filter (where r.frames_for > r.frames_against) * 2 as h2h_points
    from crossguns.fixture_results_v r
   group by r.season_id, r.league_id, r.player_id, r.opponent_id;

-- Adjusted max break per (season, league, player), used as the final
-- Crossguns tiebreaker. A break counts only if value >= 25 (per the
-- legacy Crossguns rule); the value is the raw break plus the player's
-- handicap as-of the fixture's match_date.
--
-- handicap_as_of: the handicap row with the latest effective_date that
-- is <= match_date for that player. Falls back to 0 if there is no row
-- on or before the match date.
create or replace view crossguns.max_adjusted_break_v as
  select
    f.season_id,
    f.league_id,
    b.player_id,
    max(b.value + coalesce(h.handicap, 0)) as max_adjusted
  from crossguns.breaks b
  join crossguns.fixtures f on f.fixture_id = b.fixture_id
  left join lateral (
    select h2.handicap
    from crossguns.handicaps h2
    where h2.player_id = b.player_id
      and (f.match_date is null or h2.effective_date <= f.match_date)
    order by h2.effective_date desc
    limit 1
  ) h on true
  where f.stage = 'league'
    and b.value >= 25
  group by f.season_id, f.league_id, b.player_id;

commit;
