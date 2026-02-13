import { getAnalyses } from "@/lib/actions/analysis";
import { AnalysisListClient } from "@/components/analyses/analysis-list-client";
import { checkPagePermission } from "@/lib/check-permission";

export default async function AnalysesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await checkPagePermission("/analyses");
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search;

  const result = await getAnalyses({
    page,
    search,
    limit: 20,
  });

  return (
    <AnalysisListClient
      initialData={result.data}
      initialPagination={result.pagination}
    />
  );
}
