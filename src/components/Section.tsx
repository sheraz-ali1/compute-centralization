import { cn } from "@/lib/utils";

export function Section({
  label,
  children,
  className,
  action,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[13px] text-muted-foreground">{label}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
