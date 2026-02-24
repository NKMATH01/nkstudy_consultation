-- 학부모 상담 별도 날짜/시간/장소 필드 추가
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS parent_consult_date DATE;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS parent_consult_time TIME;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS parent_location TEXT;
