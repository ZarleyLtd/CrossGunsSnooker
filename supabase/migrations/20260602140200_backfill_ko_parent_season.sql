-- Link knockout child seasons created as {parent}-ko when parent_season_id was not set.

begin;

update crossguns.seasons ko
   set parent_season_id = sub.parent_id,
       updated_at = now()
  from (
    select ko.season_id,
           regexp_replace(ko.season_id, '-ko$', '') as parent_id
      from crossguns.seasons ko
     where ko.competition_type = 'knockout'
       and ko.parent_season_id is null
       and ko.season_id ~ '-ko$'
  ) sub
  join crossguns.seasons p on p.season_id = sub.parent_id
 where ko.season_id = sub.season_id;

commit;
