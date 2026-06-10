-- Class progress board tables.
-- File only: apply after user approval.

create table if not exists public.class_progress (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null unique references public.classes(id) on delete cascade,
  student_count int,
  main_textbook text,
  main_total_pages int,
  current_page int,
  sub_textbook text,
  next_textbook text,
  next_start_plan text,
  current_plan text,
  note text,
  updated_by text,
  progress_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_progress_logs (
  id uuid primary key default gen_random_uuid(),
  progress_id uuid not null references public.class_progress(id) on delete cascade,
  page int not null,
  recorded_by text,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_class_progress_logs_progress_recorded
  on public.class_progress_logs (progress_id, recorded_at desc);

alter table public.class_progress enable row level security;
alter table public.class_progress_logs enable row level security;

drop policy if exists "class_progress_all_authenticated" on public.class_progress;
create policy "class_progress_all_authenticated"
  on public.class_progress
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "class_progress_logs_all_authenticated" on public.class_progress_logs;
create policy "class_progress_logs_all_authenticated"
  on public.class_progress_logs
  for all
  to authenticated
  using (true)
  with check (true);

create or replace function public.update_class_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_class_progress_updated_at on public.class_progress;
create trigger update_class_progress_updated_at
  before update on public.class_progress
  for each row execute function public.update_class_progress_updated_at();
