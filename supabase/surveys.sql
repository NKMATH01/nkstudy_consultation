-- NK 상담관리 시스템 - 설문 관리 스키마
-- surveys 테이블

CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  school TEXT,
  grade TEXT,
  student_phone TEXT,
  parent_phone TEXT,
  referral TEXT,
  prev_academy TEXT,
  prev_complaint TEXT,
  -- 30문항 점수 (1~5)
  q1 SMALLINT, q2 SMALLINT, q3 SMALLINT, q4 SMALLINT, q5 SMALLINT,
  q6 SMALLINT, q7 SMALLINT, q8 SMALLINT, q9 SMALLINT, q10 SMALLINT,
  q11 SMALLINT, q12 SMALLINT, q13 SMALLINT, q14 SMALLINT, q15 SMALLINT,
  q16 SMALLINT, q17 SMALLINT, q18 SMALLINT, q19 SMALLINT, q20 SMALLINT,
  q21 SMALLINT, q22 SMALLINT, q23 SMALLINT, q24 SMALLINT, q25 SMALLINT,
  q26 SMALLINT, q27 SMALLINT, q28 SMALLINT, q29 SMALLINT, q30 SMALLINT,
  -- 주관식
  study_core TEXT,
  problem_self TEXT,
  dream TEXT,
  prefer_days TEXT,
  requests TEXT,
  -- 6-Factor 계산 점수 (캐싱)
  factor_attitude NUMERIC(3,1),
  factor_self_directed NUMERIC(3,1),
  factor_assignment NUMERIC(3,1),
  factor_willingness NUMERIC(3,1),
  factor_social NUMERIC(3,1),
  factor_management NUMERIC(3,1),
  -- 분석 연결
  analysis_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_surveys_name ON surveys(name);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON surveys(created_at DESC);

-- RLS
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON surveys
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at 트리거
CREATE TRIGGER update_surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
