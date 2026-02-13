-- 선생님 권한 관리 마이그레이션
-- Supabase SQL Editor에서 실행

-- 1. teachers 테이블에 allowed_menus 컬럼 추가
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS allowed_menus JSONB;

-- 2. 총괄관리자 김기영 레코드 생성/업데이트
-- 이미 존재하면 이름과 역할 업데이트
INSERT INTO teachers (name, phone, role, password, building, is_active)
VALUES ('김기영', '01047242316', 'admin', '1004', NULL, true)
ON CONFLICT (phone) DO UPDATE SET
  name = '김기영',
  role = 'admin',
  password = '1004',
  is_active = true;

-- phone에 unique constraint가 없는 경우 대비
-- 먼저 기존 레코드 확인 후 업데이트
UPDATE teachers
SET name = '김기영', role = 'admin', password = '1004', is_active = true
WHERE phone = '01047242316' OR phone = '010-4724-2316';
