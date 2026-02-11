import { getRegistration } from "@/lib/actions/registration";
import { RegistrationDetailClient } from "@/components/registrations/registration-detail-client";
import { notFound } from "next/navigation";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const registration = await getRegistration(id);

  if (!registration) {
    notFound();
  }

  return <RegistrationDetailClient registration={registration} />;
}
