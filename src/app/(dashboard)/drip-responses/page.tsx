import { DripResponsesClient } from "@/components/drip/drip-responses-client";
import { getDripResponses } from "@/lib/actions/drip-survey";

export const dynamic = "force-dynamic";

export default async function DripResponsesPage() {
  const result = await getDripResponses();

  return <DripResponsesClient data={result.data ?? []} />;
}
