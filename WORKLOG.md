# WORKLOG — NK 상담관리 시스템

> 세션 단위 작업 기록. 최신이 위. (TASK.md는 2026-06-10 전수점검 명세서 — 별도 문서)

---

## ▶ 다음 세션 시작 체크리스트 (2026-07-09 세션 마감 기준)

**배포 상태**: origin/master = `28744ad`, Vercel 자동 배포 완료 추정. 07-08~09 이틀간 총 5개 커밋 배포 (RSC 에러 → 스키마 복구 → 동시성 방어 → API 보안 → 진도현황 리디자인 2건).

1. **[최우선] 사용자 확인 대기** — `/progress` 진도현황 리디자인(76f1336+28744ad)과 학생관리 "반 학년 기준" 교차 배정 실사용 피드백. 디자인 추가 다듬기 요청 나올 수 있음 (부분 스크린샷 받아 해당 부분만 수정하는 방식으로).
2. **미커밋 ~40개 파일 정리** — 알림톡(alimtalk·solapi), drip-survey, /feedback, /drip-responses, sidebar/header/middleware/env/package.json 수정, scripts/·test-*.py. 기능 단위 검토 후 선별 커밋 or 폐기. `20260630120000_nkc_alimtalk.sql` 운영 적용 여부도 미확인.
3. **보류 항목** (07-09 race 점검에서 후순위 처리): alimtalk.ts·drip-survey.ts의 throw 패턴(프로덕션 마스킹 동일 버그 후보), toggleBookingPaid lost-update, createTeacher Auth-orphan, deleteSurvey/deleteStudent 연쇄 삭제 순서, 인메모리 rate limit 서버리스 한계.
4. **진도현황 예상 진도율** — 현재 정의(교재 시작일~마감일 시간 경과 비율)가 실사용에서 자연스러운지 확인. 마감일(target_end_date) 미입력 반은 "예상 정보 없음"으로 나옴 → 강사들에게 마감일 입력 안내 필요할 수 있음.

**작업 체계 리마인드**: Claude=브레인(분석·명세·검증·푸시), Opus 4.8 실행자=코드 수정·커밋(푸시는 권한 문제로 브레인이 수행). DDL은 사용자가 SQL Editor에서 실행(주소: https://supabase.com/dashboard/project/scrliiiiexjedgzogcfo/sql/new). 운영 데이터 변경 스크립트는 사용자가 `! node scripts/...`로 직접 실행.

---

## 2026-07-09 (목) — 진도현황(/progress) 페이지 리디자인 (커밋 `76f1336`)

사용자가 제작한 디자인 시안(`../디자인참고/ChatGPT Image 2026년 7월 9일 오후 04_47_40.png`) 기반 전면 재구성 + 기능 5건:
1. 교재 마감일정(target_end_date) 컬럼 노출 + 페이스 상태 배지
2. 지난 교재 한 줄 요약 (최신 1권 + "외 N권")
3. 진행 단원(대단원/소단원) 인라인 입력 — `class_progress.current_major_unit/current_minor_unit` 컬럼 추가(사용자 DDL 실행, 마이그레이션 `20260709160000_progress_current_units.sql`), 신규 액션 `updateCurrentUnits`(권한 체크 포함)
4. 이번주 진도 칩 — weekly_progress를 목요일 00:00 기준 주간 계산으로 변경(이전 로그 없으면 최근 2건 차이 fallback)
5. 상세보기 진도입력현황 최근 5건만 표시

예상 진도율 정의(합의): 시작일=최근 교재 이력 finished_on(없으면 progress.created_at), 종료일=target_end_date, 시간 경과 비율. 분류: 지연 diff<-5%p / 정상 ±5%p / 앞섬 >+5%p.

**후속 조정 (커밋 `28744ad`)**: 지난 교재 3권까지 표시(4권↑ "외 N권"), 학생관리 반 배정에 "반 학년 기준" select 상시 노출(초6→중1반 등 교차 배정 — 기존 버튼 토글 UI를 select로 교체), 진도보드 스타일 폴리시.

---

## 2026-07-09 (목) — race condition / partial-write 전수 점검 및 방어 (커밋 `82db691`)

**전수 조사**: 서버 액션 13개 + API 라우트 4개에서 race 6건·partial-write 8건 발견 (조사 상세는 세션 기록). 데이터 근거: bookings 대면 슬롯 중복 5건이 이미 운영에서 발생해 있었음.

### 적용된 방어
- **DB unique 인덱스 3개** (사용자가 SQL Editor 실행, `supabase/migrations/20260709090000_race_condition_unique_indexes.sql`): `uq_analyses_survey_id`, `uq_registrations_analysis_id`, `uq_blocked_slots_slot` — pg_indexes로 적용 확인 완료.
- **submitBooking**: 삽입 후 같은 슬롯 재조회 → 나보다 먼저(created_at, 동률 시 id) 접수된 행과 충돌 시 자기 행 삭제 후 실패 반환. (대면 이중예약 차단)
- **analyzeSurvey**: insert → `upsert(onConflict: "survey_id")`. 재분석 시 같은 행 갱신으로 id 보존 → registrations/surveys 링크 유지. `reAnalyzeSurvey`는 `analyzeSurvey` 호출로 단순화(옛 삭제 로직 제거).
- **generateRegistration**: 23505 시 기존 등록안내 반환(이중 클릭 → 기존 문서로 이동). 학생 등록/상담 상태 변경 실패는 warning으로 사용자 고지 (클라 2곳 toast.warning 추가).
- **createWithdrawal**: 학생 비활성화 실패 시 warning 고지.
- **syncConsultationToBooking**: maybeSingle → order+limit(1) (동일 조건 2건 이상 시 크래시 수정).
- **submitPublicSurvey**: 10분 내 동일 이름(+학부모 연락처) 재제출 차단.
- **차단슬롯 토글**: 23505=이미 차단으로 처리, 해제는 조건 삭제(중복 행 일괄 해제). **deleteBooking**: 예약 먼저 삭제 후 상담 삭제(순서 교정), 상담 삭제 실패 시 warning.

### 추가 수정 (같은 날, 커밋 `64b3df8`)
- **[보안] `/api/onboarding-status` PATCH 인증 추가** — 로그인 세션 필수(401) + status payload 검증(고정 항목 boolean, `_custom`은 {id,label,done} 배열·label≤200자만 허용, 그 외 400). 주의: 커스텀 체크항목이 `_custom` 키로 같은 payload에 실리므로 단순 "boolean만" 검증은 기능 회귀를 일으킴(실행자가 발견, 조정안 적용).

### 수정 보류 (후순위, 다음 작업 후보)
- toggleBookingPaid lost-update(피해 미미), createTeacher Auth-orphan(빈도 낮음), students.name 동시 insert(동명이인 허용 필요로 unique 불가), 연쇄 삭제 나머지(deleteSurvey/deleteStudent 등), 인메모리 rate limit의 서버리스 한계.

---

## 2026-07-08 (수) — 설문분석 프로덕션 에러 2건 해결 + DB 스키마 드리프트 복구

**작업 체계**: Claude(브레인: 분석·설계·검증) + Opus 4.8 실행자(코드 수정·커밋). 사용자가 DDL 직접 실행.

### 배포된 커밋 (origin/master)
| 커밋 | 내용 |
|---|---|
| `50af4c4` | 안내문/상담기록 버튼 RSC 에러 수정 |
| `ea9565f` | 결과지 버튼 지연·중복분석·대시보드 쿼리 수정 |

### 문제 1 — "안내문"/"상담기록" 클릭 시 "An error occurred in the Server Components render"
- **원인**: `getConsultationByName()`(src/lib/actions/consultation.ts)이 같은 이름 상담 2건 이상이면 throw → 프로덕션은 서버 액션 throw 메시지를 마스킹해 영어 에러로 표시.
- **수정**: throw 제거, 분석 상세 페이지와 동일하게 "가장 최근 상담 1건 반환"(`.limit(1).maybeSingle()`). 깨진 한글 토스트 문구도 복구. → `50af4c4`

### 문제 2 — 김묘경 분석 완료인데 결과지 버튼 비활성
- **직접 원인**: /surveys 페이지가 분석 전건의 report_html(~3MB)을 매 렌더마다 로드 → 분석 직후 router.refresh()가 느려 버튼 활성화 지연 → 사용자가 재클릭 → 중복 분석 생성.
- **구조적 원인**: **운영 DB `surveys` 테이블에 `analysis_id` 컬럼이 없었음** (스키마 드리프트). 그래서 ① 분석→설문 연결 매번 실패, ② 재분석 시 옛 분석 미삭제(중복 6그룹 누적), ③ 대시보드 최근설문 쿼리 에러.
- **수정** (`ea9565f` + DB 작업):
  - 코드: /surveys는 분석의 `{id, survey_id, has_report}`만 로드. 결과지/설문지 미리보기는 클릭 시 `getAnalysis()`로 개별 조회(팝업차단 대응: window.open 먼저). 분석 버튼 연타 방지(localAnalyzedIds). `reAnalyzeSurvey`는 warning이어도 옛 분석 삭제. `analyzeSurvey` 연결 실패 시에도 `/surveys` revalidate.
  - DDL (사용자가 Supabase SQL Editor에서 실행, 마이그레이션 파일 `supabase/migrations/20260708100000_surveys_analysis_id.sql`로 기록):
    `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL;` + 인덱스
  - 데이터 정리 (`scripts/dedupe-analyses.mjs`, 멱등): 중복 분석 10건 삭제(138→128), 등록안내 3건(김태유·신율·최서우) 최신 분석으로 재연결, 설문 128건 전건 `analysis_id` 백필.

### 최종 검증 완료 상태
- analyses 128건, survey_id 중복 그룹 0, 끊어진 등록안내 참조 0.
- 김묘경: 설문 `4984c6ec…` → 분석 `b3a95032…`(report_html 23,362자) 연결 확인.
- lint 에러 0(기존 warning 32), build 성공, ea9565f 푸시 → Vercel 자동 배포.

### 내일 시작 시 체크리스트
1. **[확인]** 운영 사이트에서 ① 김묘경 결과지 버튼 활성/열림, ② 안내문·상담기록 버튼 정상, ③ 대시보드 최근 설문 표시 여부. (어제 배포 직후 사용자 최종 확인 전에 종료)
2. **[정리 필요]** 미커밋 변경 ~40개 파일: 알림톡(alimtalk), drip-survey, /feedback, sidebar/header/middleware/env 수정, scripts/·test-*.py 등. 기능 단위로 검토 후 선별 커밋 or 폐기 결정 필요.
3. **[동일 버그 후보]** `src/lib/actions/alimtalk.ts:73,100`, `drip-survey.ts:69`의 `throw new Error(...)` — 문제 1과 같은 "프로덕션 마스킹" 패턴. 구조화된 `{success, error}` 반환으로 바꿀 것 권장.
4. **[미적용 마이그레이션]** `supabase/migrations/20260630120000_nkc_alimtalk.sql`(미커밋) — 운영 DB 적용 여부 미확인.

### 참고 정보
- Supabase 프로젝트: `scrliiiiexjedgzogcfo` (대시보드: https://supabase.com/dashboard/project/scrliiiiexjedgzogcfo)
- DB 점검: `node scripts/check-supabase-data.mjs` 등 (.env.local의 SUPABASE_SERVICE_ROLE_KEY 사용)
- DDL은 프로그램 실행 수단 없음(CLI 미로그인·DB 비밀번호 없음) → Supabase SQL Editor에서 수동 실행 + migrations/ 파일로 기록.
