-- ========== analyses 테이블 ==========
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID REFERENCES surveys(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  school TEXT,
  grade TEXT,
  -- 6-Factor AI 점수
  score_attitude NUMERIC(3,1),
  score_self_directed NUMERIC(3,1),
  score_assignment NUMERIC(3,1),
  score_willingness NUMERIC(3,1),
  score_social NUMERIC(3,1),
  score_management NUMERIC(3,1),
  -- AI 점수별 코멘트
  comment_attitude TEXT,
  comment_self_directed TEXT,
  comment_assignment TEXT,
  comment_willingness TEXT,
  comment_social TEXT,
  comment_management TEXT,
  -- AI 분석 결과
  student_type TEXT,
  summary TEXT,
  strengths JSONB DEFAULT '[]'::jsonb,
  weaknesses JSONB DEFAULT '[]'::jsonb,
  paradox JSONB DEFAULT '[]'::jsonb,
  solutions JSONB DEFAULT '[]'::jsonb,
  final_assessment TEXT,
  report_html TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_analyses_survey_id ON analyses(survey_id);
CREATE INDEX IF NOT EXISTS idx_analyses_name ON analyses(name);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);

-- RLS
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analyses_all_access" ON analyses
  FOR ALL USING (true) WITH CHECK (true);

-- updated_at 트리거
CREATE TRIGGER update_analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
