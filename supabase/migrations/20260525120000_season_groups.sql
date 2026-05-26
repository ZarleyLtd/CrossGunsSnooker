-- Season-specific groups (maps to crossguns.leagues rows).
-- League seasons: multiple groups; knockout seasons: single "ko" pool group.

begin;

insert into crossguns.leagues (league_id, name, display_order) values
  ('ko', 'Knockout', 0)
on conflict (league_id) do nothing;

create table if not exists crossguns.season_groups (
  season_id text not null references crossguns.seasons (season_id) on delete cascade,
  league_id text not null references crossguns.leagues (league_id) on update cascade on delete cascade,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (season_id, league_id)
);

create index if not exists idx_season_groups_season
  on crossguns.season_groups (season_id, display_order);

alter table crossguns.season_groups enable row level security;

-- Backfill groups from existing rosters
insert into crossguns.season_groups (season_id, league_id, display_order)
select distinct sp.season_id, sp.league_id, coalesce(l.display_order, 0)
  from crossguns.season_players sp
  join crossguns.leagues l on l.league_id = sp.league_id
on conflict (season_id, league_id) do nothing;

-- Knockout seasons without a group row get the shared ko pool
insert into crossguns.season_groups (season_id, league_id, display_order)
select s.season_id, 'ko', 0
  from crossguns.seasons s
 where coalesce(s.competition_type, 'league') = 'knockout'
on conflict (season_id, league_id) do nothing;

commit;
