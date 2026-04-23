import { cn } from "@/lib/utils";

export function Section({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-border rounded-md p-5", className)}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-3">
        {label}
      </div>
      {children}
    </section>
  );
}
