-- ========== registrations 테이블 ==========
CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  school TEXT,
  grade TEXT,
  student_phone TEXT,
  parent_phone TEXT,
  registration_date DATE,
  assigned_class TEXT,
  teacher TEXT,
  assigned_class_2 TEXT,
  teacher_2 TEXT,
  subject TEXT,
  preferred_days TEXT,
  use_vehicle TEXT,
  test_score TEXT,
  test_note TEXT,
  location TEXT,
  consult_date TEXT,
  additional_note TEXT,
  tuition_fee INTEGER,
  report_data JSONB DEFAULT '{}'::jsonb,
  report_html TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 테이블에 컬럼 추가 (마이그레이션용)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS preferred_days TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS assigned_class_2 TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS teacher_2 TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS school_score TEXT;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_registrations_analysis_id ON registrations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_registrations_name ON registrations(name);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at DESC);

-- RLS
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registrations_all_access" ON registrations
  FOR ALL USING (true) WITH CHECK (true);

-- updated_at 트리거
CREATE TRIGGER update_registrations_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
