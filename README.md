# NK 상담관리 시스템

신입생 상담부터 AI 학습성향 분석, 맞춤 등록 안내문 생성까지 — 학원 상담 업무를 위한 올인원 관리 시스템입니다.

> Google Apps Script(GAS) 기반 원본 앱을 Next.js + Supabase로 마이그레이션한 프로젝트입니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **상담 관리** | 신입생 상담 등록/수정/삭제, 카카오톡 텍스트 파싱으로 자동 입력 |
| **설문 현황** | 학습운영 프로필 V2 설문 — 공통 38문항 + 수학 11문항 / 영어 12문항 (수학만 49 · 영어만 50 · 수학+영어 61) |
| **AI 분석** | Gemini 3.6 Flash API로 학습성향 분석 보고서 생성 (모델 기본값 `gemini-3.6-flash`, `src/lib/env.ts:9`) |
| **등록 안내** | 분석 결과 + 행정정보 기반 맞춤 등록 안내문 생성 (2페이지 보고서) |
| **설정** | 반/선생님 관리 (CRUD) |
| **공개 설문** | 학생이 로그인 없이 직접 설문에 응답하는 공개 페이지 (멀티스텝 폼) |

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
| **폰트** | Noto Sans KR (한글 최적화) |

## 페이지 구조

사이드바 메뉴는 4개 카테고리 + 상시 노출 링크로 구성됩니다 (단일 출처: `src/lib/menu-sectors.ts`).

```
[상담 관리]
/                          — 상담 및 등록 현황
/consultations             — 상담 관리
/bookings                  — 예약 현황판

[학생 분석]
/surveys                   — 설문/분석
/drip-responses            — 설문 피드백
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
/progress                  — 진도 현황

[공개 — 로그인 불필요]
/survey                    — 학생 설문
/booking                   — 상담 예약
/report/[token]            — 학부모 보고서
/feedback/[token]          — 설문 피드백

/login                     — 로그인
```

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
GEMINI_MODEL=                   # 기본: gemini-3.6-flash
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
│   │   ├── (dashboard)/          # 인증 필요 페이지 (사이드바+헤더 레이아웃)
│   │   │   ├── consultations/    # 상담 관리
│   │   │   ├── surveys/          # 설문 현황
│   │   │   ├── analyses/         # AI 분석
│   │   │   ├── registrations/    # 등록 안내
│   │   │   ├── settings/         # 설정 (반/선생님)
│   │   │   └── page.tsx          # 대시보드
│   │   ├── login/                # 로그인
│   │   ├── survey/               # 학생 공개 설문 (인증 불필요)
│   │   ├── globals.css
│   │   └── layout.tsx            # 루트 레이아웃 (Noto Sans KR)
│   ├── components/
│   │   ├── layout/               # 사이드바, 헤더
│   │   ├── consultations/        # 상담 관련 컴포넌트
│   │   ├── surveys/              # 설문 관련 컴포넌트
│   │   ├── analyses/             # 분석 관련 컴포넌트
│   │   ├── registrations/        # 등록안내 관련 컴포넌트
│   │   ├── settings/             # 설정 관련 컴포넌트
│   │   ├── common/               # 공용 컴포넌트 (EmptyState 등)
│   │   └── ui/                   # shadcn/ui 컴포넌트
│   ├── lib/
│   │   ├── supabase/             # Supabase 클라이언트 (client.ts, server.ts, middleware.ts)
│   │   ├── actions/              # Server Actions (CRUD, 파싱, AI 호출)
│   │   ├── validations/          # Zod 스키마
│   │   └── gemini.ts             # Gemini API 클라이언트
│   └── types/                    # TypeScript 타입 정의
└── supabase/                     # SQL 스키마 파일
```

## Supabase 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `consultations` | 상담 기록 (이름, 학교, 학년, 연락처, 상담내용 등) |
| `classes` | 반 목록 |
| `teachers` | 선생님 목록 |
| `surveys` | 설문 응답 (30문항 점수 + 6-Factor 계산값 + 주관식) |
| `analyses` | AI 분석 결과 (학생유형, 6-Factor 점수, 강점/약점, 솔루션) |
| `registrations` | 등록 안내문 (배정반, 담임, 수업료, AI 생성 콘텐츠) |

모든 테이블에 RLS(Row Level Security)가 적용되어 있으며, 인증된 사용자만 데이터에 접근할 수 있습니다.

## 원본 프로젝트

- **원본**: Google Apps Script 기반 웹앱 (Code.gs, DataService.gs, Index.html, Styles.html)
- **위치**: `C:\Users\nk_ma\구글앱스크립트\NK 상담관리\`
- 원본의 디자인(색상, 그라디언트, 그림자, 레이아웃)을 최대한 충실히 재현했습니다.
