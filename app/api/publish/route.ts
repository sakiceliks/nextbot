import { NextResponse } from "next/server";
import { z } from "zod";

import { publishListing } from "@/lib/puppeteer";

const publishSchema = z.object({
  mode: z.enum(["draft", "publish"]),
  reviewedForPublish: z.boolean().optional(),
  draft: z.object({
    _id: z.string(),
    name: z.string(),
    slug: z.string(),
    brand: z.string(),
    model: z.string(),
    series: z.string(),
    product: z.string(),
    productType: z.string(),
    vehicleType: z.string(),
    condition: z.string(),
    category: z.string(),
    partCategory: z.string(),
    price: z.number(),
    description: z.string(),
    imageUrl: z.string(),
    imagePath: z.string(),
    inStock: z.boolean(),
    createdAt: z.string(),
    categoryPath: z.array(z.string()),
    confidence: z.number(),
    fieldConfidence: z.object({
      brand: z.number(),
      model: z.number(),
      vehicleType: z.number(),
      partCategory: z.number(),
      product: z.number()
    }),
    sourceHints: z.array(z.string()),
    warnings: z.array(z.string())
  })
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = publishSchema.parse(json);

    if (payload.mode === "publish" && payload.draft.warnings.length > 0 && !payload.reviewedForPublish) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dusuk guvenli alanlar gozden gecirilmeden publish moduna gecilemez."
        },
        { status: 400 }
      );
    }

    const result = await publishListing(payload.draft, payload.mode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Yayinlama sirasinda hata olustu."
      },
      { status: 500 }
    );
  }
}
