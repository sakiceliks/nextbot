"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "./Logo";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  return (
    <AnimatePresence onExitComplete={() => setDismissed(true)}>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] bg-[#0d1117] flex items-center justify-center"
        >
          <div className="flex flex-col items-center">
            <Logo size="xl" />

            <p className="font-black text-2xl tracking-[0.3em] uppercase text-white mt-6">
              NEXT<span className="text-[#11F08E]">BOT</span>
            </p>

            <div className="flex items-center gap-2 mt-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#11F08E]/40 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
