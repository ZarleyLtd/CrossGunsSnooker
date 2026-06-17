-- Per-fixture match length (best of N frames; odd values 1–9).

alter table crossguns.fixtures
  add column if not exists best_of smallint not null default 3;

alter table crossguns.fixtures
  drop constraint if exists fixtures_best_of_odd_range;

alter table crossguns.fixtures
  add constraint fixtures_best_of_odd_range
    check (best_of >= 1 and best_of <= 9 and best_of % 2 = 1);
