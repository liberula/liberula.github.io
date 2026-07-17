create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),

  project text not null,
  funnel text not null,

  name text,
  email text not null,
  phone text,
  message text,

  consent boolean not null default false,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  source_url text,
  referrer text,

  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'registered',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads
add constraint leads_project_check
check (project in ('memora', 'aferia'));

create unique index if not exists leads_project_funnel_email_unique
on public.leads (
  project,
  funnel,
  lower(email)
);

create index if not exists leads_project_created_at_idx
on public.leads (project, created_at desc);

create index if not exists leads_project_funnel_idx
on public.leads (project, funnel);

alter table public.leads enable row level security;

-- The Edge Function uses the server-side service role, which bypasses RLS.
-- Intentionally create no policy for browser roles.
revoke all on table public.leads from anon;
revoke all on table public.leads from authenticated;
