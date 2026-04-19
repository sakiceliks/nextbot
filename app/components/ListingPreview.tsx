"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Car,
  Check,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Globe,
  Info,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import type { ListingDraft } from "@/lib/types";

// ─── Constants ─────────────────────────────────────────────────────────────────

const EDITABLE_FIELDS: Array<keyof ListingDraft> = [
  "name",
  "brand",
  "model",
  "series",
  "product",
  "productType",
  "vehicleType",
  "partCategory",
  "price",
  "description",
];

const FIELD_LABELS: Partial<Record<keyof ListingDraft, string>> = {
  name: "İlan Başlığı",
  brand: "Marka",
  model: "Model",
  series: "Seri",
  product: "Ürün",
  productType: "Ürün Tipi",
  vehicleType: "Araç Tipi",
  partCategory: "Parça Kategorisi",
  price: "Fiyat (₺)",
  description: "Açıklama",
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ListingPreviewProps {
  draft: ListingDraft;
  preview?: string | null;
  onUpdateField: <K extends keyof ListingDraft>(
    key: K,
    value: ListingDraft[K],
  ) => void;
  onDraft: () => void;
  onPublish: () => void;
  onReset: () => void;
  isPublishing?: boolean;
  canPublish?: boolean;
  reviewedForPublish?: boolean;
  onReviewedChange?: (v: boolean) => void;
  error?: string | null;
  publishSuccess?: boolean;
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[#05D57F]/30 bg-[#19202C] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 flex-shrink-0 text-[#11F08E]" />
        <span className="truncate text-base font-black text-zinc-100">
          {value}
        </span>
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ListingPreview({
  draft,
  preview,
  onUpdateField,
  onDraft,
  onPublish,
  onReset,
  isPublishing = false,
  canPublish = true,
  reviewedForPublish,
  onReviewedChange,
  error,
  publishSuccess = false,
}: ListingPreviewProps) {
  const [detailsOpen, setDetailsOpen] = useState(true);

  // Compute average field confidence
  const avgFieldConf = draft.fieldConfidence
    ? Math.round(
        (Object.values(draft.fieldConfidence) as number[]).reduce(
          (a: number, b: number) => a + b,
          0,
        ) / (Object.values(draft.fieldConfidence) as number[]).length,
      )
    : Math.round(draft.confidence * 100);

  const inputBase =
    "w-full rounded-xl border border-zinc-800 bg-[#0d1117] px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#11F08E]/50 transition-colors";

  // Type-safe field update helper
  const handleFieldChange = (
    key: keyof ListingDraft,
    rawValue: string | number,
  ) => {
    (
      onUpdateField as (
        key: keyof ListingDraft,
        value: ListingDraft[keyof ListingDraft],
      ) => void
    )(key, rawValue as ListingDraft[keyof ListingDraft]);
  };

  return (
    <div className="space-y-4">
      {/* ── Section 1 — Hero Card ─────────────────────────────────────────── */}
      <div className="rounded-[28px] border border-[#05D57F] bg-[#19202C]/95 p-4 shadow-[0_0_60px_rgba(17,240,142,0.22)] sm:p-6">
        {/* Drag handle */}
        <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/60" />

        {/* Header row */}
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-[#11F08E]" />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#11F08E]">
            Tespit Edildi
          </span>
        </div>

        {/* Optional image thumbnail */}
        {preview && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-[#05D57F]/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Parça görseli"
              className="h-40 w-full object-cover sm:h-52"
            />
          </div>
        )}

        {/* Part name */}
        <h2 className="mb-4 text-3xl font-black leading-tight text-zinc-100 sm:text-4xl">
          {draft.name}
          {draft.productType ? ` ${draft.productType}` : ""}
        </h2>

        {/* Badges */}
        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-[#05D57F]/40 bg-[#11F08E]/20 px-3 py-1 text-sm font-black text-[#11F08E]">
            %{Math.round(draft.confidence * 100)}
          </span>
          {(draft.brand || draft.model) && (
            <span className="rounded-full border border-[#05D57F]/40 bg-[#11F08E]/20 px-3 py-1 text-sm font-black text-[#11F08E]">
              {[draft.brand, draft.model].filter(Boolean).join(" ")}
            </span>
          )}
        </div>

        {/* 3-col stat grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            icon={CircleDollarSign}
            value={`₺${draft.price.toLocaleString("tr-TR")}`}
            label="Fiyat"
          />
          <StatCard
            icon={Car}
            value={draft.vehicleType || "—"}
            label="Araç Tipi"
          />
          <StatCard
            icon={ShieldCheck}
            value={`%${avgFieldConf}`}
            label="Alan Güveni"
          />
        </div>
      </div>

      {/* ── Section 2 — Warnings ──────────────────────────────────────────── */}
      {draft.warnings.length > 0 && (
        <div className="space-y-3 rounded-[24px] border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
            <span className="text-sm font-black text-amber-400">Uyarılar</span>
          </div>

          {/* Warning list */}
          <ul className="space-y-1.5 pl-1">
            {draft.warnings.map((w: string, i: number) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-amber-300/80"
              >
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-400/60" />
                {w}
              </li>
            ))}
          </ul>

          {/* Review checkbox */}
          {reviewedForPublish !== undefined && onReviewedChange && (
            <label className="flex cursor-pointer items-start gap-3 border-t border-amber-500/15 pt-1">
              <input
                type="checkbox"
                checked={reviewedForPublish}
                onChange={(e) => onReviewedChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded accent-amber-400"
              />
              <span className="text-xs text-zinc-400">
                Uyarıları inceledim ve yayınlamayı onaylıyorum.
              </span>
            </label>
          )}
        </div>
      )}

      {/* ── Section 3 — Editable Fields ───────────────────────────────────── */}
      <div className="rounded-[24px] border border-white/5 bg-[#19202C] p-4 sm:p-5">
        <details
          open={detailsOpen}
          onToggle={(e) =>
            setDetailsOpen((e.target as HTMLDetailsElement).open)
          }
        >
          <summary className="flex list-none cursor-pointer select-none items-center justify-between gap-3">
            <span className="text-sm font-black text-zinc-200">
              İlan Detayları
            </span>
            <motion.div
              animate={{ rotate: detailsOpen ? 180 : 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
            >
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </motion.div>
          </summary>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {EDITABLE_FIELDS.map((key) => {
              const isDescription = key === "description";
              const isPrice = key === "price";
              const label = FIELD_LABELS[key] ?? String(key);
              const value = draft[key];

              return (
                <div
                  key={String(key)}
                  className={isDescription ? "sm:col-span-2" : ""}
                >
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {label}
                  </label>

                  {isDescription ? (
                    <textarea
                      value={String(value ?? "")}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      rows={4}
                      className={`${inputBase} min-h-24 resize-y`}
                    />
                  ) : (
                    <input
                      type={isPrice ? "number" : "text"}
                      value={isPrice ? Number(value) : String(value ?? "")}
                      onChange={(e) =>
                        handleFieldChange(
                          key,
                          isPrice ? Number(e.target.value) : e.target.value,
                        )
                      }
                      className={inputBase}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </details>
      </div>

      {/* ── Section 4 — Araç & Parça Info ─────────────────────────────────── */}
      <div className="rounded-[24px] border border-[#05D57F]/35 bg-[#19202C] p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-[#11F08E]" />
          <h3 className="text-2xl font-black text-[#11F08E]">Parça Bilgisi</h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Product + category */}
          <div className="rounded-xl border border-zinc-800 bg-[#0d1117] p-3">
            <p className="text-sm font-semibold text-zinc-200">
              {draft.product}
              {draft.partCategory ? ` (${draft.partCategory})` : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Ürün / Kategori</p>
          </div>

          {/* Category path */}
          <div className="rounded-xl border border-zinc-800 bg-[#0d1117] p-3">
            <p className="text-sm font-semibold leading-relaxed text-zinc-200">
              {draft.categoryPath.length > 0
                ? draft.categoryPath.join(" › ")
                : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Kategori Yolu</p>
          </div>
        </div>
      </div>

      {/* ── Section 5 — Source Hints ──────────────────────────────────────── */}
      {draft.sourceHints.length > 0 && (
        <div className="rounded-[24px] border border-sky-500/15 bg-sky-500/5 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-black text-sky-400">
              Kaynak Bilgileri
            </span>
          </div>
          <ul className="space-y-1.5 pl-1">
            {draft.sourceHints.map((hint: string, i: number) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-sky-300/70"
              >
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-sky-400/50" />
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Section 6 — Success / Error Feedback ──────────────────────────── */}
      <AnimatePresence mode="popLayout">
        {publishSuccess && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-start gap-3 rounded-[20px] border border-emerald-500/25 bg-emerald-500/10 p-4"
          >
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-300">
              İşlem başarıyla tamamlandı.
            </p>
          </motion.div>
        )}

        {error && !publishSuccess && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-start gap-3 rounded-[20px] border border-red-500/25 bg-red-500/10 p-4"
          >
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
            <p className="text-sm font-semibold text-red-300">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section 7 — Action Buttons ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Draft button */}
        <button
          onClick={onDraft}
          disabled={isPublishing}
          className="flex items-center justify-center gap-2 rounded-[18px] border border-zinc-700 bg-[#19202C] px-5 py-3.5 text-sm font-black text-zinc-200 transition-all hover:border-zinc-600 hover:bg-[#1e2733] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPublishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Taslak Doldur
        </button>

        {/* Publish button */}
        <button
          onClick={onPublish}
          disabled={isPublishing || !canPublish}
          className="flex items-center justify-center gap-2 rounded-[18px] bg-[#11F08E] px-5 py-3.5 text-sm font-black text-[#0d1117] transition-all hover:bg-[#0fd880] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPublishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          Sahibinden Yayınla
        </button>
      </div>

      {/* ── Section 8 — Reset ─────────────────────────────────────────────── */}
      <button
        onClick={onReset}
        disabled={isPublishing}
        className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-white/5 bg-[#19202C] px-5 py-3 text-sm font-semibold text-zinc-500 transition-all hover:border-white/10 hover:text-zinc-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" />
        Yeni Analiz Başlat
      </button>
    </div>
  );
}
