"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface StepperProps {
  steps: readonly Step[];
  currentStep: number;
}

export default function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="mb-8 sm:mb-10 px-2 sm:px-0">
      <div className="flex items-center justify-between max-w-4xl mx-auto relative">
        {/* Background line */}
        <div className="absolute top-[20px] left-0 w-full h-0.5 bg-zinc-800 z-0" />

        {/* Animated progress line */}
        <div
          className="absolute top-[20px] left-0 h-0.5 bg-[#11F08E] z-0 transition-all duration-700"
          style={{
            width:
              steps.length > 1
                ? `${(currentStep / (steps.length - 1)) * 100}%`
                : "0%",
          }}
        />

        {steps.map((step, index) => {
          const isActive = index <= currentStep;
          const isCurrent = index === currentStep;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className="flex flex-col items-center gap-2 z-10"
            >
              <motion.div
                animate={{
                  scale: isCurrent ? 1.15 : 1,
                  backgroundColor: isCurrent
                    ? "#11F08E"
                    : isActive
                      ? "rgba(5,213,127,0.125)"
                      : "rgba(255,255,255,0.05)",
                  borderColor: isCurrent || isActive ? "#11F08E" : "#27272a",
                }}
                transition={{ duration: 0.3 }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border-2${
                  isActive ? " shadow-[0_0_20px_rgba(17,240,142,0.25)]" : ""
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive || isCurrent ? "text-[#11F08E]" : "text-zinc-600"
                  }`}
                  style={{ color: isCurrent ? "#0d1117" : undefined }}
                />
              </motion.div>

              <span
                className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest ${
                  isActive ? "text-[#11F08E]" : "text-zinc-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
