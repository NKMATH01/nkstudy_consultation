-- 학생 테이블
-- 컬럼 매핑: phone → student_phone, class_name → assigned_class,
--           teacher_name → teacher, is_active → active (앱 인터페이스)
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  class_name TEXT,
  school TEXT,
  grade TEXT,
  phone TEXT,
  parent_phone TEXT,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  clinic_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  teacher_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  memo TEXT,
  registration_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_students_name ON students (name);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students (grade);
CREATE INDEX IF NOT EXISTS idx_students_class_name ON students (class_name);
CREATE INDEX IF NOT EXISTS idx_students_is_active ON students (is_active);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_students_updated_at();

-- RLS 정책
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON students
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
