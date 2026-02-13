-- 퇴원생 테이블
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  school TEXT,
  subject TEXT,
  class_name TEXT,
  teacher TEXT,
  grade TEXT,
  enrollment_start TEXT,
  enrollment_end TEXT,
  duration_months NUMERIC,
  withdrawal_date TEXT,
  class_attitude TEXT,
  homework_submission TEXT,
  attendance TEXT,
  grade_change TEXT,
  recent_grade TEXT,
  reason_category TEXT,
  student_opinion TEXT,
  parent_opinion TEXT,
  teacher_opinion TEXT,
  final_consult_date TEXT,
  final_counselor TEXT,
  final_consult_summary TEXT,
  parent_thanks BOOLEAN DEFAULT FALSE,
  comeback_possibility TEXT,
  expected_comeback_date TEXT,
  special_notes TEXT,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON withdrawals FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
