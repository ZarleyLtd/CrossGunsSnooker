-- Result slip images attached to fixture results (Enter Result dialog).
alter table crossguns.fixtures
  add column if not exists result_slip_path text,
  add column if not exists result_slip_mime text;

comment on column crossguns.fixtures.result_slip_path is
  'Storage object path in bucket crossguns-result-slips (committed slip only).';
comment on column crossguns.fixtures.result_slip_mime is
  'MIME type of the committed result slip image (typically image/jpeg).';
