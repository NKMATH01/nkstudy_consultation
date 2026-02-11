# NK 상담관리 시스템

신입생 상담부터 AI 학습성향 분석, 맞춤 등록 안내문 생성까지 — 학원 상담 업무를 위한 올인원 관리 시스템입니다.

> Google Apps Script(GAS) 기반 원본 앱을 Next.js + Supabase로 마이그레이션한 프로젝트입니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **상담 관리** | 신입생 상담 등록/수정/삭제, 카카오톡 텍스트 파싱으로 자동 입력 |
| **설문 현황** | 30문항 학습성향 설문 입력, 6-Factor 자동 계산 |
| **AI 분석** | Gemini 2.0 Flash API로 학습성향 분석 보고서 생성 |
| **등록 안내** | 분석 결과 + 행정정보 기반 맞춤 등록 안내문 생성 (2페이지 보고서) |
| **설정** | 반/선생님 관리 (CRUD) |
| **공개 설문** | 학생이 로그인 없이 직접 설문에 응답하는 공개 페이지 (멀티스텝 폼) |

### 6-Factor 학습성향 분석

설문 30문항을 6가지 요인으로 자동 분석합니다:

- **학습태도** (Attitude) — 수업 집중도, 학습 자세
- **자기주도** (Self-directed) — 스스로 계획/실행하는 능력
- **과제수행** (Assignment) — 과제 완수도, 성실성
- **학습의지** (Willingness) — 학습 동기, 목표의식
- **사회성** (Social) — 또래 관계, 협력 능력
- **관리필요** (Management) — 생활습관, 시간 관리

## 기술 스택

| 분류 | 기술 |
|------|------|
| **프레임워크** | Next.js 16, React 19, TypeScript |
| **스타일링** | Tailwind CSS v4, shadcn/ui |
| **백엔드** | Supabase (Auth + PostgreSQL + RLS) |
| **폼/검증** | React Hook Form, Zod v4 |
| **데이터 패칭** | Server Actions, TanStack Query |
| **AI** | Google Gemini 2.0 Flash API |
| **폰트** | Noto Sans KR (한글 최적화) |

## 페이지 구조

```
/login                    — 로그인 (Supabase Auth)
/                         — 대시보드 (통계 카드 + 퀵 링크)
/consultations            — 상담 목록 (검색, 필터, 페이지네이션)
/consultations/[id]       — 상담 상세/수정/삭제
/surveys                  — 설문 목록 + 등록
/surveys/[id]             — 설문 상세 (6-Factor 차트) + AI 분석 실행
/analyses                 — AI 분석 결과 목록
/analyses/[id]            — 분석 상세 보고서 + 등록 안내문 생성
/registrations            — 등록 안내문 목록
/registrations/[id]       — 등록 안내문 상세 (2페이지 보고서)
/settings                 — 반/선생님 설정
/survey                   — 학생 공개 설문 (로그인 불필요)
```

## 설치 및 실행

### 1. 의존성 설치

```bash
cd nk-consultation
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 값을 설정합니다:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

- Supabase: [supabase.com](https://supabase.com) 에서 프로젝트 생성 후 Settings > API에서 확인
- Gemini API: [Google AI Studio](https://aistudio.google.com/apikey) 에서 발급

### 3. Supabase 데이터베이스 설정

Supabase SQL Editor에서 아래 파일들을 순서대로 실행합니다:

```
supabase/schema.sql          — consultations, classes, teachers 테이블 + RLS
supabase/surveys.sql          — surveys 테이블 + RLS
supabase/analyses.sql         — analyses 테이블 + RLS
supabase/registrations.sql    — registrations 테이블 + RLS
```

### 4. 공개 설문 RLS 정책 (선택)

학생 공개 설문 페이지(`/survey`)를 사용하려면 anonymous insert 정책을 추가합니다:

```sql
CREATE POLICY "Allow anonymous survey inserts" ON surveys
  FOR INSERT TO anon WITH CHECK (true);
```

### 5. 테스트 계정 생성

Supabase Authentication > Users에서 사용자를 생성합니다.
로그인 페이지에 원클릭 테스트 버튼이 있습니다:
- Email: `admin@nk.com` / Password: `nk123456`

### 6. 실행

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
