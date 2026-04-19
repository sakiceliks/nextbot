import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

export async function saveFormFile(file: File) {
  const uploadDir = await ensureUploadDir();
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const fileName = `${Date.now()}_${safeName}`;
  const fullPath = path.join(uploadDir, fileName);
  await writeFile(fullPath, buffer);
  return {
    fileName,
    fullPath,
    relativePath: `/uploads/${fileName}`
  };
}
