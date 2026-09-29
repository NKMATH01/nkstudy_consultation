-- ⚠ 이 파일은 운영 DB에 사람이 직접 검토한 뒤에만 실행한다. 자동 적용 금지(db push 금지).
-- 목적: 입학테스트 점수를 등록 화면·반 배정 도우미가 바로 읽을 수 있게 exam_analyses 에 칸 4개를 더한다.
--       지금 점수는 report_tokens.report_html(exam_v1 JSON) 안에만 있다.
-- 원칙: 추가만 한다(기존 칸·기존 값은 건드리지 않음). 여러 번 실행해도 결과가 같다(IF NOT EXISTS · 점수 세 칸 모두 NULL 가드).
-- 채우는 곳: scripts/exam-push.mjs (앞으로 올리는 분석지). 아래 백필은 이미 올라간 분석지용 1회분.
-- score_summary 는 백필하지 않는다 — 비어 있으면 앱(src/lib/actions/exam-lookup.ts)이 units 로 즉석 계산한다.

-- ─────────────────────────────────────────────
-- 1) 칸 추가 (전부 nullable)
-- ─────────────────────────────────────────────
ALTER TABLE public.exam_analyses ADD COLUMN IF NOT EXISTS score_raw     numeric;
ALTER TABLE public.exam_analyses ADD COLUMN IF NOT EXISTS score_max     numeric;
ALTER TABLE public.exam_analyses ADD COLUMN IF NOT EXISTS score_grade   text;
ALTER TABLE public.exam_analyses ADD COLUMN IF NOT EXISTS score_summary text;

COMMENT ON COLUMN public.exam_analyses.score_raw     IS '입학테스트 원점수 (분석지 score.raw)';
COMMENT ON COLUMN public.exam_analyses.score_max     IS '입학테스트 만점 (분석지 score.max)';
COMMENT ON COLUMN public.exam_analyses.score_grade   IS '입학테스트 등급 (분석지 score.grade, 글자로 보관)';
COMMENT ON COLUMN public.exam_analyses.score_summary IS '약점 2개·강점 1개 한 줄 요약 (scripts/lib/exam-score-summary.mjs)';

-- ─────────────────────────────────────────────
-- 2) 백필 — report_tokens(report_type='exam_v1') JSON 에서 raw/max/grade 만, 세 칸이 모두 NULL 인 행에만
--    (한 칸이라도 값이 있으면 사람이나 exam-push 가 넣은 값이므로 건드리지 않는다)
-- ─────────────────────────────────────────────
-- JSON 이 깨진 행이 하나 있어도 전체가 멈추지 않도록 행마다 따로 읽는다(깨진 행은 NOTICE 만 남기고 건너뜀).
DO $$
DECLARE
  r record;
  j jsonb;
BEGIN
  FOR r IN
    SELECT ea.id, rt.report_html
    FROM public.exam_analyses ea
    JOIN public.report_tokens rt ON rt.token::text = ea.report_token
    WHERE rt.report_type = 'exam_v1'
      AND ea.score_raw IS NULL
      AND ea.score_max IS NULL
      AND ea.score_grade IS NULL
      AND rt.report_html IS NOT NULL
  LOOP
    BEGIN
      j := r.report_html::jsonb;
    EXCEPTION WHEN others THEN
      RAISE NOTICE '[exam_analyses_scores] JSON 을 읽지 못해 건너뜀: %', r.id;
      CONTINUE;
    END;

    UPDATE public.exam_analyses
    SET
      score_raw = CASE WHEN jsonb_typeof(j #> '{score,raw}') = 'number'
                       THEN (j #>> '{score,raw}')::numeric END,
      score_max = CASE WHEN jsonb_typeof(j #> '{score,max}') = 'number'
                       THEN (j #>> '{score,max}')::numeric END,
      score_grade = CASE WHEN jsonb_typeof(j #> '{score,grade}') IN ('number', 'string')
                         THEN NULLIF(btrim(j #>> '{score,grade}'), '') END
    WHERE id = r.id
      AND score_raw IS NULL
      AND score_max IS NULL
      AND score_grade IS NULL;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
-- 3) 적용 후 확인
-- ─────────────────────────────────────────────
-- (a) 칸 4개가 생겼는지:
--     SELECT column_name, data_type, is_nullable FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'exam_analyses' AND column_name LIKE 'score_%'
--     ORDER BY column_name;
--     → score_grade(text)·score_max(numeric)·score_raw(numeric)·score_summary(text), 전부 YES
-- (b) 백필 결과(분석지가 있는 행은 점수가 채워져야 한다):
--     SELECT ea.id, ea.student_name, ea.status, ea.score_raw, ea.score_max, ea.score_grade
--     FROM public.exam_analyses ea
--     WHERE ea.report_token IS NOT NULL
--     ORDER BY ea.created_at DESC;
-- (c) 기존 값은 그대로인지(추가만 했는지): status·report_token·analyzed_at 이 적용 전과 같아야 한다.

-- ─────────────────────────────────────────────
-- 4) 되돌리기 (필요할 때만, 사람이 직접)
-- ─────────────────────────────────────────────
-- ALTER TABLE public.exam_analyses DROP COLUMN IF EXISTS score_summary;
-- ALTER TABLE public.exam_analyses DROP COLUMN IF EXISTS score_grade;
-- ALTER TABLE public.exam_analyses DROP COLUMN IF EXISTS score_max;
-- ALTER TABLE public.exam_analyses DROP COLUMN IF EXISTS score_raw;
-- (칸을 지우기 전에 scripts/exam-push.mjs 가 이 칸을 쓰지 않도록 먼저 되돌려야 한다 —
--  단, exam-push.mjs 는 칸이 없으면(PGRST204) 점수 칸을 빼고 다시 저장하도록 되어 있다.)
