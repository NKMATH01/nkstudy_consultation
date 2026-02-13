import { getSurvey } from "@/lib/actions/survey";
import { SurveyDetailClient } from "@/components/surveys/survey-detail-client";
import { notFound } from "next/navigation";
import { checkPagePermission } from "@/lib/check-permission";

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkPagePermission("/surveys");
  const { id } = await params;
  const survey = await getSurvey(id);

  if (!survey) {
    notFound();
  }

  return <SurveyDetailClient survey={survey} />;
}
