import { Badge } from "@/components/ui/badge";
import type { ConsultationStatus, ResultStatus } from "@/types";
import { STATUS_LABELS, RESULT_STATUS_LABELS } from "@/types";
import { cn } from "@/lib/utils";

const statusVariants: Record<ConsultationStatus, string> = {
  active: "bg-nk-progress-soft text-nk-progress hover:bg-nk-progress-soft",
  completed: "bg-nk-done-soft text-nk-done hover:bg-nk-done-soft",
  cancelled: "bg-nk-late-soft text-nk-late hover:bg-nk-late-soft",
  pending: "bg-nk-warn-soft text-nk-warn hover:bg-nk-warn-soft",
};

const resultVariants: Record<ResultStatus, string> = {
  none: "bg-nk-sunken text-nk-ink-sub hover:bg-nk-sunken",
  registered: "bg-nk-done-soft text-nk-done hover:bg-nk-done-soft",
  hold: "bg-nk-warn-soft text-nk-warn hover:bg-nk-warn-soft",
  other: "bg-nk-cat-3-soft text-nk-cat-3 hover:bg-nk-cat-3-soft",
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
