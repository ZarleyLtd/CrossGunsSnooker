-- Floor handicaps at 0 when computing the adjusted-break tiebreaker, to
-- match the legacy CrossGuns Publii site (Math.max(0, handicap)). A
-- negative handicap can't reduce a break value.

create or replace view crossguns.max_adjusted_break_v as
  select
    f.season_id,
    f.league_id,
    b.player_id,
    max(b.value + greatest(0, coalesce(h.handicap, 0))) as max_adjusted
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
