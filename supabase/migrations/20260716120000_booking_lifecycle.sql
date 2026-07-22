-- 이미 운영 DB에 적용 완료(2026-07-16). 기록 보존용 — 재실행 금지.

-- =====================================================================
-- NK 상담관리 STEP 2-A: 예약 생애주기 (상태·이력·링크·RPC) — 추가 전용
-- 2026-07-16 V0 실측 결과 기반 확정본. Supabase SQL Editor에서 실행.
-- 이 파일은 추가 전용이므로 현행 배포 코드와 즉시 호환됩니다.
-- ※ RLS 잠금(STEP 2-B)은 별도 파일 — STEP 3 코드 배포 후에만 실행할 것.
-- =====================================================================

-- ── 1. bookings: soft-cancel 상태 컬럼 ─────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check CHECK (status IN ('active','cancelled'));

CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- ── 2. consultations: 이력 컬럼 + booking 링크 ─────────────────────
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

-- ── 3. 토요일 교시(1~4) 허용 — V0-1 실측 제약명 기준 ───────────────
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_booking_hour_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_booking_hour_check
  CHECK ((booking_hour BETWEEN 1 AND 4) OR (booking_hour BETWEEN 13 AND 20));

ALTER TABLE public.blocked_slots DROP CONSTRAINT IF EXISTS blocked_slots_slot_hour_check;
ALTER TABLE public.blocked_slots ADD CONSTRAINT blocked_slots_slot_hour_check
  CHECK ((slot_hour BETWEEN 1 AND 4) OR (slot_hour BETWEEN 13 AND 20));

-- ── 4. booking_id 백필 (양방향 유일 매칭만 — V0-12 실측 93건/모호 0건) ──
WITH pairs AS (
  SELECT c.id AS cid, b.id AS bid
  FROM public.consultations c
  JOIN public.bookings b
    ON b.student_name = c.name
   AND b.booking_date = c.consult_date
   AND c.consult_time::text LIKE lpad(b.booking_hour::text,2,'0') || ':00%'
), uniq AS (
  SELECT cid, bid FROM (
    SELECT cid, bid,
           count(*) OVER (PARTITION BY cid) AS c_cnt,
           count(*) OVER (PARTITION BY bid) AS b_cnt
    FROM pairs
  ) t WHERE c_cnt = 1 AND b_cnt = 1
)
UPDATE public.consultations c
SET booking_id = uniq.bid
FROM uniq
WHERE c.id = uniq.cid AND c.booking_id IS NULL;

-- 백필 후 1예약:1상담 보장 (partial unique)
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultations_booking_id
  ON public.consultations(booking_id) WHERE booking_id IS NOT NULL;

-- ── 5. consultation_events: 변경 이력 (append-only) ────────────────
CREATE TABLE IF NOT EXISTS public.consultation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN
    ('cancelled','rescheduled','reactivated','status_changed','deleted')),
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_by uuid DEFAULT auth.uid(),      -- admin/service 경유 시 NULL 가능
  created_by_label text,                   -- 표시용 라벨 (이메일/이름/'system')
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cevents_booking ON public.consultation_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_cevents_consultation ON public.consultation_events(consultation_id);

ALTER TABLE public.consultation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events readable by authenticated" ON public.consultation_events;
CREATE POLICY "Events readable by authenticated" ON public.consultation_events
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Events insertable by authenticated" ON public.consultation_events;
CREATE POLICY "Events insertable by authenticated" ON public.consultation_events
  FOR INSERT TO authenticated WITH CHECK (true);
-- UPDATE/DELETE 정책·권한 없음 = 감사 이력 불변(append-only)

REVOKE ALL ON public.consultation_events FROM anon;
GRANT SELECT, INSERT ON public.consultation_events TO authenticated;
GRANT ALL ON public.consultation_events TO service_role;

-- ── 6. RPC: 공개 슬롯 조회 (개인정보 미포함 최소 필드) ─────────────
-- 배경: anon은 bookings SELECT 권한이 없어(V0-10) 현재 공개 페이지의
-- 예약현황 조회가 깨져 있음. 이 RPC가 조회 경로를 대체한다.
CREATE OR REPLACE FUNCTION public.get_public_booking_slots(p_start date, p_end date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'bookings', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'booking_date', b.booking_date, 'booking_hour', b.booking_hour,
        'branch', b.branch, 'consult_type', b.consult_type, 'paid', b.paid))
      FROM bookings b
      WHERE b.booking_date BETWEEN p_start AND p_end AND b.status = 'active'
    ), '[]'::jsonb),
    'blocked', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'slot_date', s.slot_date, 'slot_hour', s.slot_hour, 'branch', s.branch))
      FROM blocked_slots s
      WHERE s.slot_date BETWEEN p_start AND p_end
    ), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.get_public_booking_slots(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_booking_slots(date, date) TO anon, authenticated;

-- ── 7. RPC: 예약 생성 (예약+상담+booking_id 원자 생성, 슬롯 잠금) ──
CREATE OR REPLACE FUNCTION public.book_slot(
  p_branch text, p_consult_type text, p_booking_date date, p_booking_hour int,
  p_student_name text, p_parent_name text, p_phone text,
  p_school text, p_grade text, p_progress text, p_subject text, p_pay_method text,
  p_consult_time time, p_consult_type_label text, p_location text, p_subject_label text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking_id uuid;
  v_consultation_id uuid;
BEGIN
  -- 슬롯 단위 직렬화. 유선+유선 중복 허용 규칙 때문에 unique index로는 대체 불가.
  PERFORM pg_advisory_xact_lock(hashtext(p_booking_date::text || '|' || p_booking_hour::text || '|' || p_branch));

  IF EXISTS (SELECT 1 FROM blocked_slots
             WHERE slot_date = p_booking_date AND slot_hour = p_booking_hour AND branch = p_branch) THEN
    RETURN jsonb_build_object('success', false, 'error', 'blocked');
  END IF;

  IF EXISTS (SELECT 1 FROM bookings
             WHERE booking_date = p_booking_date AND booking_hour = p_booking_hour
               AND branch = p_branch AND status = 'active'
               AND (p_consult_type = 'inperson' OR consult_type = 'inperson')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'taken');
  END IF;

  INSERT INTO bookings (branch, consult_type, booking_date, booking_hour,
    student_name, parent_name, phone, school, grade, subject, progress, paid, pay_method, status)
  VALUES (p_branch, p_consult_type, p_booking_date, p_booking_hour,
    p_student_name, p_parent_name, p_phone, nullif(p_school,''), nullif(p_grade,''),
    p_subject, nullif(p_progress,''), (p_pay_method = 'done'), p_pay_method, 'active')
  RETURNING id INTO v_booking_id;

  INSERT INTO consultations (name, school, grade, parent_phone, consult_date, consult_time,
    subject, location, consult_type, reserve_text_sent, reserve_deposit, booking_id, status)
  VALUES (p_student_name, nullif(p_school,''), nullif(p_grade,''), p_phone, p_booking_date, p_consult_time,
    p_subject_label, p_location, p_consult_type_label, true, (p_pay_method = 'done'), v_booking_id, 'active')
  RETURNING id INTO v_consultation_id;

  RETURN jsonb_build_object('success', true,
    'booking_id', v_booking_id, 'consultation_id', v_consultation_id);
END $$;
REVOKE ALL ON FUNCTION public.book_slot(text,text,date,int,text,text,text,text,text,text,text,text,time,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_slot(text,text,date,int,text,text,text,text,text,text,text,text,time,text,text,text) TO anon, authenticated;

-- ── 8. RPC: 예약 취소 (예약+상담 미러+이벤트 원자 처리) ────────────
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid, p_reason text, p_actor_label text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_b record;
  v_cid uuid;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_b.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_cancelled');
  END IF;

  UPDATE bookings
  SET status = 'cancelled', status_changed_at = now(), cancel_reason = p_reason
  WHERE id = p_booking_id;

  -- 연동 상담: booking_id 우선, 없으면 name+date+time 유일 매칭 폴백
  SELECT id INTO v_cid FROM consultations WHERE booking_id = p_booking_id;
  IF v_cid IS NULL THEN
    SELECT min(id::text)::uuid INTO v_cid FROM consultations
    WHERE name = v_b.student_name AND consult_date = v_b.booking_date
      AND consult_time::text LIKE lpad(v_b.booking_hour::text,2,'0') || ':00%'
    HAVING count(*) = 1;
  END IF;

  IF v_cid IS NOT NULL THEN
    UPDATE consultations
    SET status = 'cancelled', status_changed_at = now(), cancel_reason = p_reason
    WHERE id = v_cid;
  END IF;

  INSERT INTO consultation_events (booking_id, consultation_id, event_type, old_value, new_value, reason, created_by_label)
  VALUES (p_booking_id, v_cid, 'cancelled',
    jsonb_build_object('status','active','name',v_b.student_name,'date',v_b.booking_date,'hour',v_b.booking_hour,'branch',v_b.branch),
    jsonb_build_object('status','cancelled'),
    p_reason, p_actor_label);

  RETURN jsonb_build_object('success', true, 'consultation_id', v_cid, 'mirrored', v_cid IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid, text, text) TO authenticated;

-- ── 9. RPC: 예약 시간변경 (충돌검사+양측 시간+이벤트 원자 처리) ────
CREATE OR REPLACE FUNCTION public.reschedule_booking(
  p_booking_id uuid, p_new_date date, p_new_hour int,
  p_new_consult_time time, p_new_consult_type_label text, p_actor_label text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_b record;
  v_cid uuid;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_b.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'cancelled_booking');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_new_date::text || '|' || p_new_hour::text || '|' || v_b.branch));

  IF EXISTS (SELECT 1 FROM blocked_slots
             WHERE slot_date = p_new_date AND slot_hour = p_new_hour AND branch = v_b.branch) THEN
    RETURN jsonb_build_object('success', false, 'error', 'blocked');
  END IF;

  IF EXISTS (SELECT 1 FROM bookings
             WHERE booking_date = p_new_date AND booking_hour = p_new_hour
               AND branch = v_b.branch AND status = 'active' AND id <> p_booking_id
               AND (v_b.consult_type = 'inperson' OR consult_type = 'inperson')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'taken');
  END IF;

  UPDATE bookings
  SET booking_date = p_new_date, booking_hour = p_new_hour, rescheduled_at = now()
  WHERE id = p_booking_id;

  SELECT id INTO v_cid FROM consultations WHERE booking_id = p_booking_id;
  IF v_cid IS NULL THEN
    SELECT min(id::text)::uuid INTO v_cid FROM consultations
    WHERE name = v_b.student_name AND consult_date = v_b.booking_date
      AND consult_time::text LIKE lpad(v_b.booking_hour::text,2,'0') || ':00%'
    HAVING count(*) = 1;
    -- 폴백으로 찾았으면 이참에 링크를 영구 기록
    IF v_cid IS NOT NULL THEN
      UPDATE consultations SET booking_id = p_booking_id WHERE id = v_cid AND booking_id IS NULL;
    END IF;
  END IF;

  IF v_cid IS NOT NULL THEN
    UPDATE consultations
    SET consult_date = p_new_date,
        consult_time = p_new_consult_time,
        consult_type = coalesce(p_new_consult_type_label, consult_type),
        rescheduled_at = now()
    WHERE id = v_cid;
  END IF;

  INSERT INTO consultation_events (booking_id, consultation_id, event_type, old_value, new_value, reason, created_by_label)
  VALUES (p_booking_id, v_cid, 'rescheduled',
    jsonb_build_object('date',v_b.booking_date,'hour',v_b.booking_hour,'name',v_b.student_name,'branch',v_b.branch),
    jsonb_build_object('date',p_new_date,'hour',p_new_hour,'time',p_new_consult_time),
    NULL, p_actor_label);

  RETURN jsonb_build_object('success', true, 'consultation_id', v_cid, 'mirrored', v_cid IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.reschedule_booking(uuid, date, int, time, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_booking(uuid, date, int, time, text, text) TO authenticated;

-- ── 10. RPC: 상담 상태변경 (취소/재활성화/일반 + 예약 미러 + 이벤트) ─
CREATE OR REPLACE FUNCTION public.update_consultation_status(
  p_consultation_id uuid, p_status text, p_reason text, p_actor_label text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_c record;
  v_event_type text;
BEGIN
  IF p_status NOT IN ('active','completed','cancelled','pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  SELECT * INTO v_c FROM consultations WHERE id = p_consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_c.status = p_status THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true);
  END IF;

  v_event_type := CASE
    WHEN p_status = 'cancelled' THEN 'cancelled'
    WHEN v_c.status = 'cancelled' AND p_status = 'active' THEN 'reactivated'
    ELSE 'status_changed'
  END;

  UPDATE consultations
  SET status = p_status, status_changed_at = now(),
      cancel_reason = CASE WHEN p_status = 'cancelled' THEN p_reason ELSE cancel_reason END
  WHERE id = p_consultation_id;

  IF v_c.booking_id IS NOT NULL AND p_status IN ('cancelled','active') THEN
    UPDATE bookings
    SET status = CASE WHEN p_status = 'cancelled' THEN 'cancelled' ELSE 'active' END,
        status_changed_at = now(),
        cancel_reason = CASE WHEN p_status = 'cancelled' THEN p_reason ELSE cancel_reason END
    WHERE id = v_c.booking_id;
  END IF;

  INSERT INTO consultation_events (booking_id, consultation_id, event_type, old_value, new_value, reason, created_by_label)
  VALUES (v_c.booking_id, p_consultation_id, v_event_type,
    jsonb_build_object('status', v_c.status, 'name', v_c.name),
    jsonb_build_object('status', p_status),
    p_reason, p_actor_label);

  RETURN jsonb_build_object('success', true, 'event', v_event_type);
END $$;
REVOKE ALL ON FUNCTION public.update_consultation_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_consultation_status(uuid, text, text, text) TO authenticated;

-- ── 11. RPC: 완전삭제 (삭제 전 스냅샷 이벤트 보존) ─────────────────
CREATE OR REPLACE FUNCTION public.delete_booking_with_event(
  p_booking_id uuid, p_actor_label text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_b record;
  v_cid uuid;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT id INTO v_cid FROM consultations WHERE booking_id = p_booking_id;
  IF v_cid IS NULL THEN
    SELECT min(id::text)::uuid INTO v_cid FROM consultations
    WHERE name = v_b.student_name AND consult_date = v_b.booking_date
      AND consult_time::text LIKE lpad(v_b.booking_hour::text,2,'0') || ':00%'
    HAVING count(*) = 1;
  END IF;

  INSERT INTO consultation_events (booking_id, consultation_id, event_type, old_value, reason, created_by_label)
  VALUES (p_booking_id, v_cid, 'deleted',
    jsonb_build_object('name',v_b.student_name,'date',v_b.booking_date,'hour',v_b.booking_hour,
                       'branch',v_b.branch,'consult_type',v_b.consult_type,'status',v_b.status,
                       'deleted_consultation_id', v_cid),
    NULL, p_actor_label);

  IF v_cid IS NOT NULL THEN
    DELETE FROM consultations WHERE id = v_cid;
  END IF;
  DELETE FROM bookings WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'deleted_consultation', v_cid IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.delete_booking_with_event(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_booking_with_event(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_consultation_with_event(
  p_consultation_id uuid, p_actor_label text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_c record;
  v_bid uuid;
BEGIN
  SELECT * INTO v_c FROM consultations WHERE id = p_consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  v_bid := v_c.booking_id;
  IF v_bid IS NULL THEN
    SELECT min(id::text)::uuid INTO v_bid FROM bookings
    WHERE student_name = v_c.name AND booking_date = v_c.consult_date
      AND v_c.consult_time::text LIKE lpad(booking_hour::text,2,'0') || ':00%'
    HAVING count(*) = 1;
  END IF;

  INSERT INTO consultation_events (booking_id, consultation_id, event_type, old_value, reason, created_by_label)
  VALUES (v_bid, p_consultation_id, 'deleted',
    jsonb_build_object('name',v_c.name,'date',v_c.consult_date,'time',v_c.consult_time,
                       'status',v_c.status,'deleted_booking_id', v_bid),
    NULL, p_actor_label);

  DELETE FROM consultations WHERE id = p_consultation_id;
  IF v_bid IS NOT NULL THEN
    DELETE FROM bookings WHERE id = v_bid;
  END IF;

  RETURN jsonb_build_object('success', true, 'deleted_booking', v_bid IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.delete_consultation_with_event(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_consultation_with_event(uuid, text) TO authenticated;

