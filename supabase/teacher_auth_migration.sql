-- 선생님 테이블에 비밀번호 변경 여부, Supabase Auth 연결 컬럼 추가
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT FALSE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 기존 선생님 중 password가 NULL인 경우 기본값 설정
UPDATE teachers SET password = '1234' WHERE password IS NULL;
UPDATE teachers SET password_changed = FALSE WHERE password_changed IS NULL;
UPDATE teachers SET role = 'teacher' WHERE role IS NULL;

-- 총괄관리자 계정 (없으면 삽입)
INSERT INTO teachers (name, phone, role, password, password_changed, building)
SELECT '총괄관리자', '01047242316', 'admin', '1234', FALSE, NULL
WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE phone = '01047242316');

-- 이미 있으면 role을 admin으로 업데이트
UPDATE teachers SET role = 'admin', password = '1234', password_changed = FALSE
WHERE phone = '01047242316';
