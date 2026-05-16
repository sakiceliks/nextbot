import { NextRequest } from "next";
import { whatsappLogEmitter } from "@/lib/events";

export async function GET(req: NextRequest) {
  console.log("[SSE] 🟢 Yeni bağlantı isteği alındı");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      console.log("[SSE] 🚀 Stream başlatıldı");
      
      const onLog = (log: string) => {
        try {
          console.log("[SSE] 📤 İstemciye log gönderiliyor:", log.slice(0, 50));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log })}\n\n`));
        } catch (err) {
          console.error("[SSE] ❌ Log gönderme hatası:", err);
        }
      };

      whatsappLogEmitter.on("log", onLog);

      // Heartbeat (Bağlantıyı canlı tutmak için her 15sn'de bir boş veri gönder)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (e) {}
      }, 15000);

      // Clean up on close
      req.signal.addEventListener("abort", () => {
        console.log("[SSE] 🔴 İstemci bağlantısı kesildi");
        clearInterval(heartbeat);
        whatsappLogEmitter.off("log", onLog);
        try {
          controller.close();
        } catch (e) {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Nginx vb. proxy'ler için önemli
    },
  });
}
