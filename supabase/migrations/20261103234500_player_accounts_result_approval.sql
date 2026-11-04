-- Player accounts (replacing passcodes), 24-hour result window, and result approval.

create table if not exists crossguns.accounts (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  password_hash text not null,
  player_id text not null,
  invite_id uuid null,
  is_admin boolean not null default false,
  is_approver boolean not null default false,
  disabled_at timestamptz null,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_handle_unique unique (handle),
  constraint accounts_player_unique unique (player_id),
  constraint accounts_handle_format check (handle ~ '^[a-z0-9]{3,20}$'),
  constraint accounts_player_fk foreign key (player_id)
    references crossguns.players (player_id) on update cascade on delete cascade
);

create table if not exists crossguns.invites (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('register', 'reset')),
  code_hash text not null unique,
  label text null,
  account_id uuid null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint invites_account_fk foreign key (account_id)
    references crossguns.accounts (id) on delete cascade
);

alter table crossguns.accounts
  drop constraint if exists accounts_invite_fk;

alter table crossguns.accounts
  add constraint accounts_invite_fk
  foreign key (invite_id)
  references crossguns.invites (id)
  on delete set null;

create table if not exists crossguns.sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint sessions_account_fk foreign key (account_id)
    references crossguns.accounts (id) on delete cascade
);

create index if not exists idx_invites_pending
  on crossguns.invites (expires_at)
  where used_at is null;

create index if not exists idx_sessions_account
  on crossguns.sessions (account_id);

alter table crossguns.fixtures
  add column if not exists result_posted_at timestamptz null;

alter table crossguns.fixtures
  add column if not exists result_approved boolean not null default true;

alter table crossguns.fixtures
  add column if not exists result_approved_by text;

alter table crossguns.fixtures
  add column if not exists result_approved_at timestamptz;

comment on column crossguns.fixtures.result_posted_at is
  'When a score was first posted. Players may edit their own match for 24 hours after this.';
comment on column crossguns.fixtures.result_approved is
  'False when a player reported the score and an admin/approver has not approved it yet.';
comment on column crossguns.fixtures.result_approved_by is
  'Name of the admin or approver who approved a player-entered result.';
comment on column crossguns.fixtures.result_approved_at is
  'When an admin or approver approved a player-entered result.';
comment on column crossguns.accounts.is_approver is
  'True when the account may approve any match score and cannot use other admin tools.';

update crossguns.fixtures
set result_posted_at = now() - interval '25 hours'
where score_a is not null
  and score_b is not null
  and result_posted_at is null;

alter table crossguns.accounts enable row level security;
alter table crossguns.invites enable row level security;
alter table crossguns.sessions enable row level security;

drop table if exists crossguns.passcodes;
