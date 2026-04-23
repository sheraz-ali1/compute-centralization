"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AudienceToggle() {
  const pathname = usePathname();
  const onAgents = pathname?.startsWith("/agents");
  return (
    <div className="inline-flex p-0.5 rounded-full border border-border bg-background/60 backdrop-blur-sm text-[12.5px]">
      <Link
        href="/"
        className={
          "px-3.5 py-1.5 rounded-full transition-colors " +
          (!onAgents
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground")
        }
      >
        For humans
      </Link>
      <Link
        href="/agents"
        className={
          "px-3.5 py-1.5 rounded-full transition-colors " +
          (onAgents
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground")
        }
      >
        For agents
      </Link>
    </div>
  );
}
