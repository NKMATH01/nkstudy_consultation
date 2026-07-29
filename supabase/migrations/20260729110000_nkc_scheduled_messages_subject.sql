-- 알림톡 발송 대상을 상담 외 문서(등록안내/분석)로 확장
-- File only: apply after user approval.
ALTER TABLE public.nkc_scheduled_messages ADD COLUMN IF NOT EXISTS subject_type TEXT;
ALTER TABLE public.nkc_scheduled_messages ADD COLUMN IF NOT EXISTS subject_id UUID;
