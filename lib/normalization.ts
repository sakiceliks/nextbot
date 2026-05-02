import slugify from "slugify";
import { z } from "zod";

import { DEFAULT_CONDITION } from "@/lib/catalog";
import type { ListingDraft, ListingFieldConfidence } from "@/lib/types";

const RawGroqDraftSchema = z.object({
  brand: z.string().nullish(),
  model: z.string().nullish(),
  series: z.string().nullish(),
  product: z.string().nullish(),
  productType: z.string().nullish(),
  vehicleType: z.string().nullish(),
  condition: z.string().nullish(),
  category: z.string().nullish(),
  partCategory: z.string().nullish(),
  price: z.number().nullish(),
  description: z.string().nullish(),
  color: z.string().nullish(),
  storage: z.string().nullish(),
  origin: z.string().nullish(),
  warranty: z.string().nullish(),
  exchangeable: z.string().nullish(),
  confidence: z.number().min(0).max(1).nullish(),
  fieldConfidence: z
    .object({
      brand: z.number().min(0).max(1).nullish(),
      model: z.number().min(0).max(1).nullish(),
      vehicleType: z.number().min(0).max(1).nullish(),
      partCategory: z.number().min(0).max(1).nullish(),
      product: z.number().min(0).max(1).nullish()
    })
    .nullish()
});

function deriveFieldConfidence(raw?: any): ListingFieldConfidence {
  return {
    brand: raw?.brand ?? 0.5,
    model: raw?.model ?? 0.5,
    vehicleType: raw?.vehicleType ?? 0.5,
    partCategory: raw?.partCategory ?? 0.5,
    product: raw?.product ?? 0.5
  };
}

export function buildListingName(brand: string, model: string, product: string) {
  return [brand, model, product].filter(Boolean).join(" ").trim().toUpperCase();
}

export function normalizeListingDraft(input: unknown, context: { imageUrl: string; imagePath: string }) {
  const raw = RawGroqDraftSchema.parse(input);
  const warnings: string[] = [];
  const fieldConfidence = deriveFieldConfidence(raw.fieldConfidence);

  const brand = (raw.brand ?? "").trim();
  const model = (raw.model ?? "").trim();
  const product = (raw.product ?? "").trim();

  const vehicleType = raw.vehicleType?.trim() || brand || "Apple";
  const partCategory = raw.partCategory?.trim() || model || "iPhone";
  const category = "Cep Telefonu";

  const series = (raw.series ?? "").trim() || model;
  const productType = (raw.productType ?? "").trim() || product;
  const condition = (raw.condition ?? "").trim() || DEFAULT_CONDITION;
  const name = buildListingName(brand, model, product);
  const slug = slugify(name, { lower: true, strict: true, locale: "tr" });

  if (fieldConfidence.brand < 0.65) warnings.push("Marka dusuk guvenle tespit edildi.");
  if (fieldConfidence.model < 0.65) warnings.push("Model dusuk guvenle tespit edildi.");

  const confidence = raw.confidence ?? 0.85;

  const draft: ListingDraft = {
    _id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    slug,
    brand,
    model,
    series,
    product,
    productType,
    vehicleType,
    condition,
    category,
    partCategory,
    price: raw.price ?? 25000,
    description: raw.description?.trim() || "Cihaz kozmetik olarak temiz durumdadır. Tüm fonksiyonları aktif olarak çalışmaktadır.",
    color: raw.color?.trim() || "Siyah",
    storage: raw.storage?.trim() || "128 GB",
    origin: raw.origin?.trim() || "Yurt içi",
    warranty: raw.warranty?.trim() || "Garantisi Yok",
    exchangeable: raw.exchangeable?.trim() || "Hayır",
    imageUrl: context.imageUrl,
    imagePath: context.imagePath,
    inStock: true,
    createdAt: new Date().toISOString(),
    categoryPath: ["İkinci El ve Sıfır Alışveriş", "Cep Telefonu", "Modeller", vehicleType, partCategory],
    confidence,
    fieldConfidence,
    sourceHints: [],
    warnings
  };

  return draft;
}
