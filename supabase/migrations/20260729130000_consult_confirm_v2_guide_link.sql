-- consult_confirm_v2 버튼을 사전 학습성향 검사(/survey)에서 학원 소개 안내문으로 교체.
-- 20260729120000 시드 파일은 이미 적용되었으므로 수정하지 않고 이 파일에서 갱신한다.
-- kakao_status = 'draft' 가드: 카카오 심사가 끝난 템플릿을 실수로 덮어쓰지 않는다.
--   (승인 후에는 본문 변경 시 재심사가 필요하므로 이 UPDATE가 0건이면 정상이다.)
-- File only: apply after user approval.

update public.nkc_alimtalk_templates
set body = '[NK test 안내]
▶이름 : #{이름}
▶학부모 : #{학부모}
▶학교 : #{학교}
▶일시 : #{일시}
▶테스트 과목 : #{과목}
▶상담비용 : #{상담비}
▶계좌 : #{계좌}
▶준비물 : #{준비물}
▶위치 : #{위치}
▶학부모님 상담 : #{학부모상담}

학원 이용 안내와 소개 자료는 아래 버튼에서 확인하실 수 있습니다.

문의 : NK EDUCATION 031-401-8102',
    button = '{"buttons":[{"buttonType":"WL","buttonName":"학원 안내 보기","linkMo":"https://nk-guide.vercel.app/t","linkPc":"https://nk-guide.vercel.app/t"}]}'::jsonb,
    updated_at = now()
where template_code = 'consult_confirm_v2'
  and kakao_status = 'draft';
