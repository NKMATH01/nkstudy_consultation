-- ⚠ 이 파일은 코드(신뢰 쓰기 경로) 배포 후, 운영에서 설문 제출 1건이 정상 저장되는 것을 확인한 뒤에만 실행한다. 직접 실행 금지.
-- 목적: 공개 설문 저장을 서버 전용 경로 하나로 모으고, anon 키로 surveys에 직접 INSERT 하는 우회를 막는다.
-- 근거: docs/learning-profile-v2-evidence-audit-2026-09-01.md §9 P0.

DROP POLICY IF EXISTS "Allow anon survey submissions" ON public.surveys;
DROP POLICY IF EXISTS "surveys_insert_anon" ON public.surveys;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'surveys'
      AND policyname = 'Authenticated insert surveys'
  ) THEN
    CREATE POLICY "Authenticated insert surveys"
      ON public.surveys FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.surveys
  FROM anon;
