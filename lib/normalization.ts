import slugify from "slugify";
import { z } from "zod";

import {
  AUTO_CATEGORIES,
  CATEGORY_OPTIONS,
  DEFAULT_CONDITION,
  SAHIBINDEN_ROOT_PATH,
  VEHICLE_TYPES,
  VEHICLE_TYPE_OPTIONS
} from "@/lib/catalog";
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
  sourceHints: z.array(z.string().nullish()).nullish(),
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

function normalizedText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findVehicleTypeByBrandModel(brand: string, model: string) {
  const normalizedBrand = normalizedText(brand);
  const normalizedModel = normalizedText(model);

  for (const vehicleType of VEHICLE_TYPES) {
    for (const reference of vehicleType.brands) {
      if (normalizedText(reference.marka) !== normalizedBrand) {
        continue;
      }

      if (reference.modeller.some((item) => normalizedText(item) === normalizedModel)) {
        return vehicleType.name;
      }

      if (!normalizedModel && reference.modeller.length > 0) {
        return vehicleType.name;
      }
    }
  }

  return null;
}

function findPartCategory(...values: string[]) {
  const text = normalizedText(values.filter(Boolean).join(" "));

  for (const category of AUTO_CATEGORIES) {
    if (category.keywords.some((keyword) => text.includes(normalizedText(keyword)))) {
      return category.label;
    }
  }

  return null;
}

function deriveFieldConfidence(raw?: any): ListingFieldConfidence {
  return {
    brand: raw?.brand ?? 0.5,
    model: raw?.model ?? 0.5,
    vehicleType: raw?.vehicleType ?? 0.5,
    partCategory: raw?.partCategory ?? 0.5,
    product: raw?.product ?? 0.5
  };
}

function fixedListingPrice() {
  const raw = Number(process.env.FIXED_LISTING_PRICE ?? "1111");
  return Number.isFinite(raw) && raw > 0 ? raw : 1111;
}

function fixedListingDescription() {
  return (
    process.env.FIXED_LISTING_DESCRIPTION ??
    "Parca temiz durumda olup detaylar icin iletisime gecebilirsiniz."
  );
}

export function buildListingName(brand: string, model: string, product: string, domain?: string) {
  const parts = [brand, model, product];
  if (domain !== "Akıllı Telefon") {
    parts.push("ÇIKMA ORİJİNAL");
  }
  return parts.filter(Boolean).join(" ").trim().toUpperCase();
}

export function normalizeListingDraft(input: unknown, context: { imageUrl: string; imagePath: string; domain?: string }) {
  const raw = RawGroqDraftSchema.parse(input);
  const warnings: string[] = [];
  const sourceHints = ((raw.sourceHints || []) as string[]).filter(Boolean);
  const fieldConfidence = deriveFieldConfidence(raw.fieldConfidence);

  const brand = (raw.brand ?? "").trim();
  const model = (raw.model ?? "").trim();
  const product = (raw.product ?? "").trim();
  const domain = context.domain || "Yedek Parça";

  let vehicleType = (raw.vehicleType ?? "").trim() || "Belirsiz";
  let partCategory = (raw.partCategory ?? "").trim() || "Belirsiz";
  let category = domain;

  if (domain === "Yedek Parça") {
    vehicleType = raw.vehicleType?.trim() || findVehicleTypeByBrandModel(brand, model) || "Otomobil & Arazi Aracı";
    if (!VEHICLE_TYPE_OPTIONS.includes(vehicleType)) {
      warnings.push(`Arac tipi referans listesinde dogrulanamadi: ${vehicleType}`);
    }

    partCategory = raw.partCategory?.trim() || findPartCategory(product, sourceHints.join(" ")) || "Kaporta & Karoser";
    if (!CATEGORY_OPTIONS.includes(partCategory)) {
      warnings.push(`Parca kategorisi keyword fallback ile de tam eslesmedi: ${partCategory}`);
    }
  } else if (domain === "Akıllı Telefon") {
    vehicleType = raw.vehicleType?.trim() || brand || "Apple";
    partCategory = raw.partCategory?.trim() || model || "iPhone";
    category = "Cep Telefonu";
  }

  const series = (raw.series ?? "").trim() || model;
  const productType = (raw.productType ?? "").trim() || product;
  const condition = (raw.condition ?? "").trim() || DEFAULT_CONDITION;
  const name = buildListingName(brand, model, product, domain);
  const slug = slugify(name, { lower: true, strict: true, locale: "tr" });

  if (fieldConfidence.brand < 0.65) {
    warnings.push("Marka dusuk guvenle tespit edildi.");
  }
  if (fieldConfidence.model < 0.65) {
    warnings.push("Model dusuk guvenle tespit edildi.");
  }
  if (fieldConfidence.vehicleType < 0.65) {
    warnings.push("Arac tipi dusuk guvenle tespit edildi.");
  }
  if (fieldConfidence.partCategory < 0.65) {
    warnings.push("Parca kategorisi dusuk guvenle tespit edildi.");
  }

  const confidence =
    raw.confidence ??
    Number(
      (
        (fieldConfidence.brand +
          fieldConfidence.model +
          fieldConfidence.vehicleType +
          fieldConfidence.partCategory +
          fieldConfidence.product) /
        5
      ).toFixed(2)
    );

  const fallbackPrice = domain === "Akıllı Telefon" ? 25000 : fixedListingPrice();
  const fallbackDesc = domain === "Akıllı Telefon"
    ? "Cihaz kozmetik olarak temiz durumdadır. Tüm fonksiyonları aktif olarak çalışmaktadır. Detaylı bilgi için iletişime geçebilirsiniz."
    : fixedListingDescription();

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
    price: raw.price ?? fallbackPrice,
    description: raw.description?.trim() || fallbackDesc,
    color: raw.color?.trim() || (domain === "Akıllı Telefon" ? "Siyah" : undefined),
    storage: raw.storage?.trim() || (domain === "Akıllı Telefon" ? "128 GB" : undefined),
    origin: raw.origin?.trim() || (domain === "Akıllı Telefon" ? "Yurt içi" : undefined),
    warranty: raw.warranty?.trim() || (domain === "Akıllı Telefon" ? "Garantisi Yok" : undefined),
    exchangeable: raw.exchangeable?.trim() || (domain === "Akıllı Telefon" ? "Hayır" : undefined),
    imageUrl: context.imageUrl,
    imagePath: context.imagePath,
    inStock: true,
    createdAt: new Date().toISOString(),
    categoryPath: domain === "Akıllı Telefon" 
      ? ["İkinci El ve Sıfır Alışveriş", "Cep Telefonu", "Modeller", vehicleType, partCategory]
      : [...SAHIBINDEN_ROOT_PATH, category, vehicleType, partCategory],
    confidence,
    fieldConfidence,
    sourceHints,
    warnings
  };

  return draft;
}
