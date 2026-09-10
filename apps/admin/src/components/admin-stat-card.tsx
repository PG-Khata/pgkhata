import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
}

export function AdminStatCard({ label, value, icon: Icon, description, className }: Props) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-xs", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
