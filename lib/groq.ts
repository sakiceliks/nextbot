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

function compactCategoryReferences(domain: string) {
  if (domain === "Akıllı Telefon") {
    return {
      basePath: ["Cep Telefonu", "Modeller"],
      keywordRules: [{ label: "Cep Telefonu", keywords: ["telefon", "smartphone", "cep", "mobil"] }]
    };
  }
  return {
    basePath: ["Yedek Parça", "Otomobil & Arazi Aracı|Minivan & Panelvan|Ticari Araçlar", "Ateşleme & Yakıt|Egzoz|Elektrik|Filtre|Fren & Debriyaj|Isıtma & Havalandırma & Klima|Kaporta & Karoser|Mekanik|Motor|Şanzıman & Vites|Yürüyen & Direksiyon"],
    keywordRules: AUTO_CATEGORIES
  };
}

function buildPrompt(lensPayload: unknown, imageUrl: string, domain: string) {
  const lensSummary = summarizeLensPayload(lensPayload);
  
  const rules = domain === "Akıllı Telefon" 
    ? [
        "Sen bir akilli telefon ilan asistansin.",
        "Gorevin Google Lens sonucundan normalize bir ilan taslagi JSON'u uretmek.",
        "Google Lens fiyat verilerini (price) analiz ederek 'price' alanına uygun ve gerçekçi bir ikinci el Türkiye piyasası fiyatı (sadece rakam, örn: 35000) yaz. Eğer fiyat bulamazsan piyasa tahminine göre mantıklı bir değer üret.",
        "Cihazın durumu hakkında alıcıların ilgisini çekecek, satışı kolaylaştıracak profesyonel ve gerçekçi bir 'description' (açıklama) metni oluştur. Asla 'Parca temiz' gibi otomobil terimleri kullanma.",
        "Ayrıca şu alanları tahmin et veya varsayılan değerler ata:",
        "- color: 'Siyah', 'Beyaz', 'Altın', 'Gümüş', 'Mor' vb.",
        "- storage: '128 GB', '256 GB', '512 GB', '1 TB'",
        "- origin: 'Yurt içi' veya 'Yurt dışı'",
        "- warranty: 'Distribütör Garantili', 'İthalatçı Garantili' veya 'Garantisi Yok'",
        "- exchangeable: 'Evet' veya 'Hayır'",
        "Kategori seciminde su kurallari uygula:",
        "- Marka (ornegin Apple, Samsung) ve model (iPhone 13, Galaxy S21) cikar.",
        "- category her zaman 'Cep Telefonu', vehicleType telefon markasi (orn. Apple), partCategory ise telefon modeli (orn. iPhone 13) olmalidir."
      ]
    : [
        "Sen bir arac parcasi ilan asistansin.",
        "Gorevin Google Lens sonucundan normalize bir ilan taslagi JSON'u uretmek.",
        "Asla aciklama uydurma; emin olmadigin alanlarda dusuk confidence ver ve warnings olusturulmasi icin alanlari bos birakmaya yakin davran.",
        "Kategori seciminde su kurallari uygula:",
        "- Marka ve modelden arac tipi bul.",
        "- Fiat Doblo gibi modeller Minivan & Panelvan tarafina gider.",
        "- Audi A3 gibi modeller Otomobil & Arazi Araci tarafina gider.",
        "- Tampon, kaput, camurluk, kapi gibi urunler Kaporta & Karoser.",
        "- Far, stop, sensor, akü gibi urunler Elektrik."
      ];

  const exampleJson = domain === "Akıllı Telefon"
    ? JSON.stringify(
        {
          brand: "Apple",
          model: "iPhone 13",
          series: "13 Serisi",
          product: "iPhone 13 128 GB",
          productType: "Akıllı Telefon",
          vehicleType: "Apple",
          condition: "İkinci El",
          category: "Cep Telefonu",
          partCategory: "iPhone 13",
          price: 35000,
          description: "Cihaz kozmetik olarak kusursuz olup, çalışmayan hiçbir aksamı yoktur. True Tone ve Face ID aktiftir. Batarya sağlığı çok iyi durumdadır. Kutu ve fatura mevcuttur.",
          color: "Siyah",
          storage: "128 GB",
          origin: "Yurt içi",
          warranty: "Garantisi Yok",
          exchangeable: "Hayır",
          sourceHints: ["lens basligi"],
          confidence: 0.9,
          fieldConfidence: {
            brand: 0.95,
            model: 0.95,
            vehicleType: 0.9,
            partCategory: 0.9,
            product: 0.95
          }
        },
        null,
        2
      )
    : JSON.stringify(
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
      );

  return [
    ...rules,
    "Asagidaki JSON formatinda cevap ver:",
    exampleJson,
    "Referans category kurallari:",
    JSON.stringify(compactCategoryReferences(domain)),
    "Referans vehicle types:",
    domain === "Yedek Parça" ? JSON.stringify(compactVehicleReferences()) : "[]",
    `Gorsel URL: ${imageUrl}`,
    "Google Lens ozeti:",
    JSON.stringify(lensSummary)
  ].join("\n");
}

export async function analyzeWithGroq(lensPayload: unknown, imageUrl: string, domain: string = "Yedek Parça") {
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
          content: buildPrompt(lensPayload, imageUrl, domain)
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
