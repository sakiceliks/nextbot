"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  QrCode, 
  RefreshCw, 
  LogOut, 
  Play, 
  Terminal,
  ShieldCheck,
  Zap,
  Clock,
  Wifi,
  WifiOff
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhatsAppState {
  status: "disconnected" | "connecting" | "qr" | "ready" | "loading";
  qrCode: string | null;
  logs: string[];
}

export function WhatsAppDashboard() {
  const [state, setState] = useState<WhatsAppState>({
    status: "disconnected",
    qrCode: null,
    logs: [],
  });
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp");
      const data = await res.json();
      if (data.ok) {
        setState(prev => ({
          ...prev,
          status: data.status,
          qrCode: data.qrCode,
          // Only take initial logs if our current log list is empty
          logs: prev.logs.length === 0 ? data.logs : prev.logs,
        }));
      }
    } catch (err) {
      console.error("WhatsApp status fetch error:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // SSE initialization
    console.log("[SSE] 🔄 Connecting to real-time log stream...");
    const eventSource = new EventSource("/api/whatsapp/logs");

    eventSource.onopen = () => {
      console.log("[SSE] ✅ Connected successfully!");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.log) {
          console.log("[SSE] 📥 New log received:", data.log.slice(0, 50));
          setState(prev => ({
            ...prev,
            logs: [data.log, ...prev.logs].slice(0, 50)
          }));
        }
      } catch (err) {
        console.error("[SSE] ❌ Parse error:", err, "Raw data:", event.data);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[SSE] ⚠️ Connection Error. State:", eventSource.readyState);
      eventSource.close();
      // Reconnect logic is handled by browser naturally but we close it to be safe
    };

    // Fallback polling for status changes (qr -> ready etc)
    const interval = setInterval(fetchStatus, 5000);

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  const handleCommand = async (command: "start" | "logout" | "stop" | "restart" | "clear-session") => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message);
        fetchStatus();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error("İşlem başarısız.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 p-1">
      {/* ── Status Header ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard 
          title="Bot Durumu"
          value={getStatusLabel(state.status)}
          icon={state.status === "ready" ? Wifi : WifiOff}
          color={getStatusColor(state.status)}
          active={state.status === "ready"}
        />
        <StatusCard 
          title="AI Motoru"
          value="Groq Llama 3.3"
          icon={Zap}
          color="text-amber-400"
          active={true}
        />
        <StatusCard 
          title="Son Aktivite"
          value={state.logs[0] ? state.logs[0].split("]")[0].replace("[", "") : "—"}
          icon={Clock}
          color="text-blue-400"
          active={state.status === "ready"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* ── Connection Panel ── */}
        <div className="flex flex-col gap-4 bg-white/[0.02] border border-white/5 rounded-3xl p-6 overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#11F08E]" />
              Bağlantı Paneli
            </h3>
            <div className="flex items-center gap-2">
              {(state.status === "loading" || state.status === "qr" || state.status === "connecting") && (
                <button
                  onClick={() => handleCommand("stop")}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50"
                  title="Durdur"
                >
                  Durdur
                </button>
              )}
              {state.status !== "disconnected" && (
                <button
                  onClick={() => handleCommand("restart")}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all disabled:opacity-50"
                  title="Yeniden Başlat"
                >
                  <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                  Yeniden Başlat
                </button>
              )}
              {state.status === "disconnected" && (
                <button
                  onClick={() => {
                    if (confirm("Oturum verilerini (QR kodu dahil) temizlemek istiyor musunuz?")) {
                      handleCommand("clear-session");
                    }
                  }}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 text-zinc-400 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all disabled:opacity-50"
                  title="Oturumu Temizle"
                >
                  Verileri Temizle
                </button>
              )}
              {state.status === "disconnected" && (
                <button
                  onClick={() => handleCommand("start")}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-[#11F08E] text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#0fd880] transition-all disabled:opacity-50"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Başlat
                </button>
              )}
              {state.status === "ready" && (
                <button
                  onClick={() => handleCommand("logout")}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50"
                >
                  <LogOut className="w-3 h-3" />
                  Oturumu Kapat
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center relative">
            <AnimatePresence mode="wait">
              {state.status === "qr" && state.qrCode ? (
                <motion.div
                  key="qr"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white p-6 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.1)]"
                >
                  <QRCodeSVG value={state.qrCode} size={220} level="H" />
                </motion.div>
              ) : state.status === "loading" ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-4 text-zinc-500"
                >
                  <RefreshCw className="w-12 h-12 animate-spin" />
                  <p className="text-sm font-bold uppercase tracking-widest">Başlatılıyor...</p>
                </motion.div>
              ) : state.status === "ready" ? (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-4 text-[#11F08E]"
                >
                  <div className="w-24 h-24 rounded-full bg-[#11F08E]/10 flex items-center justify-center border-4 border-[#11F08E]/20 animate-glow-pulse">
                    <ShieldCheck className="w-12 h-12" />
                  </div>
                  <p className="text-lg font-black uppercase tracking-[0.2em]">Sistem Aktif</p>
                  <p className="text-xs text-zinc-500 text-center max-w-[240px]">
                    Bot şu an gelen mesajları Groq AI ile yanıtlıyor.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  className="flex flex-col items-center gap-4 text-zinc-700"
                >
                  <MessageSquare className="w-16 h-16 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest">Oturum Açılmadı</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Logs Panel ── */}
        <div className="flex flex-col gap-4 bg-white/[0.02] border border-white/5 rounded-3xl p-6 overflow-hidden">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-zinc-400" />
            Sistem Kayıtları
          </h3>
          <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 hide-scrollbar">
            {state.logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-700 italic">
                Kayıt bulunamadı
              </div>
            ) : (
              state.logs.map((log, i) => (
                <div key={i} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  <span className="text-[#11F08E]/60">{log.split("]")[0]}]</span>
                  <span className="ml-2">{log.split("]")[1]}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, value, icon: Icon, color, active }: any) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl flex items-center gap-4">
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
        active ? "bg-white/5" : "bg-black/20"
      )}>
        <Icon className={cn("w-6 h-6", color, !active && "opacity-40")} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{title}</p>
        <h4 className={cn("text-sm font-black mt-0.5", active ? "text-white" : "text-zinc-500")}>
          {value}
        </h4>
      </div>
    </div>
  );
}

function getStatusLabel(status: string) {
  switch (status) {
    case "disconnected": return "Bağlı Değil";
    case "connecting": return "Bağlanıyor...";
    case "qr": return "QR Bekleniyor";
    case "ready": return "Çalışıyor";
    case "loading": return "Yükleniyor...";
    default: return "Bilinmiyor";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "ready": return "text-[#11F08E]";
    case "qr":
    case "connecting":
    case "loading": return "text-amber-400";
    default: return "text-red-400";
  }
}
