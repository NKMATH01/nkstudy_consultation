-- NK 상담관리 시스템 - 신입생 등록 기능용 스키마
-- Supabase SQL Editor에서 실행

-- ========== UUID 확장 ==========
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== profiles (사용자 프로필) ==========
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== teachers (선생님 정보) ==========
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT,
  target_grade TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== classes (반 정보) ==========
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  teacher TEXT,
  target_grade TEXT,
  class_days TEXT,
  class_time TEXT,
  clinic_time TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== consultations (상담 데이터) ==========
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  school TEXT,
  grade TEXT,
  parent_phone TEXT,
  consult_date DATE,
  consult_time TIME,
  subject TEXT,
  location TEXT,
  consult_type TEXT NOT NULL DEFAULT '유선 상담',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'pending')),
  result_status TEXT NOT NULL DEFAULT 'none' CHECK (result_status IN ('none', 'registered', 'hold', 'other')),
  memo TEXT,
  doc_sent BOOLEAN NOT NULL DEFAULT FALSE,
  call_done BOOLEAN NOT NULL DEFAULT FALSE,
  attitude TEXT,
  willingness TEXT,
  parent_level TEXT,
  requests TEXT,
  prev_academy TEXT,
  school_score TEXT,
  test_score TEXT,
  plan_date DATE,
  plan_class TEXT,
  notify_sent BOOLEAN NOT NULL DEFAULT FALSE,
  consult_done BOOLEAN NOT NULL DEFAULT FALSE,
  prefer_days TEXT,
  student_level TEXT,
  reserve_text_sent BOOLEAN NOT NULL DEFAULT FALSE,
  reserve_deposit BOOLEAN NOT NULL DEFAULT FALSE,
  payment_type TEXT NOT NULL DEFAULT '미완료',
  prev_complaint TEXT,
  referral TEXT,
  has_friend TEXT,
  advance_level TEXT,
  study_goal TEXT,
  analysis_id UUID,
  registration_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ========== 인덱스 ==========
CREATE INDEX idx_consultations_consult_date ON consultations(consult_date DESC);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_name ON consultations(name);
CREATE INDEX idx_consultations_created_at ON consultations(created_at DESC);
CREATE INDEX idx_classes_active ON classes(active);
CREATE INDEX idx_teachers_active ON teachers(active);

-- ========== RLS 정책 ==========
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- profiles: 본인 프로필 수정, 전체 조회
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- consultations: 인증된 사용자 전체 접근
CREATE POLICY "Enable all for authenticated users" ON consultations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- classes: 인증된 사용자 전체 접근
CREATE POLICY "Enable all for authenticated users" ON classes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- teachers: 인증된 사용자 전체 접근
CREATE POLICY "Enable all for authenticated users" ON teachers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== updated_at 자동 갱신 트리거 ==========
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at
  BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== 프로필 자동 생성 트리거 ==========
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
