-- 설문당 분석 1건 보장 (재분석은 upsert로 동일 행 갱신)
CREATE UNIQUE INDEX IF NOT EXISTS uq_analyses_survey_id ON analyses(survey_id);
-- 분석당 등록안내 1건 보장
CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_analysis_id ON registrations(analysis_id);
-- 차단슬롯 삼중키 유일성 보장
CREATE UNIQUE INDEX IF NOT EXISTS uq_blocked_slots_slot ON blocked_slots(slot_date, slot_hour, branch);
