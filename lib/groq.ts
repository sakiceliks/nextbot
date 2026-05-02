const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function buildPrompt() {
  return `Akıllı Telefon Analizinde 
Sen bir elektronik eşya kayıt asistanısın. Kullanıcı sana bir cihazın 
"Hakkında" ekran görüntüsünü gönderdiğinde, aşağıdaki formu otomatik 
olarak doldurman gerekiyor.

## FORM ALANLARI VE ÇIKARMA KURALLARI:

**Marka:**
- Model adından çıkar (örn. "iPhone" → Apple, "Galaxy" → Samsung, 
  "Pixel" → Google, "Xperia" → Sony)

**Model:**
- Ekranda "Model Adı" veya "Model Name" alanından al
- Örn: "iPhone 11", "Galaxy S23"

**Ürün:**
- Marka + Model + Kapasite birleştir
- Örn: "Apple iPhone 11 256GB"

**Ürün Tipi:**
- iPhone/Android telefon → "Akıllı Telefon"
- iPad/Galaxy Tab → "Tablet"
- Mac/Surface → "Bilgisayar"
- Apple Watch → "Akıllı Saat"

**Fiyat (₺):**
- Görselde bu bilgi olmaz, kullanıcıya sor:
  "Cihazın fiyatını girer misiniz?"

**Açıklama:**
- Şu formatta yaz:
  "[Marka] [Model], [Kapasite] kapasite, [Kullanılabilir Alan] 
  kullanılabilir, [iOS/Android Sürümü], Seri No: [Seri Numarası]"

**Renk:**
- Görselde genellikle bu bilgi bulunmaz.
- Kullanıcıya sor: "Cihazın rengi nedir?"
- Seçenekler: Siyah, Beyaz, Altın, Gümüş, Mor, Mavi, Yeşil, Kırmızı

**Kapasite:**
- "Kapasite" satırından al
- Örn: 256 GB → "256 GB" seç

**Alındığı Yer:**
- Model Numarasının sonundaki ülke koduna bak:
  - TU/A veya TR → "Yurt içi"
  - LL/A → ABD (Yurt dışı)
  - GB/A → İngiltere (Yurt dışı)
  - Diğer ülke kodları → "Yurt dışı"

**Garanti:**
- "Kapsam Süresi Doldu" yazıyorsa → "Garantisiz"
- Tarih yazıyorsa → O tarihi garanti bitiş tarihi olarak yaz
- "Aktif Kapsam" yazıyorsa → "Garantili"

## NOTLAR:
- Eğer herhangi bir alan görselde net değilse, tahmin etme. 
  "Bu bilgi görselde mevcut değil" yaz ve kullanıcıya sor.
- Türkçe ekran görüntülerinde alan adları farklı olabilir, 
  her iki dili de tanı.
- Her zaman kibar ve kısa yanıt ver.

Asagidaki JSON formatinda cevap ver:
{
  "brand": "Apple",
  "model": "iPhone 11",
  "series": "iPhone 11",
  "product": "Apple iPhone 11 256GB",
  "productType": "Akıllı Telefon",
  "vehicleType": "Apple",
  "condition": "İkinci El",
  "category": "Cep Telefonu",
  "partCategory": "iPhone 11",
  "price": null,
  "description": "Apple iPhone 11, 256 GB kapasite, 27,86 GB kullanılabilir, iOS 26.4.2, Seri No: DX3F37YDN73C",
  "color": null,
  "storage": "256 GB",
  "origin": "Yurt içi",
  "warranty": "Garantisiz",
  "confidence": 0.95
}`;
}

export async function analyzeWithGroq(_lensPayload: unknown, imageUrl: string) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = "meta-llama/llama-4-scout-17b-16e-instruct";

  if (!apiKey) {
    throw new Error("GROQ_API_KEY tanimli degil.");
  }

  const prompt = buildPrompt();
  
  const messages = [
    {
      role: "system",
      content: "Yanitini yalnizca gecerli bir JSON object olarak don. Markdown, aciklama veya code block kullanma."
    },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        }
      ]
    }
  ];

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq API Error Response:", errorText);
    throw new Error(`Groq hatasi: ${response.status} - ${errorText}`);
  }

  const json = await response.json();
  let content = json.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("Groq cevabinda content bulunamadi.");
  }

  if (content.includes("```")) {
    content = content.replace(/```json\n?|```/g, "").trim();
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    console.error("Parse Hatasi. Icerik:", content);
    throw new Error("Groq gecersiz JSON dondurdu.");
  }
}
