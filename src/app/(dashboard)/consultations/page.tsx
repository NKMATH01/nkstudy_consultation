import { getConsultations } from "@/lib/actions/consultation";
import { ConsultationListClient } from "@/components/consultations/consultation-list-client";

export default async function ConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const status = params.status as
    | "active"
    | "completed"
    | "cancelled"
    | "pending"
    | undefined;
  const search = params.search;
  const startDate = params.startDate;
  const endDate = params.endDate;

  const result = await getConsultations({
    page,
    status,
    search,
    startDate,
    endDate,
    limit: 20,
  });

  return (
    <ConsultationListClient
      initialData={result.data}
      initialPagination={result.pagination}
    />
  );
}
