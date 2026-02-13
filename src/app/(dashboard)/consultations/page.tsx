import { getConsultations } from "@/lib/actions/consultation";
import { ConsultationListClient } from "@/components/consultations/consultation-list-client";

export default async function ConsultationsPage() {
  const result = await getConsultations({ limit: 100 });

  return (
    <ConsultationListClient
      initialData={result.data}
      initialPagination={result.pagination}
    />
  );
}
