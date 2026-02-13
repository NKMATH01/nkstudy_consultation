-- 테스트비 납부 관련 컬럼 추가
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS test_fee_paid BOOLEAN DEFAULT false;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS test_fee_method TEXT DEFAULT NULL;
-- test_fee_method: 'transfer' (입금) | 'card' (카드) | null (미납)
