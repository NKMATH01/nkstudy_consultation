-- ⚠ 이 파일은 운영 DB에 사람이 직접 검토한 뒤에만 실행한다. 자동 적용 금지(db push 금지).
-- 목적 (T1 입학테스트 모듈, 설계 L R1·R6 / D10·D13):
--   (a) exam-papers 버킷이 매쓰플랫 결과지 PDF 를 받도록 application/pdf 추가 + 크기 한도 20MB.
--       사진 10MB·PDF 20MB 구분은 화면·서버 경로 검사에서 한다(버킷 한도는 하나라 큰 쪽).
--   (b) 입학테스트 정밀 진단 리포트 알림톡 템플릿 exam_report 추가(draft — 카카오 심사 승인 전 발송 차단).
-- 원칙: 추가만. 기존 행·기존 허용 형식은 건드리지 않는다. 두 번 실행해도 결과가 같다(멱등).
-- 다른 마이그레이션(20260929100000 T2·20260929120000 T3)과 독립.

-- ─────────────────────────────────────────────
-- (a) exam-papers 버킷에 PDF 허용
-- ─────────────────────────────────────────────
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'application/pdf'),
    file_size_limit    = 20971520
WHERE id = 'exam-papers'
  AND NOT ('application/pdf' = ANY (allowed_mime_types));

-- ─────────────────────────────────────────────
-- (b) 알림톡 템플릿 exam_report (draft)
--     버튼 모양은 20260729120000_nkc_alimtalk_templates_seed.sql 과 같다.
--     kakao_template_id 는 카카오 심사 승인 후 별도로 채운다.
-- ─────────────────────────────────────────────
INSERT INTO public.nkc_alimtalk_templates
  (template_code, title, body, variables, button, kakao_template_id, msg_type, kakao_status)
VALUES
  (
    'exam_report',
    'NK학원 입학테스트 정밀 진단 리포트',
    '[NK학원] #{이름} 학생 입학테스트 정밀 진단 리포트

안녕하세요, NK학원입니다.
#{이름} 학생이 #{시험일}에 응시한 입학테스트 답안을 한 문항씩 분석한 리포트를 보내드립니다.
아래 버튼을 눌러 확인해 주세요. (링크는 14일간 열립니다)',
    ARRAY['이름', '시험일', '토큰'],
    '{"buttons":[{"buttonType":"WL","buttonName":"리포트 보기","linkMo":"https://nkstudy-consultation.vercel.app/report/#{토큰}","linkPc":"https://nkstudy-consultation.vercel.app/report/#{토큰}"}]}'::jsonb,
    NULL,
    'info',
    'draft'
  )
ON CONFLICT (template_code) DO NOTHING;

-- ─────────────────────────────────────────────
-- 적용 후 확인
-- ─────────────────────────────────────────────
-- (1) 버킷: PDF 가 한 번만 들어가 있고 한도가 20MB, 여전히 비공개인지
--     SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'exam-papers';
--     → public = false, file_size_limit = 20971520,
--       allowed_mime_types = {image/jpeg,image/png,image/webp,image/heic,application/pdf}
-- (2) 템플릿: draft 로 1행
--     SELECT template_code, kakao_status, msg_type, variables, button->'buttons'->0->>'buttonName' AS btn
--     FROM public.nkc_alimtalk_templates WHERE template_code = 'exam_report';
--     → 1행, kakao_status = 'draft', variables = {이름,시험일,토큰}, btn = '리포트 보기'
-- (3) 기존 템플릿 불변: 적용 전후 개수 차이가 1(처음 적용) 또는 0(재실행)
--     SELECT count(*) FROM public.nkc_alimtalk_templates;

-- ─────────────────────────────────────────────
-- 되돌리기 (필요할 때만, 사람이 확인 후)
-- ─────────────────────────────────────────────
-- ※ PDF 를 빼기 전에 PDF 객체가 없는지 먼저 본다(있으면 그 시험의 결과지를 못 올리게 될 뿐 기존 파일은 남는다).
--     SELECT count(*) FROM storage.objects WHERE bucket_id = 'exam-papers' AND name ILIKE '%.pdf';
-- UPDATE storage.buckets
-- SET allowed_mime_types = array_remove(allowed_mime_types, 'application/pdf'),
--     file_size_limit    = 10485760
-- WHERE id = 'exam-papers';
--
-- ※ 발송 기록이 있으면 템플릿을 지우지 말고 kakao_status 만 'draft' 로 둔다.
--     SELECT count(*) FROM public.nkc_scheduled_messages WHERE template_code = 'exam_report';
-- DELETE FROM public.nkc_alimtalk_templates
-- WHERE template_code = 'exam_report' AND kakao_status = 'draft';
