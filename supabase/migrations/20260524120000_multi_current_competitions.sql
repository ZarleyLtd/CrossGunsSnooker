-- Allow multiple concurrent "current" competitions (e.g. league + knockout).
-- Adds competition_type to seasons and moves legacy knockout fixtures to
-- a dedicated Winter25 Knockout season.

begin;

-- Drop the single-current constraint so several seasons can be active at once.
drop index if exists crossguns.seasons_only_one_current;

alter table crossguns.seasons
  add column if not exists competition_type text not null default 'league'
  check (competition_type in ('league', 'knockout'));

-- Ensure the running league season is typed correctly.
update crossguns.seasons
   set competition_type = 'league'
 where season_id = 'spring-26';

-- Create the Winter25 Knockout competition (current alongside the league).
insert into crossguns.seasons (season_id, name, starts_on, ends_on, is_current, competition_type)
values ('winter25-knockout', 'Winter 25 K/O', '2025-11-01', '2026-02-28', true, 'knockout')
on conflict (season_id) do update set
  name = excluded.name,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  is_current = excluded.is_current,
  competition_type = excluded.competition_type,
  updated_at = now();

-- Re-home knockout fixtures that were stored under the league season.
update crossguns.fixtures
   set season_id = 'winter25-knockout',
       updated_at = now()
 where season_id = 'spring-26'
   and stage = 'knockout';

commit;
