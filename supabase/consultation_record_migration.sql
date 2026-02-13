-- 상담 기록지 컬럼 추가 마이그레이션
-- Supabase SQL Editor에서 실행

-- 기존학원
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS prev_academy TEXT;

-- 불만사항
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS prev_complaint TEXT;

-- 내신 점수
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS school_score TEXT;

-- 테스트 점수
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS test_score TEXT;

-- 선행 정도
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS advance_level TEXT;

-- 학습 목표
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS study_goal TEXT;

-- 희망 요일
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS prefer_days TEXT;

-- 등록 예정일
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS plan_date DATE;

-- 등록 예정반
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS plan_class TEXT;

-- 학원에 바라는 점
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS requests TEXT;

-- 학생 상담 특이사항
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS student_consult_note TEXT;

-- 학부모 상담 메모
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS parent_consult_note TEXT;
