"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  AnimatePresence,
  motion,
  useAnimation,
  useMotionValue,
  useTransform,
  PanInfo,
} from "framer-motion";
import Lottie from "lottie-react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  ImageIcon,
  Info,
  Lightbulb,
  Loader2,
  LogIn,
  RotateCcw,
  ScanLine,
  Upload,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  X,
  ZoomIn,
  Zap,
  History,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import { SAHIBINDEN_ROOT_PATH } from "@/lib/catalog";
import type { ListingDraft } from "@/lib/types";
import { scanLottie } from "./lottie";

import Logo from "./components/Logo";
import Stepper from "./components/Stepper";
import Navigation from "./components/Navigation";
import type { NavTab } from "./components/Navigation";
import SplashScreen from "./components/SplashScreen";
import { ListingPreview } from "./components/ListingPreview";
import { BatchUploadPanel } from "./components/BatchUploadPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalyzeResponse = {
  ok: boolean;
  error?: string;
  draft?: ListingDraft;
  lensRaw?: unknown;
};

type PublishResponse = {
  ok: boolean;
  error?: string;
  logs?: string[];
};

type BrowserSessionResponse = {
  ok: boolean;
  error?: string;
  executablePath?: string;
  userDataDir?: string;
  targetUrl?: string;
};

type BrowserStatus = "logged-in" | "logged-out" | "browser-closed" | "unknown";

type BrowserStatusResponse = {
  ok: boolean;
  status: BrowserStatus;
  browserRunning: boolean;
  currentUrl?: string;
  message: string;
  logs: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "upload", label: "Görsel", icon: Upload },
  { id: "analyze", label: "Analiz", icon: ScanLine },
  { id: "publish", label: "Yayın", icon: Globe },
] as const;

const ANALYSIS_STAGES = [
  { at: 0, value: 5, label: "Bağlantı kuruluyor…" },
  { at: 600, value: 18, label: "Görsel yükleniyor…" },
  { at: 1800, value: 38, label: "Google Lens taranıyor…" },
  { at: 4000, value: 62, label: "Lens sonuçları işleniyor…" },
  { at: 6500, value: 82, label: "Groq AI analiz yapıyor…" },
  { at: 9000, value: 94, label: "Sonuçlar hazırlanıyor…" },
  { at: 10500, value: 100, label: "Tamamlandı!" },
] as const;

const TIPS = [
  {
    id: "lighting",
    title: "İyi aydınlatma",
    body: "Yeterli ışık sağlayın; sert gölgelerden ve parlak yansımalardan kaçının.",
    icon: "☀️",
  },
  {
    id: "clean",
    title: "Temiz parça",
    body: "Tarama öncesi parçayı temizleyin; kir ve yağ AI doğruluğunu düşürür.",
    icon: "✨",
  },
  {
    id: "background",
    title: "Sade arka plan",
    body: "Parçayla zıt, düz renk bir zemin üzerinde çekim yapın.",
    icon: "🎯",
  },
] as const;

const BROWSER_STATUS_CONFIG: Record<
  BrowserStatus,
  {
    label: string;
    color: string;
    bg: string;
    dot: string;
    icon: React.ElementType;
    description: string;
  }
> = {
  "logged-in": {
    label: "Bağlı",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/25",
    dot: "bg-emerald-400",
    icon: Globe,
    description: "Sahibinden'e giriş yapılmış ve tarayıcı aktif",
  },
  "logged-out": {
    label: "Giriş Yok",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/25",
    dot: "bg-amber-400",
    icon: LogIn,
    description: "Tarayıcı açık ancak giriş yapılmamış",
  },
  "browser-closed": {
    label: "Kapalı",
    color: "text-zinc-500",
    bg: "bg-zinc-800/60 border-zinc-700/50",
    dot: "bg-zinc-600",
    icon: WifiOff,
    description: "Otomasyon tarayıcısı şu an kapalı",
  },
  unknown: {
    label: "Bilinmiyor",
    color: "text-zinc-500",
    bg: "bg-zinc-800/60 border-zinc-700/50",
    dot: "bg-zinc-600",
    icon: AlertCircle,
    description: "Bağlantı durumu kontrol edilemiyor",
  },
};

// ─── Motion Variants ─────────────────────────────────────────────────────────

const pageVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 40 : -40,
    scale: 0.96,
    filter: "blur(10px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -40 : 40,
    scale: 0.96,
    filter: "blur(10px)",
  }),
};

const containerVariants: import("framer-motion").Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
};

const floatingAnimation: import("framer-motion").TargetAndTransition = {
  y: [0, -8, 0],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

// ─── Custom Hooks ─────────────────────────────────────────────────────────────

function useFileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Sadece görsel dosyaları yüklenebilir.");
      return false;
    }

    if (f.size > 10 * 1024 * 1024) {
      setError("Görsel boyutu 10MB'dan küçük olmalıdır.");
      return false;
    }

    setFile(f);
    setError(null);
    const url = URL.createObjectURL(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    return true;
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setError(null);
  }, []);

  return { file, preview, error, setError, applyFile, clearFile };
}

function useLogs() {
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return { logs, addLog, clearLogs, logsEndRef };
}

// ─── Components ───────────────────────────────────────────────────────────────

const AuroraBackground = memo(() => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-[40%] -left-[20%] w-[140%] h-[140%] bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 animate-aurora" />
    <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%2311F08E%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" />
  </div>
));

const ProgressBar = memo(
  ({ progress, label }: { progress: number; label: string }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-400">{label}</span>
        <span className="font-mono font-bold text-emerald-400">
          {progress}%
        </span>
      </div>
      <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 15 }}
        >
          <div className="absolute inset-0 bg-white/20 animate-shimmer" />
        </motion.div>
      </div>
    </div>
  ),
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomePage() {
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );

  // Navigation
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [activeTab, setActiveTab] = useState<NavTab>("home");

  // File Management
  const {
    file,
    preview,
    error: fileError,
    setError,
    applyFile,
    clearFile,
  } = useFileUpload();

  // Data
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [reviewedForPublish, setReviewedForPublish] = useState(false);

  // UI State
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Hazırlanıyor…");
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Browser
  const [showBrowserPanel, setShowBrowserPanel] = useState(false);
  const [browserStatus, setBrowserStatus] =
    useState<BrowserStatusResponse | null>(null);
  const [browserInfo, setBrowserInfo] = useState<BrowserSessionResponse | null>(
    null,
  );

  // Logs
  const { logs, addLog, clearLogs, logsEndRef } = useLogs();
  const [showLogs, setShowLogs] = useState(false);

  // Batch & auto-publish
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [autoPublish, setAutoPublish] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<"Yedek Parça" | "Akıllı Telefon">("Yedek Parça");

  // Transitions
  const [isAnalyzing, startAnalyzing] = useTransition();
  const [isPublishing, startPublishing] = useTransition();
  const [isOpeningBrowser, startOpeningBrowser] = useTransition();
  const [isCheckingBrowser, startCheckingBrowser] = useTransition();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Memoized Values
  const canPublish = useMemo(() => {
    if (!draft) return false;
    return draft.warnings.length === 0 || reviewedForPublish;
  }, [draft, reviewedForPublish]);

  const statusConfig = useMemo(
    () => BROWSER_STATUS_CONFIG[browserStatus?.status ?? "unknown"],
    [browserStatus?.status],
  );

  // Navigation
  const navigate = useCallback(
    (next: number) => {
      setDirection(next > step ? 1 : -1);
      setStep(next);
      if (next === 0) setActiveTab("home");
    },
    [step],
  );

  const handleReset = useCallback(() => {
    setDirection(-1);
    setStep(0);
    setActiveTab("home");
    clearFile();
    setDraft(null);
    setError(null);
    clearLogs();
    setProgress(0);
    setProgressLabel("Hazırlanıyor…");
    setReviewedForPublish(false);
    setPublishSuccess(false);
    toast.success("Başarıyla sıfırlandı");
  }, [clearFile, setError, clearLogs]);

  // Analysis Progress Effect
  useEffect(() => {
    if (!isAnalyzing) {
      if (progress !== 0) setProgress(0);
      return;
    }

    setProgress(0);
    setProgressLabel("Başlatılıyor…");

    const timers = ANALYSIS_STAGES.map(({ at, value, label }) =>
      setTimeout(() => {
        setProgress(value);
        setProgressLabel(label);
      }, at),
    );

    return () => timers.forEach(clearTimeout);
  }, [isAnalyzing, progress]);

  // Read from localStorage after hydration (must run client-side only)
  useEffect(() => {
    const stored = localStorage.getItem("autoPublish");
    if (stored === "true") setAutoPublish(true);
  }, []); // empty deps → runs once after first client render

  // Persist changes
  useEffect(() => {
    localStorage.setItem("autoPublish", String(autoPublish));
  }, [autoPublish]);

  // Clipboard Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItem = Array.from(items).find((item) =>
        item.type.startsWith("image/"),
      );
      if (!imageItem) return;

      const blob = imageItem.getAsFile();
      if (!blob) return;

      e.preventDefault();
      const ext = blob.type.split("/")[1] || "png";
      const file = new File([blob], `pasted-${Date.now()}.${ext}`, {
        type: blob.type,
      });

      if (applyFile(file)) {
        addLog(`Panodan görsel alındı: ${file.name}`);
        toast.success("Görsel panodan yapıştırıldı");
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [applyFile, addLog]);

  // Browser Status Check
  const checkBrowserStatus = useCallback(
    async (pushLogs = true) => {
      startCheckingBrowser(async () => {
        try {
          const res = await fetch("/api/browser/status", { cache: "no-store" });
          const data = (await res.json()) as BrowserStatusResponse;

          if (!res.ok || !data.ok) throw new Error(data.message);

          setBrowserStatus(data);
          if (pushLogs && data.logs?.length) {
            data.logs.forEach(addLog);
          }
        } catch (err) {
          setBrowserStatus({
            ok: false,
            status: "unknown",
            browserRunning: false,
            message: err instanceof Error ? err.message : "Bağlantı hatası",
            logs: [],
          });
        }
      });
    },
    [addLog],
  );

  useEffect(() => {
    checkBrowserStatus(false);
    const interval = setInterval(() => checkBrowserStatus(false), 30000);
    return () => clearInterval(interval);
  }, [checkBrowserStatus]);

  // API Calls
  const runAnalyze = useCallback(async () => {
    if (!file) {
      toast.error("Lütfen önce bir görsel seçin");
      return;
    }

    navigate(1);

    startAnalyzing(async () => {
      setError(null);
      clearLogs();
      addLog("Analiz başlatılıyor…");

      const formData = new FormData();
      formData.append("image", file);
      formData.append("domain", selectedDomain);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });
        const result = (await res.json()) as AnalyzeResponse;

        if (!res.ok || !result.ok || !result.draft) {
          throw new Error(result.error ?? "Analiz tamamlanamadı");
        }

        setDraft(result.draft);
        setReviewedForPublish(false);
        addLog("✓ Analiz başarıyla tamamlandı");

        if (result.draft.warnings.length > 0) {
          result.draft.warnings.forEach((w) => addLog(`⚠️ ${w}`));
          toast.info(`${result.draft.warnings.length} uyarı bulundu`);
        }

        setTimeout(() => navigate(2), 800);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bağlantı hatası";
        setError(msg);
        toast.error(msg);
        navigate(0);
      }
    });
  }, [file, navigate, setError, clearLogs, addLog]);

  const openBrowser = useCallback(
    async (mode: "home" | "login" | "post-ad") => {
      startOpeningBrowser(async () => {
        try {
          const res = await fetch("/api/browser/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode }),
          });
          const result = (await res.json()) as BrowserSessionResponse;

          if (!res.ok || !result.ok) {
            throw new Error(result.error ?? "Tarayıcı başlatılamadı");
          }

          setBrowserInfo(result);
          addLog(`Tarayıcı açıldı: ${result.targetUrl}`);
          toast.success("Tarayıcı başlatıldı");
          checkBrowserStatus(false);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Başlatma hatası";
          toast.error(msg);
        }
      });
    },
    [addLog, checkBrowserStatus],
  );

  const runPublish = useCallback(
    async (mode: "draft" | "publish") => {
      if (!draft) return;

      setPublishSuccess(false);
      startPublishing(async () => {
        try {
          const res = await fetch("/api/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, draft, reviewedForPublish }),
          });
          const result = (await res.json()) as PublishResponse;

          if (result.logs?.length) result.logs.forEach(addLog);

          if (!res.ok || !result.ok) {
            throw new Error(result.error ?? "Yayın akışı başarısız");
          }

          setPublishSuccess(true);
          toast.success(
            mode === "publish" ? "İlan yayınlandı!" : "Taslak kaydedildi",
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Yayın hatası";
          toast.error(msg);
        }
      });
    },
    [draft, reviewedForPublish, addLog],
  );

  // Draft Update
  const updateDraftField = useCallback(
    <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) => {
      setDraft((curr) => {
        if (!curr) return curr;
        const next = { ...curr, [key]: value };
        next.categoryPath = [
          ...SAHIBINDEN_ROOT_PATH,
          next.category,
          next.vehicleType,
          next.partCategory,
        ];
        return next;
      });
    },
    [],
  );

  // Drag & Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      
      if (isBatchMode) return;

      const dropped = Array.from(e.dataTransfer.files).find((f) =>
        f.type.startsWith("image/"),
      );
      if (!dropped) {
        toast.error("Sadece görsel dosyası bırakabilirsiniz");
        return;
      }

      if (applyFile(dropped)) {
        addLog(`Sürükle-bırak: ${dropped.name}`);
      }
    },
    [applyFile, addLog],
  );

  // Tab Handler
  const handleTabChange = useCallback(
    (tab: NavTab) => {
      if (tab === "scan") {
        if (step === 1) return;
        setActiveTab("scan");
        setShowBrowserPanel(false);
        setShowLogs(false);
        if (step === 2) {
          setDraft(null);
          setReviewedForPublish(false);
          setPublishSuccess(false);
          setDirection(-1);
          setStep(0);
        }
      } else {
        setActiveTab(tab);
        setShowBrowserPanel(tab === "browser");
        setShowLogs(tab === "logs");
        if (tab === "home" && step === 2) navigate(0);
      }
    },
    [step, navigate],
  );

  // Render Helpers
  const renderBrowserPanel = () => (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider",
                statusConfig.bg,
                statusConfig.color,
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  statusConfig.dot,
                )}
              />
              {statusConfig.label}
            </div>
            <button
              onClick={() => checkBrowserStatus(true)}
              disabled={isCheckingBrowser}
              className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
            >
              <RotateCcw
                className={cn("w-4 h-4", isCheckingBrowser && "animate-spin")}
              />
            </button>
          </div>
        </div>

        {browserStatus?.message && (
          <p className="text-xs text-zinc-500 leading-relaxed">
            {statusConfig.description}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {[
            {
              mode: "home" as const,
              label: "Tarayıcı",
              icon: Globe,
              color: "zinc",
            },
            {
              mode: "login" as const,
              label: "Giriş",
              icon: LogIn,
              color: "sky",
            },
            {
              mode: "post-ad" as const,
              label: "İlan Ver",
              icon: FileText,
              color: "emerald",
            },
          ].map(({ mode, label, icon: Icon, color }) => (
            <button
              key={mode}
              onClick={() => openBrowser(mode)}
              disabled={isOpeningBrowser}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-bold uppercase tracking-wide",
                "transition-all duration-200 active:scale-95 disabled:opacity-40",
                color === "zinc" &&
                  "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700",
                color === "sky" &&
                  "border-sky-600/30 bg-sky-600/10 text-sky-400 hover:bg-sky-600/20",
                color === "emerald" &&
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
              )}
            >
              {isOpeningBrowser ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {browserInfo && (
          <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px] text-zinc-500 font-mono space-y-1">
            <div className="flex gap-2">
              <span className="text-zinc-600">URL:</span>
              <span className="truncate">{browserInfo.targetUrl}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-600">Profil:</span>
              <span className="truncate">{browserInfo.userDataDir}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <>
      <SplashScreen />
      <AuroraBackground />

      <div
        ref={dropZoneRef}
        onDragEnter={!isBatchMode ? handleDragOver : undefined}
        onDragLeave={!isBatchMode ? handleDragLeave : undefined}
        onDragOver={!isBatchMode ? handleDragOver : undefined}
        onDrop={!isBatchMode ? handleDrop : undefined}
        className="min-h-dvh flex flex-col bg-[#0a0a0a] text-white relative"
      >
        {/* Global Drag Overlay */}
        <AnimatePresence>
          {isDragActive && !isBatchMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none"
            >
              <div className="absolute inset-4 border-4 border-dashed border-emerald-500/50 rounded-3xl flex flex-col items-center justify-center gap-6 bg-emerald-500/5">
                <div className="w-32 h-32 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
                  <UploadCloud className="w-16 h-16 text-emerald-400" />
                </div>
                <div className="text-center">
                  <h2 className="text-4xl font-black text-white tracking-widest uppercase">
                    Görseli Buraya Bırakın
                  </h2>
                  <p className="text-emerald-400 font-medium mt-2 text-lg">
                    Hemen analiz etmeye başlayalım
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-2xl supports-[backdrop-filter]:bg-black/20">
          <div className="mx-auto flex h-20 sm:h-[72px] max-w-2xl items-center justify-between px-4 sm:px-6">
            <motion.div
              className="flex items-center gap-3.5"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Logo size="md" />
              <span className="font-black text-base tracking-widest uppercase">
                Next<span className="text-emerald-400">bot</span>
              </span>
            </motion.div>

            <div className="flex items-center">
              {/* Batch mode + auto-publish toggles */}
              <div className="flex items-center gap-2 mr-2">
                {/* Test mode toggle */}
                <button
                  type="button"
                  onClick={() => setIsTestMode((v) => !v)}
                  title={isTestMode ? "Test Modu: Açık" : "Test Modu: Kapalı"}
                  className={[
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95",
                    isTestMode
                      ? "border-purple-400/40 bg-purple-400/10 text-purple-400"
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:text-zinc-400",
                  ].join(" ")}
                >
                  <Lightbulb className="w-3 h-3" />
                  <span className="hidden sm:inline">Test</span>
                </button>

                {/* Auto-publish toggle */}
                <button
                  type="button"
                  onClick={() => setAutoPublish((v) => !v)}
                  title={autoPublish ? "Oto İlan: Açık" : "Oto İlan: Kapalı"}
                  className={[
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95",
                    autoPublish
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:text-zinc-400",
                  ].join(" ")}
                >
                  <Zap className="w-3 h-3" />
                  <span className="hidden sm:inline">Oto İlan</span>
                </button>

                {/* Batch mode toggle */}
                <button
                  type="button"
                  onClick={() => setIsBatchMode((v) => !v)}
                  title={isBatchMode ? "Tekli moda geç" : "Toplu yükleme"}
                  className={[
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95",
                    isBatchMode
                      ? "border-[#11F08E]/40 bg-[#11F08E]/10 text-[#11F08E]"
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:text-zinc-400",
                  ].join(" ")}
                >
                  <Layers className="w-3 h-3" />
                  <span className="hidden sm:inline">Toplu</span>
                </button>
              </div>

              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => {
                  setShowBrowserPanel((v) => !v);
                  setActiveTab(showBrowserPanel ? "home" : "browser");
                }}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
                  "active:scale-95 hover:scale-105",
                  statusConfig.bg,
                  statusConfig.color,
                )}
              >
                <statusConfig.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{statusConfig.label}</span>
                {showBrowserPanel ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </motion.button>
            </div>
          </div>
        </header>

        {/* Browser Panel */}
        <AnimatePresence>
          {showBrowserPanel && renderBrowserPanel()}
        </AnimatePresence>

        {/* Logs Panel */}
        <AnimatePresence>
          {showLogs && logs.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl"
            >
              <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                    Sistem Logları
                  </span>
                  <button
                    onClick={clearLogs}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Temizle
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg bg-black/40 border border-white/5 p-3 font-mono text-[11px] space-y-1">
                  {logs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <span className="text-emerald-500/50 mr-2">›</span>
                      {log}
                    </motion.div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 pb-32 sm:px-6 sm:pt-8 relative">
          {/* ── Batch Upload Mode ─────────────────────────────────────────────── */}
          {isBatchMode && (
            <motion.div
              key="batch-mode"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="mb-6"
            >
              {/* Header bar */}
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#11F08E]" />
                  <span className="text-sm font-black text-zinc-300 uppercase tracking-widest">
                    Toplu Yükleme
                  </span>
                </div>
                {autoPublish && (
                  <div className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black text-amber-400 uppercase tracking-wider">
                    <Zap className="w-3 h-3" />
                    Oto İlan Aktif
                  </div>
                )}
              </div>
              
              {/* Domain Selection for Batch Mode */}
              <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 mb-4">
                {(["Yedek Parça", "Akıllı Telefon"] as const).map((domain) => (
                  <button
                    key={domain}
                    onClick={() => setSelectedDomain(domain)}
                    className={cn(
                      "flex-1 text-sm font-bold uppercase tracking-wider py-2.5 rounded-xl transition-all",
                      selectedDomain === domain
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    )}
                  >
                    {domain}
                  </button>
                ))}
              </div>

              <BatchUploadPanel
                autoPublish={autoPublish}
                domain={selectedDomain}
                onBatchComplete={(stats) => {
                  // optionally handle completion
                  console.log("Batch complete:", stats);
                }}
              />
            </motion.div>
          )}

          {/* Hide stepper and steps when batch mode is active */}
          {!isBatchMode && (
            <>
              {/* Stepper */}
              <AnimatePresence mode="wait">
                {!(step === 0 && activeTab === "scan") && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <Stepper steps={STEPS} currentStep={step} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Content Area */}
              <AnimatePresence mode="wait" custom={direction}>
                {/* Step 0: Scan Landing */}
                {step === 0 && activeTab === "scan" && (
                  <motion.div
                    key="scan-landing"
                    custom={direction}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.35,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                    className="mt-6 space-y-4"
                  >
                    <motion.div
                      ref={dropZoneRef}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      animate={isDragActive ? { scale: 1.02 } : { scale: 1 }}
                      className={cn(
                        "relative overflow-hidden rounded-[32px] border-2 min-h-[520px] cursor-pointer transition-colors",
                        isDragActive
                          ? "border-emerald-400 bg-emerald-500/5 shadow-[0_0_60px_rgba(16,185,129,0.3)]"
                          : "border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-black hover:border-zinc-700",
                      )}
                    >
                      {/* Scan Frame Effect */}
                      <div className="absolute inset-4 border border-white/10 rounded-[24px] pointer-events-none" />
                      <div className="absolute left-6 top-6 w-8 h-8 border-l-2 border-t-2 border-emerald-500/50 rounded-tl-lg" />
                      <div className="absolute right-6 top-6 w-8 h-8 border-r-2 border-t-2 border-emerald-500/50 rounded-tr-lg" />
                      <div className="absolute left-6 bottom-6 w-8 h-8 border-l-2 border-b-2 border-emerald-500/50 rounded-bl-lg" />
                      <div className="absolute right-6 bottom-6 w-8 h-8 border-r-2 border-b-2 border-emerald-500/50 rounded-br-lg" />

                      {/* Ambient Glow */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_70%)]" />

                      <div className="relative z-10 flex flex-col items-center justify-center h-full min-h-[520px] p-8 text-center">
                        <motion.div
                          animate={floatingAnimation}
                          className="mb-8 relative"
                        >
                          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                          <div className="relative w-32 h-32 rounded-full border-2 border-emerald-500/30 bg-black/50 backdrop-blur-xl flex items-center justify-center shadow-2xl">
                            <ScanLine className="w-12 h-12 text-emerald-400" />
                          </div>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 20,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="absolute inset-0 rounded-full border border-dashed border-emerald-500/20"
                          />
                        </motion.div>

                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">
                          Taramaya{" "}
                          <span className="text-emerald-400">Hazır</span>
                        </h1>
                        <p className="text-zinc-400 max-w-sm text-lg leading-relaxed">
                          Parçaya doğrultun veya bir görsel seçin. Yapay zeka
                          otomatik analiz etsin.
                        </p>
                      </div>
                    </motion.div>

                    <div className="grid grid-cols-2 gap-3">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => cameraInputRef.current?.click()}
                        className="group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-6 flex flex-col items-center gap-3 hover:border-emerald-500/50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <ScanLine className="w-6 h-6 text-emerald-400" />
                        </div>
                        <span className="font-bold text-sm uppercase tracking-wider text-zinc-300">
                          Kamera
                        </span>
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-6 flex flex-col items-center gap-3 hover:border-emerald-500/50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <ImageIcon className="w-6 h-6 text-emerald-400" />
                        </div>
                        <span className="font-bold text-sm uppercase tracking-wider text-zinc-300">
                          Galeri
                        </span>
                      </motion.button>
                    </div>

                    <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 mt-4">
                      {(["Yedek Parça", "Akıllı Telefon"] as const).map((domain) => (
                        <button
                          key={domain}
                          onClick={() => setSelectedDomain(domain)}
                          className={cn(
                            "flex-1 text-sm font-bold uppercase tracking-wider py-3 rounded-xl transition-all",
                            selectedDomain === domain
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                          )}
                        >
                          {domain}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 0: Home Upload */}
                {step === 0 && activeTab !== "scan" && (
                  <motion.div
                    key="home-upload"
                    custom={direction}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
                    className="mt-6 space-y-4"
                  >
                    <motion.div
                      onClick={() => !file && fileInputRef.current?.click()}
                      className={cn(
                        "relative rounded-3xl border-2 overflow-hidden transition-all duration-300",
                        isDragActive
                          ? "border-emerald-400 bg-emerald-500/5 scale-[1.01]"
                          : file
                            ? "border-emerald-500/30 bg-zinc-900"
                            : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 cursor-pointer",
                      )}
                    >
                      <AnimatePresence mode="wait">
                        {preview ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="relative aspect-video"
                          >
                            <img
                              src={preview}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />

                            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-white">
                                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="max-w-[150px] truncate">
                                  {file?.name}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearFile();
                                }}
                                className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-zinc-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/30 transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center gap-4 px-6 py-16"
                          >
                            <motion.div
                              animate={
                                isDragActive
                                  ? { scale: 1.1, rotate: 5 }
                                  : { scale: 1, rotate: 0 }
                              }
                              className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center"
                            >
                              {isDragActive ? (
                                <ScanLine className="w-8 h-8 text-emerald-400" />
                              ) : (
                                <Upload className="w-8 h-8 text-zinc-600" />
                              )}
                            </motion.div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-zinc-200">
                                {isDragActive ? "Bırakın!" : "Görsel Yükle"}
                              </p>
                              <p className="text-sm text-zinc-500 mt-1">
                                Sürükle-bırak, yapıştır veya seçin
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5">
                      {(["Yedek Parça", "Akıllı Telefon"] as const).map((domain) => (
                        <button
                          key={domain}
                          onClick={() => setSelectedDomain(domain)}
                          className={cn(
                            "flex-1 text-sm font-bold uppercase tracking-wider py-3 rounded-xl transition-all",
                            selectedDomain === domain
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                          )}
                        >
                          {domain}
                        </button>
                      ))}
                    </div>

                    {file && (
                      <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={runAnalyze}
                        disabled={isAnalyzing}
                        className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm uppercase tracking-wider py-4 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Zap className="w-4 h-4" />
                          Analizi Başlat
                        </span>
                      </motion.button>
                    )}

                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="space-y-3 pt-2"
                    >
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-700 px-1">
                        İpuçları
                      </p>
                      {TIPS.map((tip) => (
                        <motion.div
                          key={tip.id}
                          variants={itemVariants}
                          className="flex items-start gap-4 rounded-2xl border border-white/5 bg-zinc-900/50 p-4 hover:bg-zinc-900 transition-colors"
                        >
                          <span className="text-2xl">{tip.icon}</span>
                          <div>
                            <p className="font-bold text-zinc-300 text-sm">
                              {tip.title}
                            </p>
                            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                              {tip.body}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}

                {/* Step 1: Analyzing */}
                {step === 1 && (
                  <motion.div
                    key="analyzing"
                    custom={direction}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
                    className="mt-6 space-y-6"
                  >
                    <div className="relative rounded-3xl overflow-hidden border border-emerald-500/20 bg-zinc-900">
                      {preview && (
                        <div className="relative aspect-[4/3] opacity-30 grayscale">
                          <img
                            src={preview}
                            alt="Analyzing"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="w-24 h-24 rounded-full border-4 border-emerald-500/20 border-t-emerald-500"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ScanLine className="w-8 h-8 text-emerald-400" />
                          </div>
                        </div>
                      </div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500/20"
                      >
                        <motion.div
                          className="h-full bg-emerald-500"
                          initial={{ width: "0%" }}
                          animate={{ width: `${progress}%` }}
                        />
                      </motion.div>
                    </div>

                    <div className="space-y-4">
                      <ProgressBar progress={progress} label={progressLabel} />

                      <div className="flex flex-wrap gap-2">
                        {ANALYSIS_STAGES.map((stage) => (
                          <motion.div
                            key={stage.label}
                            initial={false}
                            animate={{
                              backgroundColor:
                                progress >= stage.value
                                  ? "rgba(16, 185, 129, 0.1)"
                                  : "transparent",
                              borderColor:
                                progress >= stage.value
                                  ? "rgba(16, 185, 129, 0.3)"
                                  : "rgba(63, 63, 70, 1)",
                              color:
                                progress >= stage.value
                                  ? "rgb(52, 211, 153)"
                                  : "rgb(113, 113, 122)",
                            }}
                            className="px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-colors"
                          >
                            {stage.label}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Review */}
                {step === 2 && draft && (
                  <motion.div
                    key="review"
                    custom={direction}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
                    className="mt-6 pb-20"
                  >
                    {isTestMode ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                          <h2 className="text-xl font-black text-purple-400 uppercase tracking-widest">
                            Test Analiz Sonucu
                          </h2>
                          <button
                            onClick={handleReset}
                            className="text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
                          >
                            Yeni Görsel
                          </button>
                        </div>
                        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 overflow-auto max-h-[60vh] shadow-inner">
                          <pre className="text-[11px] font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(draft, null, 2)}
                          </pre>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={handleReset}
                          className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold uppercase tracking-wider text-sm transition-colors"
                        >
                          Sıfırla ve Geri Dön
                        </motion.button>
                      </div>
                    ) : (
                      <ListingPreview
                        draft={draft}
                        preview={preview}
                        onUpdateField={updateDraftField}
                        onDraft={() => runPublish("draft")}
                        onPublish={() => runPublish("publish")}
                        onReset={handleReset}
                        isPublishing={isPublishing}
                        canPublish={canPublish}
                        reviewedForPublish={reviewedForPublish}
                        onReviewedChange={setReviewedForPublish}
                        error={fileError}
                        publishSuccess={publishSuccess}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </main>

        {/* Navigation */}
        <Navigation
          activeTab={activeTab}
          loading={isAnalyzing}
          onTabChange={handleTabChange}
          onScanAction={() => handleTabChange("scan")}
        />

        {/* Hidden Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              applyFile(f);
              if (activeTab === "scan") runAnalyze();
            }
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              applyFile(f);
              if (activeTab === "scan") runAnalyze();
            }
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}
