"use client";
import { useState } from "react";
import { motion, type Variants } from "framer-motion";

const SNIPPET = "claude mcp add computegrid https://[host]/mcp";

const ease = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.18 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1, ease },
  },
};

export function Hero() {
  const [copied, setCopied] = useState(false);

  const onConnect = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="relative min-h-svh flex items-center -mx-8 px-6 sm:px-8">
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(58% 50% at 28% 32%, color-mix(in oklab, var(--brand) 7%, transparent) 0%, transparent 70%)",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full max-w-3xl mx-auto"
      >
        <motion.h1
          variants={item}
          className="font-serif text-[44px] sm:text-[58px] md:text-[72px] leading-[1.02] tracking-[-0.015em] text-foreground text-balance"
        >
          In pursuit of a centralized compute grid.
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-7 text-[18px] md:text-[20px] text-muted-foreground max-w-[52ch] leading-[1.55] text-balance"
        >
          A live, MCP-native price feed for GPU compute, so agents and the
          humans they work for can find what is available, where, and at
          what price.
        </motion.p>

        <motion.p
          variants={item}
          className="mt-4 font-serif italic text-[14px] text-muted-foreground/60"
        >
          Inspired by CS153 and AMP PBC.
        </motion.p>

        <motion.div
          variants={item}
          className="mt-12 flex flex-wrap items-center gap-3"
        >
          <button
            onClick={onConnect}
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-[14px] font-medium hover:bg-foreground/90 transition-colors"
          >
            <span>{copied ? "Copied to clipboard" : "Connect agent"}</span>
            {!copied && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            )}
          </button>
          <a
            href="#live-market"
            className="inline-flex items-center px-5 py-2.5 rounded-full bg-foreground/[0.06] text-foreground text-[14px] font-medium hover:bg-foreground/[0.10] transition-colors"
          >
            Explore market
          </a>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-6 font-mono text-[12px] text-muted-foreground/70"
        >
          {SNIPPET}
        </motion.div>
      </motion.div>
    </section>
  );
}
