create extension if not exists pgcrypto;

create table if not exists public.eco_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  consent boolean not null default false,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  source_url text,

  status text not null default 'registered',
  created_at timestamptz not null default now()
);

create unique index if not exists eco_leads_email_unique
on public.eco_leads (lower(email));

alter table public.eco_leads enable row level security;

-- No browser role can access this table. The Edge Function inserts with the
-- server-side service role, which bypasses RLS. Intentionally create no policy.
revoke all on table public.eco_leads from anon, authenticated;
