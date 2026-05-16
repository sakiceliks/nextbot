"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Loader2,
  Pencil,
  Play,
  Square,
  Trash2,
  AlertCircle,
  ListOrdered,
  X,
  Save,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ListingDraft } from "@/lib/types";
import { COLORS, TOWNS } from "@/lib/manual-data";

export type QueueItemStatus = "pending" | "running" | "done" | "error";

export interface QueueItem {
  id: string;
  draft: ListingDraft;
  preview?: string | null;
  status: QueueItemStatus;
  errorMsg?: string;
  addedAt: string;
  duration?: string;
}

interface PublishQueueProps {
  items: QueueItem[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ListingDraft>) => void;
  onClear: () => void;
  onStartQueue: () => void;
  onStopQueue: () => void;
  isRunning: boolean;
  currentIndex: number | null;
}

const STATUS_CONFIG: Record<
  QueueItemStatus,
  { label: string; color: string; bg: string; dot: string; icon: React.ElementType }
> = {
  pending: {
    label: "Bekliyor",
    color: "text-zinc-400",
    bg: "bg-zinc-800/40 border border-zinc-700/30",
    dot: "bg-zinc-500",
    icon: Clock,
  },
  running: {
    label: "Yükleniyor",
    color: "text-amber-300",
    bg: "bg-amber-400/8 border border-amber-400/25",
    dot: "bg-amber-300",
    icon: Loader2,
  },
  done: {
    label: "Yüklendi",
    color: "text-[#11F08E]",
    bg: "bg-[#11F08E]/8 border border-[#11F08E]/20",
    dot: "bg-[#11F08E]",
    icon: CheckCircle2,
  },
  error: {
    label: "Giriş Hatası",
    color: "text-red-400",
    bg: "bg-red-500/8 border border-red-500/20",
    dot: "bg-red-400",
    icon: AlertCircle,
  },
};

const cellInput =
  "w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-3 py-1.5 text-[16px] lg:text-xs text-zinc-100 outline-none focus:border-[#11F08E]/40 focus:ring-1 focus:ring-[#11F08E]/20 transition-all placeholder:text-zinc-700 shadow-inner";

function QueueRow({
  item,
  index,
  isActive,
  isSelected,
  isRunning,
  onRemove,
  onUpdate,
  onSelect,
}: {
  item: QueueItem;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  isRunning: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ListingDraft>) => void;
  onSelect: (e: React.MouseEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...item.draft });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cfg = STATUS_CONFIG[item.status];
  const StatusIcon = cfg.icon;
  const canEdit = item.status !== "running" && item.status !== "done";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (data.ok) {
        setDraft(prev => ({ ...prev, imageUrl: data.imageUrl, imagePath: data.imagePath }));
        toast.success("Görsel yüklendi!");
      } else {
        toast.error("Hata: " + data.error);
      }
    } catch (err) {
      toast.error("Görsel yükleme hatası");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = () => {
    onUpdate(item.id, {
      price: draft.price,
      color: draft.color,
      town: draft.town,
      imageUrl: draft.imageUrl,
      imagePath: draft.imagePath,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft({ ...item.draft });
    setEditing(false);
  };

  // Keyboard Edit Trigger Listener
  useEffect(() => {
    const handleEditEvent = () => {
      if (canEdit && !isRunning) {
        setDraft({ ...item.draft });
        setEditing(true);
      }
    };
    window.addEventListener(`edit-row-${item.id}`, handleEditEvent);
    return () => window.removeEventListener(`edit-row-${item.id}`, handleEditEvent);
  }, [item.id, canEdit, isRunning, item.draft]);


  // Enter/Esc listeners while editing
  useEffect(() => {
    if (!editing) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleSave();
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editing, draft]);

  return (
    <motion.div
      layout={!editing}
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative grid grid-cols-1 lg:grid-cols-[32px_48px_minmax(180px,1fr)_120px_120px_140px_100px_80px] gap-4 lg:gap-4 items-center p-4 lg:py-3 transition-all duration-300 lg:border-b-0 overflow-hidden rounded-2xl lg:rounded-none lg:px-4",
        "border border-white/5 lg:border-y-0 lg:border-r-0 lg:border-l-4 lg:border-transparent bg-white/[0.01]",
        isActive && "bg-[#11F08E]/10 ring-1 ring-[#11F08E]/20 lg:ring-0 lg:rounded-none lg:border-[#11F08E]",
        isSelected && !isActive && "bg-white/[0.04] lg:border-zinc-700",
        item.status === "done" && "bg-emerald-500/[0.02] opacity-60",
        item.status === "error" && "bg-red-500/[0.02]",
        !isActive && item.status === "pending" && "hover:bg-white/[0.03]"
      )}
    >
      {/* Active pulse bar (Desktop) */}
      {isActive && (
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-1 overflow-hidden -mx-1">
          <motion.div
            className="w-full h-full bg-[#11F08E]"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      )}

      {/* Header section for mobile - Status & Thumbnail */}
      <div className="flex lg:contents items-center justify-between w-full">
        <div className="flex lg:contents items-center gap-3">
          {/* # */}
          <div className="hidden lg:flex items-center gap-3 pl-4">
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-all",
              isSelected ? "bg-[#11F08E] border-[#11F08E]" : "border-zinc-700 bg-transparent"
            )}>
              {isSelected && <div className="w-2 h-2 bg-black rounded-sm" />}
            </div>
            <span className="text-[10px] font-black text-zinc-700 group-hover:text-zinc-500 transition-colors">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>

          {/* Thumbnail */}
          <div
            onClick={() => editing && !isUploadingImage && fileInputRef.current?.click()}
            className={cn(
              "relative group/thumb flex-shrink-0 lg:flex lg:items-center",
              editing && "cursor-pointer"
            )}
          >
            <div className={cn(
              "w-12 h-12 lg:w-10 lg:h-10 rounded-xl overflow-hidden border border-white/5 shadow-2xl transition-all duration-500",
              editing && "ring-2 ring-[#11F08E]/50 group-hover/thumb:scale-105"
            )}>
              {draft.imageUrl || item.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.imageUrl || item.preview || ""}
                  alt=""
                  className={cn("w-full h-full object-cover", isUploadingImage && "opacity-40")}
                />
              ) : (
                <div className="w-full h-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-zinc-700" />
                </div>
              )}

              {editing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                  <Upload className="w-4 h-4 text-white" />
                </div>
              )}

              {isUploadingImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="w-4 h-4 text-[#11F08E] animate-spin" />
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            {/* Status dot on thumbnail */}
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d1117] shadow-sm",
                cfg.dot,
                item.status === "running" && "animate-pulse"
              )}
            />
          </div>

          {/* Durum (Status with Duration) - Mobile Only */}
          <div className="lg:hidden flex flex-col items-start">
            <label className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold mb-1 lg:hidden">Durum</label>
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all shadow-sm",
                cfg.bg,
                cfg.color
              )}
            >
              <StatusIcon
                className={cn("w-3 h-3 flex-shrink-0", item.status === "running" && "animate-spin")}
              />
              {cfg.label}
            </div>
            {item.duration && (item.status === "done" || item.status === "error") && (
              <span className="text-[9px] font-bold text-zinc-500 mt-1 uppercase tracking-tighter flex items-center gap-1">
                <Clock className="w-2 h-2" /> {item.duration}
              </span>
            )}
            {item.errorMsg && <p className="text-[10px] text-red-400 font-medium truncate max-w-[100px] mt-1 lg:hidden">{item.errorMsg}</p>}
          </div>
        </div>

        {/* Mobile Actions Header */}
        <div className="lg:hidden flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#11F08E] text-[#0d1117] active:scale-95 transition-all shadow-lg shadow-[#11F08E]/20"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancel}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {canEdit && !isRunning && (
                <button
                  onClick={() => {
                    setDraft({ ...item.draft });
                    setEditing(true);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-[#11F08E] bg-white/[0.03] transition-all"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {item.status !== "running" && (
                <button
                  onClick={() => onRemove(item.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-red-400 bg-white/[0.03] transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* İlan Bilgisi (Readonly, Sliced if editing) */}
      <div className="flex flex-col mt-2 lg:mt-0 min-w-0">
        <label className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold mb-1 lg:hidden">İlan İsmi</label>
        <p className="text-sm lg:text-xs font-black text-zinc-100 truncate tracking-tight group-hover:text-[#11F08E] transition-colors leading-tight">
          {editing ? item.draft.name.slice(0, 7) : item.draft.name}
          {editing && item.draft.name.length > 7 && "..."}
        </p>
        {!editing && (
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 lg:mt-1 truncate">
            {item.draft.brand} {item.draft.model} · {item.draft.storage}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-none lg:contents lg:gap-0 mt-3 lg:mt-0">
        {/* Fiyat (Editable) */}
        <div className="flex flex-col min-w-0">
          <label className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold mb-1 lg:hidden">Fiyat</label>
          {editing ? (
            <div className="relative">
              <input
                type="number"
                value={draft.price}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, price: Number(e.target.value) }))
                }
                className={cellInput}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-600">₺</span>
            </div>
          ) : (
            <span className="text-sm lg:text-xs font-black text-[#11F08E] tabular-nums">
              ₺{item.draft.price.toLocaleString("tr-TR")}
            </span>
          )}
        </div>

        {/* Renk (Editable Dropdown) */}
        <div className="flex flex-col min-w-0">
          <label className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold mb-1 lg:hidden">Renk</label>
          {editing ? (
            <select
              value={draft.color ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, color: e.target.value }))
              }
              className={cn(cellInput, "appearance-none cursor-pointer p-0 h-auto break-words")}
              style={{ padding: "0.375rem 0.75rem" }}
            >
              <option value="" disabled className="bg-zinc-900 text-zinc-500">Seç</option>
              {COLORS.map((color) => (
                <option key={color} value={color} className="bg-zinc-900">
                  {color}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm lg:text-xs font-bold text-zinc-400 truncate">{item.draft.color ?? "—"}</span>
          )}
        </div>
      </div>

      {/* İlçe (Editable Dropdown) */}
      <div className="flex flex-col mt-2 lg:mt-0 min-w-0">
        <label className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold mb-1 lg:hidden">Kayıtlı İlçe</label>
        {editing ? (
          <select
            value={draft.town ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, town: e.target.value }))
            }
            className={cn(cellInput, "appearance-none cursor-pointer w-full lg:w-auto break-words")}
          >
            <option value="" disabled className="bg-zinc-900">İlçe Seçin</option>
            {TOWNS.map((town) => (
              <option key={town} value={town} className="bg-zinc-900">
                {town}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-1.5 lg:w-auto w-full min-w-0">
            <span className="hidden lg:inline-block w-1.5 h-1.5 rounded-full bg-zinc-800 flex-shrink-0" />
            <span className="text-sm lg:text-xs font-bold text-zinc-400 truncate">{item.draft.town ?? "—"}</span>
          </div>
        )}
      </div>

      {/* Durum - Desktop Only (Mobile is in header) */}
      <div className="hidden lg:flex flex-col min-w-0 pr-4">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all shadow-sm w-max",
            cfg.bg,
            cfg.color
          )}
        >
          <StatusIcon
            className={cn("w-3 h-3 flex-shrink-0", item.status === "running" && "animate-spin")}
          />
          {cfg.label}
        </div>
        {item.duration && (item.status === "done" || item.status === "error") && (
          <span className="text-[9px] font-bold text-zinc-500 mt-1 uppercase tracking-tighter flex items-center gap-1">
            <Clock className="w-2 h-2" /> {item.duration}
          </span>
        )}
      </div>

      {/* Aksiyonlar - Desktop Only (Mobile is in header) */}
      <div className="hidden lg:flex items-center gap-1.5 justify-end pl-2">
        {editing ? (
          <>
            <button
              onClick={handleSave}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#11F08E] text-[#0d1117] hover:scale-110 active:scale-95 transition-all shadow-lg shadow-[#11F08E]/20"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            {canEdit && !isRunning && (
              <button
                onClick={() => {
                  setDraft({ ...item.draft });
                  setEditing(true);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-600 hover:text-[#11F08E] hover:bg-[#11F08E]/10 transition-all opacity-0 group-hover:opacity-100"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {item.status !== "running" && (
              <button
                onClick={() => onRemove(item.id)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
</button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}


export function PublishQueue({
  items,
  onRemove,
  onUpdate,
  onClear,
  onStartQueue,
  onStopQueue,
  isRunning,
  currentIndex,
}: PublishQueueProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const handleRowClick = (index: number, e: React.MouseEvent) => {
    const clickedId = items[index].id;
    
    if (e.shiftKey && lastSelectedIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = items.slice(start, end + 1).map(it => it.id);
      
      setSelectedIds(prev => {
        const next = new Set([...prev, ...rangeIds]);
        return Array.from(next);
      });
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      setSelectedIds(prev => 
        prev.includes(clickedId) 
          ? prev.filter(id => id !== clickedId) 
          : [...prev, clickedId]
      );
    } else {
      // Single selection
      setSelectedIds([clickedId]);
    }
    setLastSelectedIndex(index);
  };

  // Bulk Paste Logic
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (selectedIds.length === 0 || isRunning) return;

      // Don't paste if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;

      const files = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith("image/"));
      if (files.length === 0) return;

      toast.promise(
        (async () => {
          const limit = Math.min(files.length, selectedIds.length);
          let successCount = 0;

          for (let i = 0; i < limit; i++) {
            const file = files[i];
            const itemId = selectedIds[i];

            try {
              const formData = new FormData();
              formData.append("image", file);
              const res = await fetch("/api/upload", { method: "POST", body: formData });
              const data = await res.json();
              
              if (data.ok) {
                onUpdate(itemId, { imageUrl: data.imageUrl, imagePath: data.imagePath });
                successCount++;
              }
            } catch (err) {
              console.error(`Paste upload error for item ${itemId}:`, err);
            }
          }
          return successCount;
        })(),
        {
          loading: `${Math.min(files.length, selectedIds.length)} adet görsel yükleniyor...`,
          success: (count) => `${count} adet görsel başarıyla yüklendi ve ilanlara eklendi.`,
          error: "Görsel yükleme sırasında bir hata oluştu."
        }
      );
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [selectedIds, isRunning, onUpdate]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/select
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        if (e.key === "Enter" || e.key === "Escape") {
          // These will be handled by the components themselves
          return;
        }
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setLastSelectedIndex(prev => {
            const next = (prev === null || prev >= items.length - 1) ? 0 : prev + 1;
            setSelectedIds([items[next].id]);
            return next;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setLastSelectedIndex(prev => {
            const next = (prev === null || prev <= 0) ? items.length - 1 : prev - 1;
            setSelectedIds([items[next].id]);
            return next;
          });
          break;
        case "e":
        case "E":
          if (selectedIds.length === 1) {
            // Trigger edit on selected item
            const event = new CustomEvent(`edit-row-${selectedIds[0]}`);
            window.dispatchEvent(event);
          }
          break;
        case "Delete":
        case "Backspace":
          if (selectedIds.length > 0 && !isRunning) {
            if (window.confirm(`${selectedIds.length} ilanı kuyruktan kaldırmak istediğine emin misin?`)) {
              selectedIds.forEach(id => onRemove(id));
              setSelectedIds([]);
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, items, isRunning, onRemove]);

  const pending = items.filter((i) => i.status === "pending").length;
  const done = items.filter((i) => i.status === "done").length;
  const errors = items.filter((i) => i.status === "error").length;
  const total = items.length;

  if (total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 bg-[#0d1117] border border-white/5 lg:rounded-[24px] rounded-3xl  flex flex-col shadow-2xl font-sans"
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between px-5 lg:px-6 py-5 border-b border-white/[0.03] bg-white/[0.01]">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full border-2 border-[#0d1117] bg-emerald-500"></div>
            <div className="w-6 h-6 rounded-full border-2 border-[#0d1117] bg-amber-500"></div>
            <div className="w-6 h-6 rounded-full border-2 border-[#0d1117] bg-zinc-700"></div>
          </div>
          <span className="text-xs font-bold text-zinc-400">Aktif Otomasyon: <span className="text-[#11F08E]">V-4.0 Stable</span></span>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto w-full sm:w-auto mt-2 sm:mt-0">
          {!isRunning && (
            <button
              onClick={onClear}
              className="p-2.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0 bg-white/[0.03] sm:bg-transparent"
              title="Kuyruğu Temizle"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {isRunning ? (
            <button
              onClick={onStopQueue}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest flex-1 sm:flex-initial justify-center"
            >
              <div className="w-2 h-2 rounded-sm bg-current"></div>
              Durdur
            </button>
          ) : (
            <button
              onClick={onStartQueue}
              disabled={pending === 0}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#11F08E]/20 flex-1 sm:flex-initial justify-center transition-all",
                pending > 0
                  ? "bg-[#11F08E] text-black"
                  : "bg-zinc-900 text-zinc-600 cursor-not-allowed border border-white/5 shadow-none"
              )}
            >
              <Play className="w-3 h-3 fill-current" />
              Devam Et
            </button>
          )}

          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden sm:flex p-2.5 rounded-2xl bg-white/[0.03] text-zinc-500 hover:text-white transition-all ml-2"
          >
            {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Overall Progress Bar */}
      {isRunning && (
        <div className="h-[2px] bg-white/[0.03] overflow-hidden w-full flex-shrink-0">
          <motion.div
            className="h-full bg-[#11F08E]"
            initial={{ width: 0 }}
            animate={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}

      {/* ── List / Grid Main ── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Desktop Table Headers */}
            <div className="hidden lg:grid grid-cols-[32px_48px_minmax(180px,1fr)_120px_120px_140px_100px_80px] gap-4 items-center bg-white/[0.01] sticky top-0 border-b border-white/[0.03] px-4 py-3 z-10 lg:pl-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 pl-4">#</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Görsel</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">İlan Bilgisi</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 pl-2">Fiyat (TL)</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 pl-2">Renk</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 pl-2">İlçe</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Durum</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 text-right pr-2">Aksiyon</div>
            </div>

            {/* List Body */}
            <div className="flex flex-col gap-3 p-4 pb-8 lg:gap-0 lg:p-0 lg:pb-0 lg:divide-y lg:divide-white/[0.02]">
              <div className="flex flex-col">
                {items.map((item, idx) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    index={idx}
                    isActive={currentIndex === idx}
                    isSelected={selectedIds.includes(item.id)}
                    isRunning={isRunning}
                    onRemove={onRemove}
                    onUpdate={onUpdate}
                    onSelect={(e) => handleRowClick(idx, e)}
                  />
                ))}
              </div>
            </div>

            {/* Empty State / Hint */}
            {pending > 0 && !isRunning && (
              <div className="px-6 py-4 bg-white/[0.01] border-t border-white/[0.03]">
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center">
                  Satır üzerine gelerek <span className="text-[#11F08E]">Fiyat, Renk veya İlçe</span> verilerini anında güncelleyebilirsiniz.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="px-8 py-4 border-t border-white/[0.03] bg-black/20 flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-auto">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#11F08E]"></div>
            API Online
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
            Proxy: TR-IST-01
          </div>
        </div>
        <div className="flex gap-4">
          <span>{total} Kayıt</span>
        </div>
      </footer>
    </motion.div>
  );
}