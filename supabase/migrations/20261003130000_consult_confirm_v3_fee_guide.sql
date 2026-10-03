-- ⚠ 운영 DB 에 사람이 검토한 뒤에만 실행한다(db push 금지).
-- 목적(원장 지시 2026-10-03): 테스트 예약 안내문 v3 정리.
--   ① 학원 안내(nk-guide)와 새 원비 안내(nk-parent-guide)가 같이 나가야 한다 → '원비 안내 보기' 버튼 추가.
--   ② 학부모 질문지를 맨 위로 — 질문지를 먼저 받아야 정확한 상담이 가능하다.
--   버튼 순서: 학부모 질문지 → 학원 안내 보기 → 원비 안내 보기. 세 버튼 모두 PC 링크도 둔다.
--   본문 두 줄을 질문지 먼저로 바꾼다.
-- 원칙: 카카오 심사 전(draft)인 v3 행만 바꾼다. 승인된 v2 는 건드리지 않는다. 두 번 실행해도 같다.
-- 카카오에 제출하는 템플릿(솔라피)도 이 버튼·본문과 글자까지 같아야 한다.

UPDATE public.nkc_alimtalk_templates
SET
  body = replace(
    replace(
      body,
      '학원 이용 안내와 학부모 질문지는 아래 버튼에서 확인하실 수 있습니다.',
      '정확한 상담을 위해 상담 전에 아래 ''학부모 질문지''(8문항)를 먼저 작성해 주세요.'
    ),
    '상담 전에 학부모 질문지(8문항)를 작성해 주시면 상담이 더 정확해집니다.',
    '학원 이용 안내와 원비 안내도 아래 버튼에서 확인하실 수 있습니다.'
  ),
  button = jsonb_build_object('buttons', jsonb_build_array(
    jsonb_build_object('buttonName', '학부모 질문지', 'buttonType', 'WL',
      'linkMo', 'https://nkstudy-consultation.vercel.app/survey/parent/#{질문지토큰}',
      'linkPc', 'https://nkstudy-consultation.vercel.app/survey/parent/#{질문지토큰}'),
    jsonb_build_object('buttonName', '학원 안내 보기', 'buttonType', 'WL',
      'linkMo', 'https://nk-guide.vercel.app/t', 'linkPc', 'https://nk-guide.vercel.app/t'),
    jsonb_build_object('buttonName', '원비 안내 보기', 'buttonType', 'WL',
      'linkMo', 'https://nk-parent-guide.vercel.app', 'linkPc', 'https://nk-parent-guide.vercel.app')
  )),
  title = 'NK test 안내 (학부모 질문지 + 학원 안내 + 원비 안내)',
  updated_at = now()
WHERE template_code = 'consult_confirm_v3'
  AND kakao_status = 'draft';

-- 적용 후 확인
--   SELECT kakao_status, jsonb_array_length(button->'buttons') AS n,
--          button->'buttons'->0->>'buttonName' AS first, button->'buttons'->2->>'buttonName' AS third,
--          position('정확한 상담을 위해' in body) > 0 AS body_new, position('원비 안내도' in body) > 0 AS body_fee
--   FROM public.nkc_alimtalk_templates WHERE template_code = 'consult_confirm_v3';
--   → draft · 3 · 학부모 질문지 · 원비 안내 보기 · true · true

-- 되돌리기(필요할 때만): 20261003120000_consult_confirm_v3_template.sql 의 버튼 2개·본문으로 다시 UPDATE.
