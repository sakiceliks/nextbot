"use client";

import { motion } from "framer-motion";
import { Globe, House, ScrollText, ScanLine, Settings } from "lucide-react";

export type NavTab = "home" | "scan" | "logs" | "browser";

interface NavigationProps {
  activeTab: NavTab;
  loading?: boolean;
  onTabChange: (tab: NavTab) => void;
  onScanAction: () => void;
}

const TABS = [
  { key: "home" as NavTab, label: "Ana Sayfa", icon: House },
  { key: "logs" as NavTab, label: "Loglar", icon: ScrollText },
  { key: "browser" as NavTab, label: "Tarayıcı", icon: Globe },
  {
    key: "settings" as const,
    label: "Ayarlar",
    icon: Settings,
    disabled: true,
  },
] as const;

export default function Navigation({
  activeTab,
  loading = false,
  onTabChange,
  onScanAction,
}: NavigationProps) {
  const isScanActive = activeTab === "scan";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 sm:px-6 sm:pb-5">
      <nav className="relative mx-auto w-full max-w-xl rounded-[26px] border border-[#05D57F]/20 bg-[#111827]/95 px-4 pb-4 pt-6 shadow-[0_-8px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {/* ── Center Scan Button ─────────────────────────────────────────── */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <motion.button
            whileTap={{ scale: loading ? 1 : 0.88 }}
            whileHover={{ scale: loading ? 1 : 1.08 }}
            transition={{ type: "spring", stiffness: 420, damping: 20 }}
            onClick={onScanAction}
            disabled={loading}
            aria-label="Tara"
            className={[
              "relative flex h-[72px] w-[72px] sm:h-20 sm:w-20 items-center justify-center rounded-full ring-8 ring-[#111827] transition-all duration-300",
              isScanActive
                ? "bg-[#11F08E] shadow-[0_0_0_4px_rgba(17,240,142,0.35),0_10px_40px_rgba(17,240,142,0.55)]"
                : "bg-[#11F08E] shadow-[0_10px_35px_rgba(17,240,142,0.35)]",
              loading ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            ].join(" ")}
          >
            {/* Inner ring decoration */}
            <div className="absolute inset-2 rounded-full border border-white/20 pointer-events-none" />

            {loading ? (
              <ScanLine className="h-8 w-8 text-[#0d1117] animate-spin" />
            ) : (
              <ScanLine className="h-8 w-8 text-[#0d1117]" />
            )}
          </motion.button>

          {/* "Tara" label */}
          <span
            className={[
              "mt-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors duration-200 select-none",
              isScanActive || loading ? "text-[#11F08E]" : "text-zinc-500",
            ].join(" ")}
          >
            Tara
          </span>
        </div>

        {/* ── Tab Grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 items-end pt-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isDisabled = "disabled" in tab && tab.disabled;
            const isActive = !isDisabled && tab.key === activeTab;
            const isCenterLeft = tab.key === "logs";
            const isCenterRight = tab.key === "browser";

            return (
              <button
                key={tab.key}
                type="button"
                disabled={isDisabled || loading}
                onClick={() => {
                  if (!isDisabled && !loading) {
                    onTabChange(tab.key as NavTab);
                  }
                }}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex flex-col items-center gap-1 py-1 transition-all duration-200",
                  isDisabled
                    ? "cursor-not-allowed opacity-35"
                    : "cursor-pointer",
                  isCenterLeft ? "pr-4 sm:pr-6" : "",
                  isCenterRight ? "pl-4 sm:pl-6" : "",
                ].join(" ")}
              >
                <motion.div
                  animate={
                    isActive ? { scale: 1.15, y: -1 } : { scale: 1, y: 0 }
                  }
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                >
                  <Icon
                    style={{ width: 22, height: 22 }}
                    strokeWidth={isActive ? 2.3 : 1.8}
                    className={isActive ? "text-[#11F08E]" : "text-zinc-500"}
                  />
                </motion.div>

                <span
                  className={[
                    "text-[10px] font-semibold leading-none transition-colors duration-200 select-none",
                    isActive ? "text-[#11F08E]" : "text-zinc-500",
                  ].join(" ")}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
