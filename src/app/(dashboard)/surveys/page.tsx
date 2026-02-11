import { getSurveys } from "@/lib/actions/survey";
import { SurveyListClient } from "@/components/surveys/survey-list-client";

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search;

  const result = await getSurveys({
    page,
    search,
    limit: 20,
  });

  return (
    <SurveyListClient
      initialData={result.data}
      initialPagination={result.pagination}
    />
  );
}
