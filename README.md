# CBI oyuncak ithalat hesaplayıcısı

CBI’ın mevcut lacivert/beyaz kimliğini kullanan, dört bilgi adımı ve sonuç ekranından oluşan tek kalem oyuncak ithalat ön hesap uygulaması. İletişim bilgileri sonuçtan sonra, isteğe bağlı talep formuyla alınır.

## Çalıştırma

Node.js 20 veya üzeri gerekir. Paket kurulumu ve derleme gerekmez.

```sh
npm start
# http://127.0.0.1:4173
npm test
```

Tarayıcı dosyayı doğrudan açmak yerine sunucu adresini kullanmalıdır. Kaynaklar göreli adreslidir. `PORT`, `HOST`, `PUBLIC_ORIGIN`, `BASE_PATH`, `LEAD_STORAGE_DIR` ortam değişkenleri desteklenir. Varsayılan sunucu yalnız yerel bilgisayarda dinler.

## Karar ve yardım katmanı (v2)

Varsayılan kolay modda teknik tarife grupları sorulmaz. Kullanıcı menşe, sevk ve belge bilgilerini girer. Doğrulanmış AB menşei + AB sevki + geçerli A.TR koşulu için tercihli senaryo çözümlenir. Diğer durumlarda oranlar tahmin edilmez: kullanıcı inceleme özetiyle ilerler veya açıkça etiketlenen genel tarife karşılaştırmasını seçer. Müşavir bilgisiyle giriş sekmesi mevcut yedi grubun uzman seçimini korur.

“Bilmiyorum” seçimi belge, ödeme ve giderlerde desteklenir. Zorunlu tutarlar için alan bazlı hatalar ve “Bu bilgi nerede?” yardımı bulunur. Sonuçta eksik bilgiler ve ilgili adıma dönen bağlantılar yer alır. Vadeli / bilinmeyen ödeme, fon kontrolü tamamlanmadan KDV ve nakit toplamını tamamlanmış göstermez. Girdi değişiklikleri bağımlı teyitleri temizler.

Tutarlar altı ondalıklı ölçekten tam sayı aritmetiğiyle kuruşa yuvarlanır. Güvenli üst sınır aşılırsa sonuç yerine alan hatası döner. `1.000` / `1,000` gibi belirsiz üç basamaklı yazımlar reddedilir; bin için `1000`, üç ondalık hassasiyet için `1.2340` girilebilir.

### Gemini

Kullanıcının izin verdiği Hubpixel Gemini yapılandırması bu projenin `.env` dosyasına yalnız `GEMINI_API_KEY` ve `GEMINI_MODEL` olarak aktarıldı. Dosya 0600 erişimli, Git dışında ve web erişimine kapalıdır. Anahtar istemci paketine konulmaz. Hubpixel dosyaları değiştirilmez.

`POST /api/guide` yalnız kullanıcının yardım sorusunu alır. Bilinen terimler ağ isteği olmadan cevaplanır. Diğer sorularda Gemini, izin verilen yardım başlıklarından birini seçer. Modelin serbest metni, vergi oranı, kodu veya hesap değeri kullanıcıya aktarılmaz; yerel incelenebilir yardım metni gösterilir. Hesap alanları, fatura bedelleri ve iletişim verileri modele otomatik gönderilmez. Arayüz yalnız soru metninin Google Gemini ile işlenebileceğini açıklar.

Model yanıtı şemaya ve izin listesine uymuyorsa veya servis yanıt vermiyorsa yerel yardım devreye girer. İstek zaman aşımı 10 saniye, soru sınırı 400 karakterdir. Anahtar veya sağlayıcı hata gövdesi günlüklenmez. Varsayılan günlük model çağrısı sınırı süreç başına 100’dür; çok sunuculu yayın için ortak kota deposu gerekir. Yardım ve talep uçlarında dakika başına istek sınırı vardır.

Gemini bağlantısı genel bir ağırlık sorusuyla canlı doğrulandı. Model adı Hubpixel yapılandırmasından alınır. Matematiksel sonuçlar Gemini’ye bağımlı değildir.

## Hesap kapsamı

- Sağlanan Excel’den 39 adet 9503 GTİP’i; yedi tarife grubu için ayrı GV / İGV oranları.
- Tek ürün kalemi, yeni eşya, ticari serbest dolaşıma giriş. Çok kalemli beyan, özel rejim, kişisel ithalat, muafiyet ve indirimli KDV kapsam dışında.
- Kaynak dönem: 10 Ağustos–1 Ekim 2026. Daha ileri/önceki tarihler için sonuç üretilmez. Canlı mevzuat veya kur API’si yoktur.
- KDV %20, kullanıcı talebine göre yapılandırılmıştır.
- Gerçek kıymet: seçili para biriminde mal + faturaya dahil olmayan navlun/sigorta + kıymet ilaveleri; işlem kuruyla TL dönüşümü.
- Gözetim: brüt kg / 1000 × GTİP’e özgü USD/ton × USD kuru. Gerçek kıymetin yerine kendiliğinden geçmez.
- Gerçek beyan, geçerli gözetim belgesi ve artırılmış beyan senaryoları ayrıdır. Artırılmış beyan yalnız kullanıcının açık toplam tutarı ve müşavir teyidiyle değerlendirilir.
- GV ve İGV ayrı ayrı beyan matrahına uygulanır. KDV matrahına bunlarla birlikte diğer ithalat vergi/harçları ve uygun giderler eklenir.
- Nakit ihtiyacı gerçek kıymet + vergiler + gerçek giderlerdir. Beyan artışı gerçek satın alma bedeline tekrar eklenmez. KDV indirimi / muhasebesel net maliyet hesaplanmaz.
- Boş gider bilinmiyor demektir; sıfır değildir. Bağımlı toplamlar tamamlanmamış kalır.
- TAREKS eşleşmesi ürün kontrolüne dair bilgi verir; otomatik test bedeli veya ithalat izni üretmez. Ürün açıklamasındaki kapsam istisnaları ayrıca incelenmelidir.

## Kaynakların işlenmesi

`data/catalog.json` kaynak dosya adlarını, SHA-256 özetlerini, Excel satırlarını, tüm gözetim satırlarını ve veri sürümünü içerir. Orijinal dosyalar değiştirilmedi. `scripts/extract_sources.py` yalnız kaynak okur ve kataloğu yeniden üretir; kaynak dosyaların yerel konumu betikte tanımlıdır. Python bağımlılıkları yalnız yeniden veri aktarımı için gereklidir: openpyxl, python-docx, lxml.

Excel’deki `474 s.K.V.O.` sütunu uygulanan ithalat vergisi değildir; hesapta kullanılmaz. Uygulanan oranlar ayrı vergi dosyasından alınır.

### Çözümlenmemiş kaynak konusu

Gözetim belgesinde `9503.00.10.19.19`, Excel ve denetim listesinde `9503.00.10.00.19` bulunur. Gözetim belgesinde aynı kod için akülü araba / diğer ayrımı da vardır. İlgili ürün uygulamada bloke edilir; sessiz kod düzeltmesi veya varsayılan oran kullanılmaz. Resmi güncel tarife eşleştirmesi doğrulanınca veri kataloğu ve testler güncellenmelidir.

Ülke → tarife grubu haritası ve tercihli menşe şartları kaynaklarda eksik. Tam ülke haritası olmadığı için kolay mod çözemediği durumda inceleme özeti üretir. Uzman modunda GV ve İGV grupları müşavir teyidiyle seçilebilir. Sadece sevk ülkesinden vergi oranı çıkarılmaz. A.TR tek başına tercihli İGV yetkisi vermez.

## Talep kaydı

`POST /api/leads` iletişim alanlarını, onayı ve hesap girdilerini doğrular, sonucu sunucuda yeniden hesaplar, `storage/leads.jsonl` içine kaydeder. Bu klasör web üzerinden sunulmaz ve Git’e dahil edilmez. Gönderim başına UUID kayıt numarası döner. Kayıt başarısız olursa kullanıcıya başarı mesajı verilmez. Örnek hesap UI’dan talep olarak gönderilemez.

Bu sürüm e-posta / CRM bildirimi göndermez. Kayıt dosyası yalnız yetkili sistem işletmecisi tarafından okunmalıdır. Canlı hizmette kayıtların takip edileceği CRM veya iş akışı bağlanmadan “ekibimiz size dönecek” taahhüdü verilmez. Talep saklama süresi ve aydınlatma metni kapsamı işletmeci tarafından belirlenmelidir. Hassas belgeler / kimlik numarası istenmez.

## CBI sitesine entegrasyon

Mevcut siteyi değiştiren veya internete yayımlayan işlem yapılmadı.

1. Mevcut CBI altyapısında `/oyuncak-ithalat-hesaplayici/` yolu ayırın. Aynı origin altında ters vekil ile bu Node servisine yönlendirin; `BASE_PATH=/oyuncak-ithalat-hesaplayici`, `PUBLIC_ORIGIN=https://www.cbitransport.com` kullanın. Sonundaki `/` için yönlendirme yapın.
2. HTTPS’yi mevcut web sunucusunda sonlandırın. Node servisini yerel adreste tutun. Veri dizinini web kökünün dışında kalıcı diske alın, erişimleri sınırlandırın, yedekleme / saklama süresini belirleyin.
3. WordPress şablonu doğrudan kullanılacaksa ortak header/footer’ı mevcut temadan alın; uygulama CSS’ini sayfa köküne kapsamlayın. Alternatif olarak aynı origin altında iframe kullanın; çift header/footer bırakmayın. Tam bağımsız sayfa şu an kendi CBI uyumlu header/footer’ını taşır.
4. Canlı talep iş akışını CRM/e-posta entegrasyonuyla bağlayın. Teslim, hata ve tekrarlı gönderim davranışlarını doğrulayın. Yerel JSONL çok sunuculu kullanım için veritabanıyla değiştirilmelidir.
5. Gümrük müşaviri, güncel tarihte tarifeleri, gözetim kod uyuşmazlığını, ülke gruplarını ve gider sınıflandırmasını onaylamalıdır. Sonra `snapshotDate` ve kaynaklar birlikte güncellenir; yalnız tarih ileri alınmaz.

## Tasarım ve kabul koşulları

Orijinal CBI logosu kullanılır. Montserrat / Poppins, sitede gözlenen yazı aileleridir; Google Fonts ulaşılamazsa sistem yazı tipi devreye girer. Lacivert, beyaz, ince çizgiler ve ölçülü yeşil seçim vurgusu kullanılır. Adım göstergesi ve tamamlanma durumu oyunlaştırmayı oluşturur; puan/ödül maliyet veya vergi sonucunu etkilemez.

Kabul ölçütleri: tüm katalog satırları eşleşir; dört kıymet ayrı kalır; üç senaryo bağımsızdır; navlun/sigorta tekrar sayılmaz; bilinmeyen gider toplamı sıfıra düşürmez; A.TR/menşe ayrımı korunur; mobil taşma olmaz; klavyeyle kullanılır; çıktı alınır; lead kaydı sunucuda doğrulanır.

## İncelenen resmi kaynaklar

- [KDV Kanunu](https://ordu.gib.gov.tr/mevzuat/kanun/436), ithalatta matrah: madde 21.
- [Ticaret Bakanlığı menşe açıklamaları](https://www.ticaret.gov.tr/gumruk-islemleri/sikca-sorulan-sorular/ticari/mense).
- [3351 sayılı İGV kararı](https://ticaret.gov.tr/ithalat/ithalat-mevzuati/ithalat-rejimi-karari-igv-karari-ve-ithalat-tebligleri/2-ithalatta-ilave-gumruk-vergisi-uygulanmasina-iliskin-karar-karar-sayisi-3351-karar-metni-ve-tablolar-konsolide-edilmis-olup-gunceldir), A.TR ve menşe ayrımı.

Vergi Excel’indeki her oran resmi güncel tarife ile bağımsız olarak doğrulanmış değildir. Bu sürüm sağlanan dosyaların açıkça tanımlı veri kesitidir.

### İndirilebilir raporlar

`POST /api/report`: `inputs`, `format` (`pdf` / `xlsx`), `example` alanlarını alır. Sunucu girdileri doğrular ve hesabı kendi kataloğuyla tekrar yapar. İstemci sonuç tutarları kullanılmaz. Raporlar geçici klasörde üretilir ve yanıt sonrası silinir; kişi bilgisi gerektirmez. Excel statik ve sayısal hesap dökümüdür; yeni hesap senaryosu için uygulamadan yeniden üretilir.

PDF çalışma zamanı: Python 3 + reportlab; `REPORT_PYTHON` ile ayarlanabilir. Yerel geliştirmede mevcut Codex Python ortamı kullanılır. Türkçe font için `REPORT_FONT` ayarlanabilir; macOS Arial veya Linux DejaVu Sans aranır. Excel: `reports/node_modules` altında `@oai/artifact-tool` gerekir; yerel geliştirmede kurulu çalışma ortamına bağlantı vardır. Yayın ortamında bu bağımlılıklar ayrıca kurulmalıdır. Sunucu rapor işlemini 45 saniyede zaman aşımına uğratır.

## Netlify yayını

`npm ci` ve `npm run build` ile statik dosyalar `dist/` içine hazırlanır. Netlify Functions aynı hesaplama doğrulamasını kullanır. PDF ve Excel üretimi Node.js üzerinde çalışır; Python veya Codex çalışma ortamı gerektirmez. Noto Sans yazı tipi OFL lisansıyla raporlara gömülür.

Talep kayıtları Netlify üzerinde özel `cbi-leads` Blobs deposunda, yerelde `storage/leads.jsonl` içinde saklanır. `.env`, kullanıcı kayıtları, bağımlılıklar ve `.netlify` bağlantı bilgileri Git'e eklenmez. Gemini anahtarı Netlify ortam değişkenlerinde saklanır.

Bu projede otomatik Git deploy kapalı tutulur. Yalnız kullanıcı yayın istediğinde `npx netlify-cli deploy --prod --build` çalıştırılır. GitHub'a kod göndermek tek başına yayını güncellemez.
