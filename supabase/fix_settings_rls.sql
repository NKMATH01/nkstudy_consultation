-- ============================================================
-- 학생/선생님/반 RLS 정책 복구
-- 사용법: Supabase Dashboard → SQL Editor 에서 실행
-- ============================================================

-- ============== students ==============
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON students;
DROP POLICY IF EXISTS "students_all_authenticated" ON students;
DROP POLICY IF EXISTS "students_select" ON students;
DROP POLICY IF EXISTS "students_insert" ON students;
DROP POLICY IF EXISTS "students_update" ON students;
DROP POLICY IF EXISTS "students_delete" ON students;

CREATE POLICY "students_all_authenticated"
  ON students FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============== teachers ==============
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON teachers;
DROP POLICY IF EXISTS "teachers_all_authenticated" ON teachers;
DROP POLICY IF EXISTS "teachers_select" ON teachers;
DROP POLICY IF EXISTS "teachers_insert" ON teachers;
DROP POLICY IF EXISTS "teachers_update" ON teachers;
DROP POLICY IF EXISTS "teachers_delete" ON teachers;

CREATE POLICY "teachers_all_authenticated"
  ON teachers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============== classes ==============
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON classes;
DROP POLICY IF EXISTS "classes_all_authenticated" ON classes;
DROP POLICY IF EXISTS "classes_select" ON classes;
DROP POLICY IF EXISTS "classes_insert" ON classes;
DROP POLICY IF EXISTS "classes_update" ON classes;
DROP POLICY IF EXISTS "classes_delete" ON classes;

CREATE POLICY "classes_all_authenticated"
  ON classes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============== 검증 ==============
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename IN ('students', 'teachers', 'classes')
ORDER BY tablename, policyname;
