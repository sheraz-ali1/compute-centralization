"use client";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

// Reveal pattern for the 3x3 cells: ordered by column then row so the
// grid lights up from top-left in a slight sweep, ending with the
// bottom-right accent cell. Indices are flat (row * 3 + col).
const REVEAL_ORDER = [0, 1, 3, 2, 4, 6, 5, 7, 8];

const cellVariants: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: REVEAL_ORDER.indexOf(i) * 0.05,
      duration: 0.5,
      ease,
    },
  }),
};

const labelVariants: Variants = {
  hidden: { opacity: 0, x: -4 },
  show: {
    opacity: 1,
    x: 0,
    transition: { delay: 0.55, duration: 0.6, ease },
  },
};

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2.5 ${className}`}
      aria-label="ComputeGrid"
    >
      <motion.svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        initial="hidden"
        animate="show"
        aria-hidden
        className="overflow-visible"
      >
        {Array.from({ length: 9 }).map((_, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          const isAccent = i === 8; // bottom-right cell = brand accent
          return (
            <motion.rect
              key={i}
              x={col * 6.5}
              y={row * 6.5}
              width={4}
              height={4}
              rx={1}
              custom={i}
              variants={cellVariants}
              style={{ originX: "50%", originY: "50%", transformBox: "fill-box" }}
              fill={isAccent ? "var(--brand)" : "currentColor"}
              fillOpacity={isAccent ? 1 : 0.85}
              className="group-hover:opacity-100 transition-opacity"
            />
          );
        })}
      </motion.svg>
      <motion.span
        initial="hidden"
        animate="show"
        variants={labelVariants}
        className="font-mono text-[14px] font-medium tabular tracking-[-0.02em] text-foreground"
      >
        computegrid
      </motion.span>
    </Link>
  );
}
