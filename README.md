# İLANLA

Google Lens + Groq + Puppeteer ile araç parçası görselinden sahibinden ilan akışı oluşturan Next.js uygulaması.

## Özellikler

- Tek ekranlı kontrol merkezi
- Tarayıcıyı aç / sahibinden oturum aç / ilan ver sayfasını aç butonları
- Sahibinden oturum durumu kontrolü ve UI rozeti
- Görsel yükleme
- imgbb ile public preview URL oluşturma
- SerpApi Google Lens entegrasyonu
- Groq ile normalize ilan JSON üretimi
- Kategori ve araç tipi için deterministic fallback
- Düşük güvenli alanlar için önizleme ve kullanıcı onayı
- Puppeteer görünür Chrome ile `draft` ve `publish` modları

## Gerekli ortam değişkenleri

`.env.local` oluşturup aşağıdaki değerleri doldur:

```bash
SERPAPI_KEY=
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
IMGBB_API_KEY=
PUPPETEER_USER_DATA_DIR=./chrome-profile
CHROME_EXECUTABLE_PATH=
FIXED_LISTING_PRICE=1111
FIXED_LISTING_DESCRIPTION=Parca temiz durumda olup detaylar icin iletisime gecebilirsiniz.
```

## Kurulum

Bu ortamda `node` ve `npm` bulunmadığı için komutları burada çalıştıramadım. Kendi makinede:

```bash
npm install
npm run dev
```

Ardından [http://localhost:3000](http://localhost:3000) adresini aç.

## Önerilen kullanım
1. `Tarayıcıyı aç` veya `Sahibinden oturum aç` butonuyla kalıcı profilli Chrome oturumu başlat.
2. `Profil durumunu kontrol et` ile rozetin `Giriş yapılmış` durumuna geldiğini doğrula.
3. Gerekirse sahibinden hesabında giriş yap.
4. Uygulamaya dönüp görsel yükle.
5. `Lens + Groq analizi başlat` ile taslak veriyi oluştur.
6. Önizlemede marka, model, araç tipi ve kategori yolunu kontrol et.
7. İstersen `Taslak olarak doldur`, istersen `Sahibinden'de yayınla`.

## Puppeteer notları

- Tarayıcı görünür çalışır.
- Login oturumu `PUPPETEER_USER_DATA_DIR` klasöründe korunur.
- Bu profil, senin normal Chrome profilinden ayrıdır.
- Normal Chrome'da zaten giris yapmis olsan bile İLANLA profilinde ilk kez ayrica giris yapman gerekir.
- İlk çalıştırmada sahibinden girişi kullanıcı tarafından tamamlanmalıdır.
- `draft` modu formu doldurur ve son yayın tıklamasından önce durur.
- `publish` modu düşük güvenli alanlar gözden geçirildikten sonra tam yayın akışını dener.

## Mevcut sınırlar


- Sahibinden selector’ları şu an verilen HTML örneklerine göre yazıldı.
- Fiyat ve açıklama global sabit değerlerden gelir.
- Ürün tipi eşlemesi ilk sürümde `tampon`, `far`, `stop` gibi temel kurallarla yapılıyor.
- Chrome yolu gerekirse `CHROME_EXECUTABLE_PATH` ile açıkça verilmelidir.
