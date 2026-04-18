# Changelog

All notable changes to NK 상담관리 시스템 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2026-04-01] - Registration Validation Bug Fix

### Fixed
- **Validation schema**: `assigned_class`, `teacher` → 과목 조건부 필수로 변경 (영어전용 과목 시 수학 필드 필수 에러 해결)
- **Form handler**: 반 선택 시 스케줄 미설정 상황에서 빈값 덮어쓰기 방지
  - `handleClassChange`, `handleClass2Change`, `handleClassMathChange` 에 조건부 setValue 로직 추가
- **Server actions**: `createRegistration`, `regenerateRegistration` 에서 "영어" 과목 시 영어반 스케줄 DB 조회 추가
- **Error display**: Validation 에러 메시지 필드별 개별 표시로 사용자 경험 개선
- **Validation schema**: 수업 요일/시간 필드를 optional로 변경 (DB fallback 활용)

### Changed
- Registration form error handling: 한 번에 1개 에러만 표시 → 모든 필드 에러 동시 표시
- Debug logging: 폼 상태 추적용 console.log 추가

### Technical Details
- **Root cause**: validation 필수 조건 vs UI 표시 조건 불동기, 폼 핸들러 빈값 덮어쓰기, 서버 액션 영어 조건 누락
- **Files modified**: 
  - `src/lib/validations/registration.ts` (schema refine logic)
  - `src/components/registrations/registration-form-client.tsx` (handler + error display)
  - `src/lib/actions/registration.ts` (영어 과목 조건)
- **Commits**: 802baa6, 057c458, 93e0335, 51d3922, ae6a87c
- **Match rate**: 95% (19/20 items)

**Related report**: `docs/04-report/features/registration-validation.report.md`

---

## [2026-02-19] - System Integrity Check

### Fixed
- **Data integrity**: 설문↔분석 이중 링크 불일치 시 고아 분석 감지/삭제 로직 추가
- **Data flow**: `handleAnalyze` 및 설문 삭제 다이얼로그에서 `analysisMap` fallback 체크
- **Cache invalidation**: 분석/설문 삭제 후 등록안내, 온보딩 페이지 revalidatePath 추가
- **DB mapping**: `registration.ts` Class 타입 매핑 수정 (description → class_days)
- **Security**: `withdrawals` 테이블 RLS 보안 정책 수정 (TO authenticated 추가)

### Changed
- Analysis delete: `revalidatePath("/registrations")`, `revalidatePath("/onboarding")` 추가
- Survey delete: `revalidatePath("/registrations")`, `revalidatePath("/onboarding")` 추가

### Technical Details
- **Root causes**: 양방향 링크 구조, 캐시 무효화 누락, DB-TS 매핑 불일치, RLS 정책 누락
- **Issues resolved**: 8 critical issues
- **Match rate**: 100%

**Related report**: `docs/04-report/features/system-integrity-check.report.md`

---

## Legend

### Categories
- **Added**: 새로운 기능
- **Changed**: 기존 기능 변경
- **Fixed**: 버그 수정
- **Deprecated**: 더 이상 권장되지 않음
- **Removed**: 제거된 기능
- **Security**: 보안 관련 수정
- **Technical**: 기술적 개선 (리팩토링, 성능 최적화 등)

### Severity Levels
- **Critical**: 시스템 오류, 보안 취약점
- **High**: 주요 기능 장애
- **Medium**: 부분적 기능 장애
- **Low**: 미미한 영향

---

> Last updated: 2026-04-01
