# Çok sektörlü ithalat hesaplayıcısı

Ürün genel bir ithalat maliyeti platformudur. Oyuncak ilk pilot veri paketidir; teknoloji, tekstil ve diğer sektörler henüz hesaplamaya açık değildir.

## Katmanlar

- `data/sectors.json`: sektör kimliği, yayın durumu, katalog yolu, hesap modeli, gözetim birimi, tarife karar politikası ve ürün grupları. Yeni sektörler önce `planned` olarak kaydedilir.
- `src/sectors.js`: tarayıcı ve sunucunun ortak katalog yükleme/doğrulama sınırı. Aktif olmayan sektör, desteklenmeyen model/birim veya uygulanmamış zorunlu kurallar reddedilir.
- Sektör kataloğu: GTİP, vergi oranları, kaynaklar, geçerlilik aralığı, gözetim ve denetim verileri. `data/catalog.json` mevcut oyuncak paketidir; kaynak çıkarma betiği yalnız bu pilot dosyasını üretir. Başka sektörler ayrı dosyalarda tutulur.
- `src/engine.js` ve `decimal.js`: ortak kıymet/matrah/para hesapları. Ürün üzerindeki `vatRate`, katalog oranını geçersiz kılar. Başka sektörlere otomatik %20 atanmaz.
- `src/rules.js`: açık tarife kararları. AB/A.TR pilot politikası yalnız açıkça seçilen paketlerde çalışır; yeni paketin varsayılanı uzman teyididir.
- `src/app.js`: aktif paketin ürün gruplarını gösteren ortak soru akışı. Paket değişiminde önceki GTİP, tutarlar, belge teyitleri ve sonuç sıfırlanır.
- `server.mjs`: istemcinin sektör kimliğinden sunucudaki paketi seçer ve hesabı tekrar yapar. İstemciden oran/katalog kabul etmez. Talep ve sonuç sektör kimliği ile veri sürümünü içerir.

## Yeni sektör açma süreci

1. Sektöre özgü GTİP, menşe/belge, vergi, gözetim, denetim ve kaynak tarihlerini doğrula.
2. Ayrı katalog oluştur; ürün gruplarında açık `productCodes` kullan. GTİP basamaklarından sektörden bağımsız grup çıkarımı yapma.
3. Hesaplama gereksinimlerini belirle. Mevcut `ad-valorem-v1`, yüzde bazlı GV/İGV/KDV ve USD/brüt ton gözetimi destekler. Miktara bağlı vergi, ÖTV, farklı gözetim birimi veya yeni zorunlu sorular için önce ayrı model/kurallar ve ilgili kullanıcı alanları geliştirilmelidir. Bunları mevcut modele uydurma. Eksik kuralları `requiredRules` ile belirt; doluysa katalog açılmaz.
4. Sektörün bağımsız örnekleri, eşik durumları ve belirsiz girdileri için test ekle. Farklı sektör verilerinin karışmadığını doğrula.
5. Model ve veriler hazır olduğunda durumu `active` yap. Dosya sunum izni kayıtlı aktif kataloglardan türetilir.

## Mevcut sınırlar

Tek hesap tek GTİP ve tek kalemdir. Çok kalemli sepet ve ortak navlun dağıtımı ayrı geliştirme gerektirir. ÖTV/antidamping gibi ek yükümlülüklerin otomatik hesapları henüz yoktur. Teknoloji ve tekstil için gerçek tarife verisi eklenmemiştir. Testteki ikinci katalog tamamen sentetiktir ve canlı ürün olarak yayımlanmaz.

Eski istemcilerin sektör kimliği olmayan talepleri geçiş uyumluluğu için kayıtlı varsayılan oyuncak pilotuna bağlanır. Yeni arayüz sektör kimliğini daima gönderir. Bilinmeyen veya planlanan sektör kimliği asla oyuncak kataloğuna düşmez.
