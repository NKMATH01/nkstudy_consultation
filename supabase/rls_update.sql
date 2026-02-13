-- ============================================================
-- NK Consultation RLS 정책 업데이트
-- 실행 전 기존 정책을 먼저 DROP 해야 합니다
-- ============================================================

-- ========================
-- 1. consultations 테이블
-- ========================
-- 단일 학원 운영 환경: 모든 인증된 상담사가 전체 상담 데이터 접근 가능
-- 참고: booking 자동 생성 상담은 created_by가 NULL이므로
--       created_by 기반 제한 정책 사용 시 접근 불가 문제 발생 (C-01)

-- 기존 정책 제거
DROP POLICY IF EXISTS "consultations_select" ON consultations;
DROP POLICY IF EXISTS "consultations_insert" ON consultations;
DROP POLICY IF EXISTS "consultations_update" ON consultations;
DROP POLICY IF EXISTS "consultations_delete" ON consultations;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON consultations;
DROP POLICY IF EXISTS "consultations_all_authenticated" ON consultations;

-- RLS 활성화
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 접근 (단일 학원 운영 환경)
CREATE POLICY "consultations_all_authenticated"
  ON consultations
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========================
-- 2. surveys 테이블
-- ========================

-- 기존 정책 제거
DROP POLICY IF EXISTS "surveys_select" ON surveys;
DROP POLICY IF EXISTS "surveys_insert_anon" ON surveys;
DROP POLICY IF EXISTS "surveys_insert_auth" ON surveys;
DROP POLICY IF EXISTS "surveys_update" ON surveys;
DROP POLICY IF EXISTS "surveys_delete" ON surveys;

-- RLS 활성화
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

-- 보안: 익명 사용자도 설문 제출 가능 (공개 설문 폼)
CREATE POLICY "surveys_insert_anon"
  ON surveys FOR INSERT
  TO anon
  WITH CHECK (true);

-- 보안: 인증된 사용자는 설문 삽입 가능
CREATE POLICY "surveys_insert_auth"
  ON surveys FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 보안: 인증된 상담사는 모든 설문 조회 가능 (상담 업무에 필요)
CREATE POLICY "surveys_select"
  ON surveys FOR SELECT
  TO authenticated
  USING (true);

-- 보안: 인증된 사용자만 설문 수정 가능
CREATE POLICY "surveys_update"
  ON surveys FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 보안: 인증된 사용자만 설문 삭제 가능
CREATE POLICY "surveys_delete"
  ON surveys FOR DELETE
  TO authenticated
  USING (true);

-- ========================
-- 3. analyses 테이블
-- ========================
-- 참고: analyses 테이블에 created_by 컬럼이 없으므로
--       인증된 사용자 전체 접근 정책 사용

-- 기존 정책 제거
DROP POLICY IF EXISTS "analyses_select" ON analyses;
DROP POLICY IF EXISTS "analyses_insert" ON analyses;
DROP POLICY IF EXISTS "analyses_update" ON analyses;
DROP POLICY IF EXISTS "analyses_delete" ON analyses;
DROP POLICY IF EXISTS "analyses_all_access" ON analyses;

-- RLS 활성화
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 접근 (단일 학원 운영 환경)
CREATE POLICY "analyses_select"
  ON analyses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "analyses_insert"
  ON analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "analyses_update"
  ON analyses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "analyses_delete"
  ON analyses FOR DELETE
  TO authenticated
  USING (true);

-- ========================
-- 4. registrations 테이블
-- ========================
-- 참고: registrations 테이블에 created_by 컬럼이 없으므로
--       인증된 사용자 전체 접근 정책 사용

-- 기존 정책 제거
DROP POLICY IF EXISTS "registrations_select" ON registrations;
DROP POLICY IF EXISTS "registrations_insert" ON registrations;
DROP POLICY IF EXISTS "registrations_update" ON registrations;
DROP POLICY IF EXISTS "registrations_delete" ON registrations;
DROP POLICY IF EXISTS "registrations_all_access" ON registrations;

-- RLS 활성화
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 접근 (단일 학원 운영 환경)
CREATE POLICY "registrations_select"
  ON registrations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "registrations_insert"
  ON registrations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "registrations_update"
  ON registrations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "registrations_delete"
  ON registrations FOR DELETE
  TO authenticated
  USING (true);
