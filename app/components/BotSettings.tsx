"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Zap,
  Clock,
  RefreshCw,
  MapPin,
  Tag,
  FileText,
  ShieldCheck,
  Bell,
  Eye,
  ToggleLeft,
  ChevronDown,
  Save,
  RotateCcw,
  Package,
  Palette,
  HardDrive,
  Globe,
  Repeat,
  Star,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BotSettings } from "@/lib/settings";

// ── Varsayılan değerler (client-side için) ──────────────────────────────────
const DEFAULT: BotSettings = {
  speedMultiplier: 1,
  queueDelaySeconds: 5,
  maxRetries: 2,
  defaultPublishMode: "publish",
  autoStartQueue: false,
  defaultColor: "Beyaz",
  defaultStorage: "256 GB",
  defaultOrigin: "Yurt dışı",
  defaultWarranty: "Distribütör Garantili",
  defaultCondition: "Sıfır",
  defaultExchangeable: "Evet",
  defaultTown: "Maltepe",
  defaultQuarter: "",
  priceAdjustPercent: 0,
  descriptionSuffix: "",
  skipDopingModal: true,
  debugScreenshots: true,
  headless: false,
  notifyOnSuccess: true,
  notifyOnError: true,
};

// ── Yardımcı Bileşenler ─────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.025] overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#11F08E]/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-[#11F08E]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">{title}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-zinc-500 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/[0.04]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-1.5">
      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
        {label}
      </span>
      {hint && <p className="text-[10px] text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: string | number;
  onChange: (v: string) => void;
  options: { label: string; value: string | number }[];
}) {
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#11F08E]/50 transition-colors appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputField({
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
  step,
}: {
  label: string;
  hint?: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#11F08E]/50 transition-colors placeholder:text-zinc-600"
      />
    </div>
  );
}

function ToggleField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {hint && <p className="text-[10px] text-zinc-500 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200",
          value ? "bg-[#11F08E]" : "bg-zinc-700",
        )}
      >
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm",
            value ? "left-5" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

// Hız slider etiketi
const SPEED_LABELS: Record<number, { label: string; color: string; desc: string }> = {
  0.5: { label: "Çok Hızlı", color: "text-red-400", desc: "Tespit riski yüksek" },
  0.75: { label: "Hızlı", color: "text-orange-400", desc: "Hafif riskli" },
  1: { label: "Normal", color: "text-[#11F08E]", desc: "Önerilen" },
  1.5: { label: "Yavaş", color: "text-blue-400", desc: "Güvenli" },
  2: { label: "Çok Yavaş", color: "text-purple-400", desc: "Maksimum güvenlik" },
};

// ── Ana Bileşen ─────────────────────────────────────────────────────────────
export function BotSettings() {
  const [settings, setSettings] = useState<BotSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedSettings, setSavedSettings] = useState<BotSettings>(DEFAULT);

  // Ayarları yükle
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.ok) {
          setSettings(data.settings);
          setSavedSettings(data.settings);
        }
      } catch {
        toast.error("Ayarlar yüklenemedi");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Değişiklik takibi
  useEffect(() => {
    setHasChanges(JSON.stringify(settings) !== JSON.stringify(savedSettings));
  }, [settings, savedSettings]);

  const patch = useCallback(<K extends keyof BotSettings>(key: K, val: BotSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.ok) {
        setSavedSettings(data.settings);
        setSettings(data.settings);
        setHasChanges(false);
        toast.success("Ayarlar kaydedildi");
      } else {
        toast.error("Kayıt hatası: " + data.error);
      }
    } catch {
      toast.error("Sunucu bağlantı hatası");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT);
    toast.info("Varsayılan değerlere sıfırlandı — kaydetmeyi unutma");
  };

  const speedInfo = SPEED_LABELS[settings.speedMultiplier] ?? SPEED_LABELS[1];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#11F08E] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-32">

      {/* ── Başlık ── */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-black text-white tracking-tight">Bot Ayarları</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Yayınlama davranışını özelleştir</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Sıfırla
          </button>
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all",
              hasChanges
                ? "bg-[#11F08E] text-[#0d1117] shadow-[0_4px_20px_rgba(17,240,142,0.3)]"
                : "bg-white/5 text-zinc-500 cursor-not-allowed",
            )}
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </motion.button>
        </div>
      </div>

      {/* ── Hız & Zamanlama ── */}
      <SectionCard
        icon={Zap}
        title="Hız & Zamanlama"
        subtitle="Bot yanıt hızı ve beklemeler"
        defaultOpen
      >
        {/* Hız Slider — tam genişlik */}
        <div className="sm:col-span-2">
          <FieldLabel
            label="Bot Yanıt Hızı"
            hint="Tüm bekleme sürelerini etkiler — düşük değer = hızlı ama riskli"
          />
          <div className="mt-3 px-1">
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.25}
              value={settings.speedMultiplier}
              onChange={(e) => patch("speedMultiplier", parseFloat(e.target.value))}
              className="w-full accent-[#11F08E] cursor-pointer"
            />
            <div className="flex justify-between mt-1">
              {Object.entries(SPEED_LABELS).map(([k, v]) => (
                <span
                  key={k}
                  className={cn(
                    "text-[10px] font-bold transition-colors",
                    settings.speedMultiplier === parseFloat(k) ? v.color : "text-zinc-600",
                  )}
                >
                  {parseFloat(k) === 0.5 ? "0.5×" :
                   parseFloat(k) === 0.75 ? "0.75×" :
                   parseFloat(k) === 1 ? "1×" :
                   parseFloat(k) === 1.5 ? "1.5×" : "2×"}
                </span>
              ))}
            </div>
          </div>
          {/* Seçili hız badge */}
          <div className={cn(
            "mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border",
            settings.speedMultiplier <= 0.75
              ? "border-red-500/20 bg-red-500/5"
              : settings.speedMultiplier === 1
              ? "border-[#11F08E]/20 bg-[#11F08E]/5"
              : "border-blue-500/20 bg-blue-500/5",
          )}>
            {settings.speedMultiplier <= 0.75 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#11F08E] flex-shrink-0" />
            )}
            <span className={cn("text-xs font-bold", speedInfo.color)}>{speedInfo.label}</span>
            <span className="text-xs text-zinc-500">— {speedInfo.desc}</span>
            <span className="ml-auto text-xs font-mono text-zinc-400">{settings.speedMultiplier}×</span>
          </div>
        </div>

        <SelectField
          label="İlanlar Arası Bekleme"
          hint="Kuyruktaki her ilan arasındaki bekleme"
          value={settings.queueDelaySeconds}
          onChange={(v) => patch("queueDelaySeconds", parseInt(v))}
          options={[
            { label: "2 saniye", value: 2 },
            { label: "5 saniye", value: 5 },
            { label: "10 saniye", value: 10 },
            { label: "15 saniye", value: 15 },
            { label: "30 saniye", value: 30 },
            { label: "60 saniye", value: 60 },
          ]}
        />

        <SelectField
          label="Maks. Yeniden Deneme"
          hint="Hata durumunda kaç kez tekrar denesin"
          value={settings.maxRetries}
          onChange={(v) => patch("maxRetries", parseInt(v))}
          options={[
            { label: "0 — Deneme", value: 0 },
            { label: "1 — Bir Kez", value: 1 },
            { label: "2 — İki Kez", value: 2 },
            { label: "3 — Üç Kez", value: 3 },
          ]}
        />
      </SectionCard>

      {/* ── Yayın ── */}
      <SectionCard
        icon={Star}
        title="Yayın Ayarları"
        subtitle="Kuyruk çalışma modu ve varsayılan yayın tipi"
      >
        <SelectField
          label="Varsayılan Yayın Modu"
          hint="Kuyruk başlatıldığında kullanılacak mod"
          value={settings.defaultPublishMode}
          onChange={(v) => patch("defaultPublishMode", v as "draft" | "publish")}
          options={[
            { label: "Yayınla (Aktif)", value: "publish" },
            { label: "Taslak Olarak Kaydet", value: "draft" },
          ]}
        />

        <div className="flex flex-col gap-3 sm:col-span-1">
          <ToggleField
            label="Otomatik Kuyruk Başlat"
            hint="İlan eklenince kuyruk otomatik çalışsın"
            value={settings.autoStartQueue}
            onChange={(v) => patch("autoStartQueue", v)}
          />
        </div>
      </SectionCard>

      {/* ── Ürün Özellikleri ── */}
      <SectionCard
        icon={Package}
        title="Ürün Özellikleri Varsayılanları"
        subtitle="urun-ozellikleri adımında kullanılacak değerler"
      >
        <SelectField
          label="Varsayılan Renk"
          value={settings.defaultColor}
          onChange={(v) => patch("defaultColor", v)}
          options={[
            "Beyaz", "Siyah", "Gümüş", "Lacivert", "Turuncu",
            "Mavi", "Kırmızı", "Yeşil", "Mor", "Sarı", "Pembe", "Gri",
          ].map((c) => ({ label: c, value: c }))}
        />

        <SelectField
          label="Depolama Kapasitesi"
          value={settings.defaultStorage}
          onChange={(v) => patch("defaultStorage", v)}
          options={["128 GB", "256 GB", "512 GB", "1 TB", "2 TB"].map((s) => ({
            label: s,
            value: s,
          }))}
        />

        <SelectField
          label="Alındığı Yer"
          value={settings.defaultOrigin}
          onChange={(v) => patch("defaultOrigin", v)}
          options={[
            { label: "Yurt dışı", value: "Yurt dışı" },
            { label: "Yurt içi", value: "Yurt içi" },
          ]}
        />

        <SelectField
          label="Garanti Tipi"
          value={settings.defaultWarranty}
          onChange={(v) => patch("defaultWarranty", v)}
          options={[
            { label: "Distribütör Garantili", value: "Distribütör Garantili" },
            { label: "İthalatçı Garantili", value: "İthalatçı Garantili" },
            { label: "Garantisi Yok", value: "Garantisi Yok" },
          ]}
        />

        <SelectField
          label="Ürün Durumu"
          value={settings.defaultCondition}
          onChange={(v) => patch("defaultCondition", v)}
          options={[
            { label: "Sıfır", value: "Sıfır" },
            { label: "İkinci El", value: "İkinci El" },
          ]}
        />

        <SelectField
          label="Takaslı"
          value={settings.defaultExchangeable}
          onChange={(v) => patch("defaultExchangeable", v)}
          options={[
            { label: "Evet", value: "Evet" },
            { label: "Hayır", value: "Hayır" },
          ]}
        />
      </SectionCard>

      {/* ── Konum ── */}
      <SectionCard
        icon={MapPin}
        title="Konum Ayarları"
        subtitle="İlan için varsayılan lokasyon bilgileri"
      >
        <InputField
          label="Varsayılan İlçe"
          hint="Boş bırakırsan mevcut hesap konumu kullanılır"
          value={settings.defaultTown}
          onChange={(v) => patch("defaultTown", v)}
          placeholder="Maltepe"
        />

        <InputField
          label="Varsayılan Mahalle"
          hint="Boş bırakırsan listeden rastgele seçilir"
          value={settings.defaultQuarter}
          onChange={(v) => patch("defaultQuarter", v)}
          placeholder="Boş = Rastgele"
        />
      </SectionCard>

      {/* ── Fiyat & Açıklama ── */}
      <SectionCard
        icon={Tag}
        title="Fiyat & Açıklama"
        subtitle="Fiyat düzeltmesi ve açıklama eki"
      >
        <div className="sm:col-span-2">
          <FieldLabel
            label="Fiyat Düzeltme Yüzdesi"
            hint="İlan fiyatına otomatik eklenecek/çıkarılacak yüzde. 0 = değişiklik yok"
          />
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={-20}
              max={20}
              step={1}
              value={settings.priceAdjustPercent}
              onChange={(e) => patch("priceAdjustPercent", parseInt(e.target.value))}
              className="flex-1 accent-[#11F08E] cursor-pointer"
            />
            <div
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-black font-mono min-w-[60px] text-center",
                settings.priceAdjustPercent > 0
                  ? "bg-green-500/10 text-green-400"
                  : settings.priceAdjustPercent < 0
                  ? "bg-red-500/10 text-red-400"
                  : "bg-white/5 text-zinc-400",
              )}
            >
              {settings.priceAdjustPercent > 0 ? "+" : ""}
              {settings.priceAdjustPercent}%
            </div>
          </div>
          {settings.priceAdjustPercent !== 0 && (
            <p className="text-[10px] text-zinc-500 mt-1">
              Örnek: 50.000 TL →{" "}
              <span className="text-white font-bold">
                {Math.round(50000 * (1 + settings.priceAdjustPercent / 100)).toLocaleString("tr-TR")} TL
              </span>
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <FieldLabel
            label="Açıklama Eki"
            hint="Her ilanın açıklamasının sonuna otomatik eklenir"
          />
          <textarea
            value={settings.descriptionSuffix}
            onChange={(e) => patch("descriptionSuffix", e.target.value)}
            placeholder="Örn: Kapıda ödeme ve kargo seçeneği mevcuttur."
            rows={2}
            className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#11F08E]/50 transition-colors placeholder:text-zinc-600 resize-none"
          />
        </div>
      </SectionCard>

      {/* ── Davranış ── */}
      <SectionCard
        icon={Settings}
        title="Davranış Ayarları"
        subtitle="Bot'un genel çalışma biçimi"
      >
        <div className="sm:col-span-2 space-y-1 divide-y divide-white/[0.04]">
          <div className="pb-3">
            <ToggleField
              label="Doping Modalını Otomatik Kapat"
              hint="Sahibinden doping teklifini otomatik geç"
              value={settings.skipDopingModal}
              onChange={(v) => patch("skipDopingModal", v)}
            />
          </div>
          <div className="py-3">
            <ToggleField
              label="Hata Ekran Görüntüsü"
              hint="Hata olduğunda debug için ekran görüntüsü al"
              value={settings.debugScreenshots}
              onChange={(v) => patch("debugScreenshots", v)}
            />
          </div>
          <div className="pt-3">
            <ToggleField
              label="Headless Mod"
              hint="Tarayıcı penceresi görünmeden çalışsın (gelişmiş)"
              value={settings.headless}
              onChange={(v) => patch("headless", v)}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Bildirimler ── */}
      <SectionCard
        icon={Bell}
        title="Bildirimler"
        subtitle="Başarı ve hata bildirimleri"
        defaultOpen={false}
      >
        <div className="sm:col-span-2 space-y-1 divide-y divide-white/[0.04]">
          <div className="pb-3">
            <ToggleField
              label="Başarı Bildirimi"
              hint="İlan başarıyla yayınlandığında bildirim göster"
              value={settings.notifyOnSuccess}
              onChange={(v) => patch("notifyOnSuccess", v)}
            />
          </div>
          <div className="pt-3">
            <ToggleField
              label="Hata Bildirimi"
              hint="Hata oluştuğunda bildirim göster"
              value={settings.notifyOnError}
              onChange={(v) => patch("notifyOnError", v)}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Değişiklikler Kaydedilmedi Uyarısı ── */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-24 left-4 right-4 max-w-xl mx-auto z-30"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-amber-300">
                  Kaydedilmemiş değişiklikler var
                </span>
              </div>
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={saving}
                whileTap={{ scale: 0.96 }}
                className="px-3 py-1.5 rounded-xl bg-[#11F08E] text-[#0d1117] text-xs font-black flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Kaydet
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
