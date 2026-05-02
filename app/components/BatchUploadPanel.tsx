"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit3,
  Layers,
  Loader2,
  RefreshCw,
  Upload,
  X,
  XCircle,
} from "lucide-react";

import type { ListingDraft } from "@/lib/types";
import { SAHIBINDEN_ROOT_PATH } from "@/lib/catalog";

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_FILES = 20;

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
  "color",
  "storage",
  "origin",
  "warranty",
  "exchangeable",
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
  color: "Renk",
  storage: "Kapasite",
  origin: "Alındığı Yer",
  warranty: "Garanti",
  exchangeable: "Takaslı",
};

const INPUT_BASE =
  "w-full rounded-xl border border-zinc-800 bg-[#0d1117] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#11F08E]/50 transition-colors";
  
const PHONE_OPTIONS = {
  color: ["Siyah", "Beyaz", "Altın", "Gümüş", "Mor", "Mavi", "Yeşil", "Kırmızı"],
  storage: ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"],
  origin: ["Yurt içi", "Yurt dışı"],
  warranty: ["Distribütör Garantili", "İthalatçı Garantili", "Garantisi Yok"],
  exchangeable: ["Evet", "Hayır"],
};

// ─── Internal types ─────────────────────────────────────────────────────────────

type ItemStatus =
  | "idle"
  | "analyzing"
  | "ready"
  | "publishing"
  | "done"
  | "error";

interface BatchItem {
  id: string;
  file: File;
  preview: string;
  draft: ListingDraft | null;
  status: ItemStatus;
  error: string | null;
  selected: boolean;
  approved: boolean;
}

type Phase = "upload" | "analyzing" | "review" | "publishing" | "done";

// ─── Public API ─────────────────────────────────────────────────────────────────

export interface BatchUploadPanelProps {
  autoPublish: boolean;
  onBatchComplete?: (stats: { done: number; errors: number }) => void;
}

// ─── Tiny helpers ───────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function calcAvgConfidence(draft: ListingDraft): number {
  if (draft.fieldConfidence) {
    const vals = Object.values(draft.fieldConfidence) as number[];
    if (vals.length)
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
  }
  return Math.round(draft.confidence * 100);
}

// ─── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ItemStatus }) {
  if (status === "idle")
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
        Sırada
      </span>
    );

  if (status === "analyzing")
    return (
      <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-[#11F08E]/10 px-2.5 py-0.5 text-xs font-medium text-[#11F08E]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analiz Ediliyor…
      </span>
    );

  if (status === "ready")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#11F08E]/15 px-2.5 py-0.5 text-xs font-medium text-[#11F08E]">
        <Check className="h-3 w-3" />
        Hazır
      </span>
    );

  if (status === "publishing")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Yayınlanıyor…
      </span>
    );

  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#11F08E]/15 px-2.5 py-0.5 text-xs font-medium text-[#11F08E]">
        <CheckCircle2 className="h-3 w-3" />
        Yayınlandı
      </span>
    );

  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
        <XCircle className="h-3 w-3" />
        Hata
      </span>
    );

  return null;
}

// ─── ProgressBar ────────────────────────────────────────────────────────────────

function ProgressBar({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-400">{label}</span>
        <span className="font-bold tabular-nums text-[#11F08E]">
          {current} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className="h-full rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #0acd7a 0%, #11F08E 50%, #0acd7a 100%)",
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─── EditAnalysisModal ─────────────────────────────────────────────────────────

interface EditAnalysisModalProps {
  item: BatchItem | null;
  onClose: () => void;
  onUpdateField: (
    key: keyof ListingDraft,
    value: ListingDraft[keyof ListingDraft],
  ) => void;
}

function EditAnalysisModal({
  item,
  onClose,
  onUpdateField,
}: EditAnalysisModalProps) {
  const draft = item?.draft;

  if (!item || !draft) return null;

  function handleChange(key: keyof ListingDraft, raw: string) {
    if (key === "price") {
      onUpdateField(key, parseFloat(raw) || 0);
      return;
    }
    onUpdateField(key, raw as unknown as ListingDraft[keyof ListingDraft]);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-edit-title"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#11F08E]">
                Analiz Verisini Duzenle
              </p>
              <h2
                id="batch-edit-title"
                className="mt-1 truncate text-lg font-black text-zinc-100"
              >
                {draft.name || item.file.name}
              </h2>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {item.file.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:border-white/15 hover:bg-white/10 hover:text-zinc-200"
              aria-label="Modalı kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-5 overflow-y-auto p-5 sm:grid-cols-[240px,minmax(0,1fr)] sm:p-6">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#111827]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt={item.file.name}
                  className="h-56 w-full object-cover"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 sm:[grid-template-columns:repeat(2,minmax(0,1fr))]">
                <div className="rounded-2xl border border-[#11F08E]/15 bg-[#11F08E]/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Analiz Guveni
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#11F08E]">
                    %{calcAvgConfidence(draft)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-[#111827] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Kategori Yolu
                  </p>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-200">
                    {draft.categoryPath.length > 0
                      ? draft.categoryPath.join(" › ")
                      : "—"}
                  </p>
                </div>
              </div>

              {draft.warnings.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-yellow-500/15 bg-yellow-500/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-yellow-300/80">
                    Uyarilar
                  </p>
                  {draft.warnings.map((warning, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-400" />
                      <p className="text-xs text-yellow-100/80">{warning}</p>
                    </div>
                  ))}
                </div>
              )}

              {draft.sourceHints.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-sky-500/15 bg-sky-500/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300/80">
                    Kaynak Bilgileri
                  </p>
                  {draft.sourceHints.map((hint, index) => (
                    <p key={index} className="text-xs text-sky-100/75">
                      {hint}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {EDITABLE_FIELDS.filter(field => {
                  // Sadece akıllı telefon alanlarını göster, yedek parça alanlarını gizle
                  return !["series", "vehicleType", "partCategory"].includes(field);
                }).map((field) => {
                  const isDesc = field === "description";
                  const label = FIELD_LABELS[field] ?? String(field);
                  const rawVal = draft[field];
                  const strVal =
                    rawVal !== undefined && rawVal !== null
                      ? String(rawVal)
                      : "";

                  return (
                    <div
                      key={field}
                      className={isDesc ? "sm:col-span-2" : "sm:col-span-1"}
                    >
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        {label}
                      </label>
                      {isDesc ? (
                        <textarea
                          value={strVal}
                          rows={6}
                          onChange={(e) => handleChange(field, e.target.value)}
                          className={`${INPUT_BASE} min-h-32 resize-y`}
                        />
                      ) : field in PHONE_OPTIONS ? (
                        <select
                          value={strVal}
                          onChange={(e) => handleChange(field, e.target.value)}
                          className={INPUT_BASE}
                        >
                          <option value="">Seçiniz</option>
                          {PHONE_OPTIONS[field as keyof typeof PHONE_OPTIONS].map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field === "price" ? "number" : "text"}
                          value={strVal}
                          onChange={(e) => handleChange(field, e.target.value)}
                          className={INPUT_BASE}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="rounded-2xl bg-[#11F08E] px-5 py-3 text-sm font-black text-[#0d1117] transition-all hover:brightness-110"
                >
                  Kaydet ve Kapat
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── ReviewTable ───────────────────────────────────────────────────────────────

interface ReviewTableProps {
  items: BatchItem[];
  onToggleSelect: (id: string) => void;
  onToggleApprove: (id: string) => void;
  onEdit: (id: string) => void;
  showStatusColumn?: boolean;
}

function ReviewTable({
  items,
  onToggleSelect,
  onToggleApprove,
  onEdit,
  showStatusColumn = false,
}: ReviewTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#111827]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="border-b border-white/5 bg-black/10 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            <tr>
              <th className="px-4 py-3">Sec</th>
              <th className="px-4 py-3">Urun</th>
              <th className="px-4 py-3">Marka / Model</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Fiyat</th>
              <th className="px-4 py-3">Guven / Uyari</th>
              <th className="px-4 py-3">Onay</th>
              {showStatusColumn && <th className="px-4 py-3">Durum</th>}
              <th className="px-4 py-3 text-right">Aksiyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item) => {
              const draft = item.draft;
              const confPct = draft ? calcAvgConfidence(draft) : 0;
              const isReady = item.status === "ready";
              const isDone = item.status === "done";
              const isReviewable = isReady && !!draft;
              return (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-[#11F08E]"
                      checked={item.selected}
                      disabled={!isReviewable}
                      onChange={() => onToggleSelect(item.id)}
                      aria-label={`${draft?.name ?? item.file.name} sec`}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-[220px] items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-xl bg-zinc-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.preview}
                          alt={item.file.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">
                          {draft?.name ?? item.file.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {draft?.productType || item.file.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="min-w-[160px]">
                      <p className="text-sm font-medium text-zinc-200">
                        {[draft?.brand, draft?.model].filter(Boolean).join(" ")}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {[draft?.color, draft?.storage, draft?.origin].filter(Boolean).join(" • ") || "Özellik bilgisi yok"}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="text-sm text-zinc-200">
                        {draft?.partCategory || "—"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {[draft?.category, draft?.vehicleType]
                          .filter(Boolean)
                          .join(" / ") || "Kategori bilgisi yok"}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-zinc-100">
                    {draft ? `₺${draft.price.toLocaleString("tr-TR")}` : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-[140px] flex-col gap-2">
                      {draft ? (
                        <span
                          className={[
                            "inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold",
                            confPct >= 80
                              ? "bg-[#11F08E]/15 text-[#11F08E]"
                              : confPct >= 60
                                ? "bg-yellow-500/15 text-yellow-400"
                                : "bg-red-500/15 text-red-400",
                          ].join(" ")}
                        >
                          %{confPct} guven
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">Veri yok</span>
                      )}
                      {draft && draft.warnings.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {draft.warnings.length} uyari
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">Uyari yok</span>
                      )}
                      {item.status === "error" && item.error && (
                        <span className="text-xs text-red-400">{item.error}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {isDone ? (
                      <span className="inline-flex rounded-full bg-[#11F08E]/15 px-2.5 py-1 text-xs font-semibold text-[#11F08E]">
                        Yayinda
                      </span>
                    ) : isReviewable ? (
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded accent-[#11F08E]"
                          checked={item.approved}
                          onChange={() => onToggleApprove(item.id)}
                        />
                        Onaylandi
                      </label>
                    ) : (
                      <span className="text-xs text-zinc-500">Bekleniyor</span>
                    )}
                  </td>
                  {showStatusColumn && (
                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <div className="flex justify-end">
                      {draft ? (
                        <button
                          onClick={() => onEdit(item.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-white/15 hover:bg-white/[0.06]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Duzenle
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── BatchUploadPanel ────────────────────────────────────────────────────────────

export function BatchUploadPanel({
  autoPublish,
  onBatchComplete,
}: BatchUploadPanelProps) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [publishTotal, setPublishTotal] = useState(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File management ──────────────────────────────────────────────────────────

  function addFiles(list: FileList | File[]) {
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setItems((prev) => {
      const slots = MAX_FILES - prev.length;
      if (slots <= 0) return prev;
      return [
        ...prev,
        ...images.slice(0, slots).map(
          (file): BatchItem => ({
            id: makeId(),
            file,
            preview: URL.createObjectURL(file),
            draft: null,
            status: "idle",
            error: null,
            selected: true,
            approved: false,
          }),
        ),
      ];
    });
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const found = prev.find((it) => it.id === id);
      if (found) URL.revokeObjectURL(found.preview);
      return prev.filter((it) => it.id !== id);
    });
  }

  function reset() {
    setItems((prev) => {
      prev.forEach((it) => URL.revokeObjectURL(it.preview));
      return [];
    });
    setPhase("upload");
    setPublishTotal(0);
    setDragActive(false);
    setEditingItemId(null);
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }

  // ── Publish loop ─────────────────────────────────────────────────────────────

  async function publishAll(snapshot: BatchItem[]) {
    const toPublish = snapshot.filter(
      (it) =>
        it.status === "ready" &&
        it.selected &&
        it.draft &&
        (autoPublish || it.approved),
    );

    // Nothing to publish — jump straight to done
    if (toPublish.length === 0) {
      setPhase("done");
      onBatchComplete?.({ done: 0, errors: 0 });
      return;
    }

    setPhase("publishing");
    setPublishTotal(toPublish.length);

    let doneCount = 0;
    let errorCount = 0;

    for (const item of toPublish) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "publishing" } : it,
        ),
      );

      try {
        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "publish",
            draft: item.draft,
            reviewedForPublish: true,
          }),
        });
        const data: { ok: boolean; error?: string; logs?: string[] } =
          await res.json();

        if (data.ok) {
          doneCount++;
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, status: "done" } : it,
            ),
          );
        } else {
          errorCount++;
          const msg = data.error ?? "Yayın başarısız";
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, status: "error", error: msg } : it,
            ),
          );
        }
      } catch (err) {
        errorCount++;
        const msg = err instanceof Error ? err.message : "Ağ hatası";
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "error", error: msg } : it,
          ),
        );
      }
    }

    setPhase("done");
    onBatchComplete?.({ done: doneCount, errors: errorCount });
  }

  // ── Analyze loop ─────────────────────────────────────────────────────────────

  async function analyzeAll(snapshot: BatchItem[]) {
    setPhase("analyzing");

    // local mirror kept in sync with setItems so we can pass correct data to
    // publishAll without waiting for React state to flush
    let current = snapshot.map((it) => ({ ...it }));

    for (let i = 0; i < snapshot.length; i++) {
      const item = snapshot[i];

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "analyzing" } : it,
        ),
      );

      try {
        const fd = new FormData();
        fd.append("image", item.file);
        const res = await fetch("/api/analyze", { method: "POST", body: fd });
        const data: { ok: boolean; draft?: ListingDraft; error?: string } =
          await res.json();

        if (data.ok && data.draft) {
          const draft = data.draft;
          current = current.map((it) =>
            it.id === item.id ? { ...it, status: "ready", draft } : it,
          );
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, status: "ready", draft } : it,
            ),
          );
        } else {
          const msg = data.error ?? "Analiz başarısız";
          current = current.map((it) =>
            it.id === item.id ? { ...it, status: "error", error: msg } : it,
          );
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, status: "error", error: msg } : it,
            ),
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ağ hatası";
        current = current.map((it) =>
          it.id === item.id ? { ...it, status: "error", error: msg } : it,
        );
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "error", error: msg } : it,
          ),
        );
      }
    }

    if (autoPublish) {
      await publishAll(current);
    } else {
      setPhase("review");
    }
  }

  // ── Draft field editing ──────────────────────────────────────────────────────

  function updateDraftField(
    itemId: string,
    key: keyof ListingDraft,
    value: ListingDraft[keyof ListingDraft],
  ) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId || !it.draft) return it;
        const next: ListingDraft = { ...it.draft, [key]: value };
        if (
          key === "category" ||
          key === "vehicleType" ||
          key === "partCategory"
        ) {
          next.categoryPath = [
            ...SAHIBINDEN_ROOT_PATH,
            next.category,
            next.vehicleType,
            next.partCategory,
          ];
        }
        return { ...it, draft: next };
      }),
    );
  }

  function toggleSelected(id: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  }

  function toggleApproved(id: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, approved: !it.approved } : it)),
    );
  }

  function selectAll(value: boolean) {
    setItems((prev) =>
      prev.map((it) =>
        it.status === "ready" ? { ...it, selected: value } : it,
      ),
    );
  }

  function approveAll(value: boolean) {
    setItems((prev) =>
      prev.map((it) =>
        it.status === "ready" ? { ...it, approved: value } : it,
      ),
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const analyzedCount = items.filter(
    (it) => it.status !== "idle" && it.status !== "analyzing",
  ).length;

  const readyItems = items.filter((it) => it.status === "ready");
  const errorItems = items.filter((it) => it.status === "error");
  const selectedReadyItems = items.filter(
    (it) => it.status === "ready" && it.selected,
  );
  const publishableItems = items.filter(
    (it) => it.status === "ready" && it.selected && it.approved,
  );
  const publishedCount = items.filter((it) => it.status === "done").length;
  const publishedItems = items.filter((it) => it.status === "done" && it.draft);
  const editingItem =
    items.find((item) => item.id === editingItemId && item.draft) ?? null;

  // ── Phase transition variants ────────────────────────────────────────────────

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      <EditAnalysisModal
        item={editingItem}
        onClose={() => setEditingItemId(null)}
        onUpdateField={(key, value) => {
          if (!editingItemId) return;
          updateDraftField(editingItemId, key, value);
        }}
      />

      <AnimatePresence mode="wait">
        {/* ════════════════════════════════════════════════════════ UPLOAD ═══ */}
        {phase === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="space-y-4"
          >
            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={[
                "flex min-h-[200px] cursor-pointer select-none flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed p-8 transition-all duration-200",
                dragActive
                  ? "border-[#11F08E] bg-[#11F08E]/5"
                  : "border-zinc-800 hover:border-zinc-600 hover:bg-white/[0.015]",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition-all duration-200",
                  dragActive
                    ? "border-[#11F08E]/50 bg-[#11F08E]/10"
                    : "border-zinc-700 bg-zinc-800/80",
                ].join(" ")}
              >
                <Upload
                  className={`h-6 w-6 transition-colors duration-200 ${
                    dragActive ? "text-[#11F08E]" : "text-zinc-400"
                  }`}
                />
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-200">
                  Görsel Seç{" "}
                  <span className="text-[#11F08E]">(max {MAX_FILES})</span>
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">(JPG, PNG, WEBP)</p>
              </div>

              {items.length > 0 && (
                <span className="rounded-full bg-[#11F08E]/15 px-3 py-1 text-xs font-bold text-[#11F08E]">
                  {items.length} görsel seçildi
                </span>
              )}
            </div>

            {/* Hidden file input — also hidden globally via globals.css */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  addFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />

            {/* Selected file list */}
            {items.length > 0 && (
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: i * 0.03 }}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#111827] p-2"
                  >
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                      {item.file.name}
                    </p>
                    <span className="flex-shrink-0 text-xs text-zinc-600">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* CTA */}
            <button
              disabled={items.length === 0}
              onClick={() => analyzeAll(items)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#11F08E] py-3.5 text-sm font-bold text-[#0d1117] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Layers className="h-4 w-4" />
              Analiz Et ({items.length} Görsel)
            </button>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════ ANALYZING ═══ */}
        {phase === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-white/5 bg-[#111827] p-4">
              <ProgressBar
                current={analyzedCount}
                total={items.length}
                label="analiz edildi"
              />
            </div>

            <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.04 }}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#111827] p-2"
                >
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                    {item.file.name}
                  </p>
                  <StatusBadge status={item.status} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════ REVIEW ═══ */}
        {phase === "review" && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="space-y-4"
          >
            {/* Sticky summary bar */}
            <div className="sticky top-0 z-10 rounded-2xl border border-white/5 bg-[#111827]/95 px-4 py-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                  <span className="text-[#11F08E]">
                    {readyItems.length} hazır
                  </span>
                  {errorItems.length > 0 && (
                    <span className="text-red-400">
                      {errorItems.length} hata
                    </span>
                  )}
                  <span className="text-zinc-400">
                    {selectedReadyItems.length} seçildi
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => selectAll(true)}
                    className="rounded-lg px-2.5 py-1 font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
                  >
                    Tümünü Seç
                  </button>
                  <span className="text-zinc-700">·</span>
                  <button
                    onClick={() => selectAll(false)}
                    className="rounded-lg px-2.5 py-1 font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
                  >
                    Seçimi Kaldır
                  </button>
                  <span className="text-zinc-700">·</span>
                  <button
                    onClick={() => approveAll(true)}
                    className="rounded-lg px-2.5 py-1 font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
                  >
                    Tümünü Onayla
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[520px] overflow-y-auto pr-1">
              <ReviewTable
                items={items}
                onToggleSelect={toggleSelected}
                onToggleApprove={toggleApproved}
                onEdit={setEditingItemId}
              />
            </div>

            {/* Sticky CTA */}
            <div className="sticky bottom-0 pt-1">
              <button
                disabled={publishableItems.length === 0}
                onClick={() => publishAll(items)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#11F08E] py-3.5 text-sm font-bold text-[#0d1117] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCircle2 className="h-4 w-4" />
                Onaylananlari Yayınla ({publishableItems.length})
              </button>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════ PUBLISHING ═══ */}
        {phase === "publishing" && (
          <motion.div
            key="publishing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-white/5 bg-[#111827] p-4">
              <ProgressBar
                current={publishedCount}
                total={publishTotal || 1}
                label="yayınlandı"
              />
            </div>

            <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.04 }}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#111827] p-2"
                >
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-300">
                      {item.draft?.name ?? item.file.name}
                    </p>
                    {item.status === "error" && item.error && (
                      <p className="truncate text-xs text-red-400">
                        {item.error}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={item.status} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════ DONE ═══ */}
        {phase === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="space-y-4"
          >
            {/* Summary card */}
            <div className="flex flex-col items-center gap-6 rounded-[24px] border border-[#11F08E]/20 bg-[#111827] px-6 py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#11F08E]/40 bg-[#11F08E]/10">
                <CheckCircle2 className="h-8 w-8 text-[#11F08E]" />
              </div>

              <div className="text-center">
                <p className="text-3xl font-black text-zinc-100">
                  {publishedCount}
                </p>
                <p className="mt-1 text-base font-semibold text-zinc-400">
                  ilan yayınlandı
                </p>
                {errorItems.length > 0 && (
                  <p className="mt-2 text-sm text-red-400">
                    {errorItems.length} hata oluştu
                  </p>
                )}
              </div>
            </div>

            {autoPublish && publishedItems.length > 0 && (
              <div className="space-y-3">
                <div className="px-1">
                  <p className="text-sm font-black uppercase tracking-widest text-zinc-300">
                    Yayınlanan Analiz Verileri
                  </p>
                </div>
                <ReviewTable
                  items={publishedItems}
                  domain={domain}
                  onToggleSelect={() => undefined}
                  onToggleApprove={() => undefined}
                  onEdit={setEditingItemId}
                  showStatusColumn
                />
              </div>
            )}

            {/* Error breakdown */}
            {errorItems.length > 0 && (
              <div className="w-full space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Hatalar
                </p>
                {errorItems.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-start gap-2 rounded-xl border border-red-500/15 bg-red-500/5 px-3 py-2"
                  >
                    <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-zinc-300">
                        {it.draft?.name ?? it.file.name}
                      </p>
                      {it.error && (
                        <p className="text-xs text-red-400">{it.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reset */}
            <button
              onClick={reset}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800/60 py-3.5 text-sm font-semibold text-zinc-200 transition-all hover:border-zinc-500 hover:bg-zinc-800"
            >
              <RefreshCw className="h-4 w-4" />
              Yeni Toplu Yükleme
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
