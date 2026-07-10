// 공개 설문 진입점. V2 학습 프로필이 유일한 신규 제출 화면이다(§2, §16).
// V1 신규 제출 UI는 공개 메뉴에서 제거하되, 기존 V1 데이터·분석·관리자 화면은 그대로 유지한다.
// (V1 제출 로직은 src/lib/actions/public-survey.ts에 호환 목적으로 보존.)

import { SurveyV2Client } from "@/components/assessment-v2/survey-v2-client";

export default function PublicSurveyPage() {
  return <SurveyV2Client />;
}
