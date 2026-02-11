import { getAnalysis } from "@/lib/actions/analysis";
import { getClasses, getTeachers } from "@/lib/actions/settings";
import { AnalysisDetailClient } from "@/components/analyses/analysis-detail-client";
import { notFound } from "next/navigation";

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [analysis, classes, teachers] = await Promise.all([
    getAnalysis(id),
    getClasses(),
    getTeachers(),
  ]);

  if (!analysis) {
    notFound();
  }

  return (
    <AnalysisDetailClient
      analysis={analysis}
      classes={classes}
      teachers={teachers}
    />
  );
}
