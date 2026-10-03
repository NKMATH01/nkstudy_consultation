-- ⚠ 이 파일은 운영 DB에 사람이 직접 검토한 뒤에만 실행한다. 자동 적용 금지.
-- 목적: 학부모 질문지(8문항) 응답 표 parent_questionnaires.
--       테스트 예약 알림톡(consult_confirm_v3) 버튼 링크 /survey/parent/<token> 으로 학부모가 답한다.
-- 원칙: 로그인한 직원(authenticated)만 읽고 쓴다. 익명 키(anon)로는 한 행도 보이지 않아야 한다.
--       공개 화면의 읽기·제출은 서버가 토큰을 확인한 뒤 service role(createTrustedWriteClient)로만 한다.
-- 근거: 20260928100000_exam_analyses.sql 과 같은 잠금 패턴(surveys 사고 재발 방지).
-- 두 번 실행해도 결과가 같다(멱등).

-- ─────────────────────────────────────────────
-- 1) 테이블
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parent_questionnaires (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  answers         jsonb,          -- 8문항 응답. 형식은 src/lib/parent-questionnaire/questions.ts 스키마.
  answered_at     timestamptz,    -- 제출 1회. 채워지면 다시 제출할 수 없다.
  revoked_at      timestamptz,    -- 직원이 링크를 회수한 시각. 회수된 행은 공개 화면에서 안내만 보인다.
  created_by      uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 상담 하나에 살아 있는(회수되지 않은) 질문지는 1개. 재발송 때는 이 행을 재사용한다.
CREATE UNIQUE INDEX IF NOT EXISTS parent_questionnaires_active_consultation_uidx
  ON public.parent_questionnaires (consultation_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS parent_questionnaires_consultation_id_idx
  ON public.parent_questionnaires (consultation_id);

-- ─────────────────────────────────────────────
-- 2) RLS
-- ─────────────────────────────────────────────
-- 주의: CREATE POLICY 에서 TO 역할을 생략하면 기본값이 PUBLIC 이 되어 anon 까지 포함된다.
--       그래서 아래 4개 정책은 모두 TO authenticated 를 명시한다.
ALTER TABLE public.parent_questionnaires ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parent_questionnaires'
      AND policyname = 'Authenticated select parent_questionnaires'
  ) THEN
    CREATE POLICY "Authenticated select parent_questionnaires"
      ON public.parent_questionnaires FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parent_questionnaires'
      AND policyname = 'Authenticated insert parent_questionnaires'
  ) THEN
    CREATE POLICY "Authenticated insert parent_questionnaires"
      ON public.parent_questionnaires FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parent_questionnaires'
      AND policyname = 'Authenticated update parent_questionnaires'
  ) THEN
    CREATE POLICY "Authenticated update parent_questionnaires"
      ON public.parent_questionnaires FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parent_questionnaires'
      AND policyname = 'Authenticated delete parent_questionnaires'
  ) THEN
    CREATE POLICY "Authenticated delete parent_questionnaires"
      ON public.parent_questionnaires FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 이중 잠금: 정책과 별개로 anon 의 테이블 권한 자체를 회수한다.
REVOKE ALL ON public.parent_questionnaires FROM anon;

-- ─────────────────────────────────────────────
-- 3) 적용 후 확인
-- ─────────────────────────────────────────────
-- (a) 익명 키로 조회하면 0행 또는 permission denied 여야 한다.
--     curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/parent_questionnaires?select=id" \
--       -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
--       -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
-- (b) 정책 4개가 모두 authenticated 전용인지:
--     SELECT policyname, cmd, roles FROM pg_policies
--     WHERE schemaname = 'public' AND tablename = 'parent_questionnaires';
--     → 4행, roles 가 모두 {authenticated} ({public} 이 보이면 사고).
-- (c) 부분 유니크·토큰 기본값:
--     SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'parent_questionnaires';
--     → parent_questionnaires_active_consultation_uidx 에 WHERE (revoked_at IS NULL)
--     SELECT column_name, column_default FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'parent_questionnaires' AND column_name IN ('token','expires_at');
-- (d) anon 권한이 비었는지:
--     SELECT privilege_type FROM information_schema.role_table_grants
--     WHERE table_schema = 'public' AND table_name = 'parent_questionnaires' AND grantee = 'anon';
--     → 0행.

-- ─────────────────────────────────────────────
-- 되돌리기 (필요할 때만, 사람이 확인 후)
-- ─────────────────────────────────────────────
-- ※ 학부모 응답이 지워진다. 먼저 백업 여부를 확인한다.
--     SELECT count(*) FROM public.parent_questionnaires WHERE answered_at IS NOT NULL;
-- ※ consult_confirm_v3 가 승인돼 쓰이는 중이면 질문지 링크가 깨진다 — v3 를 먼저 draft 로 내린다.
-- DROP TABLE IF EXISTS public.parent_questionnaires;
