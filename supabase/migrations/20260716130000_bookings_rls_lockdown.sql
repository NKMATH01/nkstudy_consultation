-- ⚠ 이 코드(STEP 3) 배포 후에만 실행. 직접 실행 금지.

DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public read booking slots" ON public.bookings;

CREATE POLICY "Authenticated insert bookings"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated read bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.bookings
  FROM anon;

DROP POLICY IF EXISTS "Anyone can select blocked_slots" ON public.blocked_slots;

CREATE POLICY "Authenticated select blocked_slots"
  ON public.blocked_slots
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON public.blocked_slots FROM anon;
