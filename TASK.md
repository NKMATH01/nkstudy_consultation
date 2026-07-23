# TASK.md — NK 상담관리 시스템 전수 점검 결과 및 구현 인계 문서

> 작성: 2026-06-10 / 작성자: Claude (읽기 전용 분석) / 구현 담당: Codex
> 본 문서는 **명세서**다. 코드는 포함하지 않으며, "무엇을 어떻게 고칠지"만 기술한다.
> 모든 경로는 `nk-consultation/` 기준 상대경로.

---

## 0. Codex 작업 규칙 (필수 준수)

1. **커밋 경계**: 태스크(T-XX) 단위로 커밋. 메시지에 태스크 ID 포함 (예: `T-01: fix mobile sheet sidebar`). **push 금지.**
2. **검증 필수**: 각 태스크 완료 후 `npm run build` + `npm run lint` 통과 확인. UI 변경은 `npm run dev`로 해당 화면 직접 확인.
3. **건드리지 말 것**: `.deploy-clean-src/`(과거 배포용 사본), `supabase/.temp/`, `node_modules/`, `.next/`.
4. **DB 마이그레이션 SQL은 작성만 하고 실행하지 말 것** — `supabase/migrations/`에 타임스탬프 파일로 추가만. 실제 적용은 사용자가 결정.
5. 디자인 변경 시 기존 기능(폼 제출, 라우팅, 권한 필터)을 깨뜨리지 않는지 각 화면에서 확인.

---

## 1. 프로젝트 개요 (분석 결과 요약)

### 1.1 기술 스택
- Next.js 16.1 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 (`@theme inline` 토큰) + shadcn/ui (radix)
- Supabase: PostgreSQL + Auth + RLS, 12개 테이블
- AI: Gemini 3.6 Flash(설문 분석) / Claude Haiku(등록 안내문) / Claude Sonnet(관리자 AI 챗)
- react-hook-form + zod, @tanstack/react-query, recharts
- 폰트: DM Sans + Noto Sans KR (`src/app/layout.tsx:8-18`)

### 1.2 핵심 기능 흐름

```
[신입생/학부모 공개 페이지 — 인증 불필요]
  /survey (35문항+기본정보+주관식)
      └→ submitPublicSurvey() ─→ surveys 테이블 ─→ 7-Factor 자동계산(calculateFactors)
  /booking (상담 예약)
      └→ submitBooking() ─→ bookings 테이블 (중복/차단슬롯 체크)
  /report/[token] (분석·등록안내 공개 열람, 30일 만료)

[관리자 대시보드 — (dashboard) 그룹, 인증 필요]
  /consultations  상담 CRUD + 카카오톡 텍스트 일괄 파싱(parseAndCreateConsultations)
      └→ createConsultation/updateConsultation 시 bookings 자동 동기화(syncConsultationToBooking)
  /surveys → analyzeSurvey(): Gemini 분석 → analyses 테이블 → /analyses/[id]
  /onboarding → registerStudent(): Claude로 등록안내문 생성 → registrations 테이블
  /withdrawals(+/dashboard) 퇴원 관리·분석
  /settings/{classes,students,teachers,permissions} 기준정보 관리

[데이터 연결 구조]
  surveys ──analysis_id──→ analyses ←──analysis_id── registrations
  consultations ──analysis_id/registration_id──→ (analyses, registrations)
  ⚠ 학생 식별은 전 구간 name 텍스트 매칭 (students 테이블과 FK 없음) ← 구조적 약점
```

### 1.3 서버 액션 모듈 (`src/lib/actions/`)
| 파일 | 역할 |
|---|---|
| consultation.ts | 상담 CRUD, 카톡 파싱, 예약 동기화, 필드 화이트리스트(`ALLOWED_UPDATE_FIELDS`) |
| public-survey.ts | 공개 설문 제출 (rate limit, factor 계산) |
| survey.ts / analysis.ts | 설문 CRUD / Gemini 분석 실행·재분석·삭제 |
| registration.ts | 등록안내문 생성(Claude)·AI 편집 |
| booking.ts | 예약 제출·슬롯 차단·중복 체크 |
| withdrawal.ts / settings.ts | 퇴원 CRUD / 반·학생·선생님 CRUD |

---

## 2. DB 스키마 진단

### 2.1 현재 스키마 (12개 테이블 요약)

| 테이블 | 주요 내용 | FK | 비고 |
|---|---|---|---|
| profiles | auth 연동 프로필 | auth.users | |
| teachers | 선생님 (role, allowed_menus JSONB) | - | 전화번호→가상 이메일 로그인 |
| classes | 반 | teachers | ⚠ D2 컬럼 불일치 |
| consultations | 상담 (40+ 컬럼) | analyses, registrations, profiles | ⚠ D1, D4 |
| surveys | 설문 q1~q35 + factor 7종 | analyses | anon INSERT 허용 |
| analyses | AI 분석 (score/comment 7종, JSONB 4종) | surveys | ⚠ D8 RLS 과개방 |
| registrations | 등록안내 (report_html, onboarding_status JSONB) | analyses | |
| students | 재원생 | teachers ×2 | ⚠ D2, D6 |
| bookings | 예약 (branch/slot) | - | anon INSERT/SELECT 허용, ⚠ D3 |
| blocked_slots | 슬롯 차단 | - | UNIQUE(date,hour,branch) |
| withdrawals | 퇴원생 | - | 날짜가 TEXT 타입 |
| report_tokens | 공개 리포트 토큰 (30일 만료) | - | |

### 2.2 진단 항목 (근거 파일 명시)

| ID | 진단 | 근거 | 심각도 |
|---|---|---|---|
| **D1** | 학생 식별이 `name` 텍스트 — consultations/surveys/registrations 모두 `student_id` FK 부재. `getConsultationByName()`, `updateRegistrationInfo()`가 이름 문자열로 최근 레코드를 찾음 → **동명이인 시 다른 학생 상담에 데이터 기록** | `src/lib/actions/consultation.ts` (getConsultationByName, updateRegistrationInfo), `supabase/schema.sql` | High |
| **D2** | DB 컬럼명 ↔ TS 타입 불일치: classes(`is_active`↔`active`, `description`↔`class_days`), students(`phone`↔`student_phone`, `class_name`↔`assigned_class`). TS에만 존재하는 컬럼(`target_grade`, `weekly_test_time`, `location` 등)은 마이그레이션 흔적 없음 — 실제 DB에 있는지 불명 | `supabase/schema.sql:17` 주석, `supabase/students.sql:3` 주석, `src/types/index.ts:69-82, 124-137` | High |
| **D3** | bookings의 `branch`/`consult_type`/`subject`/`pay_method`, teachers의 `role` — Zod enum 검증만 있고 DB CHECK 제약 없음. 직접 쿼리·AI 챗 mutation 경유 시 무결성 깨질 수 있음 | `supabase/bookings.sql` vs `src/lib/validations/booking.ts:3-29` | Med |
| **D4** | consultations 와이드 테이블: 상담 일정·학습 이력·납부·체크리스트·학부모 상담이 한 테이블 40+ 컬럼에 혼재. 당장 분리 불필요하나 신규 컬럼 추가 시 누적 위험 | `supabase/schema.sql:44-92`, `supabase/consultation_record_migration.sql` | Low(기록) |
| **D5** | registration zod 스키마의 `math_class_days`/`eng_class_days` 등 필드가 registrations 테이블에 없음 → 입력해도 저장되지 않거나 INSERT 에러 가능 | `src/lib/validations/registration.ts:3-66` vs `supabase/registrations.sql` | High |
| **D6** | `students.teacher_id`, `students.clinic_teacher_id` FK에 인덱스 없음. bookings는 `branch` 단독 조회 인덱스 없음 | `supabase/students.sql`, `supabase/bookings.sql` | Med |
| **D7** | 마이그레이션 SQL이 `supabase/` 루트에 loose 파일로 산재 (schema.sql, surveys.sql, rls_update.sql 등 10+개). `supabase/migrations/`에는 1개뿐 → 적용 순서·이력 추적 불가 | `supabase/` 폴더 구조 | Med |
| **D8** | ~~analyses RLS 과개방~~ → **정정(2026-06-10 운영 DB 직접 확인)**: 운영 analyses는 이미 authenticated 전용. 단 `rls_update.sql`의 개방 정책과 운영 상태가 다름 = **SQL 파일↔운영 드리프트** (D7의 실증 사례). **추가 발견: 운영 surveys에 anon INSERT 정책이 없음** — `rls_update.sql:45-48`은 미적용 상태이며, 공개 설문은 현재 SERVICE_ROLE_KEY 우회로만 동작 중 (T-03 절차 변경의 근거) | 운영 `pg_policies` 조회 결과 vs `supabase/rls_update.sql` | High |
| **D9** | NULL 정책 불명확: `consultations.parent_phone`, `subject` 등 실무상 필수인 컬럼이 nullable. withdrawals의 날짜 컬럼들이 TEXT 타입 | `supabase/schema.sql`, `supabase/withdrawals.sql` | Low |

### 2.3 신입생 상담 데이터 충분성 평가 + 추가 필드 명세

**평가**: 학습 태도·의지 측정(35문항 7-Factor)은 충실하나, **객관적 성적 지표·통원 조건·가정 환경·학부모 관점** 데이터가 부족하다. 상담 실무에서 반 배정·차량 운영·소개 관리·기대치 조율에 필요한 정보가 비어 있음.

**surveys 테이블 추가 컬럼 명세** (마이그레이션 파일 신규 작성: `supabase/migrations/<timestamp>_newcomer_fields.sql`):

| 컬럼 | 타입 | NULL | 이유 |
|---|---|---|---|
| mock_exam_score | TEXT | YES | 모의고사/전국단위 성적 — 내신(school_score)과 별개의 객관 지표. 고등부 반 배정 필수 |
| target_university | TEXT | YES | 목표 대학/계열 — 기존 `dream`(자유서술)을 보완하는 구조화 필드. 입시 컨설팅 근거 |
| weekly_study_hours | TEXT | YES | 주당 자습 가능 시간 — 숙제량·클리닉 배정 판단 |
| available_time | TEXT | YES | 등원 가능 시간대 — 반 배정 직결 |
| commute_method | TEXT | YES | 통학 수단(도보/자차/학원차량/대중교통) — 차량 운영(NK_ACADEMY_VEHICLE_FEE 환경변수 존재 = 차량 운영 중) |
| commute_distance | TEXT | YES | 통원 소요 시간/거리 — 지각·이탈 리스크 예측 |
| sibling_enrolled | TEXT | YES | 형제·자매 재원 여부 — 형제 할인·가정 단위 관리 |
| parent_expectation | TEXT | YES | 학부모 기대치/요청 — 학생 응답과의 괴리 분석(기존 paradox 분석과 시너지) |
| mbti | TEXT | YES | 선택 입력 — AI 성향분석 프롬프트의 보조 신호 |
| health_note | TEXT | YES | 건강·특이사항(알레르기, ADHD 진단 등) — 지도 시 필수 인지 정보 |

**consultations 테이블 추가 컬럼 명세** (같은 마이그레이션):

| 컬럼 | 타입 | NULL | 이유 |
|---|---|---|---|
| student_id | UUID FK→students(id) | YES | D1 해소의 1단계. 기존 데이터는 NULL 허용, 신규부터 연결 |
| decision_maker | TEXT | YES | 등록 결정권자(부/모/학생 본인) — 클로징 전략 |
| follow_up_date | DATE | YES | 후속 연락 예정일 — 미등록 리드 추적 |
| mock_exam_score / sibling_enrolled / parent_expectation | TEXT | YES | 설문 없이 상담만 한 케이스 대비 동일 필드 |

> 적용 시 함께 수정할 곳: `src/types/index.ts`(Survey/Consultation 인터페이스), `src/lib/validations/survey.ts`·`consultation.ts`(zod), `src/lib/actions/consultation.ts`의 `ALLOWED_UPDATE_FIELDS` 화이트리스트, 설문 페이지·상담 폼 UI(→ T-10).

---

## 3. 개선 태스크 목록

### 🔴 High

#### T-01. 모바일 햄버거 메뉴를 열면 사이드바가 비어 보이는 버그 (의심 — 검증 후 수정)
- **파일**: `src/components/layout/sidebar.tsx:135` (`<aside className="hidden ... md:flex">`), `src/components/layout/header.tsx:69-79` (Sheet 안에 `<Sidebar>` 렌더)
- **원인**: Sheet(모바일 전용)에 들어간 Sidebar 루트에도 `hidden md:flex`가 적용 → md 미만 뷰포트에서 `display:none` → 빈 시트.
- **변경**: `Sidebar`에 `inSheet?: boolean` prop 추가. `inSheet=true`면 `hidden md:flex` 대신 `flex` + `min-h-full` 적용. header.tsx의 SheetContent에서 `<Sidebar inSheet currentTeacher={...}/>`로 호출.
- **검증**: dev 서버에서 뷰포트 375px로 줄여 햄버거 클릭 → 메뉴 항목이 보여야 함. (실제로 보인다면 이 태스크는 "재현 불가"로 기록하고 스킵)
- **영향 범위**: 레이아웃 2개 파일. 데스크톱 사이드바 동작 불변 확인 필수.

#### T-02. 이름 기반 학생 식별 제거 (1단계: FK 도입)
- **파일**: `supabase/migrations/`(신규 SQL), `src/lib/actions/consultation.ts`(`getConsultationByName`, `updateRegistrationInfo`), `src/types/index.ts`
- **변경 전**: `updateRegistrationInfo(studentName, data)`가 이름으로 최근 상담을 찾아 갱신 → 동명이인 오기록 위험.
- **변경 후**: ① consultations에 `student_id` FK 추가(§2.3). ② `updateRegistrationInfo`는 가능하면 consultation `id`(UUID)를 직접 받도록 호출부를 역추적해 시그니처 변경. 호출부가 이름만 가진 경우, 동일 이름 2건 이상이면 에러 반환(silent 매칭 금지)으로 변경.
- **검증**: 동일 이름 상담 2건 생성 → 등록 정보 갱신 시 명시적 에러 또는 정확한 대상 갱신 확인.
- **영향 범위**: 상담·등록 흐름 전반. 회귀 주의 — 등록 안내 생성(`registerStudent`)도 이름 조회를 쓰므로 동일 패턴 적용.

#### T-03. 공개 설문의 Service Role 우회 제거 — ⚠ 2단계 절차로 변경 (2026-06-10 운영 확인 결과 반영)
- **확인된 사실**: 운영 DB surveys 테이블에 anon INSERT 정책 **없음** (authenticated ALL 정책만 존재). `rls_update.sql:45-48`은 미적용. 공개 설문은 현재 SERVICE_ROLE_KEY 우회로만 동작 → **코드를 먼저 고치면 운영 설문 즉시 중단됨.**
- **T-03a (선행, SQL 파일 작성만)**: `supabase/migrations/<timestamp>_surveys_anon_insert.sql` 작성 — surveys에 anon INSERT 정책 추가(WITH CHECK true, INSERT 단독 cmd). 실행은 사용자 승인 후.
- **T-03b (후행, 정책 적용 확인 후에만)**: `src/lib/actions/public-survey.ts:112-115`의 SERVICE_ROLE_KEY 분기 삭제 → 항상 일반 클라이언트. **운영에 T-03a 정책이 적용되기 전에는 코드 변경·배포 금지.**
- **검증**: 정책 적용 후 로그아웃 상태 /survey 제출 성공 + 대시보드 조회 확인.
- **영향 범위**: 공개 설문 제출 1곳 + 운영 RLS 정책 1건.

#### T-04. 예약 동기화 silent failure 노출
- **파일**: `src/lib/actions/consultation.ts` — `createConsultation`/`updateConsultation` 내 `syncConsultationToBooking` try/catch (라인 266-280 부근)
- **변경 전**: 동기화 실패해도 `console.error`만 남기고 성공 반환 → 예약 현황판 누락을 아무도 모름.
- **변경 후**: 반환 타입에 `warning?: string` 추가. 동기화 실패 시 `{ success: true, warning: "상담은 저장되었으나 예약 현황판 반영 실패" }` 반환, 폼 클라이언트(`src/components/consultations/consultation-form-client.tsx`)에서 sonner toast.warning으로 표시.
- **검증**: 동기화 함수에 임시로 throw를 넣어 경고 토스트 노출 확인 후 원복.
- **영향 범위**: 상담 생성·수정 흐름 + 폼 클라이언트 1곳.

#### T-05. registration zod ↔ DB 컬럼 불일치 해소
- **파일**: `src/lib/validations/registration.ts:3-66`, `supabase/registrations.sql`, `src/lib/actions/registration.ts`
- **변경**: `math_class_days`, `eng_class_days` 등 zod에만 있는 필드를 전수 대조(`registration.ts`의 INSERT payload와 비교). ① DB에 실제로 저장되어야 하는 필드면 마이그레이션으로 컬럼 추가, ② UI 표시용/프롬프트용이면 zod에 주석으로 명시하고 INSERT payload에서 제외 확인.
- **검증**: 등록 안내 생성 폼 전체 필드 입력 → 생성 → DB에 모두 저장됐는지(또는 의도적 제외인지) 확인.
- **영향 범위**: 등록 안내 생성 흐름.

### 🟡 Med

#### T-06. DB 무결성 보강 마이그레이션 (실행은 사용자 승인 후)
- **파일**: `supabase/migrations/<timestamp>_integrity.sql` 신규 작성
- **내용 명세**: ① bookings.branch/consult_type/subject/pay_method CHECK 제약(D3, 허용값은 `src/types/index.ts` BRANCHES 등 상수와 일치), ② teachers.role CHECK, ③ `idx_students_teacher_id`/`idx_students_clinic_teacher_id`/`idx_bookings_branch` 인덱스(D6), ④ ~~analyses RLS 축소~~ → 운영은 이미 authenticated 전용으로 확인됨(D8 정정). 대신 `rls_update.sql`의 개방 정책 구문이 운영과 다르므로 T-07 정리 시 legacy 파일에 "운영 미적용/드리프트" 주석을 남길 것.
- **검증**: SQL 문법만 로컬 검토. 실행 금지(규칙 4).

#### T-07. 마이그레이션 파일 정리 (D7)
- **파일**: `supabase/*.sql` → `supabase/migrations/`로 시간순 번호 부여 이동(또는 `supabase/legacy/`로 보관 + README 작성).
- **변경 의도**: 적용 이력 추적 가능하게. 파일 내용은 수정하지 말고 위치·이름만 정리. CLAUDE.md의 supabase 구조 설명도 갱신.
- **검증**: 빌드 영향 없음(런타임 미참조). 문서-실제 구조 일치 확인.

#### T-08. reAnalyzeSurvey race 완화
- **파일**: `src/lib/actions/analysis.ts:236-265`
- **변경 전**: 기존 분석 삭제 → 새 분석 생성 순서라 중간 실패 시 분석 無 상태로 고아화.
- **변경 후**: 순서 역전 — 새 분석을 먼저 생성·연결 성공한 뒤 이전 분석 삭제. 새 분석 실패 시 기존 분석 유지.
- **검증**: 재분석 도중 API 키를 임시로 비워 실패 유도 → 기존 분석이 남아있는지 확인 후 원복.

#### T-09. `@ts-nocheck` 범위 축소
- **파일**: `src/app/api/chat/route.ts:1`
- **변경**: 파일 전체 `@ts-nocheck` 제거 → 실제 타입 에러 나는 라인에만 `@ts-expect-error`(사유 주석 포함). 에러가 광범위하면 문제 타입만 명시적 단언으로 좁힐 것.
- **검증**: `npm run build` 통과.

#### T-10. 신입생 설문 질문지 개편 (§2.3 필드와 한 세트)
- **파일**: `src/app/survey/page.tsx`(Step 0 기본정보·Step 7 주관식 섹션), `src/types/index.ts`(SURVEY_QUESTIONS, Survey 타입), `src/lib/validations/survey.ts`, `src/lib/actions/public-survey.ts`, 신규 마이그레이션(§2.3)
- **현재 질문지 구성** (전수 확인 완료):
  - 기본정보 11필드: 이름*, 학교, 학년, 학생연락처*, 학부모연락처*, 알게 된 경로*(+친구소개 조건부), 기존 학원, 기존 학원 아쉬운 점*, 내신점수, 선행 정도
  - 35문항 리커트(1~5): 7-Factor — attitude(5)/self_directed(6)/assignment(6)/willingness(5)/social(4)/management(4)/emotion(5) (`src/types/index.ts:178-186` 매핑)
  - 주관식 7: 공부의 핵심, 스스로 느끼는 문제점, 수학 어려운 단원, 영어 어려운 영역, 장래희망, 선호 요일, 바라는 점
- **추가 질문 명세** (각각 어느 Step에 넣을지 포함):

| 추가 질문 | 입력 타입 | 위치 | 실무 근거 |
|---|---|---|---|
| 최근 모의고사/전국단위 성적 | 텍스트 | Step 0 (내신점수 옆) | 내신만으로는 절대 위치 파악 불가. 고등부 반 배정 필수 |
| 목표 대학/계열 | 텍스트(선택) | Step 7 (장래희망 위) | 자유서술 dream을 입시 상담에 쓸 수 있게 구조화 |
| 주중 자습 가능 시간 | 선택(1h 미만/1-2h/2-3h/3h+) | Step 7 | 숙제량·클리닉 강도 설계 |
| 등원 가능 시간대 | 선택(평일 오후/저녁/주말 등) | Step 7 (선호 요일 옆) | 반 배정 직결 |
| 통학 수단·소요 시간 | 선택+텍스트 | Step 0 | 차량 운영 판단, 이탈 리스크 |
| 형제·자매 재원/타학원 여부 | 선택(재원중/타학원/없음) | Step 0 | 형제 할인, 가정 단위 소개 관리 |
| 학부모 기대치 (학부모 작성 섹션) | textarea | Step 7 마지막 또는 별도 Step | 학생-학부모 기대 괴리는 퇴원 사유 상위권. 기존 AI paradox 분석과 직접 시너지 |
| 이전 학원을 그만둔 결정적 이유 | 선택형(수업 수준/관리 부족/거리/비용/강사/기타)+서술 | Step 0 (prev_complaint 보완) | 자유서술은 통계화 불가. 선택형이면 마케팅·운영 개선 데이터가 됨 |
| MBTI | 텍스트(선택, 4자) | Step 7 | AI 성향분석 보조 신호. 선택 입력으로 부담 없음 |
| 건강·특이사항 | textarea(선택) | Step 7 | 지도 시 필수 인지 정보 |

- **수정 항목**: ⓐ 선호 요일 PREFERRED_DAYS가 3개 고정("월수금/화목금/화목토") — "상관없음" 옵션 추가. ⓑ CLAUDE.md의 "30문항" 표기를 35문항으로 정정(M7).
- **주의**: 35문항 리커트와 7-Factor 매핑은 변경하지 말 것 (분석 파이프라인 호환). 추가 질문은 모두 factor 비대상 메타데이터로만.
- **검증**: 설문 제출 e2e — 신규 필드 입력 → DB 저장 → 대시보드 설문 상세에 표시(`src/components/surveys/survey-detail-client.tsx`에 표시 필드 추가 포함).

#### T-11. 모바일/태블릿 반응형 보강
- **파일**: `src/app/survey/page.tsx`(고정 `grid-cols-2/3/4` 다수 — 예: 기본정보 그리드, 라디오 5점 척도), `src/app/booking/page.tsx:295` 부근, `src/components/surveys/survey-list-client.tsx` 등 목록 테이블
- **변경**: ① 고정 grid를 `grid-cols-1 sm:grid-cols-2 ...` 패턴으로, ② 리커트 5점 버튼은 모바일에서 터치 타겟 최소 44px 확보, ③ 대시보드 목록 테이블은 모바일에서 가로 스크롤 컨테이너(`overflow-x-auto`) 보장, ④ 전화 입력 외 숫자 필드(내신점수 등)에 `inputMode` 지정.
- **검증**: 375px/768px 뷰포트에서 /survey, /booking, /consultations 화면 확인.

#### T-12. 로딩·에러 UX 보강
- **파일**: 각 대시보드 목록 클라이언트 (`src/components/*/**-list-client.tsx`), `src/app/survey/page.tsx:176-181`(제출 실패 시 재시도 불가)
- **변경**: ① 설문/예약 제출 실패 시 "다시 시도" 버튼 제공(입력값 유지), ② 목록 로딩에 스켈레톤 또는 기존 Loader2 일관 적용, ③ AI 분석 실행 버튼에 진행 상태(분석은 60초까지 걸림) 표시.
- **검증**: 네트워크 오프라인 시뮬레이션으로 제출 실패 → 재시도 성공 확인.

#### T-13. rate limit 한계 문서화 (코드 변경 보류)
- **파일**: `src/lib/rate-limit.ts`
- **변경**: 인메모리 방식은 Vercel 다중 인스턴스에서 우회 가능. 당장 Redis 도입은 과투자이므로 파일 상단에 한계를 주석으로 명시하고, surveys/bookings INSERT에 대한 DB 레벨 보완(동일 전화번호+시간대 중복 차단은 이미 일부 존재)을 검토 메모로 남김. **구현 보류, 문서화만.**

### 🟢 Low

#### T-14. 접근성 보강
- **파일**: `src/app/survey/page.tsx`, `src/app/booking/page.tsx`, `src/components/ui/*`
- **변경**: 공개 페이지 입력에 label-input `htmlFor`/`id` 연결 전수 확인, 리커트 라디오 그룹에 `role="radiogroup"`+`aria-label`(질문 텍스트), 진행바에 `aria-valuenow`. 색 대비는 T-D 파스텔 적용 시 §4.4 기준으로 함께 검증.

#### T-15. `.deploy-clean-src/` 처리 확인
- 루트의 과거 배포 사본. **삭제하지 말고** 사용자에게 용도 확인 요청만. (OneDrive 용량·검색 노이즈 원인)

#### T-16. CLAUDE.md 문서 정정
- "30문항" → "35문항(7-Factor)", supabase 폴더 구조(T-07 반영), 신규 필드 반영.

---

## 4. 파스텔 디자인 리뉴얼 (전면 적용 — 우선순위 High, 태스크 ID T-D1~T-D4)

**방향**: 네이비/골드 폐기. 밝고 편안한 파스텔, 상담·교육 서비스에 맞는 신뢰감 유지. 다크 사이드바도 라이트로 전환.

### 4.1 디자인 토큰 — A안 (기본 채택)

`src/app/globals.css:50-84`의 `:root` 변수를 아래로 교체. (Tailwind v4 `@theme inline`이 변수를 그대로 참조하므로 토큰 교체만으로 shadcn 컴포넌트 전체에 일괄 반영됨)

| 토큰 | 현재 값 | 신규 값 | 용도/근거 |
|---|---|---|---|
| --background | #F4F6FA | **#FAF9F6** | 오프화이트 배경 |
| --foreground | #111827 | **#4A4A55** | 소프트 차콜 본문 |
| --card / --popover | #FFFFFF | #FFFFFF | 유지 |
| --card-foreground | #0F172A | **#3F3F4A** | 카드 내 텍스트 (본문보다 약간 진하게) |
| --primary | #16213E | **#5E93AC** | 버튼·링크. 샘플 #A8D5E2는 흰 글자 대비 1.6:1로 불가 → 같은 계열에서 진하게 (흰 글자 대비 ≈3.5:1, 버튼/대형 텍스트 AA 충족) |
| --primary-foreground | #FFFFFF | #FFFFFF | 유지 |
| --secondary | #F8FAFC | **#EAF4EA** | 민트/세이지 틴트 배경 (#C5E1C5의 저채도 버전) |
| --secondary-foreground | #475569 | **#4E6B4E** | 세이지 위 텍스트 |
| --muted | #F8FAFC | **#F3F1EC** | 오프화이트보다 한 톤 가라앉은 뮤트 |
| --muted-foreground | #64748B | **#8A8A96** | 보조 텍스트 (배경 #FAF9F6 대비 ≈3.4:1 — 캡션 전용, 본문 금지) |
| --accent | #F1F5F9 | **#FBE9EC** | 파스텔 핑크 틴트 (hover/선택 배경) |
| --accent-foreground | #0F172A | **#9C5560** | 핑크 위 텍스트 |
| --destructive | #E11D48 | **#D9707E** | 소프트 로즈 |
| --border / --input | #E2E8F0 | **#E8E4DC** | 따뜻한 회베이지 보더 |
| --ring | #16213E | **#A8D5E2** | 포커스 링 = 메인 파스텔 블루 |
| --chart-1~5 | 네이비/틸/퍼플/골드/레드 | **#7FB5CC / #8FC9A8 / #F2A7B3 / #F5C57E / #B5A8D5** | 파스텔 5색 (블루/민트/핑크/피치/라벤더) |
| --sidebar | #111827 | **#F2F8FA** | 라이트 사이드바 (연블루 틴트) |
| --sidebar-foreground | #E2E8F0 | **#4A4A55** | |
| --sidebar-primary | #D4A853 | **#5E93AC** | 활성 메뉴 색 |
| --sidebar-primary-foreground | #FFFFFF | #FFFFFF | |
| --sidebar-accent | rgba(255,255,255,.04) | **#DDEEF4** | 활성/hover 배경 (파스텔 블루 틴트) |
| --sidebar-accent-foreground | #E2E8F0 | **#34606F** | |
| --sidebar-border | rgba(255,255,255,.05) | **#E3EDF1** | |
| --sidebar-ring | #D4A853 | **#A8D5E2** | |
| --radius | 0.625rem | **0.75rem** (12px) | 카드·다이얼로그는 기존 radius-2xl 체계로 자동 16~20px |

**추가 신규 토큰** (`:root`에 추가, `@theme inline`에도 `--color-*` 매핑 추가):
- `--primary-soft: #A8D5E2` — 배지·선택 상태·진행바 등 "원본 파스텔 블루" 전용
- `--accent-warm: #FFE0B2` / `--accent-warm-foreground: #8A6230` — 피치 포인트 (알림·하이라이트)

**그림자** (`globals.css`의 `.card-shadow`/`.card-elevated`/`.card-shadow-hover`, 라인 223-251): 검정 기반 rgba(0,0,0,…)를 **rgba(94,147,172,0.10)~(74,74,85,0.08)** 저채도 블루그레이로 교체, 레이어 수는 유지하되 spread를 줄여 "은은한" 느낌으로.

**배경 패턴** (`.app-chrome`, globals.css:95-103): 네이비 그리드 + 골드 radial → 파스텔 블루(#A8D5E2, 0.08)·민트(#C5E1C5, 0.06) radial 2개 + 그리드는 rgba(94,147,172,0.03)로 교체.

### 4.2 폰트

- **파일**: `src/app/layout.tsx:1-18`, `globals.css:10-11`
- **본문**: Pretendard 도입 — `next/font/google`에 없으므로 ① npm `pretendard` 패키지의 가변 우프 + `next/font/local`, 또는 ② 도입 부담 시 현행 Noto Sans KR 유지(허용). DM Sans는 제거하고 숫자/라틴도 Pretendard(또는 Noto)로 통일.
- **제목**: 동일 패밀리 weight 700~800 (`page-shell h1` 등). letter-spacing -0.02em 유지.
- 변수명은 `--font-sans` 체계 유지 — `--font-dm`/`--font-noto` 참조부(globals.css:10-11)만 갱신.

### 4.3 하드코딩 색상 치환 대상 (전수 목록 — T-D2)

토큰 교체만으로 바뀌지 않는 **인라인 하드코딩**. 모두 토큰 참조(Tailwind 클래스 `bg-primary`, `text-primary-soft` 또는 `var(--…)`)로 치환:

| 파일 | 위치 | 현재 | 치환 |
|---|---|---|---|
| `src/components/layout/sidebar.tsx` | 96-108 (활성 메뉴 inline style), 104 (`bg-[#B88A44]` 바), 137 (aside 다크 그라데이션), 146-147 (골드 로고), 198-228 (공개링크 골드/틸), 232-260 (유저 카드 다크) | 네이비/골드 다수 | 사이드바 전체를 라이트 토큰 기반으로 재작성. inline style 제거하고 Tailwind 클래스화. 활성 메뉴: `bg-sidebar-accent text-sidebar-accent-foreground` + 좌측 바 `bg-primary` |
| `src/components/layout/header.tsx` | 60-66 (헤더 배경), 82·87 (`#16213E`, `#0F172A`), 108-115 (검색창 inline), 119-124 (벨 아이콘, `#E11D48` 점) | 네이비 계열 | `bg-background/85` + 토큰 클래스. 포커스는 `focus:ring-ring` |
| `src/app/survey/page.tsx` | 118·127 (완료 화면 에메랄드/골드 그라데이션), 151 (진행바 네이비→블루), 199-206 (제출 버튼 그라데이션), 293/333/362/393 (섹션 아이콘 4색), 476 (문항번호 네이비), 491 (라디오 `#2563EB`) | 하드코딩 다수 | 진행바·버튼: `--primary`→`--primary-soft` 그라데이션. 섹션 아이콘 4색: chart-1~4 토큰. 완료 배지: `--secondary` 민트 계열 |
| `src/components/consultations/consultation-form-client.tsx` | 455 (등록 버튼 `#0F2B5B`), 섹션 카드 `border-blue-100 bg-blue-50/30`·`border-amber-100 bg-amber-50/30` | 네이비/블루/앰버 | 버튼은 `variant="default"`로 환원. 섹션 틴트: 일정=`--primary-soft` 틴트, 기록지=`--accent-warm` 틴트 |
| `src/components/surveys/survey-list-client.tsx` | 352 부근 (네이비 그라데이션 헤더) | 네이비 | `bg-primary` 단색 또는 primary→primary-soft 그라데이션 |
| 기타 | `#0F2B5B`, `#16213E`, `#D4A853`, `#B88A44`, `#E9C46A` 전역 검색(rg)으로 잔여 전수 치환 | | 검색 패턴: `#0F2B5B\|#16213E\|#D4A853\|#B88A44\|#E9C46A\|#A97832\|#F8E7BD` |

> **리포트 HTML 템플릿 주의**: `src/lib/claude.ts`·`gemini.ts`의 보고서 HTML 빌더에 네이비/골드가 박혀 있으면 그것은 **인쇄·학부모 전달용 문서 스타일**이므로 별도 태스크로 분리 — 이번 리뉴얼 범위에서 화면 UI만 우선. 빌더 내 색상은 같은 파스텔 팔레트로 바꾸되 사용자 확인 후 진행.

### 4.4 검증 기준 (T-D4)

1. `npm run build` 통과 + 전 화면 육안 확인(대시보드, 상담, 설문 공개/관리, 예약 공개/관리, 분석, 등록, 퇴원, 설정, 로그인).
2. 대비 체크: 본문 `#4A4A55` on `#FAF9F6` ≈ 7.9:1(AA 통과) / 버튼 흰 글자 on `#5E93AC` ≈ 3.5:1(대형·UI 컴포넌트 기준 통과, 12px 이하 텍스트에는 사용 금지) / `--muted-foreground`는 캡션 전용.
3. 차트(recharts) 색이 chart-1~5 토큰을 참조하는지 확인 (`src/components/dashboard/`, `src/components/withdrawals/` 차트 컴포넌트에 hex 직접 지정이 있으면 토큰으로).
4. 다크모드(`.dark`) 블록이 globals.css에 있으면 이번 범위에서는 라이트만 적용하고 다크는 보류 주석.

### 4.5 B안 (대안 1개 — 사용자 선택지)

라벤더·크림 톤: 메인 `#8E89C8`(버튼용 진한 라벤더, soft `#B8B5E1`) / 서브 `#C5E1DC`(민트그레이) / 포인트 `#F5D5A8`(크림 피치) / 배경 `#FBFAF7` / 텍스트 `#49495A` / 차트 `#9B96D4·#8FC9B8·#F0B9A4·#E8D49A·#A8C8E0`.
**추천 이유**: 이 시스템의 차별점이 "심리 성향 분석"인데, 라벤더 계열은 심리·상담 도메인 연상이 강하고 분석 리포트 화면과 톤이 일치. 단, 블루 대비 학부모 세대 친숙도는 A안이 높음. **기본은 A안, 사용자가 B안 선택 시 토큰 표만 교체하면 됨(구조 동일).**

---

## 5. 작업 순서 권장

```
1차 (버그·정합성): T-01 → T-03a(SQL 파일만) → T-04 → T-05 → T-08 → T-09
2차 (디자인):      T-D1(토큰 교체) → T-D2(하드코딩 치환) → T-D3(폰트) → T-D4(검증)
3차 (스키마·설문):  T-06·T-02·T-10 + T-03b(정책 적용 확인 후 코드 변경)
                   (마이그레이션 SQL 작성 → 사용자 승인·적용 → 코드/UI)
4차 (마무리):      T-11 → T-12 → T-14 → T-07 → T-16 → T-13·T-15(문서/확인만)
```
