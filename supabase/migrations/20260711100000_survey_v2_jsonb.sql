-- Survey V2 (learning profile) versioned JSONB storage.
-- File only: apply after user approval. Do NOT run against production directly.
-- Existing q1~q35 / factor columns and V1 data stay unchanged.
-- instrument_version is the single field that distinguishes V1 from V2 rows.

alter table public.surveys
  add column if not exists instrument_version text,
  add column if not exists subject_selection text,
  add column if not exists intake_v2 jsonb,
  add column if not exists responses_v2 jsonb,
  add column if not exists response_meta_v2 jsonb,
  add column if not exists score_profile_v2 jsonb;

alter table public.analyses
  add column if not exists analysis_version text,
  add column if not exists result_profile_v2 jsonb,
  add column if not exists response_quality_v2 jsonb;

-- V1 rows leave these null; only V2 submissions set instrument_version = 'v2'.
-- No default is set so existing rows are not silently reclassified as V2.

-- Version filtering index (partial: only V2 rows are indexed).
create index if not exists idx_surveys_instrument_version
  on public.surveys (instrument_version)
  where instrument_version is not null;
