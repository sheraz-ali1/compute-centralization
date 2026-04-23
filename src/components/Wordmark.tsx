import Link from "next/link";

export function Wordmark({ size = 14 }: { size?: number }) {
  return (
    <Link
      href="/"
      className="font-mono font-medium tabular tracking-[-0.02em] inline-flex"
      style={{ fontSize: size }}
    >
      <span className="text-foreground">compute</span>
      <span className="text-down/80">grid</span>
    </Link>
  );
}
