-- NK 상담관리 시스템 - 상담 예약 기능용 스키마
-- Supabase SQL Editor에서 실행

-- ========== bookings (상담 예약) ==========
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch TEXT NOT NULL,           -- gojan-math, gojan-eng, zai-both
  consult_type TEXT NOT NULL,     -- phone, inperson
  booking_date DATE NOT NULL,
  booking_hour INTEGER NOT NULL CHECK (booking_hour BETWEEN 13 AND 20),
  student_name TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  school TEXT,
  grade TEXT,
  subject TEXT,                   -- math, eng, both
  progress TEXT,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  pay_method TEXT,                -- done, later, will
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== blocked_slots (차단 시간) ==========
CREATE TABLE IF NOT EXISTS blocked_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_date DATE NOT NULL,
  slot_hour INTEGER NOT NULL CHECK (slot_hour BETWEEN 13 AND 20),
  branch TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slot_date, slot_hour, branch)
);

-- ========== 인덱스 ==========
CREATE INDEX idx_bookings_date_branch ON bookings(booking_date, branch);
CREATE INDEX idx_bookings_paid ON bookings(paid);
CREATE INDEX idx_blocked_slots_date ON blocked_slots(slot_date, branch);

-- ========== RLS ==========
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

-- bookings: 누구나 INSERT (학부모 예약), 인증 사용자 전체 접근
CREATE POLICY "Anyone can insert bookings" ON bookings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can select bookings" ON bookings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated users can update bookings" ON bookings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bookings" ON bookings
  FOR DELETE TO authenticated USING (true);

-- blocked_slots: 누구나 조회, 인증 사용자만 관리
CREATE POLICY "Anyone can select blocked_slots" ON blocked_slots
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated users manage blocked_slots" ON blocked_slots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== updated_at 트리거 ==========
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
