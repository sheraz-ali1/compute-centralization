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
  title: string;
  caption: string;
  width: "narrow" | "wide";
  Component: () => React.ReactElement;
}[] = [
  {
    id: "heatmap",
    label: "Heatmap",
    title: "The market at a glance.",
    caption:
      "Cheapest $/GPU/hr for each model across the top providers we track. Greener cells are the cheapest in their row; hover any cell for the underlying offers.",
    width: "wide",
    Component: ProviderHeatmap,
  },
  {
    id: "spreads",
    label: "Spreads",
    title: "Marketplace vs managed cloud, per GPU.",
    caption:
      "How wide the gap is between the cheapest available offer and the cheapest managed-cloud listing for the same GPU. The wider the bar, the more discount the marketplace offers.",
    width: "narrow",
    Component: SpotIndex,
  },
  {
    id: "orderbook",
    label: "Order book",
    title: "The compute order book.",
    caption:
      "For each GPU, every available listing across the market sorted cheapest to most expensive. The shape of the supply curve is the shape of the market.",
    width: "narrow",
    Component: ComputeOrderBook,
  },
  {
    id: "workloads",
    label: "Workloads",
    title: "What a workload costs, today.",
    caption:
      "Concrete model-training and inference workloads, sized realistically, priced from current listings across the providers we track.",
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
        {/* Section header — title + caption come from the active view */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-12">
          <div className="md:max-w-[60ch]">
            <AnimatePresence mode="wait">
              <motion.h2
                key={view.id + "-t"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35, ease }}
                className="font-sans text-[28px] tracking-[-0.018em] text-foreground leading-tight"
              >
                {view.title}
              </motion.h2>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.p
                key={view.id + "-c"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35, ease, delay: 0.05 }}
                className="mt-3 text-[14px] text-muted-foreground leading-snug"
              >
                {view.caption}
              </motion.p>
            </AnimatePresence>
          </div>
          <nav className="inline-flex shrink-0 p-0.5 rounded-full border border-border bg-background/70 backdrop-blur-sm self-start">
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

        {/* Active visualization */}
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
