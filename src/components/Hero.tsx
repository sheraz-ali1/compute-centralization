"use client";
import { useSnapshot } from "@/lib/use-snapshot";
import { InputCopy } from "@/components/ui/input-copy";
import { motion, type Variants } from "framer-motion";
import { providerLabel, tierLabel } from "@/lib/provider-labels";

const ENTERPRISE_TIERS = new Set(["secure", "standard"]);
const COMMUNITY_TIERS = new Set(["community", "verified", "unverified"]);

// The single GPU we feature in the hero spotlight card. H100 SXM is the
// flagship AI-compute reference; if its data is missing, the card hides.
const SPOTLIGHT_GPU = "H100 SXM";

const SNIPPET = "claude mcp add computegrid https://[host]/mcp";

const ease = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.085, delayChildren: 0.2 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease },
  },
};

export function Hero() {
  const { rows } = useSnapshot();

  const matching = rows.filter(
    (r) => r.gpu_model === SPOTLIGHT_GPU && r.available,
  );
  const cheapest =
    matching.length === 0
      ? null
      : matching.reduce((a, b) =>
          a.price_per_gpu_hour_usd <= b.price_per_gpu_hour_usd ? a : b,
        );
  const enterpriseRows = matching.filter((r) =>
    ENTERPRISE_TIERS.has(r.tier),
  );
  const enterprise =
    enterpriseRows.length === 0
      ? null
      : enterpriseRows.reduce((a, b) =>
          a.price_per_gpu_hour_usd <= b.price_per_gpu_hour_usd ? a : b,
        );
  const savings =
    cheapest && enterprise && enterprise.price_per_gpu_hour_usd > 0
      ? (1 -
          cheapest.price_per_gpu_hour_usd /
            enterprise.price_per_gpu_hour_usd) *
        100
      : null;
  const totalListings = rows
    .filter((r) => r.available)
    .reduce(
      (s, r) => s + (COMMUNITY_TIERS.has(r.tier) ? r.offer_count : 1),
      0,
    );
  const providers = new Set(rows.map((r) => r.provider)).size;

  return (
    <section className="relative min-h-svh flex flex-col -mx-8 overflow-hidden">
      {/* Ambient background — single warm radial glow, very soft */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.4, ease: "easeOut" }}
        className="absolute inset-0 z-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, color-mix(in oklab, var(--brand) 9%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 sm:px-8 py-24">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="w-full max-w-2xl text-center"
        >
          {/* Eyebrow */}
          <motion.div
            variants={item}
            className="mb-7 inline-flex items-center gap-2 px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground border border-border/70 rounded-full bg-background/60 backdrop-blur-sm"
          >
            <span className="size-1.5 rounded-full bg-down animate-pulse" />
            Open MCP price feed · Live
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={item}
            className="font-sans text-[40px] sm:text-[52px] md:text-[60px] leading-[1.04] tracking-[-0.03em] text-foreground font-normal"
          >
            In pursuit of a
            <br />
            centralized compute grid.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={item}
            className="mt-6 mx-auto text-[17px] text-muted-foreground max-w-[46ch] leading-snug"
          >
            A live price feed for GPU compute, MCP-native — so agents and
            the humans they work for can find what&apos;s available, where,
            and at what price.
          </motion.p>

          {/* Spotlight card — single GPU live preview */}
          {cheapest && enterprise && savings !== null && (
            <motion.div variants={item} className="mt-10 mx-auto max-w-[480px]">
              <div className="rounded-xl border border-border bg-background/70 backdrop-blur-sm p-5 text-left shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_8px_30px_-10px_rgba(0,0,0,0.08)]">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="font-sans text-[14px] text-foreground">
                    {SPOTLIGHT_GPU}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-mono flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-down" /> Live
                  </div>
                </div>
                <div className="flex items-baseline gap-3 mb-3">
                  <div className="font-mono tabular text-[36px] leading-none text-foreground">
                    <span className="text-muted-foreground text-[18px] mr-0.5">
                      $
                    </span>
                    {cheapest.price_per_gpu_hour_usd.toFixed(2)}
                    <span className="text-muted-foreground text-[14px] ml-1">
                      /hr
                    </span>
                  </div>
                  {savings > 5 && (
                    <div className="font-mono tabular text-[14px] text-down">
                      −{savings.toFixed(0)}%
                    </div>
                  )}
                </div>
                <div className="text-[12px] text-muted-foreground font-mono">
                  Cheapest:{" "}
                  <span className="text-foreground/85">
                    {providerLabel(cheapest.provider)} {tierLabel(cheapest.tier)}
                  </span>
                  {" · "}vs{" "}
                  <span className="text-foreground/85">
                    {providerLabel(enterprise.provider)}
                  </span>{" "}
                  managed (${enterprise.price_per_gpu_hour_usd.toFixed(2)})
                </div>
              </div>
            </motion.div>
          )}

          {/* Connect snippet */}
          <motion.div variants={item} className="mt-8 mx-auto max-w-[480px]">
            <InputCopy value={SNIPPET} />
          </motion.div>

          {/* Footnotes */}
          <motion.div
            variants={item}
            className="mt-7 flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80 font-mono"
          >
            <span>{totalListings.toLocaleString()} listings</span>
            <span className="text-muted-foreground/30">/</span>
            <span>{providers} providers</span>
            <span className="text-muted-foreground/30">/</span>
            <span>Inspired by CS153 + AMP PBC</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll affordance */}
      <motion.a
        href="#live-market"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1.2, ease: "easeOut" }}
        className="relative z-10 mb-9 mx-auto group flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 hover:text-foreground transition-colors font-mono"
        aria-label="scroll to live market"
      >
        <span>Live market</span>
        <motion.span
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </motion.span>
      </motion.a>
    </section>
  );
}
