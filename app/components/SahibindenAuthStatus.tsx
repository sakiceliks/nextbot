"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  Loader2, 
  LogIn, 
  ExternalLink 
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AuthStatus = "logged-in" | "logged-out" | "browser-closed" | "unknown" | "checking";

interface AuthResult {
  ok: boolean;
  status: AuthStatus;
  browserRunning: boolean;
  message: string;
}

export function SahibindenAuthStatus() {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/browser/status");
      const data: AuthResult = await res.json();
      if (data.ok) {
        setStatus(data.status);
      } else {
        setStatus("unknown");
      }
    } catch (err) {
      console.error("Auth status fetch error:", err);
      setStatus("unknown");
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/browser/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login" }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Tarayıcı açıldı", { description: "Lütfen Sahibinden oturumunu tamamlayın." });
        // Refresh status after a short delay
        setTimeout(fetchStatus, 5000);
      } else {
        toast.error("Hata", { description: data.error || "Tarayıcı başlatılamadı." });
      }
    } catch (err) {
      toast.error("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case "logged-in":
        return {
          label: "Oturum Açık",
          icon: UserCheck,
          color: "text-[#11F08E]",
          bgColor: "bg-[#11F08E]/10",
          borderColor: "border-[#11F08E]/20",
        };
      case "logged-out":
        return {
          label: "Oturum Kapalı",
          icon: UserX,
          color: "text-red-400",
          bgColor: "bg-red-400/10",
          borderColor: "border-red-400/20",
        };
      case "browser-closed":
        return {
          label: "Tarayıcı Kapalı",
          icon: ShieldAlert,
          color: "text-zinc-400",
          bgColor: "bg-white/5",
          borderColor: "border-white/10",
        };
      case "checking":
        return {
          label: "Kontrol ediliyor...",
          icon: Loader2,
          color: "text-amber-400",
          bgColor: "bg-amber-400/10",
          borderColor: "border-amber-400/20",
          animateIcon: true,
        };
      default:
        return {
          label: "Bilinmiyor",
          icon: ShieldAlert,
          color: "text-zinc-500",
          bgColor: "bg-white/5",
          borderColor: "border-white/10",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 lg:gap-3">
      {/* Status Badge */}
      <motion.div
        layout
        className={cn(
          "flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold transition-all",
          config.bgColor,
          config.color,
          config.borderColor
        )}
      >
        <Icon className={cn("w-3 h-3 sm:w-3.5 sm:h-3.5", config.animateIcon && "animate-spin")} />
        <span className="hidden sm:inline uppercase tracking-wider">{config.label}</span>
      </motion.div>

      {/* Login Button (Only if not logged in) */}
      <AnimatePresence>
        {status !== "logged-in" && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-black rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all hover:bg-zinc-200 disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
            ) : (
              <LogIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )}
            <span>Oturum Aç</span>
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* If logged in, maybe show a "Go to Site" link */}
      {status === "logged-in" && (
        <motion.a
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          href="https://www.sahibinden.com"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-zinc-500 hover:text-white transition-colors"
          title="Sahibinden'e Git"
        >
          <ExternalLink className="w-4 h-4" />
        </motion.a>
      )}
    </div>
  );
}
