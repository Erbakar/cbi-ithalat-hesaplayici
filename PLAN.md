# Ürün planı ve uygulama kararı

## Amaç

CBI sitesinde, oyuncak ithalatını planlayan işletmenin gerekli verileri anlaşılır adımlarla girmesi, vergilerin nasıl hesaplandığını görmesi ve isterse bu hesabı iletişim talebine dönüştürmesi. Hesaplama tamamlanmadan kişisel bilgi istenmez. KDV dahil nakit ihtiyacı ile muhasebe maliyeti birbirine karıştırılmaz.

## v2 uygulama güncellemesi

- Varsayılan kolay mod: uzman tarife kısaltmaları gizlenir; menşe ve belgelerle güvenilir şekilde çözülemeyen oran bilinmiyor kalır.
- Açık genel tarife karşılaştırması, gerçek vergi oranı gibi gösterilmez. Koşulları teyitli AB senaryosu kurallarla çözümlenir.
- Alan açıklamaları, çıkışta hata kontrolü, tıklanabilir hata listesi ve eksik bilgiye dönüş bağlantıları eklenmiştir.
- Ödeme şekli ve vadeli ödemeye bağlı fon / vergi kontrolü ayrıca sorulur.
- Bağımlı teyitler ürün, ülke, tarih, miktar, ağırlık ve ödeme değişikliklerinde temizlenir.
- Gemini yalnız soruyu yardım başlığına yönlendirir; sunucu statik açıklamayı döndürür. Hesap motoruna model çıktısı girmez.
- Kuruş hesabı tam sayı aritmetiğiyle yapılır. Belirsiz binlik yazımları ve aşırı büyük sonuçlar engellenir.
- Otomatik kontrol paketi: 46 test. Hesap senaryoları, kararlar, kaynak değişikliği, yardım servisinin başarısız olması, modelin ek alan üretmesi, gizli dosyaların erişilememesi ve sunucuda yeniden hesaplama dahil.

## Ekran akışı

| Adım | Kullanıcıya sorulan soru | Hesaba etkisi / kontrol |
|---|---|---|
| 1. Ürün | Hangi oyuncak? Ürün grubu veya GTİP? | Dört kategori ile aday liste daralır. Kesin seçim 12 haneli GTİP’tir. Malzeme / oyuncak / parça bağlamı gösterilir. |
| 1. Kapsam | Yeni eşyanın ticari serbest dolaşıma girişi mi? | Desteklenmeyen rejim veya kişisel ithalat için genel formül uygulanmaz. |
| 2. Menşe | Ürün nerede üretildi? | Ürünün geldiği ülkeden ayrı kaydedilir. |
| 2. Sevk | Hangi ülkeden gönderiliyor? | Menşe ile karıştırılmaz; A.TR durumunu değerlendiren uzmana bağlam sağlar. |
| 2. Belge | A.TR veya uygun tercihli belge var mı? | Belgesiz tercihli oran engellenir. A.TR tek başına İGV istisnası sayılmaz. |
| 2. Tarife | Müşavirin teyit ettiği GV ve İGV grupları hangileri? | Kaynakta ülke eşleştirmesi yoktur; iki oran bağımsız kaynak sütunlarından alınır. Ülke / belge değişince teyit temizlenir. |
| 3. Miktar | Kaç adet? | Adet başına nakit ihtiyacı. Sıfır, negatif ve kesirli adet reddedilir. |
| 3. Ağırlık | Ambalaj dahil brüt kg? | Gözetim referansı. Net kg ile otomatik ikame yapılmaz. |
| 3. Tarih | Beyan tarihi? | Veri kesiti dışında veya geçersiz tarih reddedilir. |
| 3. Kur | Bedelin para birimi, işlem kuru, USD kuru? | USD/EUR/TRY desteklenir. USD için tutarlı tek kur, TL için 1; EUR için ayrıca USD gözetim kuru. |
| 3. Bedel | Navlun ve sigorta dahil mi? | Dahilse tekrar eklenmez. Ayrıysa iki tutar zorunludur; gerçek sıfır açıkça girilir. |
| 3. Kıymet unsurları | Bedelde bulunmayan diğer kıymet ilaveleri? | Gerçek kıymete eklenir; kıymet tespitinin hukuki incelemesini yazılım kendiliğinden yapmaz. |
| 4. Senaryo | Gerçek kıymet, belgeyle ithalat veya artırılmış beyan? | Otomatik `max(gerçek, gözetim)` kullanılmaz. Geçerli belge / artırılmış beyan teyitleri ayrı alınır. |
| 4. Artırılmış beyan | Toplam beyan tutarı? | Artış ayrı saklanır. Gerçek kıymetten düşük beyan reddedilir. Gözetim eşiğinin altında kalan artırılmış beyan, belge koşulu çözülmeden kabul edilmez. |
| 4. Vergiler | GV/İGV/KDV dışındaki vergi, resim ve harçlar? | KKDF dahil uygulanabilecek diğer kalemler kullanıcı tarafından hesaplanmış tutar olarak girilir; oran uydurulmaz. |
| 4. Giderler | KDV matrahına dahil giderler ve diğer nakit giderler? | Çifte sayım önlenmesi için ayrı tanımlanır. Boş değerler toplamı tamamlanmamış bırakır. |
| 5. Sonuç | Toplam nakit, adet başına tutar, vergi dökümü | Dört kıymet/matrah ayrı kutularda, oranlar ve kaynaklar izlenebilir. Eksik giderler / belge kontrolü görünür. |
| 5. İletişim | Ad, firma, e-posta; isteğe bağlı telefon | Açık talep ile sunucuda saklanır. Hesaplama için zorunlu değildir. |

## Oyunlaştırma

- Ürün grubunu somut oyuncak kategorilerinden seçme.
- Her adımda bir konuya odaklanma; ilgili olmayan alanları gizleme.
- Tamamlanan adımların işaretlenmesi, dört adım üzerinden ilerleme.
- Sağ panelde sevkiyat bilgilerinin bir araya gelmesi.
- Verileri kaybetmeden geri dönüş; sonuca yeniden ilerlerken tüm girdileri yeniden doğrulama.
- Örnek verilerle deneyimi keşfetme. Örnek açıkça etiketlenir ve talep olarak gönderilemez.
- Yanıta göre indirim, ödül veya yönlendirilmiş beyan önerisi yoktur; sonuç yalnız hesap girdilerinden oluşur.

## Hesap sırası

1. GTİP, kapsam, tarih, tarife grupları ve belgelerin doğrulanması.
2. Gerçek gümrük kıymetinin TL olarak kurulması.
3. GTİP’e özgü brüt ton gözetim referansının hesaplanması.
4. Açık senaryo seçimiyle beyan / gümrük vergisi matrahının belirlenmesi.
5. GV ve İGV’nin ayrı hesaplanması; diğer vergi/harçların eklenmesi.
6. KDV matrahının ayrı kurulması, %20 KDV.
7. Gerçek kıymet + vergiler + ilgili gerçek giderlerden nakit ihtiyacının kurulması. Beyan artışı tekrar eklenmez.
8. Adet başına tutar; eksik veri veya çözülmemiş ithalat koşulunun işaretlenmesi.

Tutarlar vergi kalemi seviyesinde kuruşa yuvarlanır. Toplamlar gösterilen yuvarlanmış kalemlerden oluşur. Para girişi binlik ayırıcı içermez; virgül ve nokta ondalık kabul edilir.

## Gerçekleştirilen doğrulama

- İlk sürümdeki 24 hesap testi (v2 ile korunur): bağımsız sayısal örnek, üç senaryo, eşik eşitliği, CIF tekrar sayım, EUR/USD, brüt kg dönüşümü, bilinmeyen/sıfır gider, A.TR, tercihli oran koşulları, kod uyuşmazlığı, parça oranları, geçersiz tarihler, kapsam dışı GTİP ve veri bütünlüğü.
- HTTP entegrasyon testi: arayüz sunumu, özel dosya erişiminin engellenmesi, hatalı / izinsiz kaynak isteği, onaysız kayıt, geçersiz GTİP, kalıcı kayıt, istemciden gelen sahte sonucun yerine sunucuda hesaplanan sonucun saklanması.
- Tarayıcıda baştan sona elle işletilen akış: ürün → menşe → sevkiyat → artırılmış beyan → sonuç. Bağımsız örnekle aynı 538.368,00 TL nakit ihtiyacı.
- 390 px mobil sonuç ekranı: yatay taşma yok. Gider silinince toplamın tamamlanmamış kalması doğrulandı.

## Canlıya geçiş için açık bağımlılıklar

Bu maddeler sessiz varsayımlarla kapatılmadı:

1. Bir GTİP’in kaynak kod uyuşmazlığı: gümrük müşavirinden doğru eşleşme ve akülü araba ayrımı.
2. Ülke → tarife grubu eşleştirmesi ve tüm oranların güncel resmi kontrolü: bugün kullanıcı teyidiyle seçim yapılır.
3. Nakliye, müşavirlik, test, depolama, KKDF ve diğer giderlerin gerçek tarifeleri: bugün kullanıcı tutarı girer; bilinmeyeni sıfır kabul etmeyiz.
4. Güncel kur servisi: bugün beyan kuru açıkça girilir; uydurma canlı kur yoktur.
5. CBI üretim sunucusu / WordPress erişimi ve CRM talep iş akışı: yerel çalışan sürüm hazır; siteye yayın ve dış bildirim yapılmadı.

Bu kapsamda uygulama bir ön hesap aracıdır. Gümrük beyannamesi hazırlamaz, ithalat izni vermez ve vergi hukukuna ilişkin uzman onayını taklit etmez.
