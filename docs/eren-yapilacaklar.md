# Eren'in yapacakları (yayına kadar)

Hazırlanma: 31 Ekim 2026. Bir maddeyi bitirince Claude'a "X tamam" demen yeterli; Claude bu listeyi günceller.
Şifre, kart bilgisi, anahtar gibi şeyleri sohbete yazma; gerekiyorsa Claude nereye gireceğini söyler.

## Pro abonelik için (yayından önce, acele yok; 12 Kasım 2026)

Uygulama ve panel hazır; satın almanın gerçekten çalışması için bu hesap işleri gerekiyor. Sırası geldiğinde Claude her adımı tek tek anlatır.

- [x] **Pro fiyatı (karar verildi, 12 Kasım):** aylık 999,99 TL, yıllık 9.999,99 TL, ilk ay ücretsiz deneme. Ürünleri açarken mağaza panelinde bu fiyatları ve 1 aylık ücretsiz denemeyi sen girersin; sonra istediğin zaman oradan değiştirirsin.
- [ ] **Ücretli uygulama sözleşmesi:** Apple Developer (App Store Connect > İş) ve Google Play Console (Ödemeler profili). Şirket/vergi ve banka bilgisi gerekir; mali müşavire danış.
- [ ] **İki mağazada abonelik ürünü:** `cityjoy_pro_aylik` ve `cityjoy_pro_yillik` (Claude ekran ekran anlatır).
- [ ] **RevenueCat hesabı** (revenuecat.com, ücretsiz başlangıç) ve iki mağazanın bağlanması. Anahtarları sohbete yazma; Claude nereye gireceğini söyler.
- [ ] **Avukat:** abonelik, otomatik yenileme, iptal ve iade metinleri (mesafeli satış). **Mali müşavir:** mağaza gelirinin faturası ve kaydı.

## 1. Hemen (bugün yarın, kısa işler)

- [x] **claude/blaze-kurulum birleştirme ve yüklemeler (yapıldı, 11 Kasım; Eren izin verdi, Claude yaptı):** https://github.com/erensevinc3472-design/Cityjoynew/compare/main...claude/blaze-kurulum?expand=1
  > "Create pull request" > "Create pull request" > "Merge pull request" > "Confirm merge". Sonra proje klasöründe terminalde sırayla:
  > `npx firebase-tools@15.34.1 deploy --only firestore:rules,firestore:indexes --project cityjoynew`
  > `npx firebase-tools@15.34.1 deploy --only functions --project cityjoynew`
  > `npm run panel:deploy`
  > (Etkinlik dizini, sponsorlar, Seyahat "İçini gez" ve fotoğraf temizliği canlıda bunlarla çalışır.)

- [x] **Hesap silme + fotoğraflar (Keşfet, etkinlik kapağı, logolar, işletme vitrini) PR'ını birleştir, sonra kuralları yükle (yapıldı, 31 Ekim):** https://github.com/erensevinc3472-design/Cityjoynew/compare/main...claude/foto
  > "Create pull request" > "Create pull request" > "Merge pull request" > "Confirm merge". Sonra Claude'a "kuralları
  > yükle" de. (Fotoğraf yükleme Blaze ile çalışır; o zamana kadar yazılı paylaşım aynen çalışır.)

- [x] **Paneli internete koyma (yapıldı, 31 Ekim):** panel artık https://cityjoynew.web.app adresinde (arama
  motorlarında çıkmaz, giriş zorunlu). Telefondan ya da başka bilgisayardan da açabilirsin.

- [x] **Günlük sınırlar PR'ını birleştir, sonra kuralları yükle (yapıldı, 31 Ekim):** https://github.com/erensevinc3472-design/Cityjoynew/compare/main...claude/sinirlar
  > "Create pull request" > "Create pull request" > "Merge pull request" > "Confirm merge". Sonra Claude'a "kuralları
  > yükle" de. (Kurallar yüklenmeden yeni sınırlar ve panelin Günlük sınırlar sayfası canlıda çalışmaz.)

- [x] **Çarşı PR'ını birleştir, sonra kuralları yükle (yapıldı, 31 Ekim):** https://github.com/erensevinc3472-design/Cityjoynew/compare/main...claude/carsi-ilan
  > "Create pull request" > "Create pull request" > "Merge pull request" > "Confirm merge". Sonra Claude'a "kuralları
  > yükle" de. (Kurallar ve dizinler yüklenmeden Çarşı canlı uygulamada çalışmaz.)

- [x] **Mesajlar PR'ını birleştir ve kuralları yükle (yapıldı, 31 Ekim):** https://github.com/erensevinc3472-design/Cityjoynew/compare/main...claude/mesaj-isletme
  > "Create pull request" > "Create pull request" > "Merge pull request" > "Confirm merge". Sonra bu bilgisayarda
  > Claude'a "kuralları yükle komutunu ver" de, ya da terminale şunu yaz:
  > `npx firebase-tools@15.34.1 deploy --only firestore:rules,firestore:indexes --project cityjoynew`
  > (Kurallar yüklenmeden işletmeye mesaj ve "Sohbeti sil" canlı uygulamada çalışmaz.)
- [x] **PR'ı birleştir (yapıldı, 31 Ekim):** https://github.com/erensevinc3472-design/Cityjoynew/compare/main...claude/magaza-oncesi
  > "Create pull request" > "Create pull request" > "Merge pull request" > "Confirm merge". Kural yüklemen gerekmiyor.
- [ ] **Anthropic iadesi ve Max plan:** claude.ai > sol altta adın > Get help > Send us a message > Accept >
  Claude Refund Request. Sonra Ayarlar > Faturalandırma'dan Max plana geç.
- [ ] **Firebase'de uygulama adı:** console.firebase.google.com > cityjoynew > sol üstte dişli > Proje ayarları >
  "Herkese açık ad" alanına `CityJoy` yaz, kaydet. (Şifre sıfırlama e-postalarında bu ad görünür.)
- [ ] **Eski Firebase projesini kapat:** aynı konsolda `cityjoy-d5d29` projesini aç > Proje ayarları > en altta
  "Projeyi sil". (Eski bağlantı bilgileri tasarım dosyalarında duruyor; proje kapanınca zararsız olur.)
- [ ] **Seyahat içeriğini kontrol et (daha önce yapmadıysan):** Panel > Seyahat > "Başlangıç içeriğini yükle", sonra
  Bölgeler / Şehirler / Yerler / Hazır rotalar / Yöresel sekmelerinde içerikleri okuyup "Yayına al".
- [ ] **Panel > Moderasyon:** yasaklı kelime listesini doldur (küfür, hakaret vb.). İstersen önerilen aramaları da yaz.

## 2. Hesaplar ve ödemeler (beklemeli işler, erken başla)

- [ ] **Karar: şahıs mı, şirket mi?** Mağaza hesapları kimin adına açılacak?
  - Şahıs: hızlı açılır. Google Play yayından önce **12 kişi x 14 gün kapalı test** ister.
  - Şirket: Apple bir **D-U-N-S numarası** ister (ücretsiz, 1-2 hafta sürebilir), Google'ın 14 gün kuralı yok.
  - Mali müşavirine sor: uygulama ileride gelir getirecekse şirket daha doğru olabilir.
- [x] **Firebase Blaze plan (6 Kasım, tamam):** cityjoynew Blaze'de, ödeme hesabı "Firebase Payment", aylık bütçe
  "cityjoy" 350 TL (uyarılar %50/%90/%100), Storage europe-west1, Cloud Translation API açık. Sunucu işlevleri yüklendi.
- [ ] **Harcama sigortası için iki ayar (7 Kasım; Claude'un izni yok, senin yapman gerekiyor):**
  1. console.cloud.google.com/iam-admin/iam?project=cityjoynew > **Erişim izni ver** (Grant access) > "Yeni ana hesaplar"
     kutusuna `484442991767-compute@developer.gserviceaccount.com` > Rol: **Proje Faturalandırma Yöneticisi** (Project
     Billing Manager) > Kaydet. (Sunucu bu izinle kart bağlantısını koparabilir; başka bir şey yapamaz.)
  2. console.cloud.google.com/billing > Bütçeler ve uyarılar > **cityjoy** > Düzenle > en altta "Bu bütçeye bir Pub/Sub
     konusu bağla" kutusunu işaretle > proje **cityjoynew**, konu **budget-alerts** > Kaydet.
  Bitince Panel > Harcama sayfasında bu ayki harcama görünmeye başlar (Google günde birkaç kez bildirir). Sigorta
  tutarını orada değiştirebilir, "Kart bağlantısını şimdi kopar" düğmesiyle hemen durdurabilirsin. Yeniden açmak:
  console.cloud.google.com/billing/projects > cityjoynew > Faturalandırmayı değiştir > "Firebase Payment".
- [ ] **Apple Developer Program (yılda 99 dolar):** developer.apple.com/programs/enroll
  - İki adımlı doğrulaması açık bir Apple kimliği gerekir.
  - iPhone'a "Apple Developer" uygulamasını kur, oradan kimliğinle (TC kimlik/pasaport) kayıt ol.
  - Onay birkaç gün sürebilir.
- [ ] **Google Play Console (bir kerelik 25 dolar):** play.google.com/console/signup
  - Kimlik doğrulaması ve telefon doğrulaması ister.
  - Hesabı açarken "kişisel" mi "kuruluş" mu seçeceğin yukarıdaki karara bağlı.
- [ ] **Expo hesabı:** "cityjoy" hesabı zaten var. Telefon sürümü (EAS) için ek bir şey yapman gerekmiyor; Claude
  hazır olunca bilgisayarda `eas login` komutunu açar, şifreyi sen yazarsın.

## 3. Hukuk ve metinler

- [ ] **Avukat:** gizlilik politikası, kullanım şartları, KVKK aydınlatma metni, açık rıza metinleri, topluluk kuralları.
  Uygulamada konum (SOS ve arka plan konumu), aile listesi, yorumlar, mesajlaşma, arama kaydı ve yaş sınırı (13) var;
  avukata bunları söyle. İstersen Claude avukat için soru listesi ve uygulamanın veri dökümünü hazırlar.
- [ ] **VERBİS kaydı gerekip gerekmediği:** avukata ya da mali müşavire sor.
- [ ] **Marka:** "CityJoy" adını TÜRKPATENT'te tescil ettirmeyi düşün (avukata sor). Mağazada aynı adla başka uygulama
  var mı bak (App Store ve Google Play'de "CityJoy" ara).
- [ ] **Destek e-postası:** mağazalar bir iletişim adresi ister. Ayrı bir adres aç (örnek: cityjoydestek@gmail.com) ya da
  alan adı alırsan destek@... gibi bir adres kullan.
- [ ] **(İsteğe bağlı) Alan adı:** cityjoy.com.tr gibi bir adres. Şart değil; gizlilik politikası ve panel ücretsiz
  `cityjoynew.web.app` adresinde de yayınlanabilir.

## 4. Deneme kullanıcıları

- [ ] **12-15 kişilik liste:** aile, arkadaş. Her biri için ad, telefon türü (iPhone / Android) ve e-posta
  (Android için Gmail adresi, iPhone için Apple kimliğindeki e-posta). Listeyi sohbete değil, bir dosyaya yaz.
- [ ] Bu kişilere 2-3 hafta boyunca uygulamayı kullanıp hata bildirecekleri haberini ver.

## 5. İçerik ve kararlar

- [ ] **Nöbetçi eczane:** `docs/oneri-nobetci-eczane.md` önerisini onayla ya da değiştir. Onaylarsan nosyapi.com'dan
  hesap açıp anahtar al (anahtarı sohbete yazma; Claude nereye gireceğini söyler).
- [ ] **Benim Şehrim Excel'i:** il/ilçe bilgilerinin olduğu dosya hazır olunca proje klasörüne koy.
- [x] **İlk sürümün kapsamı (karar, 31 Ekim):** ilk sürüm Bursa içeriğiyle çıkar, altyapı 81 il için hazır.
- [ ] **Belediye fotoğrafları (sonra):** belediyelerden şehir fotoğrafı kullanma izni (Blaze sonrası panelden yüklenecek).

## Claude'un yapacakları (bilgin olsun)

- Blaze gelince: sunucu işlevleri. Expo/EAS hazır olunca: telefon sürümü, gerçek telefonda SOS ve bildirim denemesi,
  Google/Apple ile giriş. Kart görselleri (A tarzı, Eren seçti). Paneli internete koyma. Mağaza ekran görüntüleri ve
  açıklama metinleri (5 dil). Apple incelemesi için test hesapları. Yayından önce toplu güvenlik taraması ve son cila.
