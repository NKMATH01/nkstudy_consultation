-- 등록안내·성향분석 결과지·상담확정(검사 유도) 알림톡 템플릿 시드
-- kakao_template_id는 카카오 심사 승인 후 별도로 채운다. 승인 전에는 kakao_status='draft'라 발송이 차단된다.
-- File only: apply after user approval.

insert into public.nkc_alimtalk_templates
  (template_code, title, body, variables, button, kakao_template_id, msg_type, kakao_status)
values
  (
    'registration_guide',
    'NK EDUCATION 등록 안내',
    '[NK EDUCATION 등록 안내]

#{이름} 학생의 등록 안내문이 발행되었습니다.

▶ 수업 시작일 : #{등록일}
▶ 배정 반 : #{반}
▶ 담당 선생님 : #{담당}

수업 시간표, 교재, 차량, 수납 안내는 아래 버튼에서 확인하실 수 있습니다.
안내문 링크는 발송일로부터 30일간 열람하실 수 있습니다.

문의 : NK EDUCATION 031-401-8102',
    array['이름', '등록일', '반', '담당', '토큰'],
    '{"buttons":[{"buttonType":"WL","buttonName":"등록 안내문 보기","linkMo":"https://nkstudy-consultation.vercel.app/report/#{토큰}","linkPc":"https://nkstudy-consultation.vercel.app/report/#{토큰}"}]}'::jsonb,
    null,
    'info',
    'draft'
  ),
  (
    'analysis_result',
    'NK EDUCATION 학습성향 검사 결과',
    '[NK EDUCATION 학습성향 검사 결과]

#{이름} 학생의 학습성향 검사 결과지가 준비되었습니다.

▶ 대상 : #{학교}
▶ 검사일 : #{검사일}

검사 결과 전문은 아래 버튼에서 확인하실 수 있습니다.
결과 해석이나 학습 방향 문의는 아래 번호로 연락 주시기 바랍니다.
결과지 링크는 발송일로부터 30일간 열람하실 수 있습니다.

문의 : NK EDUCATION 031-401-8102',
    array['이름', '학교', '검사일', '토큰'],
    '{"buttons":[{"buttonType":"WL","buttonName":"검사 결과 보기","linkMo":"https://nkstudy-consultation.vercel.app/report/#{토큰}","linkPc":"https://nkstudy-consultation.vercel.app/report/#{토큰}"}]}'::jsonb,
    null,
    'info',
    'draft'
  ),
  (
    'consult_confirm_v2',
    'NK test 안내 (학습성향 검사 유도)',
    '[NK test 안내]
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

상담 전 아래 버튼에서 학습성향 검사를 미리 진행해 주시면
상담 시 더 정확한 안내를 드릴 수 있습니다.

문의 : NK EDUCATION 031-401-8102',
    array['이름', '학부모', '학교', '일시', '과목', '상담비', '계좌', '준비물', '위치', '학부모상담'],
    '{"buttons":[{"buttonType":"WL","buttonName":"학습성향 검사 하기","linkMo":"https://nkstudy-consultation.vercel.app/survey","linkPc":"https://nkstudy-consultation.vercel.app/survey"}]}'::jsonb,
    null,
    'info',
    'draft'
  )
on conflict (template_code) do nothing;
