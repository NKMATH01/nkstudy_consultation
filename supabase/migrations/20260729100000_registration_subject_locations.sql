-- 과목별 수업 장소 분리 + classes.location 드리프트 정리
-- File only: apply after user approval.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS location_math2 TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS location_2 TEXT;
COMMENT ON COLUMN registrations.location       IS '수학1(또는 단일 과목) 수업 장소';
COMMENT ON COLUMN registrations.location_math2 IS '수학2 수업 장소 (고2·고3 이중 수학반)';
COMMENT ON COLUMN registrations.location_2     IS '영어 수업 장소';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS location TEXT; -- 코드가 이미 참조 중(운영 DB 기존재), 스키마 파일 정합화
UPDATE registrations SET location_2 = location
 WHERE location_2 IS NULL AND subject IN ('영어','영어수학') AND location IS NOT NULL;
