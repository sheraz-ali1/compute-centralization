"use client";
import { InputCopy } from "@/components/ui/input-copy";
import { motion, type Variants } from "framer-motion";

const SNIPPET = "claude mcp add computegrid https://[host]/mcp";

const ease = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1, ease },
  },
};

export function Hero() {
  return (
    <section className="relative min-h-svh flex items-center justify-center -mx-8 px-6 sm:px-8">
      {/* Soft warm radial. No grid, no chrome. */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 35%, color-mix(in oklab, var(--brand) 7%, transparent) 0%, transparent 70%)",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full max-w-2xl text-center"
      >
        <motion.h1
          variants={item}
          className="font-sans font-light text-[44px] sm:text-[56px] md:text-[64px] leading-[1.05] tracking-[-0.035em] text-foreground text-balance"
          style={{ fontFeatureSettings: '"ss01", "cv11"' }}
        >
          In pursuit of a centralized compute grid.
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-8 mx-auto text-[18px] md:text-[19px] text-muted-foreground max-w-[44ch] leading-[1.55] text-balance"
        >
          A live, MCP-native price feed for GPU compute, so agents and the
          humans they work for can find what is available, where, and at
          what price.
        </motion.p>

        <motion.p
          variants={item}
          className="mt-5 text-[13px] text-muted-foreground/60 italic tracking-wide"
        >
          Inspired by CS153 and AMP PBC.
        </motion.p>

        <motion.div variants={item} className="mt-14 mx-auto max-w-[460px]">
          <InputCopy value={SNIPPET} />
        </motion.div>
      </motion.div>
    </section>
  );
}
