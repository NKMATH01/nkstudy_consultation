-- 공개 보고서 토큰 테이블
CREATE TABLE IF NOT EXISTS report_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  report_type TEXT NOT NULL,  -- 'analysis' | 'registration'
  report_html TEXT NOT NULL,
  name TEXT,                  -- 학생 이름 (표시용)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_report_tokens_token ON report_tokens(token);
CREATE INDEX IF NOT EXISTS idx_report_tokens_expires_at ON report_tokens(expires_at);

-- RLS
ALTER TABLE report_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read by token" ON report_tokens FOR SELECT USING (true);
CREATE POLICY "Auth users can insert" ON report_tokens FOR INSERT TO authenticated WITH CHECK (true);
