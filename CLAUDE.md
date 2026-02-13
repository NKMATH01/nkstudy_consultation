# NK 상담관리 시스템

NK EDUCATION 학원의 상담/설문/AI분석/등록안내 관리 시스템.
Google Apps Script 기반에서 Next.js + Supabase로 마이그레이션한 프로젝트.

## 기술 스택

- **프레임워크**: Next.js 16.1 (App Router) + React 19 + TypeScript
- **스타일**: Tailwind CSS v4 + shadcn/ui (radix-ui)
- **DB/Auth**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: Google Gemini 2.0 Flash (설문 분석) + Claude Haiku (등록 안내문 생성)
- **차트**: recharts
- **폼 관리**: react-hook-form + zod
- **상태 관리**: @tanstack/react-query (서버 상태)

## 프로젝트 구조

```
src/
  app/
    (dashboard)/          # 인증 필요한 대시보드 영역 (layout으로 sidebar/header 공유)
      page.tsx            # 대시보드 메인 (통계 카드, 차트, 최근 상담/설문)
      consultations/      # 상담 관리 CRUD
      surveys/            # 설문 관리 CRUD
      analyses/           # AI 분석 결과 보기
      registrations/      # 등록 안내문 보기
      settings/           # 반/선생님/학생 관리
      bookings/           # 상담 예약 관리
      withdrawals/        # 퇴원생 관리 + 분석 대시보드
      onboarding/         # 신입생 온보딩 체크리스트
    api/
      onboarding-status/  # 온보딩 상태 API (REST)
    login/                # 로그인 페이지
    survey/               # 공개 설문 페이지 (인증 불필요)
    booking/              # 공개 예약 페이지 (인증 불필요)
  components/
    analyses/             # 분석 상세/목록 클라이언트 컴포넌트
    common/               # 공통 UI (DateFilter, EmptyState, SearchInput, StatusBadge)
    consultations/        # 상담 상세/목록/폼/텍스트파싱 컴포넌트
    bookings/             # 예약 현황판 클라이언트 컴포넌트
    withdrawals/          # 퇴원생 목록/폼/분석 대시보드
    onboarding/           # 신입생 온보딩 리스트
    dashboard/            # 대시보드 클라이언트 컴포넌트
    layout/               # Header, Sidebar
    providers/            # QueryProvider
    registrations/        # 등록 안내 상세/목록/폼 컴포넌트
    settings/             # 반/선생님/학생 폼/리스트 컴포넌트
    surveys/              # 설문 상세/목록/폼 컴포넌트
    ui/                   # shadcn/ui 컴포넌트
  lib/
    actions/              # Server Actions (CRUD + Gemini API 호출)
      analysis.ts         # 설문 → AI 분석 실행/조회/삭제
      consultation.ts     # 상담 CRUD + 카카오톡 텍스트 파싱
      public-survey.ts    # 공개 설문 제출 (인증 불필요)
      registration.ts     # 등록 안내문 생성(Claude)/조회/삭제/AI편집
      settings.ts         # 반/선생님/학생 CRUD
      survey.ts           # 설문 CRUD + 6-Factor 계산
      booking.ts          # 예약 CRUD + 슬롯 차단
      withdrawal.ts       # 퇴원생 CRUD
    gemini.ts             # Gemini API 호출, JSON 추출, 분석 프롬프트 빌더
    claude.ts             # Claude Haiku API 호출, 등록 안내문 프롬프트 및 HTML 템플릿 빌더
    factors.ts            # 6-Factor 점수 계산 공유 유틸
    env.ts                # 환경변수 Zod 검증
    supabase/
      client.ts           # 브라우저용 Supabase 클라이언트
      server.ts           # 서버용 Supabase 클라이언트 (쿠키 기반)
    validations/          # Zod 스키마 (consultation, survey, class, registration, booking, withdrawal)
    utils.ts              # cn() 유틸리티
  middleware.ts           # Supabase Auth 미들웨어 (로그인 리다이렉트)
  types/index.ts          # DB 타입, 상수 (SURVEY_QUESTIONS, FACTOR_MAPPING 등)
supabase/
  schema.sql              # 메인 DB 스키마 (consultations, classes, teachers, profiles)
  surveys.sql             # 설문 테이블
  analyses.sql            # 분석 테이블
  registrations.sql       # 등록 안내 테이블
  bookings.sql            # 예약/차단슬롯 테이블
  students.sql            # 학생 테이블
  withdrawals.sql         # 퇴원생 테이블
  rls_update.sql          # RLS 정책 업데이트 스크립트
  onboarding_migration.sql # 온보딩 마이그레이션
```

## 환경변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=       # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase 익명 키
GEMINI_API_KEY=                 # Google Gemini API 키 (서버 전용)
GEMINI_MODEL=                   # Gemini 모델명 (기본: gemini-2.0-flash)
ANTHROPIC_API_KEY=              # Claude API 키 (등록 안내문 생성용)
CLAUDE_MODEL=                   # Claude 모델명 (기본: claude-haiku-4-5-20251001)
NK_ACADEMY_VEHICLE_FEE=         # 차량비 (선택, 기본: 2만원)
NK_ACADEMY_BANK_INFO=           # 계좌 정보 (선택)
NK_ACADEMY_BANK_OWNER=          # 예금주 (선택)
```

## 빌드/실행

```bash
npm install
npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint 검사
```

## 주요 컨벤션

- Server Actions: `src/lib/actions/` 에 모듈별로 분리
- 클라이언트 컴포넌트: `*-client.tsx` 접미사 사용
- 페이지: 서버 컴포넌트로 데이터 fetch 후 클라이언트 컴포넌트에 props 전달
- 폼 검증: Zod 스키마 (`src/lib/validations/`)
- DB 필드 업데이트: 화이트리스트 기반 (`ALLOWED_UPDATE_FIELDS`)
- 에러 로깅: `console.error("[모듈]", { context })` 패턴
- Gemini API: 헤더 기반 인증 (`x-goog-api-key`), 자동 재시도 (429/5xx)
- 환경변수: `src/lib/env.ts`에서 Zod 검증 후 `env` 객체로 사용
- API 엔드포인트: `PATCH /api/onboarding-status` (유일한 REST API)

## 공개 페이지

- `/survey` - 학생용 공개 설문 페이지 (인증 불필요, 30문항 + 주관식)
- `/booking` - 상담 예약 페이지 (인증 불필요)
- `/login` - 관리자 로그인
