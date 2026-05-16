import fs from "node:fs";
import path from "node:path";

export interface BotSettings {
  // ── Hız & Zamanlama ──────────────────────────────────────────────────────
  speedMultiplier: number;      // 0.5 | 1 | 1.5 | 2 — tüm sleep() değerlerini çarpar
  queueDelaySeconds: number;    // İlanlar arası bekleme (sn)
  maxRetries: number;           // Hata durumunda max yeniden deneme

  // ── Yayın Ayarları ───────────────────────────────────────────────────────
  defaultPublishMode: "draft" | "publish";
  autoStartQueue: boolean;      // Kuyruğa eklenince otomatik başlat

  // ── Ürün Özellikleri Varsayılanları ──────────────────────────────────────
  defaultColor: string;         // Renk seçimi ("Beyaz", "Siyah" vb.)
  defaultStorage: string;       // Depolama kapasitesi ("256 GB" vb.)
  defaultOrigin: string;        // Alındığı yer ("Yurt dışı" | "Yurt içi")
  defaultWarranty: string;      // Garanti tipi
  defaultCondition: string;     // Durum ("Sıfır" | "İkinci El")
  defaultExchangeable: string;  // Takas ("Evet" | "Hayır")

  // ── Konum ────────────────────────────────────────────────────────────────
  defaultTown: string;          // Varsayılan ilçe
  defaultQuarter: string;       // Varsayılan mahalle (boşsa rastgele)

  // ── Fiyat Ayarı ──────────────────────────────────────────────────────────
  priceAdjustPercent: number;   // Fiyata eklenecek yüzde (+5, -3 vb.)

  // ── Açıklama ─────────────────────────────────────────────────────────────
  descriptionSuffix: string;    // Her açıklamanın sonuna eklenecek metin

  // ── Davranış ─────────────────────────────────────────────────────────────
  skipDopingModal: boolean;     // Doping modalını otomatik kapat
  debugScreenshots: boolean;    // Hata durumunda ekran görüntüsü al
  headless: boolean;            // Headless mod (tarayıcı görünmez)

  // ── Bildirimler ──────────────────────────────────────────────────────────
  notifyOnSuccess: boolean;
  notifyOnError: boolean;
}

export const DEFAULT_SETTINGS: BotSettings = {
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

const SETTINGS_PATH = path.join(process.cwd(), "data", "bot-settings.json");

export function readSettings(): BotSettings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return { ...DEFAULT_SETTINGS };
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: Partial<BotSettings>): BotSettings {
  const current = readSettings();
  const merged = { ...current, ...settings };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
