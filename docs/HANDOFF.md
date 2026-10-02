# NK 상담관리 — 인수인계 (2026-10-02 15:20 KST 기준)

> 다음 Claude 는 이 파일부터 읽는다. 자세한 경과는 `docs/nk-team-routine/log.md`(맨 아래가 최신).

## 1. 사용자와 일하는 법 (꼭 지킬 것)
- 사용자 = NK학원 원장(비개발자). **답변은 초등학생도 알 만큼 쉽고 짧게**, 기술 용어는 쉬운 말로 풀거나 빼기. 결론 먼저.
- **운영 서버 배포(git push)·운영 DB 변경·Vercel 설정 변경은 원장 승인 후에만.** "계속 진행해"는 직전에 제안한 일에 대한 승인으로 받아 왔다.
- 배포 전 반드시: 오늘 설문 제출 수·오늘/내일 예약(`bookings.booking_date/booking_hour/status`)·최근 40분 `/survey` 접속(`vercel logs --environment production --no-branch --since 40m -q "/survey"`) 확인 → 학생이 설문 중이면 미룬다.
- 클립보드에 넣기 전엔 물어볼 것. 큰 일은 "루틴 돌려"(스킬 `nk-team-routine`: 구현·새 눈 검토·화면 실검증·게이트). 원장은 **코덱스 아스트라 교차 점검**(`codex exec -m gpt-6-astra -s read-only`)도 좋아한다 — 코덱스 지적은 후보, 파일로 확인한 것만 채택.

## 2. 저장소·운영 환경
- 저장소: `C:\Users\nk_ma\OneDrive\01. 클로드 코워크\26. 수파베이스 통합\24.NK 신입생상담관리\nk-consultation` (git 은 **이 폴더 안**에서만. 상위 폴더 .git 은 비어 있음).
- 운영: Vercel `nkstudy-consultation.vercel.app` (master push → 약 1~2분 뒤 반영). Supabase 프로젝트 `scrliiiiexjedgzogcfo`.
- DB 조회·적용: `supabase db query --linked -o table "<SQL>"` / 파일 적용 `supabase db query --linked -f <file>`. **`supabase db push` 절대 금지**(마이그레이션 기록 불일치). 적용 전 `BEGIN; …; DO $$ BEGIN RAISE EXCEPTION 'DRYRUN'; END $$;` 로 연습 실행.
- **워킹트리 미커밋 15건은 원장의 다른 작업(SSO v2·nbrain)** — 절대 수정·커밋하지 말 것: `public/nk-shared.css`, `src/app/api/sso/consume/route.ts`, `src/app/login/page.tsx`, `src/components/consultations/consultation-form-client.tsx`, `src/components/layout/{header,nk-gnb,sidebar}.tsx`, `src/middleware.ts`(nbrain 4줄), 미추적 `scripts/test-sso-v2-receiver.ts`, `src/app/api/integrations/`, `src/lib/nbrain-schedule.ts`, `src/lib/__tests__/nbrain-schedule.test.ts`, `src/lib/sso/{program-href.ts,sso-v2.mjs,sso-v2.d.mts}`. 커밋은 항상 파일을 골라서 `git add <경로>`.
- `middleware.ts` 를 고쳐야 하면: HEAD 버전에 내 줄만 넣은 파일을 `git hash-object -w` → `git update-index --cacheinfo 100644,<blob>,src/middleware.ts` 로 스테이징(‑U0 패치 apply 는 줄 위치가 틀어졌던 적 있음).
- 배포 전 "깨끗한 사본" 검증: `git worktree add --detach <OneDrive 밖> HEAD` → `.env.local` 복사 → `npm install`(`npm ci` 는 lock 불일치로 실패 — 기존 문제) → `npx tsc --noEmit` · `npx vitest run` · `npm run build` → worktree 삭제.
- 로컬 검증: `npm run dev` + playwright(저장소 node_modules) · 테스트 로그인 버튼 = admin@nk.com(관리자). 빌드는 `NEXT_DIST_DIR=.next-verify npm run build` 후 `.next-verify` 삭제.
- 재사용 도구: `docs/nk-team-routine/tools/` — `prod-verify.mjs`(운영 6곳 비로그인 점검, 인자: 저장소 경로·출력 폴더·exam_v1 토큰·기존 보고서 토큰 JSON), `wait-deploy.mjs`, `recording-e2e.mjs`/`recording-view.mjs`/`recording-delete.mjs`(가짜 마이크로 녹음→전사→분석→삭제; Chromium `--use-file-for-fake-audio-capture=<wav>`).

## 3. 지금 상태
- **origin/master = `1d060ea`(2026-10-02 20:19 운영 반영)** — 분석지 오타·연락처·차트·삭제 권한(원장·관리자) 포함, 반 배정 끝낸 단원(`d442f8f`, 중학교·초등은 verified:false)·입학테스트 메뉴 전 강사 개방 포함. 카카오 `exam_report` 심사 중(Template ID `KA01TP261002091931402ZKsfUcAy7LA`).
- 운영에 있는 것(2026-09-28~30):
  - 입학테스트 분석: 한 화면 업로드(`/exams/new?consultation=<id>`, 시험지 사진 + 매쓰플랫 PDF/사진) → 로컬 분석(`npm run exam:pull` → Claude 분석 → `npm run exam:push -- --id <id> --file report.json`) → 학부모 분석지 `/report/<token>`(제목 "수학 정밀 진단 리포트", 진단서형 표지). 고아 파일 정리 `npm run exam:orphans [--delete]`.
  - 등록 폼: 입학테스트 점수·요약 자동 입력(상담 값 우선), 반 배정 도우미(학년·수준·진도·현재 단원).
  - 설문 분석·설문 상세: "입학테스트 평가서 / 올리기" 버튼.
  - 상담 녹음: 동의 필수 → 10분 조각 녹음 → Gemini `gemini-3.5-transcribe`(Interactions API) 전사·화자 구분 → `gemini-3.8-flash` 분석 → 원본 30일 뒤 삭제(Vercel Cron 매일 03:00 KST, `CRON_SECRET` 설정됨 · 첫 실행 정상). 열람: 원장·관리자 전부 / 담당 선생님은 담당 반 학생만(fail-closed). 실행(녹음·삭제)은 원장·관리자만.
  - 알림톡 `exam_report` 발송 버튼(템플릿 **draft** — 카카오 심사 전이라 "심사 대기"로 막힘).
  - surveys 표 잠금(anon 쓰기 차단, 09-29). **10-02 15:14 KST 첫 실제 설문 정상 저장 확인**(저장 실패 로그 0).
  - 등록 안내 창 겹침 수정(보고서 툴바 z40·dock z45).
- 운영 DB 적용 완료 마이그레이션: `20260928100000_exam_analyses` · `20260929100000_exam_analyses_scores` · `20260929110000_exam_pdf_and_alimtalk` · `20260929120000_consultation_recordings` · `20260905100000_surveys_rls_lockdown`.

## 4. 남은 일 (위에서부터)
1. **원장 순서표 확인 대기** — https://claude.ai/artifact/7njDJZX6e1mKg7z3qUdfhz (중1·중2 새 과정, 중3 옛 과정, 초3~6). 원장이 "순서표 맞아" 또는 수정 지시 → `src/lib/curriculum/catalog.ts` 해당 과목 수정·`verified: true` → `npx vitest run` → 배포. 고등 14과목은 이미 verified. (d442f8f 자체는 10-02 19:02 운영 반영 — 중학교·초등은 "확인 필요"로만 표시 중.)
2. **카카오 알림톡 `exam_report` 심사 중**(10-02 17:19 요청, 1~3 영업일). 승인되면 원장 승인 받고 `UPDATE nkc_alimtalk_templates SET kakao_template_id='KA01TP261002091931402ZKsfUcAy7LA', kakao_status='approved' WHERE template_code='exam_report'`(운영 DB). 버튼은 모바일+PC 링크로 등록해 DB button 과 같다.
3. 원장 몫: 아이폰 실기기 녹음 시험(녹음 중 화면 켜 두기) · 박서진 학부모께 분석지 발송(`/exams/6c1123c8-431c-4a2e-9358-2da37cf82300` 카카오톡/링크 복사).
4. 별도 세션 진행 중: `nk-exam-report` 스킬 고등 단원 목록 오류 수정(task_63ff447a).
5. 후속 후보: 설문 목록 '빠른 등록'에도 입학테스트 점수 자동 입력 · "초" 없이 쓴 3-1/3-2 초등 교재가 중3 으로 판정되는 한계 · 학습성향 점검 보고서 v2.3 기준 재게시 · `package-lock.json` 재동기화 · SSO v2/nbrain 미커밋 작업은 원장에게 진행 여부 확인.

## 5. 핵심 파일
- 입학테스트: `src/app/(dashboard)/exams/**`, `src/lib/actions/exam-analysis.ts`, `src/lib/actions/exam-lookup.ts`, `src/components/exam-report/*`, `scripts/exam-{pull,push,orphans}.mjs`, `scripts/lib/exam-*.mjs`, `src/lib/exam-alimtalk.ts`
- 등록·반 배정: `src/components/registrations/{registration-form-client,class-placement-panel}.tsx`, `src/lib/class-placement.ts`, `src/lib/actions/class-placement.ts`, `src/lib/curriculum/{catalog,locate}.ts`
- 녹음: `src/lib/recording/**`, `src/app/api/recordings/**`, `src/app/api/cron/recordings/route.ts`, `src/components/consultations/recording-*.tsx`, `vercel.json`
- 기록: `docs/nk-team-routine/log.md`, `docs/nk-team-routine/evidence/design-l-2026-09-29.md`(녹음 설계 D1~D14), `evidence/research-stt-2026-09-29.md`(전사 API 실측)
