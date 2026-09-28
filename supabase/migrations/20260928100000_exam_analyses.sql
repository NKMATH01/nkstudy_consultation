-- ⚠ 이 파일은 운영 DB에 사람이 직접 검토한 뒤에만 실행한다. 자동 적용 금지.
-- 목적: 시험지 분석 요청(exam_analyses) 테이블과 시험지 사진 보관 버킷(exam-papers)을 만든다.
-- 원칙: 로그인한 직원(authenticated)만 읽고 쓴다. 익명 키(anon)로는 한 행도, 한 파일도 보이지 않아야 한다.
-- 근거: 20260905100000_surveys_rls_lockdown.sql — surveys 사고의 재발 방지.

-- ─────────────────────────────────────────────
-- 1) 테이블
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_analyses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid REFERENCES public.students(id) ON DELETE SET NULL,
  student_name    text NOT NULL,
  school          text,
  grade           text,
  exam_title      text NOT NULL,
  exam_date       date NOT NULL,
  subject         text,
  status          text NOT NULL DEFAULT 'pending'
                    CONSTRAINT exam_analyses_status_check
                    CHECK (status IN ('pending', 'analyzing', 'done', 'sent')),
  paper_paths     text[] NOT NULL DEFAULT '{}',
  mathflex_paths  text[] NOT NULL DEFAULT '{}',
  report_token    text,          -- report_tokens.token 과 같은 타입(text). uuid 로 두면 토큰 형식이 바뀔 때 UPDATE 가 깨진다.
  note            text,
  created_by      uuid DEFAULT auth.uid(),
  created_at      timestamptz DEFAULT now(),
  analyzed_at     timestamptz,
  sent_at         timestamptz,
  retain_until    date
);

CREATE INDEX IF NOT EXISTS exam_analyses_status_idx
  ON public.exam_analyses (status);
CREATE INDEX IF NOT EXISTS exam_analyses_created_at_idx
  ON public.exam_analyses (created_at DESC);
CREATE INDEX IF NOT EXISTS exam_analyses_student_id_idx
  ON public.exam_analyses (student_id);

-- ─────────────────────────────────────────────
-- 2) RLS
-- ─────────────────────────────────────────────
-- 주의: CREATE POLICY 에서 TO 역할을 생략하면 기본값이 PUBLIC 이 되어 anon(익명 키)까지 포함된다.
--       surveys 사고의 본질이 바로 이것이었다. 그래서 아래 4개 정책은 모두 TO authenticated 를 명시한다.
ALTER TABLE public.exam_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_analyses'
      AND policyname = 'Authenticated select exam_analyses'
  ) THEN
    CREATE POLICY "Authenticated select exam_analyses"
      ON public.exam_analyses FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_analyses'
      AND policyname = 'Authenticated insert exam_analyses'
  ) THEN
    CREATE POLICY "Authenticated insert exam_analyses"
      ON public.exam_analyses FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_analyses'
      AND policyname = 'Authenticated update exam_analyses'
  ) THEN
    CREATE POLICY "Authenticated update exam_analyses"
      ON public.exam_analyses FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_analyses'
      AND policyname = 'Authenticated delete exam_analyses'
  ) THEN
    CREATE POLICY "Authenticated delete exam_analyses"
      ON public.exam_analyses FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 이중 잠금: 정책과 별개로 anon 의 테이블 권한 자체를 회수한다.
REVOKE ALL ON public.exam_analyses FROM anon;

-- ─────────────────────────────────────────────
-- 3) Storage 버킷 exam-papers (비공개, 10MB, 이미지 4종)
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exam-papers',
  'exam-papers',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- storage.objects 정책도 모두 TO authenticated + bucket_id = 'exam-papers' 로 한정한다.
-- anon 정책은 만들지 않는다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated select exam-papers'
  ) THEN
    CREATE POLICY "Authenticated select exam-papers"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'exam-papers');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated insert exam-papers'
  ) THEN
    CREATE POLICY "Authenticated insert exam-papers"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'exam-papers');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated update exam-papers'
  ) THEN
    CREATE POLICY "Authenticated update exam-papers"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'exam-papers')
      WITH CHECK (bucket_id = 'exam-papers');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated delete exam-papers'
  ) THEN
    CREATE POLICY "Authenticated delete exam-papers"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'exam-papers');
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 4) 적용 후 확인
-- ─────────────────────────────────────────────
-- (a) 익명 키로 조회하면 0행이어야 한다(권한 오류가 나도 정상 — 어느 쪽이든 데이터가 보이면 안 된다).
--     curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/exam_analyses?select=id" \
--       -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
--       -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
--     → [] 또는 permission denied 이어야 한다. 행이 하나라도 나오면 즉시 중단하고 정책을 점검한다.
-- (b) 정책 4개가 모두 authenticated 전용인지:
--     SELECT policyname, cmd, roles FROM pg_policies
--     WHERE schemaname = 'public' AND tablename = 'exam_analyses';
--     → 4행, roles 가 모두 {authenticated} 이어야 한다({public} 이 보이면 사고).
-- (c) 버킷이 비공개인지:
--     SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'exam-papers';
--     → public = false 이어야 한다.
-- (d) storage 정책에 anon/public 이 없는지:
--     SELECT policyname, cmd, roles FROM pg_policies
--     WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%exam-papers%';
--     → 4행, roles 가 모두 {authenticated} 이어야 한다.
