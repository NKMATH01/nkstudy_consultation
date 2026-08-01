-- 등록안내문에 내부 관리 섹션(#management)이 포함된 채 발행된 기존 토큰을 일괄 회수한다.
-- 분리 배포 후 필요한 학생만 새 링크를 재발행한다.
-- File only: apply after user approval. Do NOT run against production directly.
--
-- Why:
--   P1-C에서 buildReportHTML을 parent/teacher로 분리하기 전까지, 학부모에게 발송된
--   등록안내문 링크(report_tokens.report_type = 'registration')의 report_html에는
--   담임 매니지먼트 가이드와 담당 선생님 필수 점검 체크리스트(#management)가 함께
--   저장되어 있었다. 배포 후에도 이미 발행된 링크는 과거 저장분 HTML을 그대로 서빙하므로
--   토큰 자체를 회수해 열람을 막고, 필요한 건은 새로 재생성/재발송한다.
--
-- 전제: revoked_at 컬럼은 20260711150000_report_tokens_v2.sql에서 추가됨.
update public.report_tokens
   set revoked_at = now()
 where report_type = 'registration'
   and revoked_at is null;
