# GTİP kaynak ve kod incelemesi - 1 Ekim 2026

## Sonuç

Kullanıcı seçimi hatalı değil. Paylaşılan belgeler arasında somut kod uyuşmazlığı var; yazılımda da bu durumu kalıcı engel olarak ele alan ve aynı GTİP'in ürün alt türlerini desteklemeyen eksiklik vardı. Yalnızca “belge yanlış, kod sağlam” demek doğru değildi.

## Kanıt

| Dosya / konum | Kod | İçerik |
| --- | --- | --- |
| oyuncak gtip listesi.xlsx / ilk sayfa / satır 10 | 9503.00.10.00.19 | Diğerleri |
| oyuncak gümrük vergisi ve ilave gümrük vergisi.xlsx / Sayfa1 / satır 7 ve 48 | 9503.00.10.00.19 | GV ve İGV oranları |
| 2026-10 oyuncak denetimi HTM / ek liste sıra 27 | 9503.00.10.00.19 | Diğerleri |
| 2019-06 gözetim DOCX / ilk tablo / satır 5 | 9503.00.10.19.19 | Akülü arabalar hariç, 7.500 USD/brüt ton |
| Aynı DOCX / ilk tablo / satır 6 | 9503.00.10.19.19 | Yalnız akülü arabalar, 25.000 USD/brüt ton |

DOCX, geçmiş tabloları da içeriyor. Uygulama ilk tabloyu kullanıyordu; eski tabloyu yanlışlıkla seçmiş değil. İlk tablonun bu iki satırında diğer dosyalardan farklı kod bulunduğu doğrudan doğrulandı.

11.07.2026 tarihli değişiklik metninin AB Global üzerinde yayımlanan kopyası, iki alt türü 9503.00.10.00.19 altında ve aynı 7.500/25.000 tutarlarıyla gösteriyor:
https://abglobal.tr/ithalatta-gozetim-uygulanmasina-iliskin-teblig-teblig-no-2019-6de-degisiklik-yapilmasina-dair-teblig/

Resmî Gazete referansı: https://www.resmigazete.gov.tr/eskiler/2026/07/20260711-35.htm
Resmî Gazete aslı hem tarama aracı hem doğrudan indirme denemesinde erişilemedi. Bu nedenle düzeltmenin doğrulama seviyesi `cross-checked-secondary` olarak tutuluyor; resmî metin doğrudan doğrulandı iddiası yok. Belge sağlayıcıdan bu iki satırın güncel resmî metne göre düzeltilmesi istenmeli.

## Kod bulguları ve düzeltmeler

1. Kaynak aktarımında belirli GTİP'e sabit `conflict` atanıyordu. Bunun yerine ayrı, gerekçeli kaynak düzeltmesi kaydı kondu. Orijinal dosyalar değişmedi; kaynak satırları ve eski kod saklanıyor.
2. Motor yalnız tek gözetim oranı destekliyordu. Aynı GTİP için alt tür bazlı oranlar eklendi. Ürün adımında “Bu ürün akülü araba mı?” sorusu zorunlu; seçim yapılmadan rastgele oran kullanılmıyor.
3. Alt tür seçimi ağırlık/kur üzerinden gözetim hesabına, ekrandaki kaynak formülüne ve PDF/Excel raporuna taşındı. Ürün değişince eski alt tür siliniyor; alt tür değişince belge/beyan teyitleri geçersiz kılınıyor.
4. Çoklu kaynak satırlarının `null` oranla gözetime tabi değilmiş gibi ele alınması önlendi; tanımsız çoklu kayıtlar alt tür tanımlanana kadar açık hata veriyor.
5. Fiyat maskesindeki sayısal 1.234 değerinin yeniden metne çevrilip 1234 okunması olasılığı giderildi. İçeride zaten sayısal olan değer yeniden ayrıştırılmıyor.

## Kontroller

- 39 ürün × 2 vergi tablosu × 7 grup = 546 oran hücresi kaynak Excel ile birebir eşleşiyor.
- 21 GTİP için doğrudan gözetim eşleşmesi; 1 GTİP için iki alt tür; 17 GTİP ilk gözetim tablosunda yer almıyor. “Listede yok”, bütün mevzuatta kesin muafiyet demek değildir.
- 39 GTİP / 40 alt tür senaryosu ürün adımını geçiyor ve sayısal ön hesap üretiyor.
- 1.000 brüt kg, 40 TL/USD: akülü araba referansı 1.000.000 TL; diğer alt tür 300.000 TL. Her ikisinde gerçek kıymet değişmeden korunuyor.
- 64 otomatik test başarılı: kaynak düzeltmesi, alt tür, değişiklikte teyit sıfırlama, maske, mevcut motor, adım kontrolleri, sektör ve sunucu testleri.

## Sınır

Bu inceleme kod/veri tutarlılığı ve mevcut belgelerin aktarımını denetler; tüm ülke tercihleri veya tüm güncel mevzuat için hukuki doğrulama değildir. Kolay modun Diğer Ülkeler oranları bir genel tarife senaryosu olarak etiketlenmeye devam eder. Yeni kaynak geldiğinde düzeltme kaydı yeniden kontrol edilmelidir.
