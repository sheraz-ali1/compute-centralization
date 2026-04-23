"use client";
import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { AgentQuery } from "./AgentQuery";

const SNIPPET = "claude mcp add computegrid https://[host]/mcp";

const ease = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, ease },
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
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-x-16 gap-y-14 items-start"
      >
        {/* LEFT — copy + actions */}
        <div>
          <motion.div
            variants={item}
            className="text-[13px] text-muted-foreground mb-4"
          >
            MCP server for GPU compute
          </motion.div>

          <motion.h1
            variants={item}
            className="font-sans font-light text-[40px] sm:text-[48px] md:text-[56px] leading-[1.04] tracking-[-0.03em] text-foreground text-balance"
          >
            In pursuit of a centralized compute grid.
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 text-[16px] md:text-[17px] text-muted-foreground max-w-[46ch] leading-[1.6] text-balance"
          >
            An open index of the GPU spot market, built so that one day
            agents can buy compute on their own.{" "}
            <span className="text-muted-foreground/65">
              Inspired by CS153 and AMP PBC.
            </span>
          </motion.p>

          <motion.div
            variants={item}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <button
              onClick={onConnect}
              className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-foreground text-background text-[13.5px] font-medium hover:bg-foreground/90 transition-colors"
            >
              <span>{copied ? "Copied" : "Connect agent"}</span>
              {!copied && (
                <svg
                  width="13"
                  height="13"
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
              className="inline-flex items-center px-4 py-2.5 rounded-md text-foreground text-[13.5px] font-medium hover:bg-foreground/[0.05] transition-colors"
            >
              Explore market →
            </a>
          </motion.div>

          <motion.div
            variants={item}
            className="mt-4 text-[12px] text-muted-foreground/70"
          >
            {SNIPPET}
          </motion.div>
        </div>

        {/* RIGHT — live agent query */}
        <motion.div variants={item}>
          <AgentQuery />
        </motion.div>
      </motion.div>
    </section>
  );
}

