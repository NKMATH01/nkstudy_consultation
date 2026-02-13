import { getConsultations } from "@/lib/actions/consultation";
import { ConsultationListClient } from "@/components/consultations/consultation-list-client";
import { checkPagePermission } from "@/lib/check-permission";

export default async function ConsultationsPage() {
  await checkPagePermission("/consultations");
  const result = await getConsultations({ limit: 100 });

  return (
    <ConsultationListClient
      initialData={result.data}
      initialPagination={result.pagination}
    />
  );
}
