// Player accounts: one-time invite codes, handle + password, sessions.
// Passwords: bcrypt (bcryptjs, cost 10). Invite codes and session tokens: SHA-256 hex.

import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const BCRYPT_COST = 10;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const HANDLE_RE = /^[a-z0-9]{3,20}$/;
const RESULT_WINDOW_MS = 24 * 60 * 60 * 1000;

// postgres.js client or transaction. Kept loose so this module can take either.
// deno-lint-ignore no-explicit-any
type Sql = any;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type RateBucket = { n: number; reset: number };
const rateBuckets = new Map<string, RateBucket>();

export type PublicAccount = {
  id: string;
  handle: string;
  playerId: string;
  playerName: string;
  isAdmin: boolean;
  isApprover: boolean;
};

export type PlayerActor = {
  accountId: string;
  playerId: string;
  handle: string;
  isAdmin: boolean;
  isApprover: boolean;
};

function randomCode(len = 8) {
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return s;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function normCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function normHandle(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hashPassword(password: string) {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

function checkPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0]!.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

function rateOk(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.reset) {
    rateBuckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.n >= max) return false;
  bucket.n += 1;
  return true;
}

function validateHandle(handle: string) {
  if (!HANDLE_RE.test(handle)) {
    return "Handle must be 3 to 20 letters or digits, with no spaces.";
  }
  return "";
}

function validatePassword(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 72) return "Password must be at most 72 characters.";
  return "";
}

function isUniqueViolation(err: unknown) {
  return !!err && typeof err === "object" && (err as { code?: string }).code === "23505";
}

function flagBool(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1;
}

function publicAccount(row: Record<string, unknown>): PublicAccount {
  return {
    id: String(row.id ?? row.account_id),
    handle: String(row.handle),
    playerId: String(row.player_id),
    playerName: String(row.player_name ?? ""),
    isAdmin: flagBool(row.is_admin),
    isApprover: flagBool(row.is_approver),
  };
}

async function issueSession(sql: Sql, accountId: string) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  await sql`
    insert into crossguns.sessions (account_id, token_hash, expires_at, last_seen_at)
    values (${accountId}::uuid, ${tokenHash}, now() + interval '90 days', now())
  `;
  await sql`
    update crossguns.accounts
    set last_seen_at = now(), updated_at = now()
    where id = ${accountId}::uuid
  `;
  return token;
}

async function findSession(sql: Sql, token: string) {
  const tokenHash = await sha256Hex(token);
  const rows = await sql`
    select s.id as session_id,
           a.id as account_id,
           a.handle,
           a.player_id,
           a.disabled_at,
           a.is_admin,
           a.is_approver,
           p.player_name
    from crossguns.sessions s
    join crossguns.accounts a on a.id = s.account_id
    join crossguns.players p on p.player_id = a.player_id
    where s.token_hash = ${tokenHash}
      and s.revoked_at is null
      and s.expires_at > now()
    limit 1
  `;
  return rows[0] ?? null;
}

async function touchSession(sql: Sql, sessionId: string, accountId: string) {
  await sql`
    update crossguns.sessions
    set expires_at = now() + interval '90 days',
        last_seen_at = now()
    where id = ${sessionId}::uuid
  `;
  await sql`
    update crossguns.accounts
    set last_seen_at = now()
    where id = ${accountId}::uuid
  `;
}

export function postedAtMs(value: unknown): number | null {
  if (value == null || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function withinResultWindow(postedAt: unknown, now = Date.now()) {
  const ms = postedAtMs(postedAt);
  if (ms == null) return true;
  return now < ms + RESULT_WINDOW_MS;
}

export async function readPlayerSession(sql: Sql, token: unknown): Promise<PlayerActor | null> {
  const raw = typeof token === "string" ? token.trim() : "";
  if (!raw) return null;
  const row = await findSession(sql, raw);
  if (!row || row.disabled_at) return null;
  await touchSession(sql, String(row.session_id), String(row.account_id));
  return {
    accountId: String(row.account_id),
    playerId: String(row.player_id),
    handle: String(row.handle),
    isAdmin: flagBool(row.is_admin),
    isApprover: flagBool(row.is_approver),
  };
}

export async function registerAccount(sql: Sql, req: Request, data: Record<string, unknown>) {
  if (!rateOk("register:" + clientIp(req), 10, 15 * 60 * 1000)) {
    throw new ApiError("Too many attempts. Try again later.", 429);
  }
  const inviteCode = normCode(data.inviteCode);
  const handle = normHandle(data.handle);
  const password = String(data.password ?? "");
  const playerId = String(data.playerId ?? "").trim();
  if (!inviteCode) throw new ApiError("Registration code is required");
  const handleErr = validateHandle(handle);
  if (handleErr) throw new ApiError(handleErr);
  if (!rateOk("register-h:" + handle, 8, 15 * 60 * 1000)) {
    throw new ApiError("Too many attempts. Try again later.", 429);
  }
  const passErr = validatePassword(password);
  if (passErr) throw new ApiError(passErr);
  if (!playerId || playerId.startsWith("wo:")) {
    throw new ApiError("Choose one of the players already in the league.");
  }

  const inviteHash = await sha256Hex(inviteCode);
  const passwordHash = hashPassword(password);

  try {
    return await sql.begin(async (tx) => {
      const invites = await tx`
        select id
        from crossguns.invites
        where code_hash = ${inviteHash}
          and purpose = 'register'
          and used_at is null
          and expires_at > now()
        for update
      `;
      const invite = invites[0];
      if (!invite) throw new ApiError("Registration code is invalid, used, or expired", 403);

      const handles = await tx`
        select id from crossguns.accounts where handle = ${handle} limit 1
      `;
      if (handles.length) throw new ApiError("That handle is already taken");

      const players = await tx`
        select p.player_id, p.player_name,
               exists(
                 select 1 from crossguns.accounts a where a.player_id = p.player_id
               ) as claimed
        from crossguns.players p
        where p.player_id = ${playerId}
        limit 1
      `;
      const player = players[0];
      if (!player) throw new ApiError("Choose one of the players already in the league.");
      if (player.claimed === true || player.claimed === "t" || player.claimed === "true") {
        throw new ApiError("That player already has an account.");
      }

      const created = await tx`
        insert into crossguns.accounts (handle, password_hash, player_id, invite_id)
        values (${handle}, ${passwordHash}, ${playerId}, ${String(invite.id)}::uuid)
        returning id, handle, player_id
      `;
      const account = created[0]!;
      const claimed = await tx`
        update crossguns.invites
        set used_at = now(), account_id = ${String(account.id)}::uuid
        where id = ${String(invite.id)}::uuid
          and used_at is null
        returning id
      `;
      if (!claimed.length) throw new ApiError("Registration code is invalid, used, or expired", 403);

      const sessionToken = await issueSession(tx, String(account.id));
      return {
        sessionToken,
        account: publicAccount({
          id: account.id,
          handle: account.handle,
          player_id: account.player_id,
          player_name: player.player_name,
          is_admin: false,
          is_approver: false,
        }),
      };
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isUniqueViolation(err)) throw new ApiError("That handle or player is already registered.");
    throw err;
  }
}

export async function connectAccount(sql: Sql, req: Request, data: Record<string, unknown>) {
  if (!rateOk("connect:" + clientIp(req), 10, 15 * 60 * 1000)) {
    throw new ApiError("Too many attempts. Try again later.", 429);
  }
  const handle = normHandle(data.handle);
  const password = String(data.password ?? "");
  if (!handle || !password) throw new ApiError("Handle and password are required");
  if (!rateOk("connect-h:" + handle, 8, 15 * 60 * 1000)) {
    throw new ApiError("Too many attempts. Try again later.", 429);
  }
  const rows = await sql`
    select a.id, a.handle, a.password_hash, a.player_id, a.disabled_at, a.is_admin, a.is_approver, p.player_name
    from crossguns.accounts a
    join crossguns.players p on p.player_id = a.player_id
    where a.handle = ${handle}
    limit 1
  `;
  const account = rows[0];
  if (!account || !checkPassword(password, String(account.password_hash))) {
    throw new ApiError("Handle or password is wrong", 403);
  }
  if (account.disabled_at) throw new ApiError("This account has been disabled.", 403);
  const sessionToken = await issueSession(sql, String(account.id));
  return { sessionToken, account: publicAccount(account) };
}

export async function resetAccountPassword(sql: Sql, req: Request, data: Record<string, unknown>) {
  if (!rateOk("reset:" + clientIp(req), 10, 15 * 60 * 1000)) {
    throw new ApiError("Too many attempts. Try again later.", 429);
  }
  const handle = normHandle(data.handle);
  const resetCode = normCode(data.resetCode);
  const newPassword = String(data.newPassword ?? "");
  if (!handle || !resetCode) throw new ApiError("Handle and reset code are required");
  const passErr = validatePassword(newPassword);
  if (passErr) throw new ApiError(passErr);
  const accounts = await sql`
    select id, disabled_at
    from crossguns.accounts
    where handle = ${handle}
    limit 1
  `;
  const account = accounts[0];
  if (!account) throw new ApiError("Handle or reset code is wrong", 403);
  if (account.disabled_at) throw new ApiError("This account has been disabled.", 403);
  const resetHash = await sha256Hex(resetCode);
  const passwordHash = hashPassword(newPassword);
  await sql.begin(async (tx) => {
    const invites = await tx`
      select id
      from crossguns.invites
      where account_id = ${String(account.id)}::uuid
        and code_hash = ${resetHash}
        and purpose = 'reset'
        and used_at is null
        and expires_at > now()
      for update
    `;
    const invite = invites[0];
    if (!invite) throw new ApiError("Handle or reset code is wrong", 403);
    await tx`
      update crossguns.accounts
      set password_hash = ${passwordHash}, updated_at = now()
      where id = ${String(account.id)}::uuid
    `;
    await tx`
      update crossguns.invites
      set used_at = now()
      where id = ${String(invite.id)}::uuid
        and used_at is null
    `;
    await tx`
      update crossguns.sessions
      set revoked_at = now()
      where account_id = ${String(account.id)}::uuid
        and revoked_at is null
    `;
  });
  return { ok: true };
}

export async function signOutAccount(sql: Sql, token: unknown) {
  const raw = typeof token === "string" ? token.trim() : "";
  if (!raw) throw new ApiError("Missing session", 401);
  const tokenHash = await sha256Hex(raw);
  await sql`
    update crossguns.sessions
    set revoked_at = now()
    where token_hash = ${tokenHash}
      and revoked_at is null
  `;
  return { ok: true };
}

export async function whoAmIAccount(sql: Sql, token: unknown) {
  const raw = typeof token === "string" ? token.trim() : "";
  if (!raw) throw new ApiError("Session expired. Connect again.", 401);
  const row = await findSession(sql, raw);
  if (!row || row.disabled_at) throw new ApiError("Session expired. Connect again.", 401);
  await touchSession(sql, String(row.session_id), String(row.account_id));
  return publicAccount(row);
}

export async function issueInvite(sql: Sql, data: Record<string, unknown>) {
  const purpose = String(data.purpose ?? "register").trim();
  if (purpose !== "register" && purpose !== "reset") {
    throw new ApiError("purpose must be register or reset");
  }
  const label = String(data.label ?? "").trim().slice(0, 80) || null;
  const accountId = String(data.accountId ?? "").trim();
  if (purpose === "reset") {
    if (!accountId) throw new ApiError("Choose the account that needs a reset code");
    const accounts = await sql`
      select id from crossguns.accounts where id = ${accountId}::uuid limit 1
    `;
    if (!accounts.length) throw new ApiError("Account not found", 404);
  }
  const code = randomCode(8);
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(
    Date.now() + (purpose === "reset" ? 24 : 30 * 24) * 60 * 60 * 1000,
  );
  const rows = purpose === "reset"
    ? await sql`
        insert into crossguns.invites (purpose, code_hash, label, account_id, expires_at)
        values (${purpose}, ${codeHash}, ${label}, ${accountId}::uuid, ${expiresAt})
        returning purpose, label, expires_at
      `
    : await sql`
        insert into crossguns.invites (purpose, code_hash, label, expires_at)
        values (${purpose}, ${codeHash}, ${label}, ${expiresAt})
        returning purpose, label, expires_at
      `;
  const row = rows[0]!;
  return {
    code,
    purpose: row.purpose,
    label: row.label,
    expiresAt: row.expires_at,
  };
}

export async function listInvites(sql: Sql) {
  const rows = await sql`
    select i.id, i.purpose, i.label, i.expires_at, i.created_at, a.handle, p.player_name
    from crossguns.invites i
    left join crossguns.accounts a on a.id = i.account_id
    left join crossguns.players p on p.player_id = a.player_id
    where i.used_at is null
      and i.expires_at > now()
    order by i.created_at desc
  `;
  return rows.map((row) => ({
    id: row.id,
    purpose: row.purpose,
    label: row.label,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    handle: row.handle,
    playerName: row.player_name,
  }));
}

export async function revokeInvite(sql: Sql, data: Record<string, unknown>) {
  const inviteId = String(data.inviteId ?? "").trim();
  if (!inviteId) throw new ApiError("inviteId required");
  const rows = await sql`
    update crossguns.invites
    set used_at = now()
    where id = ${inviteId}::uuid
      and used_at is null
    returning id
  `;
  if (!rows.length) throw new ApiError("Invite not found", 404);
  return { ok: true };
}

export async function listAccounts(sql: Sql) {
  const rows = await sql`
    select a.id, a.handle, a.player_id, a.is_admin, a.is_approver, a.disabled_at, a.created_at, a.last_seen_at, p.player_name
    from crossguns.accounts a
    join crossguns.players p on p.player_id = a.player_id
    order by a.handle asc
  `;
  return rows.map((row) => ({
    id: row.id,
    handle: row.handle,
    playerId: row.player_id,
    playerName: row.player_name,
    isAdmin: flagBool(row.is_admin),
    isApprover: flagBool(row.is_approver),
    disabled: row.disabled_at != null,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  }));
}

export async function disableAccount(sql: Sql, data: Record<string, unknown>) {
  const accountId = String(data.accountId ?? "").trim();
  if (!accountId) throw new ApiError("accountId required");
  const rows = await sql`
    update crossguns.accounts
    set disabled_at = now(), updated_at = now()
    where id = ${accountId}::uuid
      and disabled_at is null
    returning id
  `;
  if (!rows.length) {
    const existing = await sql`
      select id, disabled_at from crossguns.accounts where id = ${accountId}::uuid limit 1
    `;
    if (!existing.length) throw new ApiError("Account not found", 404);
  }
  await sql`
    update crossguns.sessions
    set revoked_at = now()
    where account_id = ${accountId}::uuid
      and revoked_at is null
  `;
  return { ok: true };
}

export async function setAccountAdmin(sql: Sql, data: Record<string, unknown>) {
  const accountId = String(data.accountId ?? "").trim();
  if (!accountId) throw new ApiError("accountId required");
  const isAdmin = data.isAdmin === true || data.isAdmin === "true" || data.isAdmin === 1;
  const rows = await sql`
    update crossguns.accounts
    set is_admin = ${isAdmin},
        is_approver = case when ${isAdmin} then false else is_approver end,
        updated_at = now()
    where id = ${accountId}::uuid
    returning id, is_admin, is_approver
  `;
  if (!rows.length) throw new ApiError("Account not found", 404);
  return {
    ok: true,
    isAdmin: flagBool(rows[0].is_admin),
    isApprover: flagBool(rows[0].is_approver),
  };
}

export async function setAccountApprover(sql: Sql, data: Record<string, unknown>) {
  const accountId = String(data.accountId ?? "").trim();
  if (!accountId) throw new ApiError("accountId required");
  const isApprover = data.isApprover === true || data.isApprover === "true" || data.isApprover === 1;
  const rows = await sql`
    update crossguns.accounts
    set is_approver = ${isApprover},
        is_admin = case when ${isApprover} then false else is_admin end,
        updated_at = now()
    where id = ${accountId}::uuid
    returning id, is_admin, is_approver
  `;
  if (!rows.length) throw new ApiError("Account not found", 404);
  return {
    ok: true,
    isAdmin: flagBool(rows[0].is_admin),
    isApprover: flagBool(rows[0].is_approver),
  };
}
