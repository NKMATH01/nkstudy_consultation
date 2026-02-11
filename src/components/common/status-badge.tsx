import { Badge } from "@/components/ui/badge";
import type { ConsultationStatus, ResultStatus } from "@/types";
import { STATUS_LABELS, RESULT_STATUS_LABELS } from "@/types";
import { cn } from "@/lib/utils";

const statusVariants: Record<ConsultationStatus, string> = {
  active: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  completed: "bg-green-100 text-green-700 hover:bg-green-100",
  cancelled: "bg-red-100 text-red-700 hover:bg-red-100",
  pending: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
};

const resultVariants: Record<ResultStatus, string> = {
  none: "bg-gray-100 text-gray-500 hover:bg-gray-100",
  registered: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  hold: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  other: "bg-purple-100 text-purple-700 hover:bg-purple-100",
};

export function StatusBadge({ status }: { status: ConsultationStatus }) {
  return (
    <Badge variant="secondary" className={cn("text-xs", statusVariants[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function ResultBadge({ status }: { status: ResultStatus }) {
  if (status === "none") return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <Badge variant="secondary" className={cn("text-xs", resultVariants[status])}>
      {RESULT_STATUS_LABELS[status]}
    </Badge>
  );
}
