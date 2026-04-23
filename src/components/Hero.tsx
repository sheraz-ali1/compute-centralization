"use client";
import { useSnapshot } from "@/lib/use-snapshot";
import { InputCopy } from "@/components/ui/input-copy";
import { motion, type Variants } from "framer-motion";

const HERO_GPUS = [
  "H100 SXM",
  "H100 PCIe",
  "B200",
  "A100 80GB",
  "L40S",
  "RTX 4090",
];
const ENTERPRISE_TIERS = new Set(["secure", "standard"]);
const COMMUNITY_TIERS = new Set(["community", "verified", "unverified"]);

const SNIPPET = "claude mcp add computegrid https://[host]/mcp";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.15 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
  },
};

const fadeOnly: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
  },
};

export function Hero() {
  const { rows, fetchedAt } = useSnapshot();

  let bestSavings: {
    model: string;
    savingsPct: number;
    cheapest: number;
    enterprise: number;
  } | null = null;
  for (const model of HERO_GPUS) {
    const matching = rows.filter((r) => r.gpu_model === model && r.available);
    const enterprise = matching.filter((r) => ENTERPRISE_TIERS.has(r.tier));
    const community = matching.filter((r) => COMMUNITY_TIERS.has(r.tier));
    if (enterprise.length === 0 || community.length === 0) continue;
    const cheapestC = Math.min(
      ...community.map((r) => r.price_per_gpu_hour_usd),
    );
    const cheapestE = Math.min(
      ...enterprise.map((r) => r.price_per_gpu_hour_usd),
    );
    if (cheapestE <= 0) continue;
    const savings = (1 - cheapestC / cheapestE) * 100;
    if (!bestSavings || savings > bestSavings.savingsPct) {
      bestSavings = {
        model,
        savingsPct: savings,
        cheapest: cheapestC,
        enterprise: cheapestE,
      };
    }
  }

  const totalListings = rows
    .filter((r) => r.available)
    .reduce(
      (s, r) => s + (COMMUNITY_TIERS.has(r.tier) ? r.offer_count : 1),
      0,
    );
  const providers = new Set(rows.map((r) => r.provider)).size;

  return (
    <section className="relative min-h-svh flex flex-col -mx-8 overflow-hidden">
      {/* Ambient background — soft radial brand glow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute inset-0 z-0 pointer-events-none"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 60% at 50% 35%, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--foreground) 12%, transparent) 1px, transparent 0)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
          }}
        />
      </motion.div>

      {/* Content — vertically centered, full viewport */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-8 py-20">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="w-full max-w-3xl text-center"
        >
          <motion.h1
            variants={item}
            className="font-sans text-[44px] sm:text-[60px] md:text-[80px] leading-[1.02] tracking-[-0.035em] text-foreground"
          >
            In pursuit of a centralized
            <br />
            compute grid.
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-7 mx-auto text-[17px] md:text-[19px] text-muted-foreground max-w-[58ch] leading-snug"
          >
            A live, MCP-native price feed for GPU compute — so agents and
            the humans they work for can find what&apos;s actually
            available, where, and at what price.
          </motion.p>

          <motion.p
            variants={item}
            className="mt-3.5 text-[12px] text-muted-foreground/70 italic tracking-wide"
          >
            Inspired by CS153 and AMP PBC.
          </motion.p>

          <motion.div variants={item} className="mt-12 mx-auto max-w-[560px]">
            <InputCopy value={SNIPPET} />
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground font-mono">
              <span>
                <span className="text-foreground/85">list_gpus</span>(filters)
              </span>
              <span>
                <span className="text-foreground/85">find_cheapest</span>
                (model, count, max_price)
              </span>
              <span className="text-muted-foreground/40">·</span>
              <a
                href="/api/snapshot.json"
                className="hover:text-foreground transition-colors"
              >
                /api/snapshot.json
              </a>
              <a
                href="/llms.txt"
                className="hover:text-foreground transition-colors"
              >
                /llms.txt
              </a>
            </div>
          </motion.div>

          <motion.div
            variants={item}
            className="mt-9 flex flex-wrap justify-center items-center gap-x-5 gap-y-1 text-[12px] text-muted-foreground font-mono"
          >
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-down animate-pulse" />
              {fetchedAt ? "live" : "connecting…"}
            </span>
            <span>
              <span className="text-foreground/85">
                {totalListings.toLocaleString()}
              </span>{" "}
              listings
            </span>
            <span>
              <span className="text-foreground/85">{providers}</span> providers
            </span>
            <span>
              <span className="text-foreground/85">
                {rows.filter((r) => r.available).length}
              </span>{" "}
              tracked SKUs
            </span>
          </motion.div>

          {bestSavings && (
            <motion.p
              variants={item}
              className="mt-9 text-[14px] md:text-[15px] text-muted-foreground max-w-[60ch] mx-auto"
            >
              Right now:{" "}
              <span className="text-foreground">{bestSavings.model}</span> on
              the marketplace is{" "}
              <span className="text-down">
                {bestSavings.savingsPct.toFixed(0)}% cheaper
              </span>{" "}
              than the managed-cloud price (${bestSavings.cheapest.toFixed(2)}{" "}
              vs ${bestSavings.enterprise.toFixed(2)}/hr).
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* Scroll affordance */}
      <motion.a
        href="#live-market"
        variants={fadeOnly}
        initial="hidden"
        animate="show"
        transition={{ delay: 1.6 }}
        className="relative z-10 mb-10 mx-auto group flex flex-col items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors font-mono"
        aria-label="scroll to live market"
      >
        <span>Live market</span>
        <motion.span
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          <svg
            width="14"
            height="14"
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
