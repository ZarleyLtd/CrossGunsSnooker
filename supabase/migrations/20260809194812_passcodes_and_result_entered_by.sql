-- Passcodes for score entry + fixture result attribution

create table if not exists crossguns.passcodes (
  passcode_id text primary key,
  passcode_name text not null,
  passcode_code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passcodes_name_unique unique (passcode_name)
);

create unique index if not exists passcodes_code_lower_trim_uidx
  on crossguns.passcodes (lower(trim(passcode_code)));

alter table crossguns.fixtures
  add column if not exists result_entered_by text;

comment on column crossguns.fixtures.result_entered_by is
  'Passcode name or Admin — who last entered/updated the score via score entry';
