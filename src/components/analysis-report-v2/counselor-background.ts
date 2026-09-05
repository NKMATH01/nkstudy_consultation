// 상담자 화면·강사 시트·학부모 결과지가 함께 쓰는 학생 사전정보(배경) 타입.
// analyses/[id]/page.tsx 가 intake_v2 에서 조립한다. 연락처는 여기 넣지 않는다.

export interface CounselorBackground {
  prevAcademy?: string | null;
  prevLeaveReason?: string | null;
  prevComplaint?: string | null;
  prevConcerns?: string[] | null;
  referral?: string | null;
  nkKnowledge?: string | null;
  nkExpectations?: string[] | null;
  preferredDays?: string | null;
  availableTime?: string | null;
  clinicCondition?: string | null;
  hasFuturePlan?: string | null;
  dream?: string | null;
  targetUniversity?: string | null;
  studyCore?: string | null;
  problemSelf?: string | null;
  mathDifficulty?: string | null;
  englishDifficulty?: string | null;
  /** v2.3 과목별 어려운 점 선택(최대 3). */
  mathDifficultyTags?: string[] | null;
  englishDifficultyTags?: string[] | null;
  healthNote?: string | null;
  requests?: string | null;
  /** 입학 상담에서 학생이 가장 먼저 도움받고 싶은 점. */
  entryPriority?: string | null;
  /** 저장 데이터 하위호환용 키. */
  commitment14?: string | null;
}
