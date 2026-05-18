-- CrossGuns scoring rule: 1 point per FRAME won, not 2 points per match.
-- The original migration mistakenly mirrored the ierne-snooker rule
-- (wins*2). This recreates the affected views in line with the legacy
-- Publii standings sheet, which is the source of truth.

create or replace view crossguns.league_standings_v as
  select r.season_id,
         r.league_id,
         r.player_id,
         count(*) as played,
         count(*) filter (where r.frames_for > r.frames_against) as won,
         count(*) filter (where r.frames_for < r.frames_against) as lost,
         count(*) filter (where r.frames_for = r.frames_against) as drawn,
         coalesce(sum(r.frames_for), 0) - coalesce(sum(r.frames_against), 0) as frame_diff,
         coalesce(sum(r.frames_for), 0) as points
    from crossguns.fixture_results_v r
   group by r.season_id, r.league_id, r.player_id;

create or replace view crossguns.head_to_head_v as
  select r.season_id,
         r.league_id,
         r.player_id,
         r.opponent_id,
         count(*) as played,
         count(*) filter (where r.frames_for > r.frames_against) as h2h_wins,
         count(*) filter (where r.frames_for < r.frames_against) as h2h_losses,
         coalesce(sum(r.frames_for), 0) - coalesce(sum(r.frames_against), 0) as h2h_frame_diff,
         coalesce(sum(r.frames_for), 0) as h2h_points
    from crossguns.fixture_results_v r
   group by r.season_id, r.league_id, r.player_id, r.opponent_id;
