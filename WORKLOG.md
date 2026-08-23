# WORKLOG — NK 상담관리 시스템

> 세션 단위 작업 기록. 최신이 위. (TASK.md는 2026-06-10 전수점검 명세서 — 별도 문서)

---

## ▶ 다음 세션 시작 체크리스트 (2026-08-23 세션 마감 기준)

**배포 상태**: `origin/master = 158ccea` — NK 공통 디자인 시스템 이식 + 야간 모드 배포 완료.

**작업 체계**: Claude=브레인(분석·지시·검증·푸시), 실행자=코드·커밋(push 금지, 사용자 승인 시에만 해제). DDL은 사용자가 SQL Editor 실행(https://supabase.com/dashboard/project/scrliiiiexjedgzogcfo/sql/new). 상세 이력은 아래 세션 기록과 메모리 참조.

### 남은 일

1. **[육안 1건]** 야간 토글을 **클릭한 직후** 입력창·버튼이 즉시 따라 어두워지는지 배포본에서 확인. 로컬 검수 창이 화면에 표시되지 않아 라이브 전환만 신뢰성 있게 재지 못했다. **야간 상태로 새로 로드했을 때는 폼 컨트롤 포함 정상 확인됨** — 안 따라오는 지점이 있으면 그 자리만 수리한다.
2. **[보류·사용자 결정]** 알림톡 **실발송 스모크 미실시** — "학부모 연락 오면 그때 확인"(2026-08-03 결정). 미수신 신고가 들어오면 `nkc_send_logs`·`nkc_scheduled_messages` 를 조회해 **시도 없음 / 발송 실패 / 성공했는데 미수신** 셋 중 무엇인지부터 가른다. 진단은 `scripts/check-alimtalk-setup.mjs`(읽기 전용).
3. **[역이식 후보]** `public/nk-shared.css` 의 `.nk-pf__*`(오류·개선 제안 위젯)가 업무보고 `design-system/nk-shared.css` **원본에는 없다**(원본 내 `nk-pf` 0건). 규약이 "원본을 먼저 고치고 이 파일로 옮긴다"이므로, 방향대로면 이걸 원본으로 올려야 나머지 6개 프로그램도 같은 위젯을 쓸 수 있다.
4. **[정리 후보]** 로컬 `feature/*` 브랜치 **10개**가 전부 origin/master 에 **병합 완료(ahead 0)** 인 채 46~93 커밋 behind 로 남아 있다. 원격에는 그중 3개(`booking-lifecycle`·`coral-redesign`·`summary-student-focus`)만 있다.
5. **[미확인]** Vercel 환경변수 `GEMINI_MODEL`. 코드 기본값은 `gemini-3.6-flash` 로 이미 전환돼 있다(`src/lib/env.ts:9`). Vercel 대시보드에 값이 **따로 박혀 있다면** 낡은 모델명일 수 있는데, 이번 세션에서 대시보드를 확인하지 못했다 — 완료로 단정하지 말 것.

### 이 저장소 소관이 아닌 것 (오해 방지)

퇴원 조기경보 **R1 `WITHDRAWAL_RISK`·R2 `WITHDRAWAL_COMPOSITE` 는 업무보고(nk-work-report)에 이미 구현 완료**다(`lib/students/alert-engine.ts`·`lib/ai-directives/consult-logic.ts` 에서 확인). 이 저장소에서 다시 만들지 마라. 상담관리의 퇴원 통계를 가중치로 연동하는 **R3 만** 후속 후보다.

### 완료되어 내려간 항목 (2026-07-23 체크리스트)

- STEP 5 챗 제안 HMAC → 2026-07-26 `18d8cd0` 배포 완료
- 관리자 취소/시간변경·토요일 예약 스모크 → 2026-07-26 사용자 전체 확인 완료
- SOLAPI 키·알림톡 템플릿 카카오 승인 → 2026-08-03 `b88a277` 로 3종 승인·개통 완료

---

## 2026-08-19~23 — NK 공통 디자인 시스템 이식 + 야간 모드

NK 8개 프로그램이 같은 얼굴을 갖도록 업무보고(nk-work-report)의 디자인 시스템을 이 앱에 이식했다. 마지막이 야간 모드다.

| 커밋 | 날짜 | 내용 |
|---|---|---|
| `40feaf4` | 8/19 | NK 공통 상단바(GNB) 이식 + Claude Code 버튼. 프로토콜 `claudecode-consult`, 런처 `tools/claude-launcher/`, `.gitattributes` 에 `*.cmd text eol=crlf` |
| `debbb68` | 8/19 | 오류·개선 제안 위젯 — 업무보고 의견함 연동 |
| `62da72a` | 8/20 | 본문 전면 리스킨 — 네이비·브라스 (기능 불변) |
| `8a63e1b` | 8/20 | 네비 v2 — 프로그램 메뉴 사이드 이동·미니 GNB |
| `dbeaf74` | 8/21 | Claude Code 버튼은 대표급(director·principal·admin)만 |
| `4a23ea4` | 8/21 | **대표 피드백으로 자리 되돌림** — 상단 GNB = 프로그램 전환 8개, 사이드바 = 이 앱 메뉴만. 접힘 저장 키 v3 |
| `65090c4` | 8/22 | 야간 모드 이식 |
| `158ccea` | 8/23 | 실검수 후속 수리 |

### 야간 모드 (`65090c4`)

**팔레트를 만들 필요가 없었다.** `public/nk-shared.css` 에 `:root[data-theme='night']` 한 벌이 이미 통째로 들어 있었고, `globals.css` 는 `--wr-*` 를 재정의하지 않고 `@theme inline` 으로 매핑만 한다. 모자란 것은 `<html>` 에 `data-theme="night"` 를 찍는 **스위치 하나**였다. 그래서 컴포넌트의 색 클래스는 한 글자도 바꾸지 않았다.

- 토글 `src/components/layout/theme-toggle.tsx` — GNB 우측, **전 직원 노출**(대표 결정). Claude Code 버튼과 달리 역할 게이트 없음. 업무보고 구현에 있는 **야간 시간대 자동 제안 팝업은 대표 결정으로 제외**.
- 복원 스크립트는 `src/app/layout.tsx` 의 `<head>` 안, `nk-shared.css` `<link>` **앞에 인라인 blocking** 으로 둔다. `next/script` 나 `useEffect` 로 미루면 야간을 켜 둔 사람이 접속할 때마다 흰 화면이 번쩍인 뒤 어두워진다(업무보고에서 실제로 겪고 고친 사고).
- 저장 키 `nk:wr-theme` 는 **NK 8개 프로그램 공용**이라 이름을 바꾸지 않는다. 단 브라우저 저장소는 도메인별로 분리되므로 도메인이 다르면 각각 한 번씩 켜야 한다.
- 상태 복원은 `useState`+`useEffect` 가 아니라 **`useSyncExternalStore`**. 저장값이 React 밖(localStorage)에 있어 초기값으로 읽으면 서버 렌더와 어긋나고, effect 안에서 `setState` 로 복원하면 이 저장소의 React Compiler 린트(`set-state-in-effect`)가 **error 로 막는다**. 서버 스냅샷을 `'day'` 로 고정해 하이드레이션을 맞추고 그 뒤 클라이언트 스냅샷으로 갈아끼운다. 덤으로 다른 탭의 전환도 따라온다.
- **학부모·학생 공개 화면 4곳은 라이트 고정** — `booking`·`report`·`survey`·`feedback` 레이아웃 최상위 래퍼에 `data-theme="day"`(`nk-shared.css` 의 탈출구). `feedback` 은 layout 이 없어 새로 만들었다. `login` 은 직원 화면이라 야간 대상.
  - **다만 이 래퍼가 덮는 것은 그 서브트리뿐이다.** 루트의 `<Toaster />` 는 `{children}` 의 형제고 sonner·Radix 는 `document.body` 로 포털을 띄우므로 토스트·다이얼로그는 덮이지 않는다. 실피해가 작은 이유는 학부모 브라우저에 `nk:wr-theme` 저장값이 없어 늘 라이트이기 때문이고, 직원이 야간을 켠 채 학부모 링크를 열었을 때만 토스트가 어둡게 뜬다.

### 실검수 후속 수리 (`158ccea`)

브라우저 실검수에서 야간에 밝게 남는 면 2건이 나왔다. 둘 다 **인라인 스타일이 토큰을 이긴 것**이다.

- `withdrawal-dashboard-client.tsx` **조기 퇴원 경고 카드(996행)** — `className` 에 `bg-nk-surface` 가 있는데 인라인 `background` 삼항이 경고 0명일 때 `"white"` 를 넣어 유틸리티를 덮었다. 야간에 **흰 카드 위 흰 글자**. false 분기를 `undefined` 로 바꿔 `background` 를 아예 넘기지 않는다. 실측 computed backgroundColor — 주간 `rgb(255,255,255)`(수정 전과 동일) · 야간 `rgb(20,27,37)`.
  - 같은 파일의 죽은 `CustomTooltipContent`(155행)에도 같은 리터럴이 있었다. 여기엔 `bg-nk-surface` 클래스가 없어 지우면 배경이 사라지므로 `rgb(var(--wr-surface))` 로 교체.
- **recharts 기본 툴팁** — `globals.css` 에 규칙 한 벌. 실측 — 주간 배경 `rgb(255,255,255)`/라벨 `rgb(20,24,31)`, 야간 배경 `rgb(20,27,37)`/라벨 `rgb(231,236,243)`(이전엔 흰 배경에 흰 글자). `<Tooltip>` 6개 중 5개는 `content` 로 우리 마크업(`bg-nk-surface`)을 넘겨 이미 정상이고 기본 툴팁은 대시보드 월별 차트 하나뿐인데, **호출부를 고치면 차트가 늘 때마다 같은 실수를 반복하므로 CSS 규칙으로 뒀다.**
  - `.recharts-tooltip-item` 의 색은 **일부러 두었다.** 그 `li` 의 인라인 `color` 는 계열 색이고 이 앱의 계열 색은 이미 토큰이라(`rgb(var(--wr-navy))`·`rgb(var(--wr-status-done))`) 야간에 알아서 밝아진다. `--wr-ink` 로 덮으면 두 계열이 한 색이 되어 툴팁의 색↔계열 대응이 사라진다. 읽히지 않던 것은 라벨이지 항목이 아니었다.

### ⚠ 함정 2개 — 다음 사람이 반드시 읽을 것

**1) hex 검사를 `#[0-9a-fA-F]{6}` 로만 하면 놓친다.**
`background: "white"` 같은 **색 키워드**, 3자리 hex, `rgb(숫자)` 리터럴이 이 정규식에 안 걸린다. 실제로 이 검사를 통과했는데도 야간에 흰 카드 위 흰 글자(대비 격차 20)가 남아 있었다. 검사 패턴은 여기까지 넓혀라:

```
grep -rEn "background: *[\"']?(white|black)|backgroundColor: *[\"']?(white|black)|: *[\"']#[0-9a-fA-F]{3}[\"']|rgb\( *[0-9]" "src/app/(dashboard)" src/components --include=*.tsx
```
(보고서·학부모 공개 화면 `analysis-report-v2`·`teacher-sheet`·`report-premium`·`report-theme` 은 라이트 고정이라 제외 대상 — 거기 리터럴 색은 정상이다.)

**2) 인라인 스타일은 Tailwind 유틸리티를 이긴다.**
`className="bg-nk-surface"` 가 있어도 `style={{ background: "white" }}` 가 있으면 토큰이 죽는다. 클래스가 붙어 있다고 안심하지 마라. 서드파티(recharts)가 인라인으로 박는 색은 특이성으로 못 이기므로 **CSS `!important` 말고 수단이 없다** — 그래서 `globals.css` 의 recharts 블록에만 `!important` 를 썼고 "우리 코드가 아니라 손댈 수 없는 라이브러리 인라인을 덮는 자리"라는 사유를 주석으로 남겼다. **다른 곳에서 흉내 내지 마라.**

### 검증

tsc `--noEmit` 0 error · lint 0 error(기존 warning 29건 유지) · vitest 533/533 · `next build` 성공(static 26/26) · 넓힌 리터럴 색 검사 대시보드 트리 잔여 0건.
브라우저 실검수 — `/`·`/consultations`·`/onboarding`·`/withdrawals/dashboard` 를 야간으로 로드해, 수리 후 밝게 남는 면이 **의도된 활성 탭 알약 1건뿐**임을 확인.

---

## 2026-07-22~23 — 상담 허브·분석 연결·모델/기록지/정리
- hotfix2 3커밋: `6e63020` 상담기록 자동 생성, `b4bf5c6` 분석 근거 충실도, `f63aeb6` 근거 규칙 테스트.
- STEP 4 5커밋: `88a31ad` 상담 허브, `ed3f101` 분석 연결·역링크, `1403cee` FK/id 수정, `dc7b9ff` E2E·인증 정리, `5e6ca8a` 매칭·stamping 테스트.
- 이번 브랜치: `f59e183` Gemini 3.6 전환, `99583e6` 상담 기록지 확장, `3c4d324` 임시 라우트 정리, `189734d` 코럴 톤 통일, 본 WORKLOG 갱신.
- 검증: lint 신규 오류 0, build 성공, vitest 185/185 통과.

---

## 2026-07-12 (일) — 보고서 6·7차 다듬기 + 코럴 스킨 배포 마무리
- 6차 `5d5fb38`: 종합 분석 상세화(전영역 총평+영역별 한눈에), parentSafe에 detailedSummary 추가(구 snapshot 호환)
- 7차 `3351b1b`: "OO 학생" 실명 호칭(AI 미전송·서버 치환+따님/아드님 교정), 서술 30% 축소, 본문 점수 인용, 강점 카드 점수 배지. 테스트 117건
- 코럴 스킨 병합 배포 `68516c6`, WORKLOG 마감 `0594215`, worktree 4개·임시 브랜치 정리, E2E 가상학생 삭제(cleanup-e2e-v2.mjs 실행 완료)
- 학생 6명 재분석 2회(6차 형식→7차 형식) — 최종 전원 7차 형식 확인(호칭 O·점수 인용 O·따님아드님 0건)

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
