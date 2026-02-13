import { notFound } from "next/navigation";
import { getConsultation } from "@/lib/actions/consultation";
import { ConsultationDetailClient } from "@/components/consultations/consultation-detail-client";
import { checkPagePermission } from "@/lib/check-permission";

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkPagePermission("/consultations");
  const { id } = await params;
  const consultation = await getConsultation(id);

  if (!consultation) {
    notFound();
  }

  return <ConsultationDetailClient consultation={consultation} />;
}
