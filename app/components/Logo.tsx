"use client";
import Image from "next/image";
import logo from "../../img/parcabul-logo.png";
type LogoSize = "sm" | "md" | "lg" | "xl";

const sizeMap: Record<LogoSize, string> = {
  sm: "w-10 h-10 rounded-xl shadow-[0_0_18px_rgba(17,240,142,0.3)]",
  md: "w-14 h-14 rounded-xl shadow-[0_0_24px_rgba(17,240,142,0.35)]",
  lg: "w-20 h-20 rounded-2xl shadow-[0_0_28px_rgba(17,240,142,0.4)]",
  xl: "w-28 h-28 rounded-3xl shadow-[0_0_36px_rgba(17,240,142,0.45)]",
};

interface LogoProps {
  size?: LogoSize;
  className?: string;
}

export default function Logo({ size = "md", className = "" }: LogoProps) {
  return (
    <div
      className={[
        sizeMap[size],
        "bg-[#19202C] border border-[#05D57F]/30",
        "flex items-center justify-center shrink-0 relative overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#11F08E]/10 to-transparent pointer-events-none" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Image
        src={logo}
        alt="Logo"
        className="w-[80%] h-[80%] object-contain relative z-10"
        draggable={false}
      />
    </div>
  );
}
