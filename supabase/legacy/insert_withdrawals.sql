-- ============================================================
-- NK학원 퇴원 기록 (withdrawals) - 테이블 생성 + 데이터 INSERT
-- 생성일: 2026-02-13
-- 총 30건
-- ============================================================

-- 1) updated_at 트리거 함수 (이미 존재하면 무시)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) 테이블 생성
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  school TEXT,
  subject TEXT,
  class_name TEXT,
  teacher TEXT,
  grade TEXT,
  enrollment_start TEXT,
  enrollment_end TEXT,
  duration_months NUMERIC,
  withdrawal_date TEXT,
  class_attitude TEXT,
  homework_submission TEXT,
  attendance TEXT,
  grade_change TEXT,
  recent_grade TEXT,
  reason_category TEXT,
  student_opinion TEXT,
  parent_opinion TEXT,
  teacher_opinion TEXT,
  final_consult_date TEXT,
  final_counselor TEXT,
  final_consult_summary TEXT,
  parent_thanks BOOLEAN DEFAULT FALSE,
  comeback_possibility TEXT,
  expected_comeback_date TEXT,
  special_notes TEXT,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) RLS
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'withdrawals' AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON withdrawals FOR ALL USING (true);
  END IF;
END $$;

-- 4) Updated_at 트리거
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'withdrawals'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON withdrawals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 5) INSERT 데이터 (30건)
-- ============================================================

-- #1 임예나 (수학, 고1E1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '임예나', '수학', '고1E1', '서동환', '고1',
  '2025.03.03', '2025.12.31', 10, '2025.12.31',
  '중상', '중상', '상', '하락', '중등 3-2 중간고사 75점',
  '성적 부진',
  '겨울방학동안 학생의 휴식을 위해 퇴원.',
  '겨울방학동안 학생의 휴식을 위해 퇴원.',
  '학생 휴식은 다소 표면적인 사유로, 성적 하락이 가장 큰 이유로 예상. 고1E1반이 고1D2반과 임시 합반되면서 진도가 느려진 것 또한 퇴원 결정에 비중이 있을 것으로 생각됨.',
  '12.30', '조세빈', '임시 담당 강사로서 인사 및 기간 안내. 특강 수강 여부 문의.',
  TRUE, '하', '알 수 없음',
  '담당 강사(서동환T) 부재중입니다. 퇴원 상담 및 보고는 조세빈T가 진행했습니다.',
  '[NK학원 퇴원 기록] 임예나 / 수학 / 고1E1 / 서동환T(부재중 / 대리 : 조세빈T) / 재원기간: 2025.03.03~2025.12.31(10개월) / 퇴원일: 2025.12.31'
);

-- #2 최규원 (수학, 중3D2)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '최규원', '수학', '중3D2', '박기태', '중3',
  '2025.06.04', '2026.01.02', 7, '2026.01.02',
  '중상', '중상', '상', '하락', '중등 2-2 기말고사 62점',
  '스케줄 변동',
  '고등학교를 요리 특성화고 목표로 하는 학생이라서 5월에 대회를 나가게 되는데 1월에는 케이크 수업을 받아야해서 학원 시간과 겹치게 되어 1달간 휴원하기로 함',
  '고등학교를 요리 특성화고 목표로 하는 학생이라서 5월에 대회를 나가게 되는데 1월에는 케이크 수업을 받아야해서 학원 시간과 겹치게 되어 1달간 휴원하기로 함',
  '위와 동일. 겨울방학 특강은 듣기로 함',
  '12.17', '박기태', '기말고사 상담 및 요리학원으로 인한 휴원',
  TRUE, '상', '2월 초',
  '겨울특강 월수반 신청 완료',
  '[NK학원 퇴원 기록] 최규원 / 수학 / 중3D2 / 박기태T / 재원기간: 2025.06.04~2026.01.02(7개월) / 퇴원일: 2026.01.02'
);

-- #3 이호준 (영어, 고2L1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '이호준', '영어', '고2L1', '박규진', '고2',
  '2025.05.27', '2025.12.29', 7, '2025.12.29',
  '중상', '하', '중', '유지', '25년2학기 기말고사 60점',
  '학습 의지 및 태도',
  '더 점수를 올리고싶은 학습의지가 없으며 숙제 및 학원에서 제공하는 학습 소화를 하지못함.',
  '더 점수를 올리고싶은 학습의지가 없으며 숙제 및 학원에서 제공하는 학습 소화를 하지못함. 최근 학생과 부모님의 다툼으로 이어졌고 그 과정에서 퇴원 결정함.',
  '출석률 좋지 않고 숙제 제출 등 학부모님이 이야기해도 학생이 잘 하지않음. 최근 학생과 부모님의 다툼으로 이어졌고 그 과정에서 퇴원 결정함.',
  '12.8', '박규진', '호준이와 다툼에 대해이야기 하고 진로관련 상담 진행',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 이호준 / 영어 / 고2L1 / 박규진T / 재원기간: 2025.05.27~2025.12.29(7개월) / 퇴원일: 2025.12.29'
);

-- #4 구윤하 (수학, 고1C3)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '구윤하', '수학', '고1C3', '김수한', '고1',
  '2025.12.02', '2026.01.03', 1, '2026.01.03',
  '중상', '상', '상', '유지', '최근 시험X',
  '스케줄 변동',
  '윈터스쿨로 인한 휴원',
  '윈터스쿨로 인한 휴원',
  '위와 같음',
  '12.09', '학부모', '신입생 일주일차 상담',
  TRUE, '상', '3월 초',
  NULL,
  '[NK학원 퇴원 기록] 구윤하 / 수학 / 고1C3 / 김수한T / 재원기간: 2025.12.02~2026.01.03(1개월) / 퇴원일: 2026.01.03'
);

-- #5 정유채 (영어, 고2L3)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '정유채', '영어', '고2L3', '김하영', '고2',
  NULL, '2025.12.30', 12, '2026.01.02',
  '중', '중', '중', '유지', '25년2학기 기말고사 50점 중반대',
  '타 학원/과외로 이동',
  '생각보다 점수가 나오지 않고 아이가 학원변경에 대한 고민이 지난시험때부터 있었던 상황',
  '어머님께서는 학원 자주 옮겨다니것에 대해 동의하지 않으나, 이번에 학원에 픽드랍해주시던 아버님이 일정상 픽드랍이 어려워지며, 아이 생각대로 학원 옮겨보시기로 결정하심.',
  '학생은 학습상태를 교정할 의지는 없고, 반변경하는 시기라 학원을 바꿔보고 싶은 마음이 든것 같고, 어머님은 아이가 점수에 불만족하다는 얘기와 여러 상황을 보고 퇴원하시기로 결정하신듯함.',
  '1.2', '김하영', '학생 자신의 성적 불만족과 아버지의 일정 변경으로 픽드랍이 어려워져 퇴원하신다함.',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 정유채 / 영어 / 고2L3 / 김하영T / 재원기간: 잘모름~2025.12.30(약12개월) / 퇴원일: 2026.01.02'
);

-- #6 임예나 (영어, 중3L1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '임예나', '영어', '중3L1', '김하영', '중3',
  NULL, NULL, 10, '2026.01.02',
  '중상', '상', '중상', '상승', '25년2학기 기말고사 92점',
  '타 학원/과외로 이동',
  '방학이라 쉬고 싶기도 하고, 혼자서 공부해보거나 다른학원 옮겨보고 싶다고도 했다셔서 퇴원하기로 하심.',
  '방학이라 쉬고 싶기도 하고, 혼자서 공부해보거나 다른학원 옮겨보고 싶다고도 했다셔서 퇴원하기로 하심.',
  '학습에 대한 결정권이나 케어가 학생본인에게 있는편 합반되며 반 변경으로 적응이 되지 않은듯함.',
  '1.3', '김하영', '방학이라 쉬고 싶기도 하고, 학생이 본인과 학원이 잘 안맞는것 같다했다시며 학원이동도 생각해 퇴원하신다하심.',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 임예나 / 영어 / 중3L1 / 김하영T / 재원기간: 잘모름(약10개월) / 퇴원일: 2026.01.02'
);

-- #7 김지성 (영어, 고1L1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '김지성', '영어', '고1L1', '김하영', '고1',
  NULL, '2025.12.30', 12, '2026.01.02',
  '중하', '하', '상', '상승', '25년2학기 기말고사 65점',
  '학습 의지 및 태도',
  '학습의지가 없으며 숙제 및 학원에서 제공하는 학습 소화를 하지못함. 한달동안 혼자 해보겠다해서 퇴원시키기로 함.',
  '학습의지가 없으며 숙제 및 학원에서 제공하는 학습 소화를 하지못함. 한달동안 혼자 해보겠다해서 퇴원시키기로 함.',
  '숙제 제출 등 학부모님이 이야기해도 학생이 잘 하지않고, 늘 반복되는 패턴으로 퇴원하기로 함.',
  '1.5', '김하영', '영어과 원장님께 연락와서 퇴원결정하시고, 담당교사가 연락드렸으나 통화가 어려운 상황, 카톡으로 인사드림.',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 김지성 / 영어 / 고1L1 / 김하영T / 재원기간: 잘모름~2025.12.30(약12개월) / 퇴원일: 2026.01.02'
);

-- #8 조연성 (영어, 중3L1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '조연성', '영어', '중3L1', '김하영', '중3',
  NULL, NULL, 13, '2026.01.02',
  '중상', '중하', '상', '유지', '25년2학기 기말고사 92점',
  '스케줄 변동',
  '과학 같은 다른 과목 점수가 너무 안나와서 공부해야 할듯한데, 메가스터디 온라인 과정을 어머니 감독하에 수강하기로 해서, 수학은 다음학기까지 다녀볼 생각이나, 영어학원은 이번에 퇴원하기로 하심.',
  '과학 같은 다른 과목 점수가 너무 안나와서 공부해야 할듯한데, 메가스터디 온라인 과정을 어머니 감독하에 수강하기로 해서, 영어학원은 이번에 퇴원하기로 하심.',
  '반 변경 후 컨디션이 좋지 않다며 수업을 거의 나오지 않아, 상황을 잘은 모르나, 말씀하신대로 방학동안 집에서 타과목 온라인으로 들을 예정인듯하심.',
  '1.2', '김하영', '방학동안 다른 과목 공부에 힘을 쏟기로 해서 온라인 수업 진행하기러 하심.',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 조연성 / 영어 / 중3L1 / 김하영T / 재원기간: 잘모름(약13개월) / 퇴원일: 2026.01.02'
);

-- #9 정다은 (영어, 고2L3)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '정다은', '영어', '고2L3', '김하영', '고2',
  NULL, '2026.01.02', NULL, '2026.01.05',
  '중', '상', '중', '유지', '25년 2학기 기말고사 50점 중반대',
  '스케줄 변동',
  '주위에서 너도나도 한다길래, 어머니께서도 방학동안 아침부터 하는 윈터스쿨을 알아보던 중이었다고 하십니다. 안산지역의 윈터스쿨에 접수하여 퇴원하시기로 하셨습니다.',
  '주위에서 너도나도 한다길래, 어머니께서도 방학동안 아침부터 하는 윈터스쿨을 알아보던 중이었다고 하십니다. 안산지역의 윈터스쿨에 접수하여 퇴원하시기로 하셨습니다.',
  '아이가 스스로 하는 학생은 아니라, 어머니께서 한달만이라고 해보자 설득하셔서 윈터스쿨 등록했다 하심.',
  '1.5', '김하영', '아침부터 저녁까지 하는 윈터스쿨에 보내기로 하셔서 퇴원 결정하심.',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 정다은 / 영어 / 고2L3 / 김하영T / 재원기간: 잘모름~2026.1.2 / 퇴원일: 2026.01.05'
);

-- #10 임시현 (영어, 중3L1) - 휴원 기록
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '임시현', '영어', '중3L1', '김하영', '중3',
  NULL, '2026.01.02', NULL, '2026.01.05',
  '중', '하', '상', '상승', '25년2학기 기말고사 74점',
  '개인 사유',
  '어머니께서 시현이와 아버님 사이에 실랑이가 있었는데, 1~2주 정도 시현이 생각이 정리되는 대로 결단내도 연락주시겠다 하심. 휴원처리.',
  '어머니께서 시현이와 아버님 사이에 실랑이가 있었는데, 1~2주 정도 시현이 생각이 정리되는 대로 결단내도 연락주시겠다 하심. 휴원처리.',
  '실랑이가 학습에 관한것인지 여쭈었으나 확답하지 않으셨고, 시현이가 맘정리, 생각정리 한 다음 연락주시단 하신것 보면, 아버지께서 크게혼내시며 공부 계속할지 안할지 결정하라신 느낌.',
  '1.5', '김하영', '카톡으로 갑작스레 죄송하다며 연락오심. 시현이 맘과 생각 정리 후 연락주시단 하심.',
  TRUE, '하', NULL,
  '휴원 기록',
  '[NK학원 휴원 기록] 임시현 / 영어 / 중3L1 / 김하영T / 재원기간: 잘모름~2026.1.2 / 퇴원일: 2026.01.05'
);

-- #11 김승아 (수학, 고2C3)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '김승아', '수학', '고2C3', '박기태', '고2',
  '2025.05.20', '2026.01.06', 8, '2026.01.06',
  '중상', '중', '상', '유지', '(기말) 61.5점',
  '스케줄 변동',
  '윈터스쿨로 인하여 휴원한다고 함.',
  '윈터스쿨로 인하여 휴원한다고 함.',
  '위와 동일',
  '01.06', '박기태', '2월 8일에 퇴소하고 2월 10일부터 학원 다시 온다고 함.',
  TRUE, '상', '2월 10일',
  NULL,
  '[NK학원 퇴원 기록] 김승아 / 수학 / 고2C3 / 박기태T / 재원기간: 2025.05.20~2026.01.06(8개월) / 퇴원일: 2026.01.06'
);

-- #12 이서이 (수학, 고2동산)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '이서이', '수학', '고2동산', '조현준', '고2',
  '2021.12.27', '2026.01.03', 60, '2026.01.08',
  '중상', '중상', '중상', '상승', '(기말) 85.9점',
  '수업 내용 및 방식',
  '현재 미적분1 수업 중 개념 수업이 너무 많아 지루함을 느낌. 문제풀이 위주의 수업을 듣고 싶어함. 메가스터디 인강을 수강하기로 했다고 함.',
  '현재 미적분1 수업 중 개념 수업이 너무 많아 지루함을 느낌. 문제풀이 위주의 수업을 듣고 싶어함. 메가스터디 인강을 수강하기로 했다고 함.',
  '위와 동일',
  '01.08', '조현준', '서이의 학습 습관과 관리 및 테스트를 통한 학습 점검 등을 아이와 함께 고민해볼 것을 권유 드림.',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 이서이 / 수학 / 고2동산 / 조현준T / 재원기간: 2021.12.27~2026.01.03(약5년) / 퇴원일: 2026.01.08'
);

-- #13 서하온 (수학, 초6A1K)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '서하온', '수학', '초6A1K', '김정옥', '초6',
  '2025.01.06', '2026.01.09', 12, '2026.01.09',
  '중상', '중상', '상', '하락', '주간테스트 75점',
  '학습량 부담',
  '아이가 숙제가 부담되고 내용이 어려워 힘들어 함 일테 마무리 후 학원에 오래 남는게 체력적으로 힘듬',
  '아이가 숙제가 부담되고 내용이 어려워 힘들어 함 일테 마무리 후 학원에 오래 남는게 체력적으로 힘듬',
  '숙제의 양이 많다고 느껴 힘들어 하고 어려운 내용에 일일테스트 점수가 잘 나오지 않아 많이 속상해하고 힘들어하는 모습이 있었습니다.',
  '12.16', '김정옥', '하온이의 숙제 관련해서 핸드폰 사용이 꼭 필요한지와 하온이의 전반적인 학습 태도에 대해 상담',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 서하온 / 수학 / 초6A1K / 김정옥T / 재원기간: 2025.1.6~2026.01.09(12개월) / 퇴원일: 2026.01.09'
);

-- #14 한재웅 (수학, 중3B2)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '한재웅', '수학', '중3B2', '김의준', '중3',
  '2024.03.12', '2026.01.09', 22, '2026.01.09',
  '중상', '상', '중상', '유지', '(기말) 91점',
  '스케줄 변동',
  '윈터스쿨로 인하여 휴원한다고 함.',
  '윈터스쿨로 인하여 휴원한다고 함.',
  '위와 동일',
  '01.06', '김의준', '평촌 청솔학원으로 1월12일~1월31일 윈터캠프 다녀옴.',
  TRUE, '상', '2월 3일',
  NULL,
  '[NK학원 퇴원 기록] 한재웅 / 수학 / 중3B2 / 김의준T / 재원기간: 2024.03.12~2026.01.09(22개월) / 퇴원일: 2026.01.09'
);

-- #15 안수현 (수학, 고2A1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '안수현', '수학', '고2A1', '조현준', '고2',
  '2022.05.24', '2026.01.08', 43, '2026.01.08',
  '중상', '중상', '중상', '하락', '(기말) 80점',
  '스케줄 변동',
  '윈터스쿨 : 이투스(경기도 광주). 윈터스쿨로 인하여 휴원한다고 함.',
  '윈터스쿨 : 이투스(경기도 광주). 윈터스쿨로 인하여 휴원한다고 함.',
  '위와 동일',
  '01.02', '조현준', '경기도 광주 이투스 기숙학원 1월 한달동안 갔다온다고 연락오심.',
  TRUE, '상', '2월 초',
  NULL,
  '[NK학원 퇴원 기록] 안수현 / 수학 / 고2A1 / 조현준T / 재원기간: 2022.05.24~2026.01.08(약3년7개월) / 퇴원일: 2026.01.08'
);

-- #16 이시아 (수학, 중1C2)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '이시아', '수학', '중1C2', '박기태', '중1',
  '2026.01.06', '2026.01.10', 0, '2026.01.13',
  '상', '상', '상', NULL, '주간테스트 100점',
  '학습 관리 및 시스템',
  '중학교 2학기 진도를 정규수업이 아닌 특강으로 진행하는 것에 대해서 시아에게 안 맞다고 생각하심.',
  '중학교 2학기 진도를 정규수업이 아닌 특강으로 진행하는 것에 대해서 시아에게 안 맞다고 생각하심.',
  '상담 전화 때 학원 커리큘럼 상 2학기 진도는 특강으로 진행하는 것에 대해 설명드렸고, 어머니 입장에서는 도형이 약한 시아에게 정규수업으로 진행이 되었으면 하는 마음이 크셨지만 그러지 못하게 되어 퇴원을 결정하셨음.',
  '01.12', '박기태', '학원 커리큘럼 설명 및 시아 수업태도 관련 상담',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 이시아 / 수학 / 중1C2 / 박기태T / 재원기간: 2026.01.06~2026.01.10(약1주) / 퇴원일: 2026.01.13'
);

-- #17 양서현 (수학, 고2D2)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '양서현', '수학', '고2D2', '조세빈', '고2',
  '2025.07.14', '2026.01.14', 6, '2026.01.14',
  '상', '중', '상', '하락', '고1 2학기 기말고사 58점',
  '개인 사유',
  '최근 학생 개인사로 인해 심리적으로 힘든 상태. 방학간 휴식하기로 함.',
  '최근 학생 개인사로 인해 심리적으로 힘든 상태. 방학간 휴식하기로 함.',
  '수업 태도가 매우 좋고, 학습 의욕이 있는 학생이었으나 12월 말 방학을 전후로 학습 적극성이 눈에 띄게 떨어짐.',
  '01.09', '조세빈', '진학 방향성에 대한 간단 상담.',
  TRUE, '중하', '알 수 없음',
  NULL,
  '[NK학원 퇴원 기록] 양서현 / 수학 / 고2D2 / 조세빈T / 재원기간: 2025.07.14~2026.01.14(6개월) / 퇴원일: 2026.01.14'
);

-- #18 임성근 (수학, 고2A2)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '임성근', '수학', '고2A2', '김형철', '고2',
  '2025.11.03', '2026.01.14', 2, '2026.01.14',
  '중상', '중하', '상', '유지', '고1 2학기 기말고사 70점',
  '학습 의지 및 태도',
  '학생 스스로 공부한다고 함.',
  '학생 스스로 공부한다고 함.',
  '수업태도는 좋았으나 학원을 갔다가 집가서 밥먹고 잠을 자느라 숙제를 늦게 제출할 때가 많았음.',
  '12.22', '김형철', '시험 종료 후 앞으로 커리큘럼 설명',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 임성근 / 수학 / 고2A2 / 김형철T / 재원기간: 2025.11.03~2026.01.14(2개월) / 퇴원일: 2026.01.14'
);

-- #19 이효원 (수학, 중2C1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '이효원', '수학', '중2C1', '박기태', '중2',
  '2025.05.13', '2026.01.13', 8, '2026.01.14',
  '중상', '상', '상', '유지', '중1 2학기 기말고사 82점',
  '친구 문제',
  '효원이 친구가 다니는 학원으로 옮기고 싶어 했음.',
  '효원이 친구가 다니는 학원으로 옮기고 싶어 했음.',
  '평상시 효원이는 수업 태도가 양호했으나, 학원에서의 교우 관계에 대해 중요시 여겼을 것이라 생각됨.',
  '01.02', '박기태', '효원이가 들어야 할 방학 특강 커리큘럼에 대한 상담',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 이효원 / 수학 / 중2C1 / 박기태T / 재원기간: 2025.05.13~2026.01.13(8개월) / 퇴원일: 2026.01.14'
);

-- #20 이현서 (수학, 고1C2)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '이현서', '수학', '고1C2', '박기태', '고1',
  '2025.05.21', '2026.01.16', 8, '2026.01.16',
  '상', '중', '상', '유지', '중3 2학기 중간고사 88점',
  '타 학원/과외로 이동',
  '경안고 위주의 학원으로 가기로 함',
  '경안고 위주의 학원으로 가기로 함',
  '안양외고 불합격으로 경안고를 미달로 들어가게 되었는데 통학 거리도 그렇고 경안고 근처의 경안고 학생 대비 위주의 학원으로 옮기기로 하였음.',
  '01.14', '박기태', '향후 학습계획 설정 상담',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 이현서 / 수학 / 고1C2 / 박기태T / 재원기간: 2025.05.21~2026.01.16(8개월) / 퇴원일: 2026.01.16'
);

-- #21 임시현 (수학, 중3D3)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '임시현', '수학', '중3D3', '이형우', '중3',
  '2025.07.14', '2026.01.19', 6, '2026.01.19',
  '중하', '하', '중', '상승', '중2 2학기 기말고사 81점',
  '개인 사유',
  '학생과 아버님의 다툼이 있은 후 2주간 휴원을 했는데 해결이 안된 듯 합니다',
  '학생과 아버님의 다툼이 있은 후 2주간 휴원을 했는데 해결이 안된 듯 합니다',
  '학생이 수업시간에 집중을 하지 못하고 숙제를 다수 미제출 하여 어머니와 상담 후 조금 더 강압적인 방법을 사용하기로 합의함.',
  '01.02', '이형우', '향후 학습계획 상담',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 임시현 / 수학 / 중3D3 / 이형우T / 재원기간: 2025.07.14~2026.01.19(6개월) / 퇴원일: 2026.01.19'
);

-- #22 지은 (수학, 중3D4)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '지은', '수학', '중3D4', '이형우', '중3',
  '2025.01.19', '2026.01.21', 12, '2026.01.21',
  '중상', '중상', '중상', '유지', '중2 2학기 기말고사 70점',
  '강사 역량 및 소통',
  '강사,학원과 잘맞지 않는다고 느낌',
  '강사,학원과 잘맞지 않는다고 느낌',
  '등원전부터 학부모님과 학생이 같은 반에 친구가 다수 있는 것을 우려하였음.',
  '01.19', '이형우', '신입생 상담',
  TRUE, '하', NULL,
  '신입생 보강과 정규 수업 한번 진행 후 퇴원함.',
  '[NK학원 퇴원 기록] 지은 / 수학 / 중3D4 / 이형우T / 재원기간: 2025.01.19~2026.01.21(3일) / 퇴원일: 2026.01.21'
);

-- #23 정준회 (영어, 고2L2)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '정준회', '영어', '고2L2', '박규진', '고2',
  '2025.03.10', '2026.01.09', 12, '2026.01.09',
  '상', '중상', '중상', '유지', '2학기 기말고사 97점',
  '스케줄 변동',
  '타과목 공부를 방학때 더 하고싶어서 계획을 세움. 영어는 특강만 학원에서 듣고 정규수업은 종료.',
  '타과목 공부를 방학때 더 하고싶어서 계획을 세움. 영어는 특강만 학원에서 듣고 정규수업은 종료.',
  '학생 본인이 영어는 실력이 좋고 충분한데 타과목에서 부족한 부분을 이번 방학때 메우고 싶은 생각이 많음.',
  '01.14', '박규진', '퇴원 및 학습상담',
  TRUE, '상', '2026년 3월 중순',
  NULL,
  '[NK학원 퇴원 기록] 정준회 / 영어 / 고2L2 / 박규진T / 재원기간: 2025.03.10~2026.01.09(12개월) / 퇴원일: 2026.01.09'
);

-- #24 김효중 (수학, 고3확통B2)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '김효중', '수학', '고3확통B2', '김의준', '고3',
  '2024.09', '2026.01', 17, '2026.01.24',
  '중', '하', '중하', '유지', '기말고사 70점',
  '개인 사유',
  '고1때부터 예정되어있던 중국 유학 준비를 본격적으로 준비 시작.',
  '고1때부터 예정되어있던 중국 유학 준비를 본격적으로 준비 시작.',
  '위와 동일',
  '12/18', '김의준', '중국여행을 앞두고 학생이 공부를 전혀 하지 않으려고 함.',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 김효중 / 수학 / 고3확통B2 / 김의준T / 재원기간: 2024.09~2026.01(약17개월) / 퇴원일: 2026.01.24'
);

-- #25 전준구 (수학, 중2B2)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '전준구', '수학', '중2B2', '김의준', '중2',
  '2025.07.30', '2026.01.28', 6, '2026.01.28',
  '중', '중', '중', '유지', '기말고사 100점',
  '학습 의지 및 태도',
  '복싱을 다니기 시작하면서 공부가 하기 싫어짐',
  '복싱을 다니기 시작하면서 공부가 하기 싫어졌으며 모든 학원에 다니기 싫다고 학생이 집에서 책을 찢으며 반항중임.',
  '학생이 질이 좋지 못한 친구들과 평소에도 어울렸는데 복싱까지 다니기 시작하면서 공부에 손을 놓으려고 함.',
  '01.27', '김의준', '집에서 반항하며 학원에 가지 않으려고 함',
  TRUE, '상', '3월',
  NULL,
  '[NK학원 퇴원 기록] 전준구 / 수학 / 중2B2 / 김의준T / 재원기간: 2025.07.30~2026.01.28(6개월) / 퇴원일: 2026.01.28'
);

-- #26 윤이설 (수학, 중3C1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '윤이설', '수학', '중3C1', '김정옥', '중3',
  '2024.04.15', '2026.02.02', 22, '2026.02.02',
  '중', '중상', '상', '하락', '2학기 기말고사 73점',
  '학습 의지 및 태도',
  '혼자 공부해보겠다고함',
  '어머님은 학원에 보내고 싶어했지만 아이의 의견이 강력해 아이를 믿고 지지해주시기로함',
  '최근 숙제를 늦게 제출하거나 수업시간에 집중하지 못하는 모습이 있었습니다.',
  '12.15', '김정옥', '기말고사 후 앞으로의 계획 및 전체적인 방향성 상담',
  TRUE, '하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 윤이설 / 수학 / 중3C1 / 김정옥 / 재원기간: 2024.04.15~2026.02.02(22개월) / 퇴원일: 2026.02.02'
);

-- #27 장정우 (영어, 고1L1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '장정우', '영어', '고1L1', '김하영', '고1',
  '2025.12.04', '2026.01.27', 2, '2026.01.30',
  '중', '중상', '상', '유지', '없음',
  '타 학원/과외로 이동',
  '수업시간에 하는 건 알아들으나, 모의고사 수업시 그외 기초적인 내용을 잘 몰라 힘들었다 함.',
  '친구가 하는 과외선생님에게 테스트 받아보았는데, 중등 2학년 과정의 기초도 안되어있다하여, 과외 보내시기로 하심.',
  '기초가 없는데, 열심히 하려하니, 해야할 양이 많아 자신과의 차이가 점점더 보이니, 학생 스스로 급해지는 마음만 더 생긴듯 합니다.',
  '1.30', '김하영', '아이가 영어 기초잡기에는 학원의 수업과 맞지않고, 병행이 어렵다 생각하심.',
  TRUE, '중하', NULL,
  NULL,
  '[NK학원 퇴원 기록] 장정우 / 영어 / 고1L1 / 김하영 / 재원기간: 2025.12.4~2026.01.27(2개월) / 퇴원일: 2026.01.30'
);

-- #28 이에론 (수학, 초6A1K)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '이에론', '수학', '초6A1K', '김정옥', '초6',
  '2025.01.02', '2026.02.02', 13, '2026.02.02',
  '상', '상', '상', '유지', '월말평가 100점',
  '학습 관리 및 시스템',
  NULL,
  '본수업 시간에 중등 2학기 과정을 하지 않고 넘어가는 부분이 조금 불안해함. 과외를 통해서 중등 과정을 마무리하고 고등 과정에서 다시 다니고 싶다고 말씀하심',
  '2-1 과정이 마무리 되가면서 2-2를 수업시간에 하면 안되냐고 물어보시는 연락이 종종 있었습니다. 학원 커리큘럼에 대해 설명드리고 부족함 없이 나간다고 말씀드렸지만 불안감을 해소하지 못한 것 같습니다.',
  '01.14', '김정옥', '중등2학기에 대한 내용 앞으로 어떻게 채우는지에 대한 설명',
  TRUE, '중', '7월',
  NULL,
  '[NK학원 퇴원 기록] 이에론 / 수학 / 초6A1K / 김정옥T / 재원기간: 2025.01.02~2026.02.02(13개월) / 퇴원일: 2026.02.02'
);

-- #29 이수민 (영어, 중3L1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '이수민', '영어', '중3L1', '김하영', '중3',
  '2026.01.05', '2026.01.30', 1, '2026.02.02',
  '상', '상', '상', '유지', '월말평가 88.4점',
  '스케줄 변동',
  '2월달 쉬는 날이 많고, 영어수업이 있는 날에 빠지는 날이 많아 한달 쉬기로 함.',
  '수학은 계속 다니고, 영어만 2월 한 달 쉰 후, 학교 개학하면 다시 보내기로 하심.',
  '아이들도 잘 적응하고 만족하는 편이었고, 3월달 다시 등원할 가능성 높음.',
  '2.2', '김하영', '구정연휴와 방학기간 여행으로 영어수강은 한달 쉬기로 하심.',
  TRUE, '상', '3월',
  '쌍둥이 자매',
  '[NK학원 퇴원 기록] 이수민 / 영어 / 중3L1 / 김하영 / 재원기간: 2026.1.5~2026.01.30(1개월) / 퇴원일: 2026.02.02'
);

-- #30 이수빈 (영어, 중3L1)
INSERT INTO withdrawals (
  name, subject, class_name, teacher, grade,
  enrollment_start, enrollment_end, duration_months, withdrawal_date,
  class_attitude, homework_submission, attendance, grade_change, recent_grade,
  reason_category, student_opinion, parent_opinion, teacher_opinion,
  final_consult_date, final_counselor, final_consult_summary,
  parent_thanks, comeback_possibility, expected_comeback_date, special_notes, raw_text
) VALUES (
  '이수빈', '영어', '중3L1', '김하영', '중3',
  '2026.01.05', '2026.01.30', 1, '2026.02.02',
  '상', '상', '상', '유지', '없음',
  '스케줄 변동',
  '부모님 의견 동일',
  '2월달 쉬는 날이 많고, 영어수업이 있는 날에 빠지는 날이 많아 한달 쉬기로 함.',
  '아이들도 잘 적응하고 만족하는 편이었고, 3월달 다시 등원할 가능성 높음.',
  '2.2', '김하영', '구정연휴와 방학기간 여행으로 영어수강은 한달 쉬기로 하심.',
  TRUE, '상', '3월',
  '쌍둥이 자매',
  '[NK학원 퇴원 기록] 이수빈 / 영어 / 중3L1 / 김하영 / 재원기간: 2026.1.5~2026.01.30(1개월) / 퇴원일: 2026.02.02'
);
