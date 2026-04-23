"use client";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;
// Diagonal sweep order (TL → BR)
const REVEAL_ORDER = [0, 1, 3, 2, 4, 6, 5, 7, 8];

const cellVariants: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: REVEAL_ORDER.indexOf(i) * 0.045,
      duration: 0.55,
      ease,
    },
  }),
};

const labelVariants: Variants = {
  hidden: { opacity: 0, x: -6 },
  show: {
    opacity: 1,
    x: 0,
    transition: { delay: 0.55, duration: 0.7, ease },
  },
};

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2 ${className}`}
      aria-label="computegrid"
    >
      <motion.svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        initial="hidden"
        animate="show"
        aria-hidden
        className="overflow-visible"
      >
        {Array.from({ length: 9 }).map((_, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          const isAccent = i === 8;
          return (
            <motion.rect
              key={i}
              x={col * 8}
              y={row * 8}
              width={5}
              height={5}
              rx={1}
              custom={i}
              variants={cellVariants}
              style={{
                originX: "50%",
                originY: "50%",
                transformBox: "fill-box",
              }}
              fill={isAccent ? "var(--brand)" : "currentColor"}
              fillOpacity={isAccent ? 1 : 0.88}
            />
          );
        })}
      </motion.svg>
      <motion.span
        initial="hidden"
        animate="show"
        variants={labelVariants}
        className="font-sans text-[17px] font-medium tracking-[-0.025em] text-foreground leading-none"
      >
        computegrid
      </motion.span>
    </Link>
  );
}
