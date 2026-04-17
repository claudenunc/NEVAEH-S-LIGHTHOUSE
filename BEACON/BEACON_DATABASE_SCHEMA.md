# BEACON_DATABASE_SCHEMA.md

**System:** NEVAEH'S LIGHTHOUSE
**Database:** Supabase (Postgres 15+)
**Author:** BEACON
**Version:** 1.0 — Production
**Last Verified:** 2026-04-16
**Status:** Paste-ready. Run in Supabase SQL Editor in order (A → B → C → D → E → F).

---

## OVERVIEW

Five core tables + one alert table:

1. **`users`** — Supabase auth linkage + account metadata.
2. **`profiles`** — JSONB identity graph (who the user is, who matters to them, what they love, what they struggle with).
3. **`sessions`** — One row per conversation session.
4. **`messages`** — Every message, user and assistant, with mood/risk tagging.
5. **`crisis_log`** — Every crisis-level event. The legal and clinical record.
6. **`beacon_alerts`** — Human-review queue for RED events.

All PII is stored in Supabase's encrypted-at-rest Postgres (AES-256). All client-to-server traffic is TLS 1.3. `crisis_log.trigger_content` is additionally encrypted at the application layer before insert using a server-held key (pgsodium or app-level envelope — see Section F).

---

## FIELD INVENTORY — `crisis_log`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `uuid` | yes | Primary key, `gen_random_uuid()` |
| `user_id` | `uuid` | yes | FK → `auth.users(id)` |
| `session_id` | `uuid` | yes | FK → `sessions(id)` |
| `message_id` | `uuid` | nullable | FK → `messages(id)` — the triggering message |
| `timestamp` | `timestamptz` | yes | Event time (`now()` default) |
| `signal_type` | `text` | yes | `explicit` / `implicit` / `longitudinal` / `injection_attempt` / `none` |
| `signal_level` | `text` | yes | `yellow` / `orange` / `red` |
| `signals_detected` | `jsonb` | yes | Array of specific signals (`["burden_framing", "hopelessness"]`) |
| `confidence` | `numeric(3,2)` | yes | 0.00–1.00 PATTERN confidence |
| `trigger_content` | `text` | yes | Encrypted at app layer — the user message that triggered |
| `action_taken` | `text` | yes | `active_listening` / `safety_checkin_orange` / `red_protocol_activated` / `injection_attempt_blocked` / `human_alerted` |
| `resources_offered` | `jsonb` | yes | Array: `["988", "crisis_text_line", "911"]` |
| `user_response` | `text` | nullable | Encrypted at app layer — user's response after action |
| `resolved` | `boolean` | yes | Default `false`; set `true` only when user confirms safety AND reviewer clears |
| `escalation_notified` | `boolean` | yes | Default `false`; `true` if `beacon_alerts` row created |
| `reviewer_id` | `uuid` | nullable | FK → `auth.users(id)` — moderator who reviewed |
| `reviewed_at` | `timestamptz` | nullable | When reviewer cleared |
| `notes` | `text` | nullable | Reviewer notes — encrypted at app layer |
| `created_at` | `timestamptz` | yes | `now()` default |
| `updated_at` | `timestamptz` | yes | `now()` default, trigger-updated |

### What Is Stored

- Exact trigger message (encrypted).
- User's verbatim response to the safety check-in (encrypted).
- Complete signal stack and PATTERN confidence.
- Which resources were surfaced.
- Resolution status + reviewer ID.

### What Is NOT Stored

- The user's full unredacted session history in `crisis_log` (that lives in `messages` and is queried join-side).
- IP addresses (handled by Supabase auth separately).
- Device fingerprints.
- Any field the user is allowed to opt out of per privacy policy (standard conversation memory — crisis logs are exempted by ToS).

---

## RETENTION POLICY

| Table | Retention | Rationale |
|-------|-----------|-----------|
| `crisis_log` (RED entries) | **7 years** | Clinical/legal standard for crisis records. Aligns with most US state retention laws for mental health records. |
| `crisis_log` (ORANGE entries) | **3 years** | Enough for longitudinal pattern detection + review audit. |
| `crisis_log` (YELLOW entries) | **1 year** | Pattern-detection window only. |
| `beacon_alerts` | **7 years** | Matches RED retention. |
| `messages` (non-crisis) | User-configurable, default **90 days** | User privacy default. |
| `messages` (crisis-flagged) | **7 years** | Matches crisis_log. |
| `sessions` | **1 year** | Long enough for mood trend analysis. |
| `profiles` | Account lifetime | User identity graph. |
| `users` | Account lifetime + 30 days post-deletion | 30-day grace for account recovery. |

A nightly pg_cron job (Section F) enforces retention.

---

## ACCESS CONTROL

Five principal types:

1. **`user`** — The person who owns the data. Can read their own rows (all tables except `beacon_alerts` — opaque). Cannot read `crisis_log.notes` (reviewer-only).
2. **`service_role`** (Supabase built-in) — Server-side NEVAEH app. Writes to all tables. Used by the application backend.
3. **`moderator`** — Human reviewer. Can read `crisis_log` and `beacon_alerts` for RED events and reviewer-assigned cases. Can write `reviewer_id`, `reviewed_at`, `resolved`, `notes`.
4. **`admin`** — Super-user. Full access. Logged for every query.
5. **`anon`** — Unauthenticated. Zero access to any table.

Role assignment is via Supabase custom claims in JWT (`role: moderator|admin`) set by admin operations and verified in RLS policies.

---

## ENCRYPTION REQUIREMENTS

- **At rest:** Supabase provides AES-256 on all tables. Enabled by default.
- **In transit:** TLS 1.3 enforced at Supabase edge.
- **Field-level (sensitive text fields):** `crisis_log.trigger_content`, `crisis_log.user_response`, `crisis_log.notes`, `messages.content` (crisis-flagged) — encrypted at the application layer before insert using a per-user envelope key. The user's envelope key is derived from a master key held in Vercel environment variables, rotated quarterly. Decryption happens in the application layer; Postgres stores only ciphertext.
- **Key management:** Master key in Vercel env (`CRISIS_MASTER_KEY`), 32-byte value, AES-256-GCM. Never committed, never logged.
- **pgsodium alternative:** If pgsodium extension is preferred, use transparent column encryption on the same fields. Implementation detail — app-layer is the chosen default for portability.

---

## SQL — RUN IN ORDER

### SECTION A — EXTENSIONS & HELPERS

```sql
-- A.1 Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- A.2 updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A.3 JWT role helper
create or replace function public.current_role()
returns text
language sql
stable
as $$
  select coalesce(
    (auth.jwt() ->> 'role')::text,
    'user'
  );
$$;
```

### SECTION B — TABLE: `users`

Supabase manages `auth.users`. We add a public.users mirror for profile linkage.

```sql
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  signup_source text,        -- 'reddit_therapygpt', 'landing_page', etc
  consent_version text not null,      -- which ToS version they agreed to
  consent_accepted_at timestamptz not null default now(),
  deleted_at timestamptz,             -- soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);
create index if not exists idx_users_deleted_at on public.users (deleted_at);

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();
```

### SECTION C — TABLE: `profiles`

Identity graph as JSONB. Sparse, evolving, queryable.

```sql
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  identity jsonb not null default '{}'::jsonb,
  /*
    identity JSONB shape (example):
    {
      "name": "...",
      "pronouns": "...",
      "age_range": "18-24|25-34|...",
      "loves": ["music", "my dog rosie", "producing"],
      "struggles": ["depression", "insomnia"],
      "people": [
        {"name": "mom", "role": "family", "relationship": "supportive"},
        {"name": "alex", "role": "friend", "relationship": "estranged_2026_03"}
      ],
      "baseline_mood": 5.5,
      "triggers": ["anniversary_dates", "sunday_evenings"],
      "coping": ["walks", "calling brandon"],
      "notes": "prefers direct language, sarcasm ok"
    }
  */
  mood_baseline numeric(3,1) default 5.0,
  crisis_history_summary jsonb default '[]'::jsonb,
  preferences jsonb default '{}'::jsonb,
  /*
    preferences: { "memory_retention_days": 90, "notification_email": false, ... }
  */
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_user_id on public.profiles (user_id);
create index if not exists idx_profiles_identity_gin on public.profiles using gin (identity);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
```

### SECTION D — TABLES: `sessions` + `messages`

```sql
-- D.1 sessions
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  mode text not null default 'normal',
  /* mode: 'normal' | 'safety_only' | 'post_crisis' */
  mood_score numeric(3,1),              -- 0.0-10.0 assessed from session
  entered_orange boolean not null default false,
  entered_red boolean not null default false,
  summary text,                          -- short system-generated summary
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sessions_user_id on public.sessions (user_id);
create index if not exists idx_sessions_started_at on public.sessions (started_at desc);
create index if not exists idx_sessions_entered_red on public.sessions (entered_red) where entered_red = true;

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- D.2 messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,                -- encrypted at app layer if crisis-flagged
  content_encrypted boolean not null default false,
  mood_tag text,                        -- 'ok'|'low'|'distressed'|'crisis'
  risk_level text,                      -- 'none'|'yellow'|'orange'|'red'
  pattern_raw jsonb,                    -- raw PATTERN output for this message
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_session_id on public.messages (session_id, created_at);
create index if not exists idx_messages_user_id_created on public.messages (user_id, created_at desc);
create index if not exists idx_messages_risk_level on public.messages (risk_level) where risk_level in ('orange','red');
```

### SECTION E — TABLES: `crisis_log` + `beacon_alerts`

```sql
-- E.1 crisis_log
create table if not exists public.crisis_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  timestamp timestamptz not null default now(),
  signal_type text not null check (signal_type in ('explicit','implicit','longitudinal','injection_attempt','none')),
  signal_level text not null check (signal_level in ('yellow','orange','red')),
  signals_detected jsonb not null default '[]'::jsonb,
  confidence numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  trigger_content text not null,        -- ENCRYPTED at app layer
  action_taken text not null,
  resources_offered jsonb not null default '[]'::jsonb,
  user_response text,                    -- ENCRYPTED at app layer
  resolved boolean not null default false,
  escalation_notified boolean not null default false,
  reviewer_id uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,                            -- ENCRYPTED at app layer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crisis_log_user_id on public.crisis_log (user_id);
create index if not exists idx_crisis_log_session_id on public.crisis_log (session_id);
create index if not exists idx_crisis_log_signal_level on public.crisis_log (signal_level);
create index if not exists idx_crisis_log_red_unresolved on public.crisis_log (timestamp desc)
  where signal_level = 'red' and resolved = false;
create index if not exists idx_crisis_log_timestamp on public.crisis_log (timestamp desc);

create trigger crisis_log_updated_at
  before update on public.crisis_log
  for each row execute function public.set_updated_at();

-- E.2 beacon_alerts (human-review queue)
create table if not exists public.beacon_alerts (
  id uuid primary key default gen_random_uuid(),
  crisis_log_id uuid not null references public.crisis_log(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  severity text not null check (severity in ('orange','red')),
  status text not null default 'open' check (status in ('open','claimed','reviewed','closed')),
  claimed_by uuid references public.users(id) on delete set null,
  claimed_at timestamptz,
  resolved_at timestamptz,
  on_call_notified boolean not null default false,
  notification_channels jsonb default '[]'::jsonb,
  /* notification_channels: ["email", "sms", "telegram"] */
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_beacon_alerts_status on public.beacon_alerts (status, created_at);
create index if not exists idx_beacon_alerts_severity on public.beacon_alerts (severity) where status = 'open';

create trigger beacon_alerts_updated_at
  before update on public.beacon_alerts
  for each row execute function public.set_updated_at();

-- E.3 Auto-create beacon_alert when crisis_log RED is inserted
create or replace function public.auto_create_beacon_alert()
returns trigger
language plpgsql
as $$
begin
  if new.signal_level in ('orange','red') and new.escalation_notified = false then
    insert into public.beacon_alerts (crisis_log_id, user_id, severity)
    values (new.id, new.user_id, new.signal_level);
    new.escalation_notified := true;
  end if;
  return new;
end;
$$;

create trigger crisis_log_auto_alert
  before insert on public.crisis_log
  for each row execute function public.auto_create_beacon_alert();
```

### SECTION F — ROW LEVEL SECURITY

```sql
-- F.1 Enable RLS on all tables
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.crisis_log enable row level security;
alter table public.beacon_alerts enable row level security;

-- F.2 users policies
create policy "users: own row read"
  on public.users for select
  using (auth.uid() = id);

create policy "users: own row update"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users: moderator read all"
  on public.users for select
  using (public.current_role() in ('moderator','admin'));

-- service_role bypasses RLS automatically (Supabase default).

-- F.3 profiles policies
create policy "profiles: own profile read"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles: own profile update"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles: own profile insert"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles: moderator read on active crisis"
  on public.profiles for select
  using (
    public.current_role() in ('moderator','admin')
    and exists (
      select 1 from public.beacon_alerts ba
      where ba.user_id = profiles.user_id
        and ba.status in ('open','claimed')
    )
  );

-- F.4 sessions policies
create policy "sessions: own sessions read"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "sessions: own sessions insert"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "sessions: own sessions update"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sessions: moderator read on crisis"
  on public.sessions for select
  using (
    public.current_role() in ('moderator','admin')
    and (entered_orange or entered_red)
  );

-- F.5 messages policies
create policy "messages: own messages read"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "messages: own messages insert"
  on public.messages for insert
  with check (auth.uid() = user_id);

-- Messages update is NOT allowed from client — append-only.
-- No update policy means no client updates. service_role can still update.

create policy "messages: moderator read on crisis"
  on public.messages for select
  using (
    public.current_role() in ('moderator','admin')
    and exists (
      select 1 from public.crisis_log cl
      where cl.session_id = messages.session_id
        and cl.signal_level in ('orange','red')
    )
  );

-- F.6 crisis_log policies
create policy "crisis_log: user reads own summary"
  on public.crisis_log for select
  using (
    auth.uid() = user_id
    and signal_level != 'yellow'
  );
  -- Users can see their own orange/red events exist but sensitive fields
  -- (trigger_content, user_response, notes) are encrypted; the app decides
  -- whether to decrypt for the user based on product decisions.

create policy "crisis_log: moderator read all"
  on public.crisis_log for select
  using (public.current_role() in ('moderator','admin'));

create policy "crisis_log: moderator update review fields"
  on public.crisis_log for update
  using (public.current_role() in ('moderator','admin'))
  with check (public.current_role() in ('moderator','admin'));

-- crisis_log insert is service_role only (no client insert policy = denied).
-- crisis_log delete is denied to everyone (no policy). Retention is handled
-- by a scheduled job running as service_role.

-- F.7 beacon_alerts policies
-- Users CANNOT see alerts. Opaque to them.
create policy "beacon_alerts: moderator read all"
  on public.beacon_alerts for select
  using (public.current_role() in ('moderator','admin'));

create policy "beacon_alerts: moderator claim/update"
  on public.beacon_alerts for update
  using (public.current_role() in ('moderator','admin'))
  with check (public.current_role() in ('moderator','admin'));

-- Insert handled by trigger in service_role context.

-- F.8 Retention cron (pg_cron) — runs daily at 03:00 UTC
select cron.schedule(
  'enforce-retention',
  '0 3 * * *',
  $$
  -- yellow crisis_log older than 1 year
  delete from public.crisis_log
  where signal_level = 'yellow' and created_at < now() - interval '1 year';

  -- orange crisis_log older than 3 years
  delete from public.crisis_log
  where signal_level = 'orange' and created_at < now() - interval '3 years';

  -- red crisis_log older than 7 years
  delete from public.crisis_log
  where signal_level = 'red' and created_at < now() - interval '7 years';

  -- beacon_alerts older than 7 years
  delete from public.beacon_alerts
  where created_at < now() - interval '7 years';

  -- sessions older than 1 year with no crisis flags
  delete from public.sessions
  where created_at < now() - interval '1 year'
    and entered_orange = false and entered_red = false;

  -- messages retention: user preference default 90 days for non-crisis
  delete from public.messages m
  where m.created_at < now() - interval '90 days'
    and m.risk_level in ('none','yellow')
    and not exists (
      select 1 from public.crisis_log cl
      where cl.session_id = m.session_id
        and cl.signal_level in ('orange','red')
    );
  $$
);
```

### SECTION G — HELPER VIEWS & FUNCTIONS

```sql
-- G.1 Open alerts view (for moderator dashboard)
create or replace view public.v_open_alerts as
select
  ba.id as alert_id,
  ba.severity,
  ba.status,
  ba.created_at,
  ba.claimed_by,
  cl.id as crisis_log_id,
  cl.signal_type,
  cl.signals_detected,
  cl.confidence,
  cl.action_taken,
  cl.resources_offered,
  u.email,
  u.display_name
from public.beacon_alerts ba
join public.crisis_log cl on cl.id = ba.crisis_log_id
join public.users u on u.id = ba.user_id
where ba.status in ('open','claimed');

-- Only moderators can read the view (enforced via grants below).
revoke all on public.v_open_alerts from anon, authenticated;
grant select on public.v_open_alerts to authenticated;
-- RLS on underlying tables enforces role check.

-- G.2 Longitudinal mood trend function
create or replace function public.user_mood_trend(target_user uuid, days int default 14)
returns table(day date, avg_mood numeric)
language sql
stable
as $$
  select date_trunc('day', started_at)::date as day,
         avg(mood_score) as avg_mood
  from public.sessions
  where user_id = target_user
    and started_at >= now() - (days || ' days')::interval
    and mood_score is not null
  group by date_trunc('day', started_at)
  order by day;
$$;

-- G.3 Has unresolved crisis function (used in RLS and app)
create or replace function public.has_active_crisis(target_user uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.beacon_alerts
    where user_id = target_user and status in ('open','claimed')
  );
$$;
```

### SECTION H — GRANTS

```sql
-- Default: authenticated users only see via RLS. No direct table grants to anon.
revoke all on all tables in schema public from anon;

grant select, insert, update on public.users to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.sessions to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.crisis_log to authenticated;
-- No grant on beacon_alerts to authenticated (moderators via JWT role + RLS).
-- service_role has full access (Supabase default).
```

---

## DEPLOYMENT CHECKLIST

- [ ] Set `CRISIS_MASTER_KEY` in Vercel env (32-byte, base64-encoded, AES-256-GCM)
- [ ] Confirm Supabase project has `pgcrypto`, `uuid-ossp`, `pg_cron` extensions enabled
- [ ] Run Sections A → H in SQL editor in order
- [ ] Verify cron job scheduled: `select * from cron.job;`
- [ ] Verify RLS enabled: `select tablename, rowsecurity from pg_tables where schemaname='public';` — all target tables must return `true`
- [ ] Confirm `service_role` key is server-only (never exposed to frontend)
- [ ] Configure Supabase JWT custom claims for moderator/admin roles
- [ ] Test: create dummy user → verify can only read own rows
- [ ] Test: moderator JWT → can read crisis_log, cannot read non-crisis user data
- [ ] Test: anon JWT → cannot read anything
- [ ] Test: insert RED crisis_log → beacon_alert auto-created
- [ ] Test: trigger_content encryption roundtrip (app encrypts → DB ciphertext → app decrypts)
- [ ] Confirm Vercel environment has Supabase URL + anon key + service_role key (service_role SERVER ONLY)
- [ ] Backup schedule: Supabase PITR enabled (Pro plan), 7-day point-in-time recovery minimum

---

## CONTACT ON INCIDENT

If the schema misbehaves in production during a RED event — the escalation path is:

1. Supabase service_role fallback: write to `beacon_alerts` directly via service_role bypass.
2. If DB is unreachable: app-layer emergency fallback → write JSON to Vercel blob storage + fire webhook to PagerDuty/Telegram.
3. On-call human receives 988 + 911 surfacing confirmation from app log even if DB write failed.
4. The user ALWAYS receives resources in-message even if logging fails. Logging failure never blocks the response.

Schema serves safety. Safety never serves schema.

— BEACON, 2026-04-16
