-- Migrate legacy knockout round_label values to standard codes (L32-N, L16-N, QF/SF/F).
-- Also updates wo:* synthetic player IDs to match new round codes.

begin;

create temp table _ko_round_map (
  fixture_id uuid primary key,
  old_label text not null,
  new_label text not null
) on commit drop;

insert into _ko_round_map (fixture_id, old_label, new_label)
select f.fixture_id, f.round_label, f.round_label
from crossguns.fixtures f
where f.stage = 'knockout'
  and (
    f.round_label ~ '^L32-[0-9]+$'
    or f.round_label ~ '^L16-[0-9]+$'
    or f.round_label ~ '^QF[1-4]$'
    or f.round_label ~ '^SF[1-2]$'
    or f.round_label in ('F', 'F-P', 'F-C')
  );

insert into _ko_round_map (fixture_id, old_label, new_label)
select f.fixture_id, f.round_label,
  case f.round_label
    when 'KO Last 2' then 'F'
    when 'PF' then 'F-P'
    when 'CF' then 'F-C'
    else f.round_label
  end
from crossguns.fixtures f
where f.stage = 'knockout'
  and f.round_label in ('KO Last 2', 'PF', 'CF')
  and not exists (select 1 from _ko_round_map m where m.fixture_id = f.fixture_id);

insert into _ko_round_map (fixture_id, old_label, new_label)
select
  f.fixture_id,
  f.round_label,
  case g.old_label
    when 'KO Last 4' then 'SF' || g.rn::text
    when 'KO Last 8' then 'QF' || g.rn::text
    when 'KO Last 16' then 'L16-' || g.rn::text
    when 'KO Last 32' then 'L32-' || g.rn::text
    when 'PQ' then 'QF' || g.rn::text
    when 'PS' then 'SF' || g.rn::text
    when 'CS' then 'SF' || g.rn::text
    when 'PO1' then 'L32-1'
    when 'PO2' then 'L32-2'
    when 'PO3' then 'L32-3'
    when 'PO4' then 'L32-4'
    else
      case
        when g.old_label ~ '^KO Pre-' then 'L32-' || g.rn::text
        else g.old_label || '-' || g.rn::text
      end
  end
from crossguns.fixtures f
join (
  select
    fixture_id,
    round_label as old_label,
    row_number() over (
      partition by season_id, round_label
      order by sort_order asc nulls last, fixture_id
    ) as rn
  from crossguns.fixtures
  where stage = 'knockout'
    and (
      round_label in ('KO Last 4', 'KO Last 8', 'KO Last 16', 'KO Last 32', 'PQ', 'PS', 'CS')
      or round_label ~ '^KO Pre-'
    )
) g on g.fixture_id = f.fixture_id
where not exists (select 1 from _ko_round_map m where m.fixture_id = f.fixture_id);

insert into _ko_round_map (fixture_id, old_label, new_label)
select f.fixture_id, f.round_label, f.round_label
from crossguns.fixtures f
where f.stage = 'knockout'
  and not exists (select 1 from _ko_round_map m where m.fixture_id = f.fixture_id);

update crossguns.fixtures f
set
  round_label = m.new_label,
  sort_order = 10000 + case
    when m.new_label ~ '^L32-([0-9]+)$' then 100 + substring(m.new_label from 'L32-([0-9]+)')::int
    when m.new_label ~ '^L16-([0-9]+)$' then 200 + substring(m.new_label from 'L16-([0-9]+)')::int
    when m.new_label ~ '^QF([0-9]+)$' then 300 + substring(m.new_label from 'QF([0-9]+)')::int
    when m.new_label ~ '^SF([0-9]+)$' then 400 + substring(m.new_label from 'SF([0-9]+)')::int
    when m.new_label = 'F' then 501
    when m.new_label = 'F-P' then 502
    when m.new_label = 'F-C' then 503
    else f.sort_order
  end
from _ko_round_map m
where f.fixture_id = m.fixture_id
  and f.round_label is distinct from m.new_label;

update crossguns.players p
set
  player_id = 'wo:' || m.new_label,
  player_name = m.new_label || ' Winner'
from (
  select distinct old_label, new_label
  from _ko_round_map
  where old_label is distinct from new_label
) m
where p.player_id = 'wo:' || m.old_label;

commit;
