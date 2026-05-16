import { NextResponse } from "next/server";
import { getWhatsAppState, initializeWhatsApp, logoutWhatsApp, stopWhatsApp, clearSession } from "@/lib/whatsapp";

export async function GET() {
  const state = getWhatsAppState();
  return NextResponse.json({ ok: true, ...state });
}

export async function POST(request: Request) {
  try {
    const { command } = await request.json();

    switch (command) {
      case "start":
        // Don't await initializeWhatsApp because it's a long running process
        initializeWhatsApp();
        return NextResponse.json({ ok: true, message: "WhatsApp başlatılıyor..." });
      
      case "stop":
        await stopWhatsApp();
        return NextResponse.json({ ok: true, message: "WhatsApp durduruldu." });

      case "restart":
        await stopWhatsApp();
        initializeWhatsApp();
        return NextResponse.json({ ok: true, message: "WhatsApp yeniden başlatılıyor..." });
      
      case "clear-session":
        await clearSession();
        return NextResponse.json({ ok: true, message: "Oturum verileri temizlendi. Yeniden başlatabilirsiniz." });

      case "logout":
        await logoutWhatsApp();
        return NextResponse.json({ ok: true, message: "WhatsApp oturumu kapatıldı." });

      default:
        return NextResponse.json({ ok: false, error: "Geçersiz komut." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "İşlem başarısız." },
      { status: 500 }
    );
  }
}
