# NK 상담관리 시스템

NK EDUCATION 학원의 상담/설문/AI분석/등록안내 관리 시스템.
Google Apps Script 기반에서 Next.js + Supabase로 마이그레이션한 프로젝트.

## 기술 스택

- **프레임워크**: Next.js 16.1 (App Router) + React 19 + TypeScript
- **스타일**: Tailwind CSS v4 + shadcn/ui (radix-ui)
- **DB/Auth**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: Google Gemini 3.6 Flash (설문 분석) + Claude Haiku 4.5 (등록 안내문 생성) + Claude Sonnet 4.6 (AI 채팅 비서, `src/app/api/chat/route.ts:428`)
- **차트**: recharts
- **폼 관리**: react-hook-form + zod
- **상태 관리**: @tanstack/react-query (서버 상태)
- **디자인**: NK 8개 프로그램 공통 디자인 시스템(네이비·브라스). 공유 토큰은 `public/nk-shared.css`
- **야간 모드**: `<html data-theme="night">` 스위치 방식. 저장 키 `nk:wr-theme` 는 NK 8개 프로그램 공용. 학부모·학생 공개 화면 4곳(`booking`·`report`·`survey`·`feedback`)은 `data-theme="day"` 로 라이트 고정
- **알림톡**: Solapi 경유 카카오 알림톡

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
      withdrawals/        # 퇴원생 관리 + 분석 대시보드 (현황/분석/월간 반성/강사 러닝 뷰)
      onboarding/         # 신입생 온보딩 체크리스트 (등록 관리)
      drip-responses/     # 설문 피드백 응답 현황
      progress/           # 진도 현황 보드
    api/
      onboarding-status/  # 온보딩 상태 API (REST)
      chat/               # AI 채팅 비서 API + chat/execute (제안 실행, HMAC 검증)
    login/                # 로그인 페이지
    survey/               # 공개 설문 페이지 (인증 불필요)
    booking/              # 공개 예약 페이지 (인증 불필요)
    report/[token]/       # 학부모 보고서 (인증 불필요, 토큰 기반)
    feedback/[token]/     # 설문 피드백 (인증 불필요, 토큰 기반)
  components/
    analyses/             # 분석 상세/목록 클라이언트 컴포넌트
    assessment-v2/        # V2 학생 설문 UI (인테이크 화면, 문항 응답, 진행 클라이언트)
    analysis-report-v2/   # V2 결과 보고서 (학부모용/상담자용/강사 시트)
    chat/                 # AI 채팅 비서 UI (챗 클라이언트, 제안 확인 카드)
    common/               # 공통 UI (DateFilter, EmptyState, SearchInput, StatusBadge)
    consultations/        # 상담 상세/목록/폼/텍스트파싱 컴포넌트
    bookings/             # 예약 현황판 클라이언트 컴포넌트
    withdrawals/          # 퇴원생 목록/폼/분석 대시보드
    onboarding/           # 신입생 온보딩 리스트
    progress/             # 진도 현황 보드 클라이언트 컴포넌트
    dashboard/            # 대시보드 클라이언트 컴포넌트
    layout/               # Header, Sidebar, nk-gnb(NK 프로그램 전환 GNB), theme-toggle(야간 모드)
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
      survey.ts           # 설문 CRUD + 7-Factor 계산
      booking.ts          # 예약 CRUD + 슬롯 차단
      withdrawal.ts       # 퇴원생 CRUD
      progress.ts         # 진도 현황 조회/갱신
    assessment/v2/        # V2 설문 정의·점수 엔진·해석·직렬화
      definition.ts       # 문항 정의 (공통 38 + 수학 11 / 영어 12)
      scoring.ts          # 축·요인 점수 계산 엔진
      interpretation.ts   # 점수 → 해석 텍스트
      serializer.ts       # 응답 JSONB 직렬화/역직렬화
    chat-tools.ts         # AI 채팅 비서 도구 정의 (조회/제안 생성)
    solapi/               # 카카오 알림톡 발송 클라이언트 (client.ts, alimtalk.ts)
    consultation-alimtalk.ts  # 상담 알림톡 템플릿·발송
    registration-alimtalk.ts  # 등록 안내 알림톡 템플릿·발송
    analysis-alimtalk.ts      # 분석 결과 알림톡 템플릿·발송
    withdrawal-insight/   # 퇴원 신호·블록 분석 (signals.ts, blocks.ts, events.ts)
    menu-sectors.ts       # 사이드바 메뉴 카테고리 단일 출처 + 권한 필터
    gemini.ts             # Gemini API 호출, JSON 추출, 분석 프롬프트 빌더
    claude.ts             # Claude Haiku API 호출, 등록 안내문 프롬프트 및 HTML 템플릿 빌더
    factors.ts            # 레거시 V1 7-Factor 점수 계산 공유 유틸
    auth.ts               # 휴대폰번호 ↔ Supabase Auth 이메일 변환
    env.ts                # 환경변수 Zod 검증
    supabase/
      client.ts           # 브라우저용 Supabase 클라이언트
      server.ts           # 서버용 Supabase 클라이언트 (쿠키 기반)
    validations/          # Zod 스키마 (consultation, survey, class, registration, booking, withdrawal)
    utils.ts              # cn() 유틸리티
  middleware.ts           # Supabase Auth 미들웨어 (로그인 리다이렉트)
  types/index.ts          # DB 타입, 상수 (SURVEY_QUESTIONS, FACTOR_MAPPING 등)
supabase/
  migrations/             # 적용 대상 timestamped 마이그레이션 SQL
  legacy/                 # 과거 loose SQL 보관본 (직접 적용 전 검토 필요)
    README.md             # legacy 파일 역할 및 운영 드리프트 기록
    schema.sql            # 메인 DB 스키마 보관본
    surveys.sql           # 설문 테이블 보관본
    analyses.sql          # 분석 테이블 보관본
    registrations.sql     # 등록 안내 테이블 보관본
    bookings.sql          # 예약/차단슬롯 테이블 보관본
    rls_update.sql        # 과거 RLS 정책 업데이트 보관본
```

## 환경변수 (.env.local)

```
NEXT_PUBLIC_BASE_URL=           # 공개 링크 생성 기준 URL (기본: src/lib/academy.ts 의 DEFAULT_BASE_URL)
NEXT_PUBLIC_SUPABASE_URL=       # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase 익명 키
GEMINI_API_KEY=                 # Google Gemini API 키 (서버 전용)
GEMINI_MODEL=                   # Gemini 모델명 (기본: gemini-3.6-flash)
ANTHROPIC_API_KEY=              # Claude API 키 (등록 안내문 생성용)
CLAUDE_MODEL=                   # Claude 모델명 (기본: claude-haiku-4-5-20251001)
NK_ACADEMY_VEHICLE_FEE=         # 차량비 (선택, 기본: 2만원)
NK_ACADEMY_BANK_INFO=           # 계좌 정보 (선택)
NK_ACADEMY_BANK_OWNER=          # 예금주 (선택)
SOLAPI_API_KEY=                 # Solapi/CoolSMS API 키 (서버 전용)
SOLAPI_API_SECRET=              # Solapi/CoolSMS API 시크릿 (서버 전용)
SOLAPI_PFID=                    # 알림톡 발신프로필 ID (서버 전용)
SOLAPI_SENDER_PHONE=            # 대체 SMS/LMS 발신번호 (서버 전용)
CHAT_PROPOSAL_SIGNING_SECRET=   # 챗 제안 HMAC 서명 전용 시크릿 (서버 전용)
SUPABASE_SERVICE_ROLE_KEY=      # Supabase 서비스 롤 키 (서버 전용)
```

## 빌드/실행

```bash
npm install
npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint 검사
npm test             # 단위 테스트 (vitest run, 현재 533건)
npm run test:e2e     # E2E 테스트 (node e2e/run.mjs)
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
- REST API 엔드포인트 (3개):
  - `PATCH /api/onboarding-status` — 온보딩 상태 갱신
  - `POST /api/chat` — AI 채팅 비서 (Claude Sonnet 4.6 스트리밍)
  - `POST /api/chat/execute` — 챗 제안 실행 (HMAC 서명 검증)

## 공개 페이지

- `/survey` - 학생용 공개 설문 페이지 (인증 불필요, V2 학습운영 프로필: 공통 38문항 + 수학 11 / 영어 12)
- `/booking` - 상담 예약 페이지 (인증 불필요)
- `/report/[token]` - 학부모 보고서 (인증 불필요, 토큰 기반)
- `/feedback/[token]` - 설문 피드백 (인증 불필요, 토큰 기반)
- `/login` - 관리자 로그인
