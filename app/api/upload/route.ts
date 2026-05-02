import { NextResponse } from "next/server";
import { uploadToImgbb } from "@/lib/imgbb";
import { saveFormFile } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Görsel dosyası zorunlu." }, { status: 400 });
    }

    const savedImage = await saveFormFile(file);
    const { imageUrl } = await uploadToImgbb(savedImage.fullPath);

    return NextResponse.json({
      ok: true,
      imageUrl,
      imagePath: savedImage.relativePath,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
