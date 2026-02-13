import { getConsultations } from "@/lib/actions/consultation";
import { getClasses } from "@/lib/actions/settings";
import { ConsultationListClient } from "@/components/consultations/consultation-list-client";
import { checkPagePermission } from "@/lib/check-permission";

export default async function ConsultationsPage() {
  await checkPagePermission("/consultations");
  const [result, classes] = await Promise.all([
    getConsultations({ limit: 100 }),
    getClasses(),
  ]);

  return (
    <ConsultationListClient
      initialData={result.data}
      initialPagination={result.pagination}
      classes={classes.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
