-- 7-Factor 확장 마이그레이션
-- 실행: Supabase SQL Editor에서 직접 실행

-- surveys 테이블: 신규 문항 5개 + 주관식 2개 + 7번째 Factor
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS q31 SMALLINT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS q32 SMALLINT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS q33 SMALLINT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS q34 SMALLINT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS q35 SMALLINT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS math_difficulty TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS english_difficulty TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS factor_emotion NUMERIC(3,1);

-- analyses 테이블: 7번째 Factor 점수 + 코멘트
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS score_emotion NUMERIC(3,1);
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS comment_emotion TEXT;
