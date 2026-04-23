import Link from "next/link";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-mono text-[14px] font-medium tabular tracking-[-0.02em] inline-flex items-center ${className}`}
    >
      <span className="text-foreground">compute</span>
      <span className="text-brand">grid</span>
    </Link>
  );
}
