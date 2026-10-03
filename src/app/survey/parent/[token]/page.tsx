import type { Metadata, Viewport } from "next";
import { getPublicParentQuestionnaire } from "@/lib/actions/parent-questionnaire";
import {
  ParentQuestionnaireClient,
  ParentQuestionnaireNotice,
} from "./parent-questionnaire-client";

// 토큰마다 상태(열림·답함·만료·회수)가 바뀌므로 캐시하지 않는다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NK 학부모 질문지",
  description: "상담 전 학부모 질문지",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// 공개 경로: 미들웨어가 /survey 로 시작하는 주소를 비로그인 허용한다.
// 라이트 고정은 src/app/survey/layout.tsx(data-theme="day")를 그대로 물려받는다.
export default async function ParentQuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getPublicParentQuestionnaire(token);

  if (view.state !== "open") {
    return <ParentQuestionnaireNotice state={view.state} />;
  }

  return <ParentQuestionnaireClient token={token} studentName={view.studentName} />;
}
