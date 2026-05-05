-- NEVAEH'S LIGHTHOUSE — formulation table
-- Per-user evolving clinical case conceptualization.
-- Written and revised by NEVAEH after each session.
-- Visible to the user (radical transparency).
-- Reviewable by a human clinician when one joins the team.

create table if not exists public.formulation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version int not null default 1,
  presenting_concerns text,
  core_patterns text,
  strengths text,
  working_hypothesis text,
  what_has_helped text,
  what_has_not_helped text,
  next_focus text,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id)  -- one live formulation per user (upserted each time)
);

alter table public.formulation enable row level security;

create policy "Users read own formulation"
  on public.formulation for select
  using (auth.uid() = user_id);

create policy "Service role manages formulation"
  on public.formulation for all
  using (true)
  with check (true);
