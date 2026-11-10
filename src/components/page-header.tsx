import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex items-end justify-between gap-4 px-5 pb-4 pt-4", className)}>
      <div className="min-w-0">
        {subtitle && <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>}
        <h1 className="truncate text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}
