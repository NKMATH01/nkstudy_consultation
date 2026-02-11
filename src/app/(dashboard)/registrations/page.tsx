import { getRegistrations } from "@/lib/actions/registration";
import { RegistrationListClient } from "@/components/registrations/registration-list-client";

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search;

  const result = await getRegistrations({
    page,
    search,
    limit: 20,
  });

  return (
    <RegistrationListClient
      initialData={result.data}
      initialPagination={result.pagination}
    />
  );
}
