# 프로그램 프로필 — NK 상담관리 (등록·퇴원)

> 루틴이 매번 저장소를 다시 훑지 않도록 하는 요약. 바뀐 것만 갱신한다.
> 최초 작성 2026-09-28.

## 검증 명령

| 목적 | 명령 | 기준 |
|---|---|---|
| 타입 | `npx tsc --noEmit` | 0 error |
| 린트 | `npm run lint` | 신규 error 0 (기존 warning은 허용) |
| 테스트 | `npm test` (vitest run) | 전부 통과. 2026-09-23 기준 44 files / 651 tests |
| 빌드 | `npm run build` | 성공. dev 서버와 `.next` 충돌 피하려면 `NEXT_DIST_DIR=.next-verify` |
| E2E | `npm run test:e2e` | 선택 |

**★ 저장소 위치**: 실제 git 저장소는 `nk-consultation/` 안이다. 상위 폴더에도 `.git` 이 있으나 **비어 있어** 거기서 git 명령을 쓰면 "not a git repository" 가 난다.

## 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 + shadcn/ui · Supabase(PostgreSQL + Auth + RLS) · recharts · react-hook-form + zod · TanStack Query
AI — Gemini 3.x(설문 분석) · Claude Haiku(등록 안내문) · Claude Sonnet(채팅 비서)
알림톡 — Solapi 경유 카카오

## 보호 구역 (건드리면 L 크기)

- **개인정보** — 학생·학부모 이름·연락처, 설문 응답, 시험지 사진
- **운영 DB** — 마이그레이션은 파일만 만들고 **적용은 사용자가 SQL Editor에서** 직접
- **외부 키** — `SUPABASE_SERVICE_ROLE_KEY` · `GEMINI_API_KEY` · `ANTHROPIC_API_KEY` · `SOLAPI_*` · `NK_SSO_SECRET` · `CHAT_PROPOSAL_SIGNING_SECRET`
- **로그인·권한** — `src/middleware.ts`, `src/lib/menu-sectors.ts` 의 권한 게이트, SSO 소비 경로
- **알림톡 발송** — 실제 비용 발생 + 외부 전송. 승인된 카카오 템플릿으로만 나감
- **공개 페이지 4곳** — `/survey` `/booking` `/report/[token]` `/feedback/[token]` 은 비로그인 접근. `data-theme="day"` 로 라이트 고정

## 이 프로그램을 쓰는 사람

| 역할 | 보는 것 |
|---|---|
| 대표 (director·principal·admin) | 전부. Claude Code 버튼·AI 비서·제한 분석 화면 |
| 강사 | 상담·설문·등록·퇴원. 일부 분석 화면 제한 |
| 학생 | 공개 설문 `/survey` |
| 학부모 | 토큰 링크 `/report/[token]` · `/feedback/[token]` · 예약 `/booking` |

## 기존 규칙 (반드시 따른다)

- `CLAUDE.md` — 구조·컨벤션·환경변수. 서버 액션은 `src/lib/actions/`, 클라이언트 컴포넌트는 `*-client.tsx`
- **디자인** — NK 8개 프로그램 공통 네이비·브라스. 공유 토큰 `public/nk-shared.css`. 색은 토큰으로만, hex·`white` 리터럴 금지. 스킬 `nk-design-system` 참조
- **야간 모드** — `<html data-theme="night">` 스위치. 저장 키 `nk:wr-theme` 는 8개 프로그램 공용. 검증은 **야간 상태로 새로 로드**해서 (속성만 토글하면 폼 컨트롤이 오탐)
- **마이그레이션** — `supabase/migrations/YYYYMMDDHHMMSS_이름.sql`. 최신 `20260905100000_surveys_rls_lockdown.sql`
- **로컬 스크립트** — `scripts/*.mjs`, `@supabase/supabase-js` + `dotenv` 로 `.env.local` 읽고 service role 사용
- 에러 로깅 `console.error("[모듈]", { context })`
- 환경변수는 `src/lib/env.ts` 에서 Zod 검증 후 `env` 객체로 (raw `process.env` 직접 읽기는 관례 위반)

## 알려진 미결 (작업 전 확인)

- 워킹트리에 **미커밋 15건** (SSO v2 · nbrain 연동, 2026-09-08·18). 내 작업과 겹치지 않는지 매번 확인
- 로컬 `master` 가 `origin/master` 보다 **15커밋 앞섬** — 푸시는 사용자 승인 시에만
- `docs/learning-profile-v2-evidence-audit-2026-09-01.md` §9 에 **P0 보안 미결** 목록 있음
