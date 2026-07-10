-- report_tokens V2 hardening + parent-safe share snapshots.
-- File only: apply after user approval. Do NOT run against production directly.
--
-- Why:
--   1) RLS audit (§14): the legacy policy
--        CREATE POLICY "Anyone can read by token" ON report_tokens FOR SELECT USING (true);
--      lets an anonymous client SELECT *every* row (enumerate all shared reports), not just
--      the one row matching a known token. `.eq("token", token)` only filters client-side.
--   2) V2 share links store an immutable parent-safe snapshot (report_type = 'analysis_v2',
--      the JSON payload lives in report_html as text so this works even before this migration).
--   3) Revocation: admins can revoke a shared link without deleting the row (revoked_at).
--
-- Backward compatibility:
--   - Existing V1 links (report_type in ('analysis','registration'), report_html = HTML) keep working.
--   - The app reads a token via the get_report_token() RPC when present, and falls back to a
--     direct single-row select when the RPC/columns are absent (pre-migration). So the app runs
--     in both states; applying this migration only *hardens* anonymous access.

-- ── new columns (idempotent) ────────────────────────────────────────────────
alter table public.report_tokens
  add column if not exists revoked_at timestamptz,
  add column if not exists template_version text;

-- V2 snapshots are versioned; existing rows stay null (treated as V1/template v1).
comment on column public.report_tokens.revoked_at is
  '관리자가 공유 링크를 취소한 시각. null이면 유효. 만료(expires_at)와 별개.';
comment on column public.report_tokens.template_version is
  '공유 스냅샷 템플릿 버전. V2 parent-safe 스냅샷은 ''v2''.';

-- ── RLS: close anonymous full-table read ────────────────────────────────────
-- Replace the permissive SELECT policy. Anonymous clients must go through the
-- SECURITY DEFINER RPC below (single-token lookup only). Authenticated staff keep read access.
drop policy if exists "Anyone can read by token" on public.report_tokens;

drop policy if exists "Authenticated can read report tokens" on public.report_tokens;
create policy "Authenticated can read report tokens"
  on public.report_tokens for select
  to authenticated
  using (true);

-- Keep authenticated insert (staff create share links).
drop policy if exists "Auth users can insert" on public.report_tokens;
create policy "Auth users can insert"
  on public.report_tokens for insert
  to authenticated
  with check (true);

-- Authenticated staff may revoke (set revoked_at) their shared links.
drop policy if exists "Authenticated can revoke report tokens" on public.report_tokens;
create policy "Authenticated can revoke report tokens"
  on public.report_tokens for update
  to authenticated
  using (true)
  with check (true);

-- ── single-token lookup RPC for anonymous /report/[token] ───────────────────
-- SECURITY DEFINER bypasses RLS but only ever returns the single row whose token
-- matches exactly. Callers still compute expiry/revocation for the response.
create or replace function public.get_report_token(p_token text)
returns table (
  report_type text,
  report_html text,
  name text,
  created_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  template_version text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.report_type,
    t.report_html,
    t.name,
    t.created_at,
    t.expires_at,
    t.revoked_at,
    t.template_version
  from public.report_tokens t
  where t.token = p_token
  limit 1;
$$;

-- Anonymous report viewer needs to call the RPC; nothing else.
revoke all on function public.get_report_token(text) from public;
grant execute on function public.get_report_token(text) to anon, authenticated;
