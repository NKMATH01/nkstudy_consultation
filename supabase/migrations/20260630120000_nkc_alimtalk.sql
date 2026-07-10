-- NK consultation Alimtalk and drip survey foundation.
-- File only: apply after user approval.
-- Do not add foreign keys to shared tables.

create table if not exists public.nkc_alimtalk_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text unique not null,
  title text not null,
  body text not null,
  variables text[] default '{}',
  button jsonb,
  kakao_template_id text,
  msg_type text not null default 'info' check (msg_type in ('info', 'ad')),
  kakao_status text not null default 'draft' check (kakao_status in ('draft', 'pending', 'approved', 'rejected')),
  pf_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.nkc_scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  template_code text not null,
  consultation_id uuid,
  target_phone_snapshot text not null,
  payload jsonb not null default '{}',
  wave text check (wave in ('D1', 'W1', 'W2')),
  send_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'retry', 'dead')),
  retry_count int not null default 0,
  dedup_key text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint nkc_sched_dedup unique (target_phone_snapshot, template_code, dedup_key)
);

create index if not exists idx_nkc_scheduled_messages_status_send_at
  on public.nkc_scheduled_messages (status, send_at);

create index if not exists idx_nkc_scheduled_messages_consultation_id
  on public.nkc_scheduled_messages (consultation_id);

create table if not exists public.nkc_send_logs (
  id uuid primary key default gen_random_uuid(),
  scheduled_message_id uuid,
  message_id text,
  template_code text,
  phone text not null,
  channel text check (channel in ('alimtalk', 'sms', 'lms')),
  status text,
  unit_price numeric,
  retry_count int default 0,
  api_response jsonb,
  sent_at timestamptz default now()
);

create index if not exists idx_nkc_send_logs_phone
  on public.nkc_send_logs (phone);

create index if not exists idx_nkc_send_logs_sent_at
  on public.nkc_send_logs (sent_at);

create table if not exists public.nkc_consents (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  info_ok boolean not null default true,
  ad_ok boolean not null default false,
  ad_consent_at timestamptz,
  optout_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists public.nkc_survey_invitations (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  consultation_id uuid,
  wave text check (wave in ('D1', 'W1', 'W2')),
  target_phone text,
  sent_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz default now()
);

create index if not exists idx_nkc_survey_invitations_token
  on public.nkc_survey_invitations (token);

create table if not exists public.nkc_survey_responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.nkc_survey_invitations(id) on delete cascade,
  wave text,
  answers jsonb not null default '{}',
  free_text text,
  flag text,
  handled boolean not null default false,
  handled_at timestamptz,
  created_at timestamptz default now()
);

alter table public.nkc_alimtalk_templates enable row level security;
alter table public.nkc_scheduled_messages enable row level security;
alter table public.nkc_send_logs enable row level security;
alter table public.nkc_consents enable row level security;
alter table public.nkc_survey_invitations enable row level security;
alter table public.nkc_survey_responses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nkc_alimtalk_templates'
      and policyname = 'nkc_alimtalk_templates_all_authenticated'
  ) then
    create policy "nkc_alimtalk_templates_all_authenticated"
      on public.nkc_alimtalk_templates
      for all to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nkc_scheduled_messages'
      and policyname = 'nkc_scheduled_messages_all_authenticated'
  ) then
    create policy "nkc_scheduled_messages_all_authenticated"
      on public.nkc_scheduled_messages
      for all to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nkc_send_logs'
      and policyname = 'nkc_send_logs_all_authenticated'
  ) then
    create policy "nkc_send_logs_all_authenticated"
      on public.nkc_send_logs
      for all to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nkc_consents'
      and policyname = 'nkc_consents_all_authenticated'
  ) then
    create policy "nkc_consents_all_authenticated"
      on public.nkc_consents
      for all to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nkc_survey_invitations'
      and policyname = 'nkc_survey_invitations_all_authenticated'
  ) then
    create policy "nkc_survey_invitations_all_authenticated"
      on public.nkc_survey_invitations
      for all to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nkc_survey_responses'
      and policyname = 'nkc_survey_responses_all_authenticated'
  ) then
    create policy "nkc_survey_responses_all_authenticated"
      on public.nkc_survey_responses
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

create or replace function public.get_drip_invitation(p_token text)
returns table (wave text, expired boolean, responded boolean)
language sql
security definer
set search_path = public
as $$
  select i.wave,
         (i.expires_at < now()) as expired,
         (i.responded_at is not null) as responded
  from public.nkc_survey_invitations i
  where i.token = p_token
  limit 1;
$$;

grant execute on function public.get_drip_invitation(text) to anon, authenticated;

create or replace function public.submit_drip_response(
  p_token text,
  p_answers jsonb,
  p_free_text text,
  p_flag text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.nkc_survey_invitations%rowtype;
begin
  select *
    into v_inv
  from public.nkc_survey_invitations
  where token = p_token
  limit 1;

  if not found then
    return false;
  end if;

  if v_inv.expires_at < now() then
    return false;
  end if;

  if v_inv.responded_at is not null then
    return false;
  end if;

  insert into public.nkc_survey_responses (
    invitation_id,
    wave,
    answers,
    free_text,
    flag
  )
  values (
    v_inv.id,
    v_inv.wave,
    coalesce(p_answers, '{}'::jsonb),
    p_free_text,
    p_flag
  );

  update public.nkc_survey_invitations
    set responded_at = now()
  where id = v_inv.id;

  return true;
end;
$$;

grant execute on function public.submit_drip_response(text, jsonb, text, text) to anon, authenticated;
