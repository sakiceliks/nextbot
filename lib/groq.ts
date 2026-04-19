import { AUTO_CATEGORIES, VEHICLE_TYPES } from "@/lib/catalog";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function truncate(value: string, limit = 220) {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function pickStringsDeep(input: unknown, limit = 40) {
  const values: string[] = [];

  function walk(node: unknown) {
    if (values.length >= limit) {
      return;
    }

    if (typeof node === "string") {
      const trimmed = node.trim();
      if (trimmed) {
        values.push(truncate(trimmed, 180));
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
        if (values.length >= limit) {
          break;
        }
      }
      return;
    }

    if (node && typeof node === "object") {
      for (const value of Object.values(node)) {
        walk(value);
        if (values.length >= limit) {
          break;
        }
      }
    }
  }

  walk(input);
  return values;
}

function summarizeLensPayload(lensPayload: unknown) {
  const payload = lensPayload as Record<string, unknown> | null;
  const visualMatches = Array.isArray(payload?.visual_matches)
    ? payload?.visual_matches.slice(0, 6)
    : [];
  const knowledgeGraph = payload?.knowledge_graph ?? null;
  const relatedContent = Array.isArray(payload?.related_content)
    ? payload?.related_content.slice(0, 4)
    : [];

  return {
    title:
      typeof payload?.search_metadata === "object" &&
      payload?.search_metadata &&
      typeof (payload.search_metadata as Record<string, unknown>).google_lens_url === "string"
        ? truncate((payload.search_metadata as Record<string, unknown>).google_lens_url as string, 120)
        : null,
    knowledgeGraph: knowledgeGraph
      ? pickStringsDeep(knowledgeGraph, 10)
      : [],
    topVisualMatches: visualMatches.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        title: typeof record.title === "string" ? truncate(record.title) : "",
        source: typeof record.source === "string" ? truncate(record.source, 80) : "",
        price: typeof record.price === "string" ? record.price : "",
        snippet: typeof record.snippet === "string" ? truncate(record.snippet) : ""
      };
    }),
    relatedContent: relatedContent.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        title: typeof record.title === "string" ? truncate(record.title) : "",
        snippet: typeof record.snippet === "string" ? truncate(record.snippet) : ""
      };
    }),
    extractedTerms: pickStringsDeep(lensPayload, 24)
  };
}

function compactVehicleReferences() {
  return VEHICLE_TYPES.map((vehicleType) => ({
    name: vehicleType.name,
    brands: vehicleType.brands.slice(0, 20).map((brand) => ({
      marka: brand.marka,
      modeller: brand.modeller.slice(0, 12)
    }))
  }));
}

function compactCategoryReferences() {
  return {
    basePath: ["Yedek Parça", "Otomobil & Arazi Aracı|Minivan & Panelvan|Ticari Araçlar", "Ateşleme & Yakıt|Egzoz|Elektrik|Filtre|Fren & Debriyaj|Isıtma & Havalandırma & Klima|Kaporta & Karoser|Mekanik|Motor|Şanzıman & Vites|Yürüyen & Direksiyon"],
    keywordRules: AUTO_CATEGORIES
  };
}

function buildPrompt(lensPayload: unknown, imageUrl: string) {
  const lensSummary = summarizeLensPayload(lensPayload);
  return [
    "Sen bir arac parcasi ilan asistansin.",
    "Gorevin Google Lens sonucundan normalize bir ilan taslagi JSON'u uretmek.",
    "Asla aciklama uydurma; emin olmadigin alanlarda dusuk confidence ver ve warnings olusturulmasi icin alanlari bos birakmaya yakin davran.",
    "Kategori seciminde su kurallari uygula:",
    "- Marka ve modelden arac tipi bul.",
    "- Fiat Doblo gibi modeller Minivan & Panelvan tarafina gider.",
    "- Audi A3 gibi modeller Otomobil & Arazi Araci tarafina gider.",
    "- Tampon, kaput, camurluk, kapi gibi urunler Kaporta & Karoser.",
    "- Far, stop, sensor, akü gibi urunler Elektrik.",
    "Asagidaki JSON formatinda cevap ver:",
    JSON.stringify(
      {
        brand: "Fiat",
        model: "Doblo",
        series: "Doblo",
        product: "Arka Tampon",
        productType: "Tampon",
        vehicleType: "Minivan & Panelvan",
        condition: "İkinci El",
        category: "Yedek Parça",
        partCategory: "Kaporta & Karoser",
        sourceHints: ["lens basligi", "benzer urun sonucu"],
        confidence: 0.84,
        fieldConfidence: {
          brand: 0.91,
          model: 0.9,
          vehicleType: 0.87,
          partCategory: 0.89,
          product: 0.93
        }
      },
      null,
      2
    ),
    "Referans category kurallari:",
    JSON.stringify(compactCategoryReferences()),
    "Referans vehicle types:",
    JSON.stringify(compactVehicleReferences()),
    `Gorsel URL: ${imageUrl}`,
    "Google Lens ozeti:",
    JSON.stringify(lensSummary)
  ].join("\n");
}

export async function analyzeWithGroq(lensPayload: unknown, imageUrl: string) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

  if (!apiKey) {
    throw new Error("GROQ_API_KEY tanimli degil.");
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Yanitini yalnizca gecerli bir JSON object olarak don. Markdown, aciklama veya code block kullanma."
        },
        {
          role: "user",
          content: buildPrompt(lensPayload, imageUrl)
        }
      ]
    })
  });

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error("Groq hatasi: 413 - gonderilen prompt/payload cok buyuk. Lens ozeti daha da kucultulmeli.");
    }
    throw new Error(`Groq hatasi: ${response.status}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq cevabinda content bulunamadi.");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Groq gecersiz JSON dondurdu.");
  }
}
