# WORKLOG — NK 상담관리 시스템

> 세션 단위 작업 기록. 최신이 위. (TASK.md는 2026-06-10 전수점검 명세서 — 별도 문서)

---

## ▶ 다음 세션 시작 체크리스트 (2026-07-12 세션 마감 기준)

**상태**: 설문 V2 전면 개편 + **결과 보고서 단일화(학부모형)** + **코럴 라이트 대시보드 스킨** 배포 완료. `origin/master = 68516c6`(feature/coral-redesign 병합 반영, 동일 트리). vitest 100 · E2E 13 · lint 0 error · build 성공. DDL 3건(V2 JSONB · report_tokens 보안 RLS 등) 적용 완료.

**배포 완료 요약 (origin/master `68516c6`)**:
- **설문 V2**(학생 자기작성형 학습운영 프로필) — 명세 `../CLAUDE-CODE-NK-SURVEY-REPORT-IMPLEMENTATION.md`. 결정론적 점수 엔진 + AI 해석(Gemini) + 규칙 기반 fallback.
- **결과 보고서 단일화**: 상담자 전용 보고서 제거, `/analyses` 직원 화면도 학부모 공유본과 동일한 단일 보고서를 렌더(상담자/학부모 토글 제거). 구조 = 종합분석 → 강점 → **약점**(점수 근거 + 실제 나타남 + NK 도움, 낙인 없는 행동 서술) → **항목별 분석**(구간별 3문장: 상태·학습 장면 예·도움 팁, 공용 `signal-descriptions.ts`) → 과목 이야기 → NK 지도계획 → 읽는 안내. 카톡 전송용 모바일 문서(컴팩트 밴드 · 문서폭 660px) · 타이포 축소.
- **코럴 라이트 대시보드 스킨**: 운영 대시보드(사이드바/헤더/글로벌 크롬)를 코럴(#F0653A) 웜톤으로 리스킨. `/design-preview`는 참조용 유지.
- **report_tokens 보안 RLS**: anon 전체조회 차단 + 단일 토큰 SECURITY DEFINER RPC(`get_report_token`).

**남은 작업**:
1. **E2E 가상학생 삭제**: `node scripts/cleanup-e2e-v2.mjs`(`e2e/.live-ids.json` 참조) — 사용자가 직접 실행.
2. **SOLAPI 키 4종 + 알림톡 템플릿 등록**(카카오 승인 필요) — 기존 보류.
3. **`/dev-report-preview` · `/design-preview` 정리(삭제) 시점 결정**.
4. **`CounselorReport` 미사용 코드** — 단일화로 렌더만 차단하고 복원 대비 파일 보존 중. 정리 시 삭제 여부 결정.

**작업 체계 리마인드**: Claude=브레인(분석·명세·검증·푸시), Opus 4.8 실행자=코드 수정·커밋. DDL은 사용자가 SQL Editor에서 실행(https://supabase.com/dashboard/project/scrliiiiexjedgzogcfo/sql/new). 운영 데이터 변경 스크립트는 사용자가 `! node scripts/...`로 직접 실행.

---

## 2026-07-11~12 — V2 운영 대응 + 보고서 3·4·5차 다듬기 + 단일화 + 코럴 스킨 (배포)

`origin/master 1d279e6`(V2 최초 배포) → `68516c6`(현재). 보고서 다듬기는 master 기준 별도 worktree(`.claude/worktrees/report-polish`, 브랜치 report-polish)에서 작업하고, 마지막에 코럴 브랜치(feature/coral-redesign)에 병합.

- **V2 배포·운영 대응**: DDL(V2 JSONB · report_tokens 보안 RLS) 적용, 실학생 3명(강현찬·방준혁·양우준) V2 분석. 서버 가드 — V2 설문에 V1 분석 차단(`afaf614`), 결과지 버튼 V2 분기(`f679fee`). 라이브 E2E 7/7(제출→분석→공유).
- **보고서 2차 (`e6e847b`+`6a58dc4`)**: 화이트 기반+네이비·골드, 고딕(세리프 금지)·영문 라벨 금지, 카톡 학부모 공유 모바일 우선. 점수 라벨은 원래 용어 유지 + 회색 한 줄 풀이(라벨 교체는 사용자 거부).
- **보고서 3차 (`4fc8c34`)**: 타이포 전면 축소(표지 34→28px 등), 학부모 공유본을 카톡 전송용 모바일 문서(컴팩트 밴드 + 660px 문서 카드)로 재구성.
- **보고서 4차 (`577ec80`)**: 학부모 공유본을 **선별된 종합 분석** 구조로(설문 점수 echo 제거) — ①종합분석 ②강점 ③도와줄부분 ④항목별 분석(레이더+카드) ⑤과목 ⑥NK 계획. MBTI·NK 4영역·상황 evidence는 학부모 렌더에서 제외(parent-safe payload는 유지, 렌더만 선별).
- **약점 명시화·해설 3문장 (`366d5d9`)**: ③을 **우리 아이의 약점**(낮은 점수 항목 선별 + 실제 나타남 + NK 도움)으로, ④ 항목별 해설을 3문장(상태·장면 예·도움 팁)으로 확장. 항목×구간 문구를 공용 매트릭스 `signal-descriptions.ts`로 추출(중복 제거).
- **보고서 단일화 (`c50d259`)**: 사용자 결정으로 상담자 전용 보고서 폐지. `AnalysisReportV2Client` 토글 제거, 항상 `ParentReport` 렌더. `CounselorReport`는 파일 보존·렌더만 차단(복원 대비 주석). 공유·카카오톡·PDF·등록안내·삭제 액션 유지, 하단 dock 단일 섹션(종합/강점/약점/항목별/계획).
- **테스트 정리 (`4e9a5a6`)**: E2E를 단일 보고서 구조 검사로 교체(상담자 14섹션·토글 검사 제거), 스모크 마커 갱신. vitest 100 유지.
- **코럴 스킨 병합 (`68516c6`)**: feature/coral-redesign(코럴 라이트 대시보드 스킨)에 보고서 3~5차(origin/master) 병합 — 충돌 0(변경 파일 무겹침). 검증: lint 0 error · build 성공 · vitest 100 · E2E 13. 로그인 실렌더로 코럴 대시보드 스킨 + 운영 `/analyses` 단일 보고서(실학생 김지민, 실 AI 내용) 동시 정상 확인.

---

## 2026-07-11 (토) — 설문 V2 학습 프로필 개편 Phase 1~5 (미푸시)

기존 35문항(7-Factor) 공개 설문을 학생 자기작성형 **학습운영 프로필 V2**로 교체. 명세서 `CLAUDE-CODE-NK-SURVEY-REPORT-IMPLEMENTATION.md` 기준. 5단계로 분업 구현.

- **Phase 1 (`7c085de`)**: `src/lib/assessment/v2/` — 문항 정의(공통36+과목12·역채점 고정), 결정론적 점수 엔진(정/역 환산·75% 유효응답·conscientiousness·지도 4분면·MBTI 0/4/8% 보조·NK 적합도·응답품질 flag), vitest 고정 fixture.
- **Phase 2 (`bb2dd25`)**: 학생 설문 UI(`assessment-v2/`) — 한 화면 한 문항, 포인터 첫 선택 자동이동(520ms), 키보드·수정·보조선택(P4·N4) 예외, NK 기대 최대 3개, sessionStorage 임시저장. 공유 Zod 검증·제출 액션(서버 재채점).
- **Phase 3 (`7c0f0a5`/`156e9d7`)**: AI-safe serializer(deny-by-default allowlist·PII redaction), 해석 전용 분석(숫자 미생성), 규칙 기반 fallback.
- **Phase 4 (`f485844`)**: 결과 보고서 — 상담자용 14섹션 + 학부모 parent-safe snapshot(금지 필드 물리 제외), 하단 고정 5메뉴, A4 세로 다중 페이지 PDF(native print CSS).
- **Phase 5 (이 세션 + fix `436683e`)**: Playwright E2E·PDF 시각검증.
  - **E2E** (`e2e/`, `npm run test:e2e`, playwright 코어 API 자체 러너): 13건 전부 통과. 사전정보 입력, 수학 48/영어 48/수학+영어 60 전 문항 진행(문항 수 assert), 첫 선택 자동이동, 기존 답 수정 시 자동이탈 없음·값 보존, 보조선택 문항 자동이동 안 함, NK 기대 최대 3개, 14일 약속 전 제출 차단. **제출 성공·분석 실행 = SKIP(운영 DB에 V2 컬럼 미적용)** — 제출 직전 단계·버튼 존재까지 확인. 결과지: 상담자 14섹션·학부모 토글 시 금지 섹션 DOM 부재·하단 5메뉴 fixed·수학+영어 모두 렌더·모바일 390 가로넘침 0·console/page error 0.
  - **PDF 시각검증** (`npm run verify:pdf`): chromium `page.pdf()`로 상담자 결과지 A4 PDF 생성 → MediaBox 595.9×842.9pt(A4) 확인, 11페이지(8논리 섹션이 내용 분량따라 자연 분할), pdftoppm 래스터 11장 육안 검수 → 잘림·빈 페이지·고립 제목 없음, 인쇄 시 dock/toolbar 미출력 확인. 스크린샷: `screenshots/v2-final/`(repo) 및 `../docs/prototypes/2026-07-10-learning-profile-v2/screenshots/v2-final/`.
  - **fix (`436683e`)**: 검수 중 09 MBTI 섹션 제목 고립 발견 → print CSS `.rpt-sec break-inside/after:avoid` + 본문 10.125pt 상향.
  - **검증 인프라**: 비프로덕션 전용 `src/app/dev-report-preview/` 라우트(가상 프로필 렌더, production notFound()+미들웨어 가드), `middleware.ts` 비프로덕션 예외, `eslint.config.mjs` 중첩 `.next`·`.claude` 무시, `next.config.ts` NEXT_DIST_DIR 오버라이드(개발 서버와 빌드 .next 충돌 방지·기본값 불변).
  - **게이트**: `npm run lint` 0 error(32 pre-existing warning), `npm run build` 성공, `npm test` 97건, E2E 13건.

**미적용 DDL 2건**(위 체크리스트 참조)·**미푸시**. 남은 작업: DDL 적용 → 운영 DB 제출·분석 E2E → push.

---

## 2026-07-10 (금) — 미커밋 43개 파일 정리 + 알림톡·드립설문 기능 배포

**조사 결과**: 미커밋 파일을 4그룹으로 분류. 알림톡+드립설문 기능(6/30 작업분)은 코드 완결·빌드 통과 상태였으나 ① 운영 DB에 nkc_ 테이블 6개 미적용, ② SOLAPI 키 미설정 상태였음. 점검 스크립트 3개(check-new-project/full-check/verify-new.mjs)에서 타 프로젝트(xhlxwmzhhvexqxbrukfg) anon 키 하드코딩 발견 → 커밋 제외·삭제.

**주의(재발 방지)**: supabase-js `select(..., {head:true})`는 존재하지 않는 테이블에서도 error 없이 count=null만 반환함 — 테이블 존재 확인은 반드시 일반 GET으로 할 것.

**배포 커밋** (origin/master `28744ad` → `2c0d9e6`):
| 커밋 | 내용 |
|---|---|
| `778e2de` | feat: 알림톡 발송·드립 설문 기능 (Solapi 연동, 19파일) — 상담목록 알림톡 발송/설문링크 버튼, /drip-responses 강사 페이지, /feedback/[token] 공개 설문, nkc_ 마이그레이션 |
| `3d779ee` | docs: WORKLOG·TASK 작업 기록 |
| `756c892` | chore: DB 점검 스크립트 7개 |
| `2c0d9e6` | chore: 일회성 test-*.py 13개·키 하드코딩 스크립트 3개·깨진 빈 디렉토리(src/app/feedback/백틱[token백틱]) 삭제, supabase/.temp gitignore |

**DDL**: 사용자가 SQL Editor에서 `20260630120000_nkc_alimtalk.sql` 실행 → nkc_ 테이블 6개 + get_drip_invitation/submit_drip_response RPC 생성 실측 확인 완료 (푸시 전 적용).

**미완(다음 작업)**: SOLAPI 키 4종 Vercel/.env.local 등록, nkc_alimtalk_templates에 템플릿 등록 + 카카오 채널 승인. 이전까지 발송·미리보기는 에러 반환(정상 동작).

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
