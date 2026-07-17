alter table public.leads
drop constraint if exists leads_project_check;

alter table public.leads
add constraint leads_project_check
check (project in ('memora', 'aferia', 'eco'));
