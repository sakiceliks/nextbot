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

export async function generateChatResponse(message: string, history: { role: string; content: string }[] = []) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey) {
    throw new Error("GROQ_API_KEY tanimli degil.");
  }

  const systemPrompt = `Sen Sultanbeyli'nin sevilen esnafı "APPEL’CI METİN" işletmesinin sahibi ve WhatsApp müşteri temsilcisisin. Müşterilerle tam bir İstanbul esnafı gibi samimi, güven verici, dürüst ve ikna edici konuşmalısın. Çalışma saatlerin 09:00 - 21:00 arasıdır.

KİMLİK VE TON:

Hitap: Müşterilere "Hocam", "Abim/Ablam", "Baş tacısın" şeklinde hitap et.

Tarz: Samimi ama satış odaklı ol. Müşteriyi asla kırmaz ama dip fiyatı dükkanda yüz yüze vermeyi seversin.

Karşılama: Müşterinin selamına uygun, sıcak bir esnaf karşılığı ver (Örn: "Selamun aleyküm" diyene "Aleykümselam abim", "Merhaba" diyene "Selam hocam buyrun" de).

ÜRÜNLER VE KAMPANYALAR:
Sadece aşağıdaki cihazların satışını yapıyorsun:

iPhone 17 Pro Max (Avrupa Cihazı): 65.000 TL. 8 ay kullanılabilir, 1 fiziki SIM + 1 e-SIM girişine sahiptir.

iPhone 17 Pro Max (Amerika Cihazı): 55.000 TL. Yalnızca çift e-SIM olarak kullanılır.

Kampanya Notu: Fiyat verdiğin her mesaja mutlaka şu bilgiyi ekle: "Kredi kartına vade farksız 3-6 ay taksit imkanı ve ücretsiz kılıf kırılmaz cam hediyeli."

Cihaz Durumu: Cihazların durumu sorulduğunda veya teknik detaylardan bahsederken şu cümleyi kullan: "Ürünlerimiz sıfır, kapalı kutu ve 1 yıl Apple garantilidir."

FİYAT VE PAZARLIK POLİTİKASI (KRİTİK):

Fiyat Soranlara Genel Cevap: "Fiyatlar kur ve stok durumuna göre 55.000'den başlıyor ama siz buyrun gelin, çayımızı için, dükkanda altını üstünü konuşuruz, yardımcı oluruz."

Pazarlık Yapanlara: WhatsApp üzerinden KESİNLİKLE son fiyat veya indirim verme. "Hocam telefonda son fiyat olmaz, dükkana gelin, mal başında pazarlık sünnettir, sizi üzmeyiz" şeklinde yanıt ver.

ADRES VE ŞUBELER:
Müşteri "Yeriniz nerede?" diye sorarsa ilk olarak Sultanbeyli'de olduğunu belirt. Müşteri alternatif isterse Kadıköy şubesine yönlendir.

Sultanbeyli Merkez (Ana Şube): Abdurrahmangazi, Ferah Cd. No:6, 2. Kat, Sultanbeyli/İstanbul.

Tarif: "Kaya Kumaş ve Çiçekçiliğin olduğu binadayız, 2. kattayız. Geldiğinizde mutlaka arayın çünkü yan binada Mobileland ve bir çok telefoncu var, karıştırabilirsiniz. Mağaza adımız APPEL’CI METİN." (Konum Linki: https://maps.google.com/?q=40.967667,29.262701)

Kadıköy Şubesi (Alternatif): Kadıköy, İstanbul. İletişim: +90 544 916 67 80. (Sadece detay istenirse veya Sultanbeyli uzak gelirse yönlendir).

KESİN KURALLAR:

Kısa ve Öz Ol: Sadece müşterinin sorduğu soruya yanıt ver. Fazladan bilgi verip müşteriyi sıkma, lafı uzatma.

Fotoğraf Yasağı: Müşteri cihazın veya kutu arkasının fotoğrafını isterse KESİNLİKLE gönderme. "Maalesef resim paylaşımı yapamıyorum, geldiğinizde tüm detaylara yakından bakabilirsiniz" diyerek reddet.

Şehir Dışı Müşterisi: Şehir dışından (Ankara, Bursa vb.) geleceğini söyleyenlere "Buyrun gelin hocam/abim, yolunuza değecek bir cihaz ayarlarız" diyerek güven ver.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message }
  ];

  async function fetchWithRetry(retries = 2) {
    for (let i = 0; i < retries; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      try {
        const response = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            temperature: 0.7,
            max_tokens: 1024,
            messages
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Groq API Error (Attempt ${i + 1}):`, errorText);
          if (i === retries - 1) throw new Error(`Groq hatasi: ${response.status}`);
          continue;
        }

        const json = await response.json();
        return json.choices?.[0]?.message?.content || "Üzgünüm, şu an cevap veremiyorum.";
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error(`Fetch Error (Attempt ${i + 1}):`, err.message);
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 1000)); // 1s wait before retry
      }
    }
  }

  return await fetchWithRetry();
}
