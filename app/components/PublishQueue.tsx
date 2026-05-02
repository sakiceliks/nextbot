"use client";

import { useState } from "react";
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
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListingDraft } from "@/lib/types";
import { COLORS, TOWNS } from "@/lib/manual-data";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type QueueItemStatus = "pending" | "running" | "done" | "error";

export interface QueueItem {
  id: string;
  draft: ListingDraft;
  preview?: string | null;
  status: QueueItemStatus;
  errorMsg?: string;
  addedAt: string;
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

// ─── Status Config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  QueueItemStatus,
  { label: string; color: string; bg: string; dot: string; icon: React.ElementType }
> = {
  pending: {
    label: "Bekliyor",
    color: "text-zinc-400",
    bg: "bg-zinc-800/40 border-zinc-700/30",
    dot: "bg-zinc-500",
    icon: Clock,
  },
  running: {
    label: "Yükleniyor",
    color: "text-amber-300",
    bg: "bg-amber-400/8 border-amber-400/25",
    dot: "bg-amber-300",
    icon: Loader2,
  },
  done: {
    label: "Tamam",
    color: "text-[#11F08E]",
    bg: "bg-[#11F08E]/8 border-[#11F08E]/20",
    dot: "bg-[#11F08E]",
    icon: CheckCircle2,
  },
  error: {
    label: "Hata",
    color: "text-red-400",
    bg: "bg-red-500/8 border-red-500/20",
    dot: "bg-red-400",
    icon: AlertCircle,
  },
};

// ─── Shared cell/input styles ───────────────────────────────────────────────

const cellInput =
  "w-full bg-zinc-900 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-[#11F08E]/50 focus:ring-1 focus:ring-[#11F08E]/15 transition-all placeholder:text-zinc-600 hover:border-zinc-600 shadow-sm";

// ─── Row Component ──────────────────────────────────────────────────────────

function QueueRow({
  item,
  index,
  isActive,
  isRunning,
  onRemove,
  onUpdate,
}: {
  item: QueueItem;
  index: number;
  isActive: boolean;
  isRunning: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ListingDraft>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...item.draft });

  const cfg = STATUS_CONFIG[item.status];
  const StatusIcon = cfg.icon;
  const canEdit = item.status !== "running" && item.status !== "done";

  const handleSave = () => {
    onUpdate(item.id, {
      price: draft.price,
      color: draft.color,
      town: draft.town,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft({ ...item.draft });
    setEditing(false);
  };

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative border-b border-white/[0.025] transition-all duration-200",
        isActive && "bg-[#11F08E]/[0.04]",
        item.status === "done" && "opacity-50",
        item.status === "error" && "bg-red-500/[0.025]",
        !isActive && item.status === "pending" && "hover:bg-white/[0.015]"
      )}
    >
      {/* Active indicator — left accent line */}
      {isActive && (
        <td className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full overflow-hidden pointer-events-none">
          <motion.div
            className="w-full h-full bg-[#11F08E] rounded-full"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </td>
      )}

      {/* # */}
      <td className="pl-5 pr-2 py-3.5 w-10">
        <span className="text-[10px] font-bold tabular-nums text-zinc-700 group-hover:text-zinc-500 transition-colors">
          {String(index + 1).padStart(2, "0")}
        </span>
      </td>

      {/* Thumbnail */}
      <td className="pr-4 py-3 w-14">
        <div className="relative">
          {item.preview ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/[0.07] shadow-lg shadow-black/30 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.preview}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/40 flex items-center justify-center">
              <Globe className="w-4 h-4 text-zinc-600" />
            </div>
          )}
          {/* Status dot on thumbnail */}
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d1117] shadow-sm",
              cfg.dot,
              item.status === "running" && "animate-pulse"
            )}
          />
        </div>
      </td>

      {/* İlan Bilgisi */}
      <td className="pr-4 py-3 min-w-[120px] max-w-[200px]">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-zinc-200 truncate tracking-tight group-hover:text-white transition-colors">
            {editing ? item.draft.name.slice(0, 7) : item.draft.name}
            {editing && item.draft.name.length > 7 && "…"}
          </p>
          {!editing && (
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">
              {item.draft.brand} {item.draft.model} · {item.draft.storage}
            </p>
          )}
        </div>
      </td>

      {/* Fiyat (Editable) */}
      <td className="pr-4 py-3 w-36">
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
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500 pointer-events-none">₺</span>
          </div>
        ) : (
          <span className="text-xs font-bold text-[#11F08E] tabular-nums tracking-tight">
            ₺{item.draft.price.toLocaleString("tr-TR")}
          </span>
        )}
      </td>

      {/* Renk (Editable Dropdown) */}
      <td className="pr-4 py-3 w-36">
        {editing ? (
          <select
            value={draft.color ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, color: e.target.value }))
            }
            className={cn(cellInput, "appearance-none cursor-pointer")}
          >
            <option value="" disabled className="bg-zinc-900">Renk Seçin</option>
            {COLORS.map((color) => (
              <option key={color} value={color} className="bg-zinc-900">
                {color}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-700 flex-shrink-0" />
            <span className="text-xs text-zinc-400 font-medium">{item.draft.color ?? "—"}</span>
          </div>
        )}
      </td>

      {/* İlçe (Editable Dropdown) */}
      <td className="pr-4 py-3 w-44">
        {editing ? (
          <select
            value={draft.town ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, town: e.target.value }))
            }
            className={cn(cellInput, "appearance-none cursor-pointer")}
          >
            <option value="" disabled className="bg-zinc-900">İlçe Seçin</option>
            {TOWNS.map((town) => (
              <option key={town} value={town} className="bg-zinc-900">
                {town}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-zinc-400 font-medium">{item.draft.town ?? "—"}</span>
        )}
      </td>

      {/* Durum */}
      <td className="pr-4 py-3 w-28">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all",
            cfg.bg,
            cfg.color
          )}
        >
          <StatusIcon
            className={cn("w-3 h-3 flex-shrink-0", item.status === "running" && "animate-spin")}
          />
          {cfg.label}
        </div>
      </td>

      {/* Aksiyonlar */}
      <td className="pr-5 py-3 w-24">
        <div className="flex items-center gap-1 justify-end">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                title="Kaydet"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#11F08E] text-[#0d1117] hover:bg-[#0fd880] active:scale-95 transition-all shadow-md shadow-[#11F08E]/20"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCancel}
                title="İptal"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all"
              >
                <X className="w-3.5 h-3.5" />
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
                  title="Düzenle"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-[#11F08E] hover:bg-[#11F08E]/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {item.status !== "running" && (
                <button
                  onClick={() => onRemove(item.id)}
                  title="Kaldır"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

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

  const pending = items.filter((i) => i.status === "pending").length;
  const done = items.filter((i) => i.status === "done").length;
  const errors = items.filter((i) => i.status === "error").length;
  const total = items.length;

  if (total === 0) return null;

  const progress = total > 0 ? (done / total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-hidden shadow-2xl shadow-black/60"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.04]">
        {/* Icon + Title block */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#11F08E]/10 border border-[#11F08E]/15 flex items-center justify-center flex-shrink-0">
            <ListOrdered className="w-4 h-4 text-[#11F08E]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.18em] leading-none">
              Kuyruk Yönetimi
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-medium text-zinc-600 tabular-nums">{total} ilan</span>
              {done > 0 && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                  <span className="text-[10px] font-medium text-[#11F08E] tabular-nums">{done} başarılı</span>
                </>
              )}
              {errors > 0 && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                  <span className="text-[10px] font-medium text-red-400 tabular-nums">{errors} hatalı</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5">
          {!isRunning && (
            <button
              onClick={onClear}
              title="Kuyruğu Temizle"
              className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-400/8 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {isRunning ? (
            <button
              onClick={onStopQueue}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/15 transition-all active:scale-95"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Durdur
            </button>
          ) : (
            <button
              onClick={onStartQueue}
              disabled={pending === 0}
              className={cn(
                "flex items-center gap-1.5 px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95",
                pending > 0
                  ? "bg-[#11F08E] text-[#0d1117] hover:bg-[#0fd880] shadow-lg shadow-[#11F08E]/15"
                  : "bg-zinc-800/60 text-zinc-600 cursor-not-allowed border border-white/[0.04]"
              )}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Kuyruğu Başlat
            </button>
          )}

          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Genişlet" : "Daralt"}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all ml-0.5"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress bar — only when running */}
      {isRunning && (
        <div className="h-px bg-zinc-800 overflow-hidden">
          <motion.div
            className="h-full bg-[#11F08E]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      )}

      {/* ── Table ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="table-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.03]">
                    <th className="pl-5 pr-2 py-3 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-700 w-10">#</th>
                    <th className="pr-4 py-3 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-700 w-14">Görsel</th>
                    <th className="pr-4 py-3 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-700">İlan</th>
                    <th className="pr-4 py-3 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-700 w-36">Fiyat (TL)</th>
                    <th className="pr-4 py-3 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-700 w-36">Renk</th>
                    <th className="pr-4 py-3 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-700 w-44">İlçe</th>
                    <th className="pr-4 py-3 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-700 w-28">Durum</th>
                    <th className="pr-5 py-3 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-700 w-24 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {items.map((item, index) => (
                      <QueueRow
                        key={item.id}
                        item={item}
                        index={index}
                        isActive={currentIndex === index}
                        isRunning={isRunning}
                        onRemove={onRemove}
                        onUpdate={onUpdate}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Bottom hint */}
            {pending > 0 && !isRunning && (
              <div className="px-5 py-3 border-t border-white/[0.025]">
                <p className="text-[9px] text-zinc-700 font-medium uppercase tracking-widest text-center">
                  Satır üzerine gelerek{" "}
                  <span className="text-[#11F08E]/70">fiyat, renk veya ilçe</span>{" "}
                  değerlerini düzenleyebilirsiniz
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}