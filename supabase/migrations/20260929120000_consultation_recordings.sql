-- ⚠ 이 파일은 운영 DB에 사람이 직접 검토한 뒤에만 실행한다. 자동 적용 금지(db push 금지).
-- 목적: 상담 녹음(R4) — 녹음 기록 표, 조각(10분) 표, 원본 오디오 버킷 consult-audio.
-- 원칙(설계 D1·D3·D6·D7):
--   * 두 표 모두 RLS 켬 + 정책 0개 + anon·authenticated 권한 회수 → 서버(서비스 롤)만 읽고 쓴다.
--     열람·실행 권한 판정은 서버 코드(src/lib/recording/access.ts)가 매번 한다.
--   * 버킷은 비공개. storage.objects 정책을 만들지 않는다 → 서명 URL(업로드·재생 10분)로만 접근.
--   * 상담 FK 는 ON DELETE RESTRICT — 녹음이 남아 있으면 상담을 지울 수 없다(오디오 먼저 삭제 확인).
--   * 추가만 한다. 기존 표·행은 건드리지 않는다. 여러 번 실행해도 같다(IF NOT EXISTS · ON CONFLICT DO NOTHING).

-- ─────────────────────────────────────────────
-- 1) 녹음 기록
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultation_recordings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id     uuid NOT NULL REFERENCES public.consultations(id) ON DELETE RESTRICT,
  status              text NOT NULL DEFAULT 'recording'
                        CONSTRAINT consultation_recordings_status_check
                        CHECK (status IN ('recording', 'transcribing', 'transcribed', 'analyzing', 'analyzed', 'failed', 'deleting')),
  mime                text NOT NULL,
  segment_count       integer,                 -- 마감(finalize) 때 확정. null = 아직 녹음 중
  duration_sec        integer,
  consent_at          timestamptz NOT NULL,
  consent_by          text NOT NULL,           -- 동의를 확인한 직원(teachers.id 또는 시스템 계정 표시)
  consent_version     text NOT NULL,
  transcript          jsonb,                   -- 조각 전사를 이어 붙인 전체 [{seq,speaker,startSec,endSec,text}]
  analysis            jsonb,                   -- zod 검증을 통과한 분석 JSON
  error               text,
  created_by          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  finalized_at        timestamptz,
  transcribed_at      timestamptz,
  analyzed_at         timestamptz,
  locked_at           timestamptz,             -- 분석 선점 시각(10분 넘으면 다시 선점 가능)
  audio_delete_after  timestamptz NOT NULL,    -- INSERT 때 created_at + 30일로 확정, 늘리지 않는다
  audio_deleted_at    timestamptz,
  purge_error         text,                    -- 원본 삭제 실패 사유(성공하면 null)
  deleting_at         timestamptz              -- 녹음 삭제 시작 시각(status='deleting'). 24시간 넘게 남으면 cron 이 마저 지운다
);

CREATE INDEX IF NOT EXISTS consultation_recordings_consultation_id_idx
  ON public.consultation_recordings (consultation_id);
CREATE INDEX IF NOT EXISTS consultation_recordings_audio_delete_after_idx
  ON public.consultation_recordings (audio_delete_after)
  WHERE audio_deleted_at IS NULL;

-- ─────────────────────────────────────────────
-- 2) 녹음 조각(10분 단위 독립 파일)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultation_recording_segments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id  uuid NOT NULL REFERENCES public.consultation_recordings(id) ON DELETE CASCADE,
  seq           integer NOT NULL CHECK (seq BETWEEN 1 AND 72),
  path          text NOT NULL,
  duration_sec  integer,
  bytes         integer,
  status        text NOT NULL DEFAULT 'pending'
                  CONSTRAINT consultation_recording_segments_status_check
                  CHECK (status IN ('pending', 'uploaded', 'transcribing', 'transcribed', 'failed')),
  transcript    jsonb,                          -- [{speaker,startSec,endSec,text}]
  error         text,
  locked_at     timestamptz,                    -- 전사 선점 시각(10분 넘으면 다시 선점 가능)
  created_at    timestamptz NOT NULL DEFAULT now(),
  uploaded_at   timestamptz,
  transcribed_at timestamptz,
  CONSTRAINT consultation_recording_segments_recording_seq_key UNIQUE (recording_id, seq)
);

CREATE INDEX IF NOT EXISTS consultation_recording_segments_status_idx
  ON public.consultation_recording_segments (status);

-- ─────────────────────────────────────────────
-- 3) RLS: 켜고 정책은 만들지 않는다 + 권한 회수(이중 잠금)
-- ─────────────────────────────────────────────
ALTER TABLE public.consultation_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_recording_segments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.consultation_recordings FROM anon, authenticated;
REVOKE ALL ON public.consultation_recording_segments FROM anon, authenticated;

-- ─────────────────────────────────────────────
-- 4) Storage 버킷 consult-audio (비공개, 15MB, audio/*) — storage.objects 정책 없음
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consult-audio',
  'consult-audio',
  false,
  15728640,
  ARRAY['audio/*']
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 5) 적용 후 확인
-- ─────────────────────────────────────────────
-- (a) 정책이 0개인지(두 표 모두):
--     SELECT tablename, count(*) FROM pg_policies
--     WHERE schemaname = 'public'
--       AND tablename IN ('consultation_recordings', 'consultation_recording_segments')
--     GROUP BY tablename;
--     → 0행이어야 한다.
-- (b) RLS 켜짐:
--     SELECT relname, relrowsecurity FROM pg_class
--     WHERE relname IN ('consultation_recordings', 'consultation_recording_segments');
--     → 둘 다 true.
-- (c) anon·authenticated 권한 없음:
--     SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
--     WHERE table_name IN ('consultation_recordings', 'consultation_recording_segments')
--       AND grantee IN ('anon', 'authenticated');
--     → 0행.
-- (d) 익명 키 조회가 막히는지:
--     curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/consultation_recordings?select=id" \
--       -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
--     → permission denied 이어야 한다.
-- (e) 버킷:
--     SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'consult-audio';
--     → public=false, 15728640, {audio/*}.
-- (f) consult-audio 용 storage 정책이 없는지:
--     SELECT policyname FROM pg_policies
--     WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%consult-audio%';
--     → 0행.
-- (g) FK 가 RESTRICT 인지:
--     SELECT confdeltype FROM pg_constraint
--     WHERE conrelid = 'public.consultation_recordings'::regclass AND contype = 'f';
--     → 'r'.

-- ─────────────────────────────────────────────
-- 6) 되돌리기(필요할 때만, 사람이 직접). 버킷 안 오디오를 먼저 비워야 버킷 삭제가 된다.
-- ─────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.consultation_recording_segments;
-- DROP TABLE IF EXISTS public.consultation_recordings;
-- -- 오디오 파일은 Storage API(서비스 롤)로 consult-audio 폴더를 모두 remove 한 뒤:
-- DELETE FROM storage.buckets WHERE id = 'consult-audio';
