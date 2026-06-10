# Supabase Legacy SQL

이 폴더는 현재 마이그레이션 체인에 편입되지 않은 과거 Supabase SQL 보관본입니다. 신규 적용은 `supabase/migrations/`의 timestamped migration 파일을 기준으로 합니다.

- `analyses.sql`: `analyses` 테이블, 인덱스, RLS, `updated_at` 트리거 초기 정의.
- `bookings.sql`: 공개 상담 예약용 `bookings`, `blocked_slots` 테이블과 RLS 초기 정의.
- `consultation_record_migration.sql`: 상담 기록지 입력을 위한 `consultations` 추가 컬럼 정의.
- `fix_settings_rls.sql`: 학생, 선생님, 반 설정 테이블의 authenticated RLS 정책 복구 스크립트.
- `insert_withdrawals.sql`: `withdrawals` 테이블 생성과 과거 퇴원 기록 30건 삽입 스크립트.
- `onboarding_migration.sql`: `registrations.onboarding_status` 컬럼과 온보딩 검증용 등록 데이터 추가 스크립트.
- `permissions_migration.sql`: 선생님 메뉴 권한(`allowed_menus`)과 관리자 계정 보정 스크립트.
- `registrations.sql`: `registrations` 테이블, 보정 컬럼, 인덱스, RLS, 트리거 초기 정의.
- `report_tokens.sql`: 공개 보고서 접근 토큰 테이블과 RLS 정책 정의.
- `rls_update.sql`: 상담, 설문, 분석, 등록 테이블 RLS 정책 일괄 갱신 스크립트.
- `schema.sql`: profiles, teachers, classes, consultations 등 초기 핵심 스키마 정의.
- `seven_factor_migration.sql`: 35문항 7-Factor 확장 컬럼과 분석 감정 점수 컬럼 추가 스크립트.
- `students.sql`: `students` 테이블, 인덱스, RLS, `updated_at` 트리거 초기 정의.
- `surveys.sql`: `surveys` 테이블, 인덱스, RLS, `updated_at` 트리거 초기 정의.
- `teacher_auth_migration.sql`: 선생님 비밀번호 변경 상태와 Supabase Auth 연결 컬럼 추가 스크립트.
- `test_fee_migration.sql`: 상담 테스트비 납부 상태와 납부 방식 컬럼 추가 스크립트.
- `withdrawals.sql`: `withdrawals` 테이블, 인덱스, RLS, `updated_at` 트리거 초기 정의.

## Drift Notes

- `rls_update.sql`의 analyses 개방 정책은 운영 미적용(운영은 authenticated 전용), surveys anon INSERT는 2026-06-10 별도 마이그레이션으로 적용됨.
