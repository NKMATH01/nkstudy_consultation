-- ⚠ 적용은 원장 승인 후. 운영 DB 에 사람이 직접 검토한 뒤 SQL Editor 에서만 실행한다(db push 금지).
-- 목적: 설문 목록에서 시험지·매쓰플랫을 따로 올리고 "분석 요청" 을 눌러야 분석 대기로 넘어가게 한다.
--   (a) status 에 'draft'(작성 중) 추가. exam-pull 은 status='pending' 만 가져가므로 draft 는 원장님 PC 로 넘어가지 않는다.
--   (b) 분석 요청 시각·요청한 사람(requested_at·requested_by).
--   (c) 상담 1건에 작성 중 시험은 하나만(부분 유니크).
-- 원칙: 추가만. 기존 행·기존 상태 값은 건드리지 않는다. 여러 번 실행해도 결과가 같다(멱등).
-- 앱: src/lib/actions/exam-analysis.ts (addExamFiles — 처음 올릴 때 draft 생성 · requestExamAnalysis).
--     이 파일을 적용하기 전에는 새 아이콘(시험지·매쓰플랫·분석 요청)이 "저장 실패" 로 끝난다. 기존 한 화면 올리기는 영향 없음.

-- ─────────────────────────────────────────────
-- (a) status CHECK 에 'draft' 추가
--     처음 만든 이름은 exam_analyses_status_check(20260928100000). 운영에서 이름이 달라졌을 수도 있어
--     status 칸에 걸린 CHECK 를 이름과 상관없이 모두 지우고 같은 이름으로 다시 만든다.
-- ─────────────────────────────────────────────
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.exam_analyses'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.exam_analyses DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.exam_analyses
  ADD CONSTRAINT exam_analyses_status_check
  CHECK (status IN ('draft', 'pending', 'analyzing', 'done', 'sent'));

-- 기본값은 그대로 'pending' (기존 한 화면 올리기·외부 스크립트가 status 없이 넣어도 바로 분석 대기).

-- ─────────────────────────────────────────────
-- (b) 분석 요청 기록 칸
-- ─────────────────────────────────────────────
ALTER TABLE public.exam_analyses ADD COLUMN IF NOT EXISTS requested_at timestamptz;
ALTER TABLE public.exam_analyses ADD COLUMN IF NOT EXISTS requested_by uuid;

COMMENT ON COLUMN public.exam_analyses.requested_at IS '작성 중(draft) → 분석 요청됨(pending) 으로 넘긴 시각';
COMMENT ON COLUMN public.exam_analyses.requested_by IS '분석 요청을 누른 직원(auth.users.id)';

-- ─────────────────────────────────────────────
-- (c) 상담 1건에 작성 중 시험은 하나만
-- ─────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS exam_analyses_one_draft_per_consultation
  ON public.exam_analyses (consultation_id)
  WHERE status = 'draft';

-- ─────────────────────────────────────────────
-- 적용 후 확인
-- ─────────────────────────────────────────────
-- (1) CHECK 가 하나이고 draft 를 포함하는지:
--     SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conrelid = 'public.exam_analyses'::regclass AND contype = 'c';
--     → exam_analyses_status_check 1행, ('draft','pending','analyzing','done','sent')
-- (2) 칸 2개:
--     SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'exam_analyses' AND column_name LIKE 'requested_%';
--     → requested_at(timestamp with time zone)·requested_by(uuid)
-- (3) 부분 유니크:
--     SELECT indexdef FROM pg_indexes WHERE indexname = 'exam_analyses_one_draft_per_consultation';
--     → ... (consultation_id) WHERE (status = 'draft'::text)
-- (4) 기존 행 불변: SELECT status, count(*) FROM public.exam_analyses GROUP BY status; 가 적용 전과 같다.

-- ─────────────────────────────────────────────
-- 되돌리기 (필요할 때만, 사람이 확인 후)
-- ─────────────────────────────────────────────
-- ※ 작성 중 행이 있으면 CHECK 를 되돌릴 수 없다. 먼저 확인하고, 남길지 지울지 정한다.
--     SELECT id, consultation_id, created_at FROM public.exam_analyses WHERE status = 'draft';
-- DROP INDEX IF EXISTS public.exam_analyses_one_draft_per_consultation;
-- ALTER TABLE public.exam_analyses DROP CONSTRAINT IF EXISTS exam_analyses_status_check;
-- ALTER TABLE public.exam_analyses
--   ADD CONSTRAINT exam_analyses_status_check CHECK (status IN ('pending', 'analyzing', 'done', 'sent'));
-- ALTER TABLE public.exam_analyses DROP COLUMN IF EXISTS requested_by;
-- ALTER TABLE public.exam_analyses DROP COLUMN IF EXISTS requested_at;
