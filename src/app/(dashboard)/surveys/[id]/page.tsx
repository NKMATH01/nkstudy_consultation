import { getSurvey } from "@/lib/actions/survey";
import { SurveyDetailClient } from "@/components/surveys/survey-detail-client";
import { notFound } from "next/navigation";

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const survey = await getSurvey(id);

  if (!survey) {
    notFound();
  }

  return <SurveyDetailClient survey={survey} />;
}
