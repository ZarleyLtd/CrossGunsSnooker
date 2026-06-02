-- Linked knockout stages: child season references parent league season.

begin;

alter table crossguns.seasons
  add column if not exists parent_season_id text null;

alter table crossguns.seasons
  drop constraint if exists seasons_parent_fk;

alter table crossguns.seasons
  add constraint seasons_parent_fk
    foreign key (parent_season_id)
    references crossguns.seasons (season_id)
    on delete set null;

-- Link existing Winter25 knockout to Spring league season.
update crossguns.seasons
   set parent_season_id = 'spring-26',
       updated_at = now()
 where season_id = 'winter25-knockout'
   and parent_season_id is null;

commit;
