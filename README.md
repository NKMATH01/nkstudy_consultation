# NK 상담관리 시스템

신입생 상담부터 AI 학습성향 분석, 맞춤 등록 안내문 생성까지 — 학원 상담 업무를 위한 올인원 관리 시스템입니다.

> Google Apps Script(GAS) 기반 원본 앱을 Next.js + Supabase로 마이그레이션한 프로젝트입니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **상담 관리** | 신입생 상담 등록/수정/삭제, 카카오톡 텍스트 파싱으로 자동 입력 |
| **설문 현황** | 학습운영 프로필 V2 설문 — 공통 38문항 + 수학 11문항 / 영어 12문항 (수학만 49 · 영어만 50 · 수학+영어 61) |
| **AI 분석** | Gemini 3.8 Flash API로 학습성향 분석 보고서 생성 (모델 기본값 `gemini-3.8-flash`, `src/lib/env.ts:9`) |
| **등록 안내** | 분석 결과 + 행정정보 기반 맞춤 등록 안내문 생성 (2페이지 보고서) |
| **설정** | 반/선생님 관리 (CRUD) |
| **공개 설문** | 학생이 로그인 없이 직접 설문에 응답하는 공개 페이지 (멀티스텝 폼) |
| **예약 현황판** | 공개 예약(`/booking`) 접수 현황·슬롯 차단 관리 (`/bookings`) |
| **퇴원생 관리** | 퇴원 사유 기록 + 통계 대시보드 + 월간 반성 리포트 + 강사 러닝 뷰 (원장·관리자 전용) |
| **진도 현황** | 반별 교재·커리큘럼 진도 보드 (`/progress`) |
| **카카오 알림톡** | 상담 확정·분석 결과·등록 안내 발송 (Solapi) |
| **AI 채팅 비서** | 말로 지시하면 상담 등록 등을 대신 수행. 실행 전 HMAC 서명 검증 |

### 7-Factor 학습성향 분석

설문 응답을 7가지 요인으로 자동 분석합니다 (라벨 원본: `src/types/index.ts` 의 `FACTOR_LABELS`):

- **수업태도** (`attitude`)
- **자기주도성** (`self_directed`)
- **과제수행력** (`assignment`)
- **학업의지** (`willingness`)
- **사회성** (`social`)
- **관리선호** (`management`)
- **심리·자신감** (`emotion`)

> 이 7-Factor 는 레거시 V1 설문(35문항) 기준이며, 현재 공개 설문은 V2 학습운영 프로필입니다.

## 기술 스택

| 분류 | 기술 |
|------|------|
| **프레임워크** | Next.js 16, React 19, TypeScript |
| **스타일링** | Tailwind CSS v4, shadcn/ui |
| **백엔드** | Supabase (Auth + PostgreSQL + RLS) |
| **폼/검증** | React Hook Form, Zod v4 |
| **데이터 패칭** | Server Actions, TanStack Query |
| **AI** | Gemini 3.6 Flash (설문 분석) · Claude Haiku 4.5 (등록 안내문 생성, 기본값 `claude-haiku-4-5-20251001` — `src/lib/env.ts:11`) · Claude Sonnet 4.6 (AI 채팅 비서 — `src/app/api/chat/route.ts:428`) |
| **폰트** | 직원 화면(`.app-chrome`)은 **Pretendard Variable** (`--wr-font-sans` 정의 `public/nk-shared.css:87`, 적용 `src/app/globals.css:211`) · 그 바깥 공개 화면은 Noto Sans KR + DM Sans (루트 레이아웃 로드 `src/app/layout.tsx:2,8`) |
| **디자인** | NK 8개 프로그램 공통 디자인 시스템(네이비·브라스). 공유 토큰 `public/nk-shared.css` |
| **야간 모드** | `<html data-theme="night">` 스위치. 저장 키 `nk:wr-theme` (NK 8개 프로그램 공용). 공개 화면 4곳은 `data-theme="day"` 라이트 고정 |
| **알림톡** | Solapi 경유 카카오 알림톡 |

## 페이지 구조

사이드바 메뉴는 4개 카테고리 + 상시 노출 링크로 구성됩니다 (단일 출처: `src/lib/menu-sectors.ts`).

```
[상담 관리]
/                          — 상담 및 등록 현황
/consultations             — 상담 관리
/bookings                  — 예약 현황판

[학생 분석]
/surveys                   — 설문/분석
/drip-responses            — 설문 피드백   ★
/onboarding                — 등록 관리

[퇴원생 관리]   (원장·관리자 role 전용)
/withdrawals               — 퇴원생 현황
/withdrawals/dashboard     — 퇴원생 분석
/withdrawals/review        — 월간 반성 리포트
/withdrawals/teachers      — 강사 러닝 뷰

[학생 관리]
/settings/students         — 학생 관리
/settings/classes          — 반 관리
/settings/teachers         — 선생님 관리
/settings/permissions      — 선생님 권한 (관리자 전용)

[카테고리 밖 상시 노출]
/progress                  — 진도 현황   ★

[공개 — 로그인 불필요]
/survey                    — 학생 설문
/booking                   — 상담 예약
/report/[token]            — 학부모 보고서
/feedback/[token]          — 설문 피드백

/login                     — 로그인
```

★ `ALWAYS_VISIBLE_MENUS`(`src/lib/menu-sectors.ts:84`)에 속한 2개입니다. 이 둘은 선생님별
`allowed_menus` 권한 필터를 **우회**해 항상 보입니다(같은 파일 100행). 단, 카테고리 밖에 따로 놓인 것은
`/progress` 뿐이고 `/drip-responses` 는 "학생 분석" 카테고리 안에 있습니다 — 위치와 권한 우회는 별개입니다.

메뉴에는 없지만 살아 있는 라우트: `/analyses`(성향분석 결과), `/registrations`(등록 안내문), `/settings`.

## 설치 및 실행

### 1. 의존성 설치

```bash
cd nk-consultation
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 값을 설정합니다:

스키마 원본은 `src/lib/env.ts` 입니다. 아래 16개 중 **기본값이 없는 4개가 필수**, 나머지는 선택입니다.

**필수 (기본값 없음 — 없으면 프로덕션 부팅 실패)**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**선택 (기본값 있음)**

```env
NEXT_PUBLIC_BASE_URL=           # 공개 링크 생성용 기준 URL (기본: src/lib/academy.ts 의 DEFAULT_BASE_URL)
GEMINI_MODEL=                   # 기본: gemini-3.8-flash
CLAUDE_MODEL=                   # 기본: claude-haiku-4-5-20251001
NK_ACADEMY_VEHICLE_FEE=         # 차량비 (기본: 20000)
NK_ACADEMY_BANK_INFO=           # 계좌 정보
NK_ACADEMY_BANK_OWNER=          # 예금주
SOLAPI_API_KEY=                 # 카카오 알림톡 (Solapi/CoolSMS) API 키
SOLAPI_API_SECRET=              # Solapi API 시크릿
SOLAPI_PFID=                    # 알림톡 발신프로필 ID
SOLAPI_SENDER_PHONE=            # 대체 SMS/LMS 발신번호
CHAT_PROPOSAL_SIGNING_SECRET=   # 챗 제안 HMAC 서명 시크릿
SUPABASE_SERVICE_ROLE_KEY=      # 서버 전용 서비스 롤 키
```

- Supabase: [supabase.com](https://supabase.com) 에서 프로젝트 생성 후 Settings > API에서 확인
- Gemini API: [Google AI Studio](https://aistudio.google.com/apikey) 에서 발급
- Anthropic API: [Anthropic Console](https://console.anthropic.com/) 에서 발급

### 3. Supabase 데이터베이스 설정

적용 대상은 `supabase/migrations/` 의 타임스탬프 마이그레이션 **25개**입니다. 파일명 순서대로 적용합니다.

```
supabase/migrations/    — 적용 대상 timestamped 마이그레이션 (25개)
supabase/legacy/        — 과거 loose SQL 보관본. 운영 DB와 드리프트가 있을 수 있으므로
                          직접 적용하기 전에 반드시 검토할 것 (supabase/legacy/README.md 참고)
```

공개 설문의 anonymous insert RLS 정책은 이미 마이그레이션(`20260610192827_surveys_anon_insert.sql`)에 포함되어 있어 따로 실행할 필요가 없습니다.

### 4. 계정 및 로그인

운영 로그인은 **휴대폰번호 기반**입니다. 입력한 번호를 `src/lib/auth.ts` 의 `phoneToEmail()` 이 Supabase Auth 이메일로 변환합니다.

원클릭 "테스트 계정으로 로그인" 버튼은 **개발 환경(`NODE_ENV === "development"`)에서만 노출**되며,
계정 값은 `NEXT_PUBLIC_TEST_EMAIL` / `NEXT_PUBLIC_TEST_PASSWORD` 환경변수에서 읽습니다
(`src/app/login/page.tsx`). 자격증명을 이 문서나 코드에 하드코딩하지 마세요.

### 5. 실행

```bash
# 개발 서버
npm run dev

# 프로덕션 빌드 + 실행
npm run build
npm start
```

기본 포트: http://localhost:3000

## 프로젝트 구조

```
nk-consultation/
├── src/
│   ├── app/
│   │   ├── (dashboard)/               # 인증 필요 페이지 (사이드바+헤더 레이아웃)
│   │   │   ├── page.tsx               # 상담 및 등록 현황 (대시보드 메인)
│   │   │   ├── consultations/         # 상담 관리 CRUD
│   │   │   ├── bookings/              # 예약 현황판
│   │   │   ├── surveys/               # 설문/분석
│   │   │   ├── drip-responses/        # 설문 피드백 응답 현황
│   │   │   ├── analyses/              # 성향분석 결과 (사이드바 메뉴 밖 라우트)
│   │   │   ├── onboarding/            # 등록 관리 (신입생 온보딩 체크리스트)
│   │   │   ├── progress/              # 진도 현황 보드
│   │   │   ├── registrations/         # 등록 안내문 (사이드바 메뉴 밖 라우트)
│   │   │   ├── withdrawals/           # 퇴원생 현황·분석·월간 반성·강사 러닝 뷰
│   │   │   └── settings/              # 학생/반/선생님/권한 관리
│   │   ├── api/
│   │   │   ├── onboarding-status/     # PATCH — 온보딩 상태 갱신
│   │   │   └── chat/                  # POST — AI 채팅 비서 + chat/execute (HMAC 검증)
│   │   ├── login/                     # 로그인 (휴대폰번호 기반)
│   │   ├── survey/                    # 학생 공개 설문 (인증 불필요)
│   │   ├── booking/                   # 상담 예약 (인증 불필요)
│   │   ├── report/[token]/            # 학부모 보고서 (인증 불필요, 토큰 기반)
│   │   ├── feedback/[token]/          # 설문 피드백 (인증 불필요, 토큰 기반)
│   │   ├── globals.css
│   │   └── layout.tsx                 # 루트 레이아웃 (폰트 로드 + 야간 모드 부트스트랩)
│   ├── components/
│   │   ├── layout/                    # Header, Sidebar, nk-gnb, theme-toggle
│   │   ├── assessment-v2/             # V2 학생 설문 UI
│   │   ├── analysis-report-v2/        # V2 결과 보고서 (학부모/상담자/강사 시트)
│   │   ├── chat/                      # AI 채팅 비서 UI
│   │   ├── consultations/             # 상담 관련 컴포넌트
│   │   ├── bookings/                  # 예약 현황판 컴포넌트
│   │   ├── surveys/                   # 설문 관련 컴포넌트
│   │   ├── analyses/                  # 분석 관련 컴포넌트
│   │   ├── registrations/             # 등록안내 관련 컴포넌트
│   │   ├── withdrawals/               # 퇴원생 목록/폼/분석 대시보드
│   │   ├── onboarding/                # 신입생 온보딩 리스트
│   │   ├── progress/                  # 진도 현황 보드 컴포넌트
│   │   ├── dashboard/                 # 대시보드 컴포넌트
│   │   ├── settings/                  # 설정 관련 컴포넌트
│   │   ├── providers/                 # QueryProvider
│   │   ├── common/                    # 공용 컴포넌트 (EmptyState 등)
│   │   └── ui/                        # shadcn/ui 컴포넌트
│   ├── lib/
│   │   ├── supabase/                  # Supabase 클라이언트 (client.ts, server.ts)
│   │   ├── actions/                   # Server Actions (CRUD, 파싱, AI 호출, 진도)
│   │   ├── assessment/v2/             # V2 설문 정의·점수 엔진·해석·직렬화
│   │   ├── solapi/                    # 카카오 알림톡 발송 클라이언트
│   │   ├── withdrawal-insight/        # 퇴원 신호·블록 분석
│   │   ├── validations/               # Zod 스키마
│   │   ├── menu-sectors.ts            # 사이드바 메뉴 단일 출처 + 권한 필터
│   │   ├── chat-tools.ts              # AI 채팅 비서 도구 정의
│   │   ├── *-alimtalk.ts              # 상담·등록·분석 알림톡 템플릿·발송
│   │   ├── gemini.ts                  # Gemini API 클라이언트
│   │   ├── claude.ts                  # Claude API 클라이언트 (등록 안내문)
│   │   ├── auth.ts                    # 휴대폰번호 ↔ Auth 이메일 변환
│   │   └── env.ts                     # 환경변수 Zod 검증
│   ├── middleware.ts                  # Supabase Auth 미들웨어
│   └── types/                         # TypeScript 타입 정의
├── public/
│   └── nk-shared.css                  # NK 8개 프로그램 공통 디자인 토큰 (주간·야간)
├── e2e/                               # E2E 러너 (npm run test:e2e)
└── supabase/
    ├── migrations/                    # 적용 대상 timestamped 마이그레이션 (25개)
    └── legacy/                        # 과거 loose SQL 보관본 (직접 적용 전 검토 필요)
```

## Supabase 테이블 구조

테이블은 총 **25개**입니다. (마이그레이션 파일도 25개지만 우연히 같은 숫자일 뿐, 서로 대응하지 않습니다.)

| 테이블 | 설명 |
|--------|------|
| `analyses` | AI 분석 결과 (학생유형, 7-Factor 점수·코멘트, 강점/약점/역설, 솔루션, 보고서 HTML). V2는 `result_profile_v2`·`response_quality_v2` JSONB |
| `blocked_slots` | 예약 차단 슬롯 (날짜 + 13~20시 + 지점, 조합 UNIQUE) |
| `bookings` | 공개 예약 접수 (지점, 유선/대면, 날짜·시각, 학생·학부모·연락처, 과목, 결제 여부) |
| `class_curriculum_progress` | 반별 커리큘럼 단원 진도 (단원 토큰, 기본/응용/심화, 진행중/완료 — 반·단원 UNIQUE) |
| `class_progress` | 반별 교재 진도 (주교재·총페이지·현재페이지, 부교재, 다음 교재·계획 — 반당 1행) |
| `class_progress_logs` | 진도 기록 이력 (페이지, 기록자, 기록 시각) |
| `class_textbook_history` | 반별 교재 사용 이력 (교재명, 시작일·종료일) |
| `classes` | 반 목록 (반명, 담임 `teacher_id`, 수업/클리닉 시간, 활성 여부) |
| `consultation_events` | 예약·상담 생명주기 감사 로그 (취소/일정변경/재활성/상태변경/삭제 + 이전·이후 값 JSONB) |
| `consultations` | 상담 기록 (이름·학교·학년·연락처, 상담 일시·유형, 진행 상태·결과 상태, 메모, 발송·통화 체크) |
| `nkc_alimtalk_templates` | 알림톡 템플릿 (템플릿 코드, 본문, 변수, 버튼, 카카오 검수 상태) |
| `nkc_consents` | 수신 동의 (번호별 정보성/광고성 동의, 수신거부 시각) |
| `nkc_first14_checks` | 등록 후 14일 관찰 체크 (분석 항목 1~3, 담당 교사, matched/differed/unobserved) |
| `nkc_improvement_actions` | 월간 개선 액션 (연월, 액션 내용, 담당, pending/done/dropped) |
| `nkc_scheduled_messages` | 알림톡 발송 예약 큐 (템플릿·대상번호 스냅샷, 웨이브 D1/W1/W2, 발송 시각, 상태·재시도, 중복 방지 키) |
| `nkc_send_logs` | 발송 결과 로그 (채널 alimtalk/sms/lms, 상태, 단가, API 응답) |
| `nkc_survey_invitations` | 설문 피드백 초대 토큰 (웨이브, 대상번호, 발송·응답 시각, 30일 만료) |
| `nkc_survey_responses` | 설문 피드백 응답 (답변 JSONB, 자유 서술, 플래그, 처리 여부) |
| `profiles` | `auth.users` 연결 프로필 (이름, role: admin/user) |
| `registrations` | 등록 안내문 (배정반·담임 최대 2개, 과목, 차량, 수업료, 보고서 데이터 JSONB) |
| `report_tokens` | 공개 보고서 토큰 (analysis/registration, 보고서 HTML, 30일 만료, 회수 시각) |
| `students` | 재원생 명부 (반, 학교·학년, 연락처, 담임·클리닉 담당, 활성 여부) |
| `surveys` | 설문 응답 — 레거시 V1(35문항 `q1`~`q35` 점수 + 7-Factor 계산값 + 주관식)과 V2(`responses_v2`·`score_profile_v2` 등 JSONB, `20260711100000_survey_v2_jsonb.sql`)를 한 테이블에 함께 보관 |
| `teachers` | 선생님 (이름, 연락처, 건물/과목, role, 활성 여부) + 로그인 연결 `auth_user_id` · 메뉴 권한 `allowed_menus` |
| `withdrawals` | 퇴원생 기록 (재원 기간, 수업태도·과제·출결·성적 변화, 사유, 학생/학부모/강사 의견, 회고 JSONB) |

모든 테이블에 RLS(Row Level Security)가 적용되어 있으며, 인증된 사용자만 데이터에 접근할 수 있습니다.

## 원본 프로젝트

- **원본**: Google Apps Script 기반 웹앱 (Code.gs, DataService.gs, Index.html, Styles.html)
- **위치**: `C:\Users\nk_ma\구글앱스크립트\NK 상담관리\`
- 원본은 **기능·데이터 구조의 출처**로만 남아 있습니다. 초기에는 원본 디자인을 재현했지만,
  2026-08 에 **NK 8개 프로그램 공통 디자인 시스템(네이비·브라스)으로 전면 리스킨**되고 야간 모드가
  추가되어 현재 화면은 GAS 원본과 다릅니다.
