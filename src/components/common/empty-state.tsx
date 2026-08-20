import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-nk-sunken flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-nk-ink-hint" />
      </div>
      <h3 className="text-base font-semibold text-nk-ink-sub">{title}</h3>
      {description && (
        <p className="text-sm text-nk-ink-hint mt-1">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
