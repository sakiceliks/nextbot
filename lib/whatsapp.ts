const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcodeTerminal = require("qrcode-terminal");
import { resolveChromeExecutable } from "./browser";
import { generateChatResponse } from "./groq";
import path from "node:path";
import { existsSync } from "node:fs"; 
import connectDB from "./mongodb";
import WhatsAppLog from "@/models/WhatsAppLog";

export type WhatsAppStatus = "disconnected" | "connecting" | "qr" | "ready" | "loading";

interface WhatsAppClientState {
  status: WhatsAppStatus;
  qrCode: string | null;
  logs: string[];
  client: any | null;
}

// Global state to persist through Next.js hot-reloads
declare global {
  var whatsappClientState: WhatsAppClientState | undefined;
}

if (!global.whatsappClientState) {
  global.whatsappClientState = {
    status: "disconnected",
    qrCode: null,
    logs: [],
    client: null,
  };
}

const state = global.whatsappClientState;

async function loadLogsFromDB() {
  try {
    await connectDB();
    const dbLogs = await WhatsAppLog.find().sort({ timestamp: -1 }).limit(50);
    state.logs = dbLogs.map((log: { timestamp: string | number | Date; message: string }) => {
      const time = new Date(log.timestamp).toLocaleTimeString("tr-TR");
      return `[${time}] ${log.message}`;
    });
  } catch (err) {
    console.error("[DB] Log yükleme hatası:", err);
  }
}

// İlk yüklemede logları arka planda çek — başlatmayı engelleme
if (typeof window === "undefined") {
  setTimeout(() => loadLogsFromDB(), 0);
}

import { whatsappLogEmitter } from "./events";

function addLog(message: string, type: "info" | "error" | "success" | "warning" = "info") {
  const timestampStr = new Date().toLocaleTimeString("tr-TR");
  const logEntry = `[${timestampStr}] ${message}`;
  state.logs = [logEntry, ...state.logs].slice(0, 50);
  console.log(`[WhatsApp] ${message}`);

  // SSE'ye anında yayınla (beklemeden)
  whatsappLogEmitter.emit("log", logEntry);

  // DB yazımı arka planda — asla await etme, startup'ı yavaşlatmasın
  connectDB()
    .then(() => WhatsAppLog.create({ message, type }))
    .catch((err: unknown) => console.error("[DB] Log kaydetme hatası:", err));
}

export const getWhatsAppState = () => ({
  status: state.status,
  qrCode: state.qrCode,
  logs: state.logs,
});

export const initializeWhatsApp = async () => {
  if (state.client) {
    addLog("Client zaten çalışıyor.");
    return;
  }

  addLog("WhatsApp Client başlatılıyor...");
  state.status = "loading";

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: "nextbot-wa",
      dataPath: path.join(process.cwd(), ".wwebjs_auth"),
    }),
    puppeteer: {
      executablePath: resolveChromeExecutable(),
      headless: true,
      args: [
        // Sandbox (macOS'ta no-zygote ile --single-process yok — crash'e yol açar)
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // Bellek / render
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        // Gereksiz ağ & servisler — hız için kapat
        "--disable-extensions",
        "--disable-plugins",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-client-side-phishing-detection",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-hang-monitor",
        "--disable-ipc-flooding-protection",
        "--disable-popup-blocking",
        "--disable-prompt-on-repost",
        "--disable-renderer-backgrounding",
        "--disable-sync",
        "--disable-translate",
        "--metrics-recording-only",
        "--mute-audio",
        "--no-default-browser-check",
        "--safebrowsing-disable-auto-update",
        "--password-store=basic",
        "--use-mock-keychain",
        "--ignore-certificate-errors",
      ],
      timeout: 90000,
    },
    webVersionCache: {
      type: "local",
      path: path.join(process.cwd(), ".wwebjs_cache"),
    },
  });

  client.on("qr", (qr: string) => {
    state.status = "qr";
    state.qrCode = qr;
    
    // Terminalde QR göster (Kullanıcı isteği üzerine)
    qrcodeTerminal.generate(qr, { small: true });
    addLog("QR Kod oluşturuldu (Terminalde de görebilirsiniz).");
  });

  client.on("ready", () => {
    state.status = "ready";
    state.qrCode = null;
    addLog("WhatsApp bağlandı ve hazır!");
  });

  client.on("authenticated", () => {
    addLog("Kimlik doğrulama başarılı.");
  });

  client.on("auth_failure", (msg: string) => {
    addLog(`Kimlik doğrulama hatası: ${msg}`, "error");
  });

  client.on("disconnected", (reason: string) => {
    state.status = "disconnected";
    addLog(`Bağlantı kesildi: ${reason}`, "warning");
  });

  client.on("change_state", (state: string) => {
    addLog(`Durum değişti: ${state}`);
  });

  client.on("message", async (msg: any) => {
    const sender = msg.from;
    const body = msg.body;
    const allowedNumber = process.env.ALLOWED_WA_NUMBER;

    addLog(`📩 Mesaj geldi (${sender}): ${body.slice(0, 50)}`);

    // Sadece belirli bir numaraya cevap ver (eğer tanımlıysa)
    if (allowedNumber && sender !== allowedNumber) {
      addLog(`⚠️ Engellendi: ${sender} yetkili numara değil.`);
      return;
    }
    
    // Basit ping-pong testi
    if (body.toLowerCase() === "!ping") {
      addLog("🏓 Ping algılandı, cevap veriliyor...");
      msg.reply("pong");
      return;
    }

    const chat = await msg.getChat();
    if (chat.isGroup) {
      addLog("👥 Grup mesajı, görmezden geliniyor.");
      return;
    }

    try {
      addLog("🤖 AI Cevap hazırlanıyor...");
      await chat.sendStateTyping();
      const response = await generateChatResponse(body);
      await msg.reply(response);
      addLog(`✅ Cevap gönderildi: ${response.slice(0, 50)}...`, "success");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Bilinmeyen hata";
      addLog(`❌ AI Hata: ${errMsg}`, "error");
    }
  });

  try {
    state.client = client;
    await client.initialize();
  } catch (error) {
    state.status = "disconnected";
    state.client = null;
    // Hata tipini ne olursa olsun düzgün yakala
    let errMsg: string;
    if (error instanceof Error) {
      errMsg = error.message;
    } else if (typeof error === "string") {
      errMsg = error;
    } else {
      try { errMsg = JSON.stringify(error); } catch { errMsg = String(error); }
    }
    console.error("[WhatsApp] Başlatma hatası detayı:", error);
    addLog(`Başlatma hatası: ${errMsg}`, "error");
  }
};

export const logoutWhatsApp = async () => {
  if (state.client) {
    await state.client.logout();
    state.client = null;
    state.status = "disconnected";
    state.qrCode = null;
    addLog("Oturum kapatıldı.");
  }
};
export const stopWhatsApp = async () => {
  if (state.client) {
    addLog("Client durduruluyor...");
    const clientRef = state.client;
    state.client = null;
    state.status = "disconnected";
    state.qrCode = null;
    try {
      await clientRef.destroy();
    } catch (e) {
      addLog(`Kapatma hatası: ${e instanceof Error ? e.message : "Bilinmeyen"}`);
    }
    addLog("Client durduruldu.");
  }
};

export const clearSession = async () => {
  await stopWhatsApp();
  const authPath = path.join(process.cwd(), ".wwebjs_auth");
  const cachePath = path.join(process.cwd(), ".wwebjs_cache");
  
  const { rm } = require("node:fs/promises");
  try {
    if (existsSync(authPath)) await rm(authPath, { recursive: true, force: true });
    if (existsSync(cachePath)) await rm(cachePath, { recursive: true, force: true });
    addLog("Oturum verileri temizlendi.");
  } catch (e) {
    addLog(`Temizleme hatası: ${e instanceof Error ? e.message : "Bilinmeyen"}`);
  }
};
