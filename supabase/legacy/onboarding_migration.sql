-- Onboarding Migration: Run in Supabase SQL Editor

-- 1. Add onboarding_status column if not exists
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS onboarding_status JSONB DEFAULT '{}';

-- 2. Insert a test registration for onboarding verification
INSERT INTO registrations (
  name, school, grade, student_phone, parent_phone,
  registration_date, assigned_class, subject, teacher,
  report_html, onboarding_status
) VALUES (
  '테스트학생', '테스트중학교', '중2', '010-1234-5678', '010-9876-5432',
  '2025-02-01', '중2M1', '수학', '김선생',
  '<html><body><h1>테스트 등록안내문</h1><p>이것은 테스트 등록안내문입니다.</p></body></html>',
  '{"doc_confirmed": true, "mathflat_entered": false, "pre_parent_consult": false, "post_student_consult": false, "two_week_consult": false, "four_week_consult": false}'::jsonb
)
ON CONFLICT DO NOTHING;
