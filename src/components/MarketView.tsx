"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SpotIndex } from "./SpotIndex";
import { ProviderHeatmap } from "./ProviderHeatmap";
import { ComputeOrderBook } from "./ComputeOrderBook";
import { AgentScenarios } from "./AgentScenarios";

type ViewId = "spreads" | "heatmap" | "orderbook" | "workloads";

const VIEWS: {
  id: ViewId;
  label: string;
  caption: string;
  width: "narrow" | "wide";
  Component: () => React.ReactElement;
}[] = [
  {
    id: "heatmap",
    label: "Heatmap",
    caption: "GPU × provider, cheapest in cell",
    width: "wide",
    Component: ProviderHeatmap,
  },
  {
    id: "spreads",
    label: "Spreads",
    caption: "Marketplace vs managed range per GPU",
    width: "narrow",
    Component: SpotIndex,
  },
  {
    id: "orderbook",
    label: "Order book",
    caption: "Cumulative supply curve per GPU",
    width: "narrow",
    Component: ComputeOrderBook,
  },
  {
    id: "workloads",
    label: "Workloads",
    caption: "Live cost for realistic agent jobs",
    width: "narrow",
    Component: AgentScenarios,
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function MarketView() {
  const [active, setActive] = useState<ViewId>("heatmap");
  const view = VIEWS.find((v) => v.id === active)!;

  return (
    <section
      id="live-market"
      className="border-t border-border pt-16 pb-24 scroll-mt-16"
    >
      <div className="mx-auto w-full max-w-6xl px-8">
        {/* Tab strip */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <h2 className="font-sans text-[24px] tracking-[-0.018em] text-foreground">
              Live market data.
            </h2>
            <p className="mt-2 text-[13.5px] text-muted-foreground max-w-[58ch] leading-snug">
              {view.caption}.
            </p>
          </div>
          <nav className="inline-flex shrink-0 p-0.5 rounded-full border border-border bg-background/70 backdrop-blur-sm self-start md:self-end">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setActive(v.id)}
                className={
                  "px-3.5 py-1.5 rounded-full text-[12.5px] transition-colors " +
                  (v.id === active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {v.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content frame — animates between views */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={view.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease }}
              className={
                "mx-auto " +
                (view.width === "wide" ? "max-w-6xl" : "max-w-4xl")
              }
            >
              <view.Component />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
