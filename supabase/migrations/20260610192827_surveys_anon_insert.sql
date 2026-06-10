-- 공개 설문(/survey) anon 제출용. 적용 후 T-03b(코드의 SERVICE_ROLE_KEY 분기 제거) 진행 가능.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'surveys'
      AND policyname = 'Allow anon survey submissions'
  ) THEN
    CREATE POLICY "Allow anon survey submissions"
      ON public.surveys
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;
