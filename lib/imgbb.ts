import { readFile } from "node:fs/promises";

export async function uploadToImgbb(imagePath: string) {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    throw new Error("IMGBB_API_KEY tanimli degil.");
  }

  const fileBuffer = await readFile(imagePath);
  const formData = new FormData();
  formData.append("key", apiKey);
  formData.append("image", fileBuffer.toString("base64"));

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    headers: {
      "Accept": "application/json"
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`imgbb yukleme hatasi: ${response.status}`);
  }

  const json = (await response.json()) as {
    data?: {
      url?: string;
      display_url?: string;
      delete_url?: string;
    };
  };

  const imageUrl = json.data?.display_url ?? json.data?.url;
  if (!imageUrl) {
    throw new Error("imgbb cevabinda public image URL bulunamadi.");
  }

  return {
    imageUrl,
    deleteUrl: json.data?.delete_url ?? null
  };
}
