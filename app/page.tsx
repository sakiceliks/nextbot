"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  AnimatePresence,
  motion,
} from "framer-motion";
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  History,
  Layers,
  Plus,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import type { ListingDraft } from "@/lib/types";
import SplashScreen from "./components/SplashScreen";
import { ManualListingForm } from "./components/ManualListingForm";
import { BulkAddModal } from "./components/BulkAddModal";
import { PublishQueue } from "./components/PublishQueue";
import type { QueueItem } from "./components/PublishQueue";
import { SahibindenAuthStatus } from "./components/SahibindenAuthStatus";
import { WhatsAppDashboard } from "./components/WhatsAppDashboard";
import { BotSettings } from "./components/BotSettings";

export default function Home() {
  // ── States ──────────────────────────────────────────────────────────────────
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);
  const [queueCurrentIndex, setQueueCurrentIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [activeView, setActiveView] = useState<"queue" | "whatsapp" | "settings">("queue");
  const queueAbortRef = useRef(false);
  const queueItemsRef = useRef<QueueItem[]>([]);
  queueItemsRef.current = queueItems;

  // ── Persistence ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
    const fetchQueue = async () => {
      try {
        const res = await fetch("/api/queue");
        const data = await res.json();
        if (data.ok) {
          const mappedItems = data.items.map((it: any) => ({
            id: it.queueId,
            draft: it.draft,
            preview: it.preview,
            status: it.status,
            errorMsg: it.errorMsg,
            addedAt: it.addedAt,
            duration: it.duration
          }));
          setQueueItems(mappedItems);
        }
      } catch (err) {
        console.error("[DB] ❌ Kuyruk yükleme hatası:", err);
      }
    };
    fetchQueue();
  }, []);

  // Auto-sync to DB
  useEffect(() => {
    if (!isMounted || queueItems.length === 0) return;
    
    const syncQueue = async () => {
      try {
        await fetch("/api/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: queueItems })
        });
      } catch (err) {
        console.error("[DB] ❌ Kuyruk senkronizasyon hatası:", err);
      }
    };

    const timer = setTimeout(syncQueue, 1000);
    return () => clearTimeout(timer);
  }, [queueItems, isMounted]);

  // ── Queue Handlers ──────────────────────────────────────────────────────────
  const addToQueue = useCallback((draft: ListingDraft, preview: string | null) => {
    const item: QueueItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      draft,
      preview,
      status: "pending",
      addedAt: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    };
    console.log("[QUEUE] ➕ İlan kuyruğa eklendi:", draft.name);
    setQueueItems((prev) => [...prev, item]);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    const item = queueItemsRef.current.find(i => i.id === id);
    console.log("[QUEUE] ➖ İlan kuyruktan kaldırıldı:", item?.draft.name);
    setQueueItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQueueItem = useCallback((id: string, patch: Partial<ListingDraft>) => {
    console.log("[QUEUE] 📝 İlan güncellendi:", id, patch);
    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, draft: { ...item.draft, ...patch } } : item
      )
    );
  }, []);

  const handleReset = useCallback(async () => {
    if (window.confirm("Kuyruğu tamamen temizlemek istediğine emin misin?")) {
      console.log("[SYSTEM] 🔄 Sistem sıfırlanıyor...");
      try {
        await fetch("/api/queue", {
          method: "DELETE",
          body: JSON.stringify({ clearAll: true })
        });
        setQueueItems([]);
        setQueueCurrentIndex(null);
        setQueueRunning(false);
        toast.success("Sistem ve Veritabanı sıfırlandı");
      } catch (err) {
        toast.error("Sıfırlama hatası");
      }
    }
  }, []);

  // ── Queue Execution Logic ───────────────────────────────────────────────────
  const startQueue = async () => {
    if (queueRunning) return;
    queueAbortRef.current = false;
    setQueueRunning(true);
    console.log("[BOT] 🚀 Kuyruk başlatıldı");

    let items = [...queueItemsRef.current];
    for (let i = 0; i < items.length; i++) {
      if (queueAbortRef.current) {
        console.log("[BOT] 🛑 Kuyruk kullanıcı tarafından durduruldu");
        break;
      }
      if (items[i].status === "done" || items[i].status === "running") continue;

      setQueueCurrentIndex(i);
      setQueueItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "running" } : it))
      );

      console.log(`[BOT] 🛠 İşleniyor (${i + 1}/${items.length}):`, items[i].draft.name);
      const startTime = Date.now();

      try {
        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draft: items[i].draft,
            mode: "publish" // Required by Zod schema
          }),
        });

        const data = await res.json();
        const duration = ((Date.now() - startTime) / 1000).toFixed(0) + "s";
        console.log(`[API] 📡 Yanıt alındı (${items[i].draft.name}) [${duration}]:`, data);

        if (data.ok) {
          console.log(`[BOT] ✅ Başarıyla yayınlandı:`, items[i].draft.name);
          setQueueItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: "done", duration } : it))
          );
          toast.success("İlan başarıyla yüklendi", { description: `${items[i].draft.name} (${duration})` });
        } else {
          console.error(`[BOT] ❌ Yayınlama hatası (${items[i].draft.name}):`, data.error);
          setQueueItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: "error", errorMsg: data.error } : it))
          );
          toast.error("Yayınlama hatası", { description: data.error });
        }
      } catch (err) {
        console.error(`[BOT] ☢️ Kritik hata (${items[i].draft.name}):`, err);
        setQueueItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "error", errorMsg: "Bağlantı hatası" } : it))
        );
      }

      // Wait between items
      await new Promise((r) => setTimeout(r, 2000));
    }

    setQueueRunning(false);
    setQueueCurrentIndex(null);
    console.log("[BOT] 🏁 Kuyruk işlemi tamamlandı");
  };

  const stopQueue = () => {
    queueAbortRef.current = true;
    setQueueRunning(false);
    setQueueCurrentIndex(null);
    setQueueItems((prev) =>
      prev.map((it) => (it.status === "running" ? { ...it, status: "pending" } : it))
    );
    toast.info("Kuyruk durduruldu");
  };

  if (!isMounted) return null;

  return (
    <div className="flex h-[100dvh] w-full bg-[#0d1117] text-zinc-300 font-sans overflow-hidden">
      {/* ── Sidebar (Aside) ── */}
      <aside className="w-64 border-r border-white/5 hidden lg:flex flex-col flex-shrink-0 bg-[#0d1117]">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#11F08E] flex items-center justify-center">
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-black tracking-tighter text-white text-xl uppercase">NextBot</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          <div className="px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Dashboard</div>
          
          <div 
            onClick={() => setActiveView("queue")}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all",
              activeView === "queue" 
                ? "bg-[#11F08E]/10 text-[#11F08E] border border-[#11F08E]/20" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            <Layers className="w-4 h-4" />
            <span className="text-sm font-bold">Yükleme Kuyruğu</span>
          </div>

          <div 
            onClick={() => setActiveView("whatsapp")}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all",
              activeView === "whatsapp" 
                ? "bg-[#11F08E]/10 text-[#11F08E] border border-[#11F08E]/20" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm font-bold">WhatsApp AI Bot</span>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer group">
            <History className="w-4 h-4" />
            <span className="text-sm font-bold">Tamamlananlar</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer group">
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-bold">Log Kayıtları</span>
          </div>
          <div className="mt-8 px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Ayarlar</div>
          <div
            onClick={() => setActiveView("settings")}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all",
              activeView === "settings"
                ? "bg-[#11F08E]/10 text-[#11F08E] border border-[#11F08E]/20"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            <Zap className="w-4 h-4" />
            <span className="text-sm font-bold">Bot Ayarları</span>
          </div>
        </nav>

        <div className="p-6 border-t border-white/5 hidden">
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Account Plan</p>
            <p className="text-white font-bold text-sm mb-2">Enterprise Pro</p>
            <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#11F08E] w-3/4"></div>
            </div>
            <p className="text-[9px] text-zinc-500 mt-2 italic">750 / 1000 listings used</p>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-h-0 bg-[#0d1117]">
        {/* Header */}
        <header className="h-14 lg:h-16 border-b border-white/5 flex items-center justify-between px-3 sm:px-4 lg:px-8 bg-[#0d1117]/50 backdrop-blur-md flex-shrink-0 z-20">
          {/* Sol: Breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-zinc-500 hidden sm:inline truncate">Bot</span>
            <svg className="w-3 h-3 text-zinc-600 hidden sm:inline flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-bold text-zinc-100 truncate">
              {activeView === "queue" ? "Yükleme Kuyruğu" : activeView === "whatsapp" ? "WhatsApp AI Bot" : "Bot Ayarları"}
            </span>
          </div>

          {/* Sağ: Aksiyonlar */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-4 flex-shrink-0">
            {/* Sahibinden Durumu */}
            <SahibindenAuthStatus />

            <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

            {/* Manuel Ekle */}
            <button
              onClick={() => {
                console.log("[UI] 🖱 Manuel İlan modalı açıldı");
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-[10px] px-2 sm:px-3 lg:px-4 py-2 border border-[#11F08E]/20 bg-[#11F08E]/10 text-[#11F08E] hover:bg-[#11F08E]/20 rounded-lg transition-all font-bold uppercase tracking-widest leading-none active:scale-95"
              title="Manuel Ekle"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Manuel</span>
              <span className="hidden lg:inline"> Ekle</span>
            </button>

            {/* Toplu Ekle */}
            <button
              onClick={() => {
                console.log("[UI] 🖱 Toplu İlan modalı açıldı");
                setIsBulkModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-[10px] px-2 sm:px-3 lg:px-4 py-2 border border-amber-500/20 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-lg transition-all font-bold uppercase tracking-widest leading-none active:scale-95"
              title="Toplu Ekle"
            >
              <Layers className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Toplu</span>
              <span className="hidden lg:inline"> Ekle</span>
            </button>

            {/* Sıfırla */}
            <button
              onClick={handleReset}
              className="text-[10px] px-2 sm:px-3 lg:px-4 py-2 border border-white/10 rounded-lg text-zinc-400 hover:text-white transition-all font-bold uppercase tracking-widest leading-none active:scale-95"
              title="Sıfırla"
            >
              <span className="sm:hidden">↺</span>
              <span className="hidden sm:inline">Sıfırla</span>
            </button>

            {/* Avatar */}
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/10 bg-zinc-800 flex items-center justify-center text-[10px] font-black text-[#11F08E] shadow-lg flex-shrink-0">
              MB
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 flex flex-col relative min-h-0 hide-scrollbar">
          <style dangerouslySetInnerHTML={{
            __html: `
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `}} />

          {activeView === "queue" ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8 flex-shrink-0">
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl shadow-sm">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Kuyrukta</p>
                  <h4 className="text-2xl font-black text-white mt-2 tracking-tight">
                    {queueItems.filter((i) => i.status === "pending").length}
                  </h4>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl shadow-sm">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tamamlanan</p>
                  <h4 className="text-2xl font-black text-[#11F08E] mt-2 tracking-tight">
                    {queueItems.filter((i) => i.status === "done").length}
                  </h4>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl shadow-sm">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Hatalı</p>
                  <h4 className="text-2xl font-black text-red-400 mt-2 tracking-tight">
                    {queueItems.filter((i) => i.status === "error").length}
                  </h4>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl shadow-sm">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Durum</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={cn("w-2 h-2 rounded-full", queueRunning ? "bg-amber-400 animate-pulse" : "bg-zinc-600")} />
                    <h4 className={cn("text-lg font-black tracking-tight", queueRunning ? "text-amber-400" : "text-zinc-500")}>
                      {queueRunning ? "Aktif" : "Beklemede"}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Publish Queue Table */}
              <PublishQueue
                items={queueItems}
                onRemove={removeFromQueue}
                onUpdate={updateQueueItem}
                onClear={handleReset}
                onStartQueue={startQueue}
                onStopQueue={stopQueue}
                isRunning={queueRunning}
                currentIndex={queueCurrentIndex}
              />
            </>
          ) : activeView === "whatsapp" ? (
            <WhatsAppDashboard />
          ) : (
            <BotSettings />
          )}

          <div className="h-12 flex-shrink-0" /> {/* Spacer */}
        </div>
      </main>

      {/* ── Manual Listing Modal ── */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-[5%] bottom-[5%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-[#161c24] border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <ManualListingForm
                  onCancel={() => setIsModalOpen(false)}
                  onDraftCreated={() => { }}
                  onAddToQueue={(draft, preview) => {
                    addToQueue(draft, preview);
                    setIsModalOpen(false);
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Bulk Add Modal ── */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-[10%] bottom-[10%] left-1/2 -translate-x-1/2 w-full max-w-3xl bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              <BulkAddModal
                onClose={() => setIsBulkModalOpen(false)}
                onAdd={(newItems) => {
                  console.log(`[QUEUE] 📦 ${newItems.length} adet toplu ilan ekleniyor...`);
                  newItems.forEach(item => {
                    const queueItem: QueueItem = {
                      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                      draft: item.draft,
                      preview: item.preview,
                      status: "pending",
                      addedAt: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
                    };
                    setQueueItems(prev => [...prev, queueItem]);
                  });
                  toast.success(`${newItems.length} adet ilan kuyruğa eklendi!`);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <SplashScreen />
    </div>
  );
}
