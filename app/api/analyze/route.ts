import { NextResponse } from "next/server";

import { analyzeWithGroq } from "@/lib/groq";
import { uploadToImgbb } from "@/lib/imgbb";
import { normalizeListingDraft } from "@/lib/normalization";
import { fetchGoogleLens } from "@/lib/serpapi";
import { saveFormFile } from "@/lib/storage";

export const maxDuration = 60; // 60 seconds

export async function POST(request: Request) {
  const traceId = `analyze_${Date.now()}`;
  console.log(`[${traceId}] Analiz istegi alindi.`);
  
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    const domain = (formData.get("domain") as string) || "Yedek Parça";

    if (!(file instanceof File)) {
      console.log(`[${traceId}] Hata: Gorsel dosyasi bulunamadi.`);
      return NextResponse.json({ error: "Gorsel dosyasi zorunlu." }, { status: 400 });
    }

    console.log(`[${traceId}] Dosya alindi: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB), Tur: ${domain}`);

    const savedImage = await saveFormFile(file);
    console.log(`[${traceId}] Dosya kaydedildi: ${savedImage.fullPath}`);

    console.log(`[${traceId}] ImgBB yuklemesi basliyor...`);
    const { imageUrl } = await uploadToImgbb(savedImage.fullPath);
    console.log(`[${traceId}] ImgBB basarili: ${imageUrl}`);

    console.log(`[${traceId}] Google Lens (SerpAPI) taramasi basliyor...`);
    const lensRaw = await fetchGoogleLens(imageUrl);
    console.log(`[${traceId}] Google Lens tamamlandi.`);

    console.log(`[${traceId}] Groq AI analizi basliyor...`);
    const groqRaw = await analyzeWithGroq(lensRaw, imageUrl, domain);
    console.log(`[${traceId}] Groq analizi tamamlandi.`);

    const draft = normalizeListingDraft(groqRaw, {
      imageUrl,
      imagePath: savedImage.relativePath,
      domain
    });

    console.log(`[${traceId}] Analiz basariyla sonuclandi.`);
    return NextResponse.json({
      ok: true,
      lensRaw,
      draft
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Bilinmeyen hata";
    console.error(`[${traceId}] HATA:`, errorMsg);
    
    if (error instanceof Error && (error as any).cause) {
      console.error(`[${traceId}] SEBEP:`, (error as any).cause);
    }
    
    return NextResponse.json(
      {
        ok: false,
        error: errorMsg
      },
      { status: 500 }
    );
  }
}
