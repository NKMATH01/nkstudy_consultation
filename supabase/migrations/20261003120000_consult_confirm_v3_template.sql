-- ⚠ 이 파일은 운영 DB에 사람이 직접 검토한 뒤에만 실행한다. 자동 적용 금지.
-- 목적: 테스트 예약 알림톡 consult_confirm_v3(draft) 추가 — v2 + "학부모 질문지" 버튼.
--       카카오 심사 승인 전(kakao_status <> 'approved')에는 앱이 지금처럼 v2 로 보낸다
--       (src/lib/consultation-alimtalk.ts selectConsultConfirmTemplate).
-- 선행: 20261003110000_parent_questionnaires.sql (버튼 링크가 그 표의 token 을 쓴다).
--
-- 본문은 운영 DB 의 v2 행에서 그대로 가져와 한 문장만 바꾼다(2026-10-03 읽기 전용 조회로 확인:
--   v2 본문 줄바꿈은 CRLF, 버튼은 '학원 안내 보기' WL linkMo 만 있음, kakao_status = approved).
--   v2 에 바꿀 문장이 없으면(본문이 달라졌으면) 아무것도 넣지 않는다 — 확인 (2) 가 0행이면 v2 를 다시 보고 맞춘다.
-- 원칙: 추가만. v2 행은 건드리지 않는다. 두 번 실행해도 결과가 같다(멱등).
-- kakao_template_id 는 카카오 심사 승인 후 별도로 채운다.

INSERT INTO public.nkc_alimtalk_templates
  (template_code, title, body, variables, button, kakao_template_id, msg_type, kakao_status, pf_id)
SELECT
  'consult_confirm_v3',
  'NK test 안내 (학원 안내 + 학부모 질문지)',
  replace(
    v2.body,
    '학원 이용 안내와 소개 자료는 아래 버튼에서 확인하실 수 있습니다.',
    '학원 이용 안내와 학부모 질문지는 아래 버튼에서 확인하실 수 있습니다.'
      || E'\r\n'
      || '상담 전에 학부모 질문지(8문항)를 작성해 주시면 상담이 더 정확해집니다.'
  ),
  array_append(v2.variables, '질문지토큰'),
  '{"buttons":[{"buttonType":"WL","buttonName":"학원 안내 보기","linkMo":"https://nk-guide.vercel.app/t"},{"buttonType":"WL","buttonName":"학부모 질문지","linkMo":"https://nkstudy-consultation.vercel.app/survey/parent/#{질문지토큰}","linkPc":"https://nkstudy-consultation.vercel.app/survey/parent/#{질문지토큰}"}]}'::jsonb,
  NULL,
  v2.msg_type,
  'draft',
  v2.pf_id
FROM public.nkc_alimtalk_templates v2
WHERE v2.template_code = 'consult_confirm_v2'
  AND v2.body LIKE '%학원 이용 안내와 소개 자료는 아래 버튼에서 확인하실 수 있습니다.%'
  AND NOT ('질문지토큰' = ANY (coalesce(v2.variables, '{}')))
ON CONFLICT (template_code) DO NOTHING;

-- ─────────────────────────────────────────────
-- 적용 후 확인
-- ─────────────────────────────────────────────
-- (1) v3 가 draft 로 1행, 변수 11개(v2 10개 + 질문지토큰), 버튼 2개:
--     SELECT template_code, kakao_status, msg_type, variables,
--            jsonb_array_length(button->'buttons') AS n_buttons,
--            button->'buttons'->1->>'linkMo' AS questionnaire_link
--     FROM public.nkc_alimtalk_templates WHERE template_code = 'consult_confirm_v3';
--     → kakao_status = 'draft', n_buttons = 2, questionnaire_link 끝이 /survey/parent/#{질문지토큰}
-- (2) 본문에 새 문장이 들어갔는지(0행이면 v2 본문이 바뀐 것 — INSERT 가 건너뛰어졌다):
--     SELECT body FROM public.nkc_alimtalk_templates
--     WHERE template_code = 'consult_confirm_v3' AND body LIKE '%학부모 질문지(8문항)%';
-- (3) v2 불변:
--     SELECT kakao_status, button FROM public.nkc_alimtalk_templates WHERE template_code = 'consult_confirm_v2';
--     → approved, 버튼 1개 그대로.
--
-- 카카오 심사 승인 후(사람이): kakao_template_id 를 채우고 kakao_status = 'approved' 로 바꾸면
-- 앱이 그때부터 v3 + 질문지 토큰으로 보낸다. 그 전까지 발송 동작은 v2 와 같다.

-- ─────────────────────────────────────────────
-- 되돌리기 (필요할 때만, 사람이 확인 후)
-- ─────────────────────────────────────────────
-- ※ 승인 뒤 되돌릴 때는 지우지 말고 kakao_status 만 'draft' 로 내린다(앱이 즉시 v2 로 돌아간다).
--     UPDATE public.nkc_alimtalk_templates SET kakao_status = 'draft', updated_at = now()
--     WHERE template_code = 'consult_confirm_v3';
-- ※ 발송 기록이 없을 때만 삭제:
--     SELECT count(*) FROM public.nkc_scheduled_messages WHERE template_code = 'consult_confirm_v3';
-- DELETE FROM public.nkc_alimtalk_templates
-- WHERE template_code = 'consult_confirm_v3' AND kakao_status = 'draft';
