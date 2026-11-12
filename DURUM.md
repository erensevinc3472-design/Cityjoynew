# CityJoy: güncel durum (oturumlar arası özet)

> Her oturumun başında `CLAUDE.md`'den sonra bunu oku. `PROJE.md` uzundur (yaklaşık 50 bin token);
> baştan sona okuma, yalnızca üzerinde çalışılan konunun bölümünü oku (bölüm listesi en altta).
> Bir iş bitince bu dosyayı güncelle: "Yapılanlar", "Açık işler" ve "Sıradaki adım" bölümleri.

Son güncelleme: 12 Kasım 2026 (Gezimi planla ve Yakınımda; yer konum/saat/süre alanları panelde). Önceki: 11 Kasım 2026 (dal claude/blaze-kurulum ana dala birleşti; kurallar, dizinler, sunucu işlevleri ve panel yüklendi; Seyahat yer sayfasında "İçini gez" (Bursa’da 23 yer: Ulu Camii, Yeşil Türbe, Cumalıkızık, Koza Han, Tophane, Muradiye, Emir Sultan, Kapalıçarşı, Gölyazı, İznik Surları, İznik Yeşil Cami, İznik Ayasofya, Tirilye, Mütareke Evi, Misi, Kumyaka, Balat Ormanı, Uludağ, Suuçtu, İznik Gölü, Panorama 1326, Sarıalan, Bakacak); Seyahat şehir sayfası sadeleşti; Seyahat bölge sayfası kayan şehir kartlarıyla; Sosyal Harmoni canlı şerit, sponsor bandı ve Panel > Sponsorlar; Sosyal Harmoni ve Fırsatlar kartlarında Eren'in resimleri; Bölgesel/Türkiye geneli etkinlik seçimi, Belediye Hizmetleri ve Park & Pazar Benim Şehrim kutularıyla, Müzeler örneğe göre, Çarşı üst görseli, Vitrin boş panolar, Keşfet cam düğmeler, Benim Şehrim alt çubuğu; Eren'in örneklerine göre ince kayan başlık, ayrıntı sayfası, Mahalle Meydanı, Etkinlikler; Önemli Kurumlar arama + ilçe düğmeleri + yeni kartlar; Benim Şehrim alt sayfalarında il fotoğrafı; öncesinde Ara ekranına ışıklı ağaç). Önceki: 7 Kasım 2026 (dal claude/blaze-kurulum: Blaze kuruldu, sunucu işlevleri yüklendi, harcama sigortası ve Panel > Harcama). Önceki: 6 Kasım (PR #72 "Çevir" düğmesi birleşti; kurallar ve panel yüklendi). Önceki: 6 Kasım (dal claude/iki-kademe: işletme kademeleri ikiye indi, Panel > Sınırlar kaydetme hatası). Önceki: 4 Kasım (dal claude/magical-maxwell-0tnmeh: kural yükleme hatası giderildi, aşağıdaki not). Önceki: 4 Kasım (dal claude/ic-ekranlar: Acil alt sayfaları, Sosyal Harmoni iç sayfaları, Seyahat > Planla tatil keşfi ve Panel > Tatil fikirleri). Önceki: 3 Kasım, PR #55 kuralları yüklendi.

> **Eren'in bilgisayarında çalışma (28 Ekim):** `Desktop\Cityjoynew-main` artık GitHub deposunun git kopyası (`origin`,
> `core.autocrlf=false`). Her iş `claude/...` dalında; bu bilgisayarda `gh` yok, git Eren'in tarayıcıdan verdiği GitHub
> girişiyle gönderir, PR'ı Eren bağlantıdan açıp birleştirir (20. madde PR #6). Sistem Java'sı 8; kural testleri için
> Temurin JDK 21 zip olarak `%TEMP%\cj-jdk21` klasörüne açıldı (kurulmadı): `JAVA_HOME` ve `PATH` o klasörü gösterecek
> şekilde ayarlanıp `npm run test:rules` (JDK yolu: `%TEMP%/cj-jdk21/x/jdk-21.0.12.1+1`). Emülatör "An unexpected error" ile
> açılmazsa `%TEMP%/hub-demo-cityjoy.json` bozuktur (içi boş baytlar): adını değiştir ya da sil. Klasör silinmişse yeniden indirilir. Kurallar Eren'in bilgisayarından yüklenir:
> `npx firebase-tools@15.34.1 deploy --only firestore:rules,firestore:indexes --project cityjoynew` (giriş kayıtlı).

> **Kural yükleme hatası (4 Kasım, giderildi):** Firebase'in kural derleyicisi işlevlere doğrudan `null` verilmesini
> ("Geçersiz tür. [null] alındı") artık kabul etmiyor. Düzeltme: ilçesiz yetki denetimi için yeni `provinceAllows`
> işlevi (eski `regionAllows(..., null)` yerine), `countStep` / `statsStep` içinde "yok" `''` ve boş harita `{}` ile
> gösteriliyor, `orgAuthorActions` / `personAuthorActions` içinde `null` yerine `{}`. Davranış aynı; 156 kural testi geçti.
> Yeni kural yazarken işlev çağrısına `null` (ya da `koşul ? x : null`) verme.
> **Boyut sınırı (4 Kasım, giderildi):** Panelde "Bilinmeyen hata" görünen asıl sebep: derlenmiş kurallar 279.296 bayt,
> Firebase sınırı 256.000. `scripts/rules-compact.py` ile 141 kural kısa işleve taşındı (`_kN(nw[, od])`,
> `nw` = request.resource.data, `od` = resource.data); sınırın altına indi, 156 test geçti ve kurallar Claude tarafından
> yayına alındı (4 Kasım 21:09). Dizinler zaten yüklüydü (58/58). **Yeni kural yazarken** yeni kayıt 2+ kez geçiyorsa
> aynı kalıpla işlev içine yaz; dosya sınıra yakın. Not: hizmet hesabıyla `firebase deploy` yetki hatası veriyor
> (serviceusage); kurallar firebase-admin `releaseFirestoreRulesetFromSource` ile yüklendi. Eren anahtarı sohbete
> yapıştırdı; konsoldan silmesi istendi.

> **Kural boyutu yine sınırda (11 Kasım):** Sponsor ve İçini gez kurallarıyla derlenmiş boyut 257.867 bayta çıktı (sınır
> 256.000; hata panelde değil, yüklemede "Total size of compiled executables" olarak görünür, CLI bunu 409 "already exists"
> diye gösterir: `--debug` ile PATCH cevabına bak). Çözüm: `config` ayarları kısa işlevlere taşındı ve tekrar eden
> "updatedBy + updatedAt" denetimi `stamped(d)` işlevine alındı; davranış aynı, 156 test geçti, yüklendi. Yeni kural
> eklerken önce böyle sadeleştir. Firebase kural servisi bazen 503 veriyor: birkaç kez yeniden dene.

> **Blaze ve harcama sigortası (6-7 Kasım, dal `claude/blaze-kurulum`):** cityjoynew Blaze'de (ödeme hesabı
> "Firebase Payment" 01AEE0-D23C40-9ABD42; bütçe "cityjoy" 350 TL/ay), Storage europe-west1, Translation API açık
> (herkese açık API anahtarı Translation'a kapalı, denendi). Tüm sunucu işlevleri europe-west1'e yüklendi (ilk yüklemede
> Eventarc izni gecikti, ikinci denemede tamam). **Sigorta:** `functions/src/budget.ts`, `budgetGuard` (Pub/Sub
> `budget-alerts`): her bildirimde `billing/status` yazılır; bu ayki harcama sigorta tutarına (`billing/settings.cap`,
> boşsa bütçe × 2) ulaşınca Cloud Billing API ile ödeme bağlantısı koparılır. **Panel > Harcama** (yalnızca admin):
> durum, sigorta tutarı (100-100000 TL, işlem kaydı), "Şimdi durdur" (`billingStop` callable, sunucu admin denetler,
> işlem kaydı), yeniden açma Google Cloud bağlantısıyla (bağlantı kopukken sunucu çalışmaz). Kural: `billing/{id}`
> okuma admin, yazma yalnızca `settings`. **Eksik (Eren, docs/eren-yapilacaklar.md):** hizmet hesabına "Project Billing
> Manager" rolü (Claude'un IAM değişikliği izin dışı kaldı) ve bütçeyi `budget-alerts` konusuna bağlamak. Not:
> Google'ın kendi harcama tavanı yalnızca Gemini/Vertex/Cloud Run içindir, bu yüzden özel sigorta.
> **Fırsat bitiş günü düzeltmesi (7 Kasım):** `latestDealEnd` UTC tarihine göre; Türkiye saatiyle 00.00-03.00 arası
> "en geç gün" sunucu kuralınca reddediliyordu (kural testi gece yarısından sonra düşüyordu).

## Depo ve ortam

- GitHub: `erensevinc3472-design/Cityjoynew` (gizli), ana dal `main`. Eski `cityjoy` deposu kullanılmıyor.
- Yetki zinciri, şehir rehberi ve onay merkezi (PR #3), resmî duyurular ve kutucuklu yetkiler (PR #4) `main`'de. Sonraki
  işler `claude/durum-md-continuation-82b1wf` dalında; `main`'e birleştirilmediyse yeni oturum o daldan başlamalı.
- Firebase projesi: `cityjoynew` (Spark, ücretsiz plan). Firestore bölgesi eur3. Giriş yöntemleri: e-posta/şifre ve Google.
- Bağlantı bilgileri koda konmaz. `.env.local` dosyaları GitHub'a gitmez ve oturum kapanınca silinir.
  Yeni oturumda yeniden üretmek için ortam değişkeni `FIREBASE_WEB_CONFIG` (konsoldaki `firebaseConfig` bloğu)
  gerekir, sonra `npm run env:write`. Değişken yoksa Eren'den Firebase konsolu > Proje ayarları > Uygulamalarınız >
  `cityjoy-panel` > Config bloğunu ortam ayarına eklemesini iste (sohbete yapıştırmasını isteme).
  Emülatörle denemek için gerçek değer gerekmez: değişkenlere herhangi bir dolu değer yazılabilir.
- Ağ kısıtları (bulut oturumu): `docs.expo.dev`, `cdn.tailwindcss.com`, `api.expo.dev` kapalı. npm açık
  (`EXPO_OFFLINE=1 npx expo install ...` kullan). Firebase API'leri açık. Tasarım HTML'lerini görüntülemek için
  Tailwind'i npm'deki `tailwindcss-cdn@3.4.10` paketinden yerel olarak ver.

## Klasörler

| Yol | İçerik |
|---|---|
| `apps/mobile` | Expo SDK 58 + Expo Router (TypeScript). Ekranlar `src/app`, bileşenler `src/components`, tema `src/theme` |
| `apps/panel` | React 19 + Vite + React Router (hash yönlendirme). Tek panel, menü yetkiye göre süzülür |
| `packages/shared` | Ortak: şehir rehberi şeması ve Excel denetimi (`data/city-guide-schema.json`, `src/city-guide`), kilitli belediye adları ve kurumlar (`src/organizations`), 5 dil metinleri (`src/i18n/locales`), konum verisi, acil numaralar (`src/emergency`), hizmet kategorileri (`src/categories`), işletmeler ve sıralama (`src/business`), SOS ve aile (`src/sos`), yetki, veri yapıları, hizmet arayüzleri, Firebase uygulaması (`src/firebase`, `@cityjoy/shared/firebase` olarak alınır) |
| `firebase/` | `firestore.rules` ve emülatör testleri |
| `tasarim/` | Eren'in 135 tasarım HTML dosyası. İçerikleri değiştirilmez (`CLAUDE.md`) |
| `docs/stil-rehberi.md` | Renk, yazı tipi, bileşen kuralları (görsel yön kararı) |
| `docs/oneri-nobetci-eczane.md` | Nöbetçi eczane veri kaynağı ve günlük çekim önerisi (onay bekliyor) |

## Komutlar

```sh
npm install
npm test                      # ortak paket testleri (166)
npm run test:rules            # güvenlik kuralları (Firestore + Storage) + depo testleri, emülatörde (156; Java 21 gerekir)
npm run test:functions        # sunucu işlevleri, emülatörde (30; Java 21 gerekir)
npm run panel:deploy          # paneli derleyip internete koyar (Firebase Hosting, ücretsiz plan yeter): cityjoynew.web.app
npm run functions:build       # functions/lib/index.js (ortak kod gömülü tek dosya)
# Sunucu işlevlerini yükleme (Blaze plan gerekir): npx firebase-tools@15.34.1 deploy --only functions --project cityjoynew
# Dosya deposu kuralları (Blaze + konsolda Storage açılınca): npx firebase-tools@15.34.1 deploy --only storage --project cityjoynew --config firebase/firebase.json
npm run typecheck
npm run env:write             # FIREBASE_WEB_CONFIG -> apps/*/.env.local
npm run locations:build       # PTT verisinden il/ilçe/mahalle dosyalarını üret
# Mobil web sürümü: cd apps/mobile && EXPO_OFFLINE=1 CI=1 npm run export:web  (dist/)
# Telefonda (Expo Go, iPhone): bilgisayar ve Expo Go "cityjoy" hesabıyla girişli olmalı (npx expo login --no-browser -u cityjoy,
#   şifreyi Eren yazar); cd apps/mobile && npx expo start --lan --go, telefonda Safari > exp://<bilgisayar IP>:8081.
#   İlk derleme ~1 dk sürer, telefon zaman aşımına düşerse "Reload JS". Expo paketleri Expo Go sürümüyle uyumlu olmalı
#   (npx expo install --check), yoksa "Cannot find native module" hatası çıkar.
# Panel: cd apps/panel && npm run build   (dist/)
# Emülatör: npx firebase emulators:start --only auth,firestore --project cityjoynew
#   mobil EXPO_PUBLIC_FIREBASE_EMULATOR=1, panel VITE_FIREBASE_EMULATOR=1 ile derlenince ona bağlanır
```

Dikkat: arka plandaki işlemi `pkill -f "...emulators..."` ile durdurma; komut satırı da eşleşip kabuğu öldürüyor.

## Yapılanlar

1. **Temel:** depo yapısı (npm workspaces), 5 dil (Arapça sağdan sola, harf sırası metne göre), cihaz diline göre dil önerisi.
2. **Konum:** PTT posta kodu listesinden 81 il, 973 ilçe, 73.305 mahalle/köy. İl/ilçe uygulamada gömülü; mahalleler il başına
   ayrı dosya, seçilen il bir kez indirilir ve telefonda saklanır (maliyet ilkesi). Türkçe karakter duyarsız arama.
3. **Giriş ve kayıt (mobil):** dil > karşılama > kayıt/giriş > ek bilgiler > konum > ana sayfa. Kayıtta ad, e-posta,
   şifre (en az 8), doğum yılı (13 yaş altı yok, sonradan değişmez), kullanım şartları + aydınlatma onayı (sürümlü).
   E-posta doğrulama uyarısı (engellemez). Ek bilgiler: meslek zorunlu (listeden), cinsiyet ve hedefleme/kampanya
   izni isteğe bağlı (18 yaş altına kampanya sorulmaz). Konum profile yazılır; mahalle ayda bir kez değişir.
   Hesabım: dil, konum, görünüm, yasal metinler (taslak), çıkış, uygulama içinden hesap silme.
4. **Güvenlik kuralları** (`firebase/firestore.rules`, konsola yüklendi ve doğrulandı): kullanıcı yalnızca kendi
   profilini okur/yazar; yaş, doğrulama alanları korunur; meslek listesini yalnızca admin yazar; işlem kaydı yalnızca eklenir.
5. **Yetki yapısı** (`packages/shared/src/permissions`): rol × bölge × modül × eylem, süreli/geri alınan yetki,
   rol başına varsayılan yetkiler. Kurum içi personel (`src/organizations`): hazırlayan / onaylayan / izleyen,
   "onaysız yayınlayabilir".
6. **Panel:** Firebase girişi, yetkisiz hesap ekranı, admin = Firestore `admins/<uid>` belgesi (Eren kendini ekledi;
   panel girişini henüz denemedi). Sayfalar: Genel bakış, İl/ilçe/mahalleler (herkes kendi bölgesini görür),
   Meslekler (başlangıç listesi, ekle/düzenle 5 dil, pasifleştir; her değişiklik işlem kaydına). Geliştirme modunda örnek hesaplar.
7. **Görsel yön** (Karar, Eren): koyu modda A "Gece ve Altın", açık modda C "Karma" (koyu üst bant, aydınlık içerik).
   Telefon ayarına uyar; Hesabım > Görünüm ile sabitlenir. Ayrıntı `docs/stil-rehberi.md`. Ortak bileşenler:
   `Screen` (üst bantlı), `HeroHeader`, `LocationChip`, `FormScreen`, `OptionRow`, `TextField`, `AppButton`, `StateMessage`.
8. **Denemeler:** kayıttan hesap silmeye 12 adımlık akış emülatörde (açık ve koyu modda) ve gerçek projede geçti
   (geçici hesap silindi). Panel girişi ve meslek yönetimi emülatörde geçti.
9. **Acil İhtiyaçlar, 1. parça: acil numaralar.** Ana sayfadaki "Acil İhtiyaçlar" kutusu açılıyor (`apps/mobile/src/app/urgent.tsx`).
   Üstte "Hayati tehlikede 112'yi arayın, CityJoy resmi acil çağrı hizmeti değildir" uyarısı, numaraya dokununca telefonun
   arama ekranı açılır (uygulama kendiliğinden aramaz). SOS, nöbetçi eczane, hizmetler "yakında" olarak görünür.
   Liste telefonda saklanır, gömülü başlangıç listesiyle internetsiz de çalışır. Panel: "Acil numaralar" sayfası
   (ekle/düzenle 5 dil, simge, sıra, pasifleştir, başlangıç listesini yükle; işlem kaydı). Veritabanı: `emergencyNumbers`
   (herkes okur, yalnızca admin yazar). Tasarımdaki 183/186/187 etiket hatası düzeltildi (PROJE.md 5.4 ve 13. madde 33).
   Emülatörde panel + uygulama (açık, koyu, Arapça) denendi.
10. **Acil İhtiyaçlar, 2. parça: hizmetler.** Acil İhtiyaçlar > Hizmetler (`apps/mobile/src/app/services/`): 14 ana kategori,
   88 alt kategori (tasarımdan, 5 dilde), açılır liste, Türkçe karakter duyarsız arama, acil kategorilerde "Acil" etiketi.
   Alt kategori sayfası şimdilik boş durum gösterir (işletmeler İşletmem ile gelecek); acil kategoride 112 hatırlatması.
   "Eksik hizmet mi var? Bildir" formu (giriş gerekir, il bilgisiyle). Maliyet: liste telefonda saklanır, her açılışta yalnızca
   `catalogVersions/serviceCategories` sürüm belgesi okunur (tek okuma), liste değiştiyse indirilir. Panel: "Hizmet kategorileri"
   sayfası (üstte eksik hizmet önerileri, "incelendi" işareti; altta ağaç: ana/alt kategori ekle, düzenle, acil işareti,
   pasifleştir, başlangıç listesini yükle; işlem kaydı). Kurallar iki seviyeyi zorunlu kılar. Emülatörde baştan sona denendi.

11. **İşletme ekle, 1. parça** (PROJE.md 5.6-5.7). Hesabım > İşletmem: işletme ekle/düzenle/gizle/sil (`apps/mobile/src/app/business/`).
   Tür, ad, hizmetler (en çok 5, Hizmetler listesinden), il/ilçe, adres (evden çalışanlarda yok), telefon, WhatsApp, 7/24 veya
   saat notu, tanıtım, fiyat listesi ("tahmini" notuyla). Eklenen işletme seçtiği hizmetlerde, kendi ilinde kart olarak görünür
   (Ara / WhatsApp, doğrulama tarihi, puan, ilçe). İşletme sayfası: güven bilgisi, fiyat listesi, son güncelleme, "bilgi
   platformu" notu. **Sıralama (Karar, Eren):** en çok 2 "Reklam" kartı (yalnızca doğrulanmış), sonra doğrulanmış, yorum
   sayısıyla ağırlıklı puan, ilçe, güncellik; üyelik kademesi sırayı değiştirmez; kural uygulamada "Sıralama nasıl yapılır?"
   altında yazılı (`rankBusinesses`). Panel > İşletmeler: il süzgeci, doğrula / incelemeye al / kaldır, yayından kaldır,
   elle üyelik kademesi ve 30 gün öne çıkarma (ödeme gelene kadar), işlem kaydı. Kurallar: sahibi doğrulama, kademe, puan ve
   öne çıkmayı değiştiremez; admin işletme bilgisini değiştiremez. Hesap silinince işletmeler de silinir. Firestore bileşik
   dizinleri `firebase/firestore.indexes.json` içinde. Emülatörde baştan sona denendi (açık, koyu, Arapça).

12. **İşletme ekle, 2. parça: değerlendirmeler ve tekrar kaydı engeli.** İşletme sayfasında Değerlendirmeler: ortalama,
   son 30 yorum ("Ayşe K." biçiminde ad), işletmenin cevabı, "Şikâyet et" (5 neden). Değerlendirmeyi yalnızca giriş yapmış ve
   işletmeyi uygulamadan arayan / WhatsApp'tan yazan kişi yazar (`contacts` kaydı), kişi başına bir (düzenle/sil), sahibi
   kendine yazamaz. Puan `rating {sum, count}` olarak tutulur; değerlendirmeyle aynı işlemde güncellenir ve kurallar toplamın
   tam o yorum kadar değiştiğini denetler (Blaze/sunucu işlevi gerekmeden puan şişirilemez). Panel > Moderasyon: şikâyetler,
   "Değerlendirmeyi gizle / yeniden yayınla" (puan birlikte düzelir), "Şikâyeti reddet", işlem kaydı. Aynı telefonla ikinci
   işletme açılamaz (`businessPhones`). İşletme silinince yorumları, hesap silinince kullanıcının yorumları ve arama kayıtları
   silinir. Çok satırlı metin kutuları büyütüldü; doğrudan açılan ekranlarda "Kaydet" sonrası geri dönüş düzeltildi.
   Emülatörde baştan sona denendi.

13. **SOS - Aileme haber ver** (PROJE.md 5.4). Hesabım > Ailem (SOS): davet kodu (8 karakter, tek kullanımlık, 24 saat) QR,
   bağlantı (`cityjoy://family?kod=...`, paylaş ile WhatsApp vb.) ya da elle yazılarak; ekleme karşılıklı, herkes istediği an
   çıkar, en çok 10 kişi. Acil İhtiyaçlar > SOS (en üstte): 112 uyarısı, konum durumu, haber verilecek kişiler, tek SOS düğmesi
   (Karar, Eren: tür seçimi yok) + geri sayım (iptal edilebilir), deneme gönderimi. Gönderilince canlı görünüm: kalan süre,
   uygulama açıkken canlı konum (30 sn / 50 m), Güvendeyim / Yardım gerek / Durdur, kişi başına Teslim edildi / Görüldü.
   Alıcıda her ekranın üstünde kırmızı şerit, ayrıntıda konum + "Haritada aç" + 112. SOS geçmişi. İnternet yoksa 12 sn sonra
   "112'yi arayın" uyarısı. Kurallar: SOS yalnızca aile bağı olan kişilere (tek tek denetlenir), admin dahil kimse başkasının
   SOS'unu göremez; alıcı yalnızca kendi teslim/görüldü işaretini koyar. Kayıtlar 30 gün sonra silinir (TTL `deleteAt`).
   Panel > SOS ayarları: canlı konum süresi, geri sayım (kişisel veri gösterilmez). Hesap silinince aile bağları, davetler ve
   gönderilen SOS'lar silinir. Emülatörde iki kullanıcıyla baştan sona denendi.
   **Eren'in netleştirmesiyle güncellendi:** SOS = gönderen yardım istiyor ("Yardım gerek" düğmesi kaldırıldı, alıcıda
   "X yardım istiyor"). Telefon sürümü için kod hazır: SOS'ta arka planda konum (`lib/sos-background.ts`, expo-task-manager;
   ekran kilitli / uygulama kapalıyken de, yalnızca SOS süresince), aile üyelerine yüksek öncelikli sesli bildirim
   (`lib/push.ts`, Expo push, alıcının dilinde; `pushTokens` yalnızca sahibi ve ailesi okur), bildirime dokununca SOS
   ekranı, "Güvendeyim" bildirimi, SOS hazırlığı bölümü (bildirim + "her zaman" konum izni), çıkışta bildirim adresi silinir.
   Web'de bu kısımlar sessizce atlanır ve ekranda uyarı görünür; **gerçek telefonda henüz denenmedi** (EAS gerekir).

14. **Yetki zinciri, kurumlar ve kilitli adlar** (PROJE.md 6.7, Eren'in kararı). **Kilitli adlar:** 30 büyükşehir, 51 il ve
   922 ilçe belediyesinin adı listede (`packages/shared/src/organizations/municipalities.ts`); "belediye, valilik,
   kaymakamlık, muhtarlık, CityJoy" sözcükleri işletme adında ve kayıttaki adda kullanılamaz (uygulama + kurallar, 5 dilde
   uyarı). **Kurumlar sayfası (admin):** kurum aç (belediye kilitli listeden seçilir, aynısı iki kez açılamaz; kamu kurumu,
   kulüp, yayıncı serbest adla), resmî e-posta + kurum yöneticisinin adı, bölümler, sözleşme bitişi. Hesap o e-postayla
   açılır ve "şifrenizi belirleyin" bağlantısı gider (şifreyi kimse görmez; bağlantıyla şifre koyunca e-posta da
   doğrulanmış olur). Pasifleştir / etkinleştir, bağlantıyı yeniden gönder; sözleşme bitince panel kendiliğinden kapanır.
   **Kurum yöneticisi:** kendi personelini e-postayla ekler, bölüm başına görev verir (kutucuklarla, madde 17), süreli görev, çıkarma; kurum yöneticisi atayamaz (admin atar). **Yetkiler sayfası:** admin
   il yöneticisi, muhtar, gönüllü moderatör atar; il yöneticisi kendi ilinde muhtar ve moderatör atar, kendinde olmayan
   yetkiyi veremez. Form yok: kişi e-postasıyla eklenir, o e-postayla (doğrulanmış) girince yetkisi açılır; doğrulanmamış
   e-postada "doğrulama e-postasını yeniden gönder / doğruladım" ekranı. **İşlem kayıtları** sayfası. İl yöneticisi kendi
   ilinin kurumlarını, işletmelerini (salt okunur) ve eksik hizmet önerilerini görür. Veritabanı: `grants/{e-posta}__{bölge}`,
   `organizations/{bld-.. | krm-..}`, `orgMembers/{kurum}__{e-posta}`; hiçbiri silinmez (geçmiş kalır). Kurallar sunucuda
   aynı sınırları denetler (rol × bölge × bölüm × eylem, kurumun bölümleri, kendine yetki yok, admin rolü panelden yok).
   Emülatörde tarayıcıyla baştan sona denendi (kurum aç > şifre bağlantısı > kurum yöneticisi personel ekler > il
   yöneticisi muhtar atar > muhtar ve personel paneli > doğrulanmamış e-posta).

15. **Benim Şehrim sabit bilgileri (şehir rehberi).** Tek kaynak: `packages/shared/data/city-guide-schema.json` (10 bölüm,
   sütunlar, seçenekler, 5 dilde adlar). Excel şablonu bundan üretilir (`scripts/build-data-templates.py` >
   `docs/veri-sablonlari/benim-sehrim-sablon.xlsx` ve panelde indirilebilir kopya). **Panel > Şehir rehberi:** il seç, "Excel'den
   yükle" > önizleme (geçerli / hatalı satır, nedeni ve satır numarası; örnek satırlar atlanır; yetkisi olmayan il reddedilir) >
   yükle. Aynı yer yeniden yüklenince güncellenir (kimlik bölüm + ilçe + ad), içerik değişirse doğrulama düşer, dosyada olmayan
   eskiler kalır. Tek tek doğrula / düzenle (Excel ile aynı denetim) / kaldır; işlem kaydı. Admin her ili ve ülke geneli ("tr",
   Nasıl yapılır) içeriği, il yöneticisi kendi ilini yönetir (yeni yetki bölümü `sehir-rehberi`). **Veritabanı:**
   `cityGuide/{il}` özet (bölüm başına sürüm, sayı, parça) + `cityGuidePacks/{il}__{bölüm}__{n}` (en çok 400 öğe/parça); herkes
   okur. **Uygulama:** ana sayfada Benim Şehrim açıldı (`apps/mobile/src/app/city/`): bölümler (kayıt sayısı, boş olanlar
   "henüz bilgi yok"), liste (arama, ilçe süzgeci, kendi ilçesi önce), ayrıntı (Ara, Haritada aç, web/başvuru, bölüme özgü
   bilgiler, kaynak ve tarih, doğrulanmamışsa uyarı). Açılışta tek okuma, bölüm yalnızca değişince indirilir, internetsizken
   telefondaki gösterilir. Emülatörde panel + uygulama (web) baştan sona denendi. **Eren veri dosyası hazırlıyor** (başka yapay
   zekâyla ya da ekibiyle); gelmezse Claude açık kaynaklardan "doğrulanmadı" olarak hazırlayacak.

16. **Onay merkezi (PROJE.md 6.5, 6.7), ilk kullanım: işletme doğrulaması.** Ortak yapı `packages/shared/src/approvals`
   (iş türleri, "yüksek risk" işareti, güvenli iş hesabı, süzgeç, toplu onay seçimi). **Akış:** işletme sahibi uygulamada
   İşletmem > işletmeyi düzenle > Doğrulama > "Doğrulama iste" der (durumu, ret gerekçesini görür, geri çeker, yeniden ister) >
   il yöneticisi Panel > Bekleyen onaylar'da onaylar (admin'e gider) ya da gerekçeyle reddeder > admin son kararı verir >
   işletme "Doğrulandı" olur. İl yöneticisi istek gelmemiş bir işletmeyi Panel > İşletmeler'den "Doğrulamaya öner" ile de
   gönderebilir (kendi işletmesini öneremez). İl yöneticisi olmayan ildeki işi admin doğrudan onaylar. **Bekleyen onaylar
   sayfası:** aşama (admin onayı / il onayı bekleyen, hepsi, sonuçlananlar), il, ilçe, kategori süzgeci; satır satır onay ve
   ret (gerekçe 5-300 karakter, istek sahibine gösterilir); "Tümünü onayla" ve "Güvenli olanları onayla" (önce "X iş onaylanacak"
   sorusu; yüksek riskli işler toplu onaya girmez; her iş ayrı ayrı işlem kaydına). **Güvenilir yöneticiler** (yalnızca admin):
   e-posta + il (+ isteğe bağlı ilçe) + kategoriler (boş = hepsi), listeden çıkarma. Veritabanı: `approvals/{tür}__{hedef}`
   (aynı iş için tek bekleyen istek), `trustedApprovers/{e-posta}__{il-.. | ilce-..}`. Kurallar: istek yalnızca işletme
   sahibinden ve işletmenin gerçek adı/yeriyle; 1. aşamayı yalnızca o ilde onay yetkisi olan, kendi isteği olmayan kişi, kendi
   adıyla; 2. aşamayı yalnızca admin; işletme silinince istek de silinir. Şimdilik yalnızca işletme doğrulaması açık; diğer
   türler (kampanya bildirimi, etkinlik yetkisi, kulüp başvurusu...) ilgili özellik yapılınca aynı yapıya eklenir. Emülatörde
   tarayıcıyla baştan sona denendi (uygulamadan istek > il yöneticisi onayı ve önerisi > admin güvenli toplu onay > uygulamada
   "doğrulandı").

17. **Yetkiler kutucuklarla, "Onaysız yayınla" yetkisi** (Karar, Eren, 27 Ekim 2026). Yeni eylem `yayinla`: işaretli kişi
   hazırladığını onay beklemeden yayınlar; işaretli değilse içerik onaya gider. **Kurum personeli:** açılır listedeki hazır görev
   (hazırlayan / onaylayan / izleyen) kaldırıldı; kurum yöneticisi her bölümde Görüntüle, Ekle, Düzenle, Sil, Onayla, Onaysız
   yayınla, Bildirim gönder (yalnızca bildirimlerde) kutucuklarını işaretler. Eski biçimde kayıtlı görevler okunurken yeni
   biçime çevrilir (`normalizeAssignment`), kurallar yalnızca yeni biçimi yazdırır. **İl yöneticisi > muhtar:** Yetkiler
   sayfasındaki tabloya "Onaysız yayınla" sütunu geldi (gönderi, etkinlik, bildirim). Kimse kendinde olmayanı veremez:
   il yöneticisinin varsayılan yetkisinde gönderi ve etkinlikte "onaysız yayınla" var, bildirimde yok (il geneli bildirim
   admin onayına gider); admin isterse il yöneticisinin yetkisinde işaretler. Emülatörde tarayıcıyla denendi.

18. **Resmî duyurular ve acil duyurular** (PROJE.md 6.2 madde 1, 4, 6, 18; 6.6; 6.7). Ortak yapı
   `packages/shared/src/announcements`. **Panel > Duyurular** (menüde eski "Gönderiler" yeri): kurum personeli, muhtar ve il
   yöneticisi duyuru yazar (tür: duyuru / acil duyuru, başlık, metin, hedef: il geneli / ilçe / mahalle, yalnızca kendi
   bölgesi; bitiş tarihi, acilde zorunlu ve en çok 7 gün). "Ekle" olan taslak kaydeder ve onaya gönderir; "Onaysız yayınla"
   ya da "Onayla" olan doğrudan yayınlar. Onay bekleyenler: kurumda "Onayla" olan personelde, muhtar duyurularında il
   yöneticisinde, admin'de hepsi; onay ya da gerekçeli geri gönderme (hazırlayan düzeltip yeniden gönderir). Yayından
   kaldırma: onaylayan, admin ya da "Sil" yetkisi olan hazırlayan. Birden çok hesabı olan "Yayınlayan hesap" seçer. Admin il
   seçip yayındakileri görür ve kaldırır. **Uygulama:** ana sayfada yayındaki acil duyurular en üstte kırmızı kartla, modüllerin
   altında son 3 duyuru ve "Tüm duyurular"; liste (`/announcements`, acil önce) ve ayrıntı (yayınlayan, "Resmî hesap", bölge,
   yayın / bitiş, acilde 112 hatırlatması). Kullanıcı il genelini, kendi ilçesini ve mahallesini görür. Maliyet: il başına tek
   sorgu (en çok 50), 5 dakika telefonda tutulur. Veritabanı: `announcements` (yayındakini herkes okur, silinmez). Kurallar:
   yazan hesabın yetkisi, bölge sınırı, kurum adı kurumun gerçek adı, yayındaki değiştirilemez; işlem kaydı kurum personeli ve
   muhtar için de açıldı. Emülatörde tarayıcıyla baştan sona denendi (basın > özel kalem onayı, fen işleri acil duyuru, muhtar
   > il yöneticisi onayı, uygulamada Türkçe ve Arapça). Yok (sonra): fotoğraf (Storage, Blaze), planlı yayın, acil duyuruda
   telefona bildirim (sunucu işlevi, Blaze), Keşfet akışıyla birleşme, otomatik çeviri (SORULACAK, PROJE.md 2).
   Not: panel denemesinde `npm run build` kullan (mahalle dosyalarını kopyalar); `npx vite build` kopyalamaz.

19. **Etkinlikler** (PROJE.md 5.3, 6.2 madde 3). Ortak yapı `packages/shared/src/events`. Yetki ve akış duyurularla aynı
   (bölüm "etkinlikler": Ekle / Onayla / Onaysız yayınla / Sil; muhtar etkinliği il yöneticisinin onayına gider).
   **Panel > Etkinlikler:** başlık, kategori (10), başlangıç-bitiş (en çok 60 gün), açıklama, mekân ve açık adres (halka açık
   etkinlikte herkese görünür), hedef bölge, ücretsiz / ücretli (ücret bilgisi), resmî bilet bağlantısı (yalnızca https;
   CityJoy bilet satmaz), kontenjan, "siyasi parti etkinliği, miting ya da gösteri değildir" onayı. Onay / geri gönderme,
   **İptal et** ("İptal edildi" etiketiyle bitişine kadar görünür), yayından kaldırma, katılım sayısı ve adını paylaşan
   katılanların listesi. **Uygulama:** ana sayfada "Sosyal Harmoni" açıldı (`/social`: Etkinlikler hazır; aktiviteler,
   haberler, yarışmalar, anketler, forum, şehir kulüpleri, fırsatlar "yakında"). Etkinlikler listesi (il geneli / yalnızca
   ilçem, başlama sırasıyla, iptaller sonda), ayrıntı (tarih, yer, haritada aç, ücret, bilet bağlantısı, kontenjan) ve
   **Katılıyorum** (giriş gerekir; "adım düzenleyenle paylaşılsın" isteğe bağlı; kontenjan dolunca kapanır; vazgeçilebilir).
   Hesap silinince katılımlar silinir. Veritabanı: `events`, `events/{id}/attendees/{uid}`; sayaç yalnızca katılım kaydıyla
   birlikte tam bir değişir (kurallar denetler). Maliyet: il başına tek sorgu (en çok 100), 5 dakika telefonda. Kurallar
   yeniden düzenlendi: yayınlayan hesabın yetkileri bir kez hesaplanıyor (dolu bir etkinlikte "1000 işlem" sınırı aşılıyordu).
   Emülatörde tarayıcıyla denendi. Yok (sonra): değişiklik / iptal bildirimi katılanlara (Blaze), etkinlik görseli (Storage),
   takvime ekleme, "Etkinlik düzenleme yetkisi iste" başvurusu (onay merkezine `etkinlik-yetkisi` türü), kullanıcı
   aktiviteleri (5.3: herkes açar, tam adres yalnızca katılana).

20. **Resmî profil ve Mahalle Meydanı** (PROJE.md 6.2 madde 2, 5.1). Ortak yapı `packages/shared/src/organizations/profiles.ts`.
   **Panel > Resmî profil** (menüde Genel bakış'ın altında; kurum yöneticisi, muhtar ve admin görür): tanıtım, telefon,
   e-posta, web (yalnızca https), adres, çalışma saatleri; muhtarlıkta isteğe bağlı muhtar adı. Kurumun adı ve bölgesi kurum
   kaydından gelir, değiştirilemez. Kurum yöneticisi kendi kurumunu, muhtar kendi mahallesini, admin her kurumu düzenler;
   işlem kaydına yazılır. **Uygulama:** duyuru ve etkinlik ayrıntısında yayınlayan satırı "Resmî hesap · Profili gör"
   (`AuthorLink`), dokununca `/official/[id]` (rozet, tanıtım, saatler, adres; Ara / Haritada aç / E-posta / Web; bilgi yoksa
   "henüz eklenmedi"). İl yöneticisinin profili yok. **Mahalle Meydanı** (`/neighbourhood`, Benim Şehrim'in en üstünde geniş
   kutu): muhtarlık (resmî profil; yoksa şehir rehberindeki "Muhtarlıklar" satırı, doğrulanmadıysa uyarıyla), mahalleye özel
   duyurular (+ acil), mahalle ve ilçedeki yaklaşan etkinlikler (en çok 5), afet toplanma alanları (şehir rehberinden; mahallede
   yoksa ilçedekiler ve e-Devlet/AFAD notu), belediyeler (ilçe + büyükşehir/il, yalnızca profili girilmişse), "Mahallem akışı
   Keşfet ile gelecek" notu. Veritabanı: `officialProfiles/{bld-.. | krm-.. | mahalle-..}` (herkes okur, silinmez). Maliyet:
   profil başına tek okuma, 30 dakika telefonda tutulur; duyuru/etkinlik mevcut il önbelleğinden. Kurallar: kurumda ad ve bölge
   kurumla aynı olmalı ve yalnızca kurum yöneticisi/admin; muhtarlıkta geçerli muhtar yetkisi/admin; alan biçimleri denetlenir.
   Testler: ortak paket 75 (5 yeni) geçti, tür denetimi ve panel derlemesi geçti, panel sayfası örnek muhtar hesabıyla
   tarayıcıda görüldü. Kural testleri emülatörde geçti: 61/61 (4'ü yeni, `firebase/official-profiles.test.ts`); emülatör
   hazırlık süresi 60 sn'ye çıkarıldı (yavaş bilgisayarda 10 sn aşılıyordu). Uygulama (web) emülatörde örnek veriyle
   denendi: Mahalle Meydanı, etkinlik > "Profili gör" > resmî profil; açık mod Türkçe, koyu mod Arapça. Denemede bulunan
   ve düzeltilen: Arapçada telefon numarası ters görünüyordu (`ltr()` ile yalıtıldı; şehir rehberi ayrıntısında da);
   mahalle adı eşleşmesi "Ataevler" / "Ataevler Mahallesi" farkına dayanıklı (`sameNeighbourhoodName`). Yok (sonra): logo (Storage, Blaze), sabitlenmiş duyuru, mahalle haritası,
   ilanlar ve kayıp-buluntu, profil sayfasında o hesabın duyuru/etkinlik listesi.

21. **Kullanıcı aktiviteleri** (PROJE.md 5.3). Ortak yapı `packages/shared/src/activities`. **Uygulama:** Sosyal Harmoni >
   Aktiviteler açıldı (`/activities`; giriş gerekir): ildeki yaklaşanlar, il / ilçem / mahallem süzgeci, "+ Aktivite aç"
   (`/activities/new`: başlık, 9 tür, gün (14 gün), saat, süre, mahalle = kullanıcının mahallesi, yalnızca katılanlara
   görünen buluşma yeri, kontenjan 1-50, açıklama, "ilk buluşma ipuçlarını okudum" onayı). Ayrıntı (`/activities/[id]`):
   açan "Ayşe K.", tarih, mahalle; tam yer yalnızca katılınca (ve haritada aç); "Katılıyorum" (ad paylaşımı isteğe bağlı),
   düzenleyene adını paylaşanlar ve iptal; herkese ilk buluşma ipuçları ve "Şikâyet et" (5 neden). **Kararlar (Claude,
   standart güvenlik):** yalnızca 18 yaş ve üstü açar ve katılır; yalnızca kendi ilinde, en çok 30 gün sonrası için, en çok
   12 saat; tarih ve yer sonradan değişmez (değişiklik bildirimi Blaze ister), yalnızca iptal; 3 şikâyette moderatör karar
   verene kadar listeden düşer. **Panel > Moderasyon > Aktivite şikâyetleri:** admin hepsini, il yöneticisi / il düzeyi
   moderatör kendi ilini görür; "Aktiviteyi kaldır" ya da "Yerinde kalsın"; işlem kaydı. Veritabanı: `activities`,
   `activities/{id}/private/details` (adres), `activities/{id}/attendees/{uid}` (etkinliklerle aynı ad: hesap silmede tek
   sorgu), `activityReports/{aktivite}_{uid}`; yeni dizinler. Hesap silinince katılımlar silinir, açtığı aktiviteler kaldırılır
   ve adresleri silinir. Testler: ortak 78 (3 yeni), kurallar 66 (5 yeni) geçti; uygulama emülatörde denendi (liste, gizli
   adres > katılınca görünür, aktivite açma, iptal). Panel moderasyon bölümü yalnızca derleme ve kural testiyle denendi.
   Yok (sonra): değişiklik / iptal bildirimi katılanlara (Blaze), günlük açma sınırı (sunucu işlevi), kullanıcı engelleme,
   ilçe düzeyi moderatörün kuyruğu, aktiviteye yorum / mesaj.

22. **Sabit duyuru** (PROJE.md 5.1 Mahalle Meydanı). Panel > Duyurular formunda, hedef mahalle seçili ve tür "duyuru"
   iken "Mahalle Meydanı'nda sabitle" kutusu. Sabit duyuru acil duyurulardan sonra en üstte (Mahalle Meydanı, Tüm
   duyurular, ana sayfa) ve "Sabit" etiketi / iğne simgesiyle görünür; düzenleyip işaret kaldırılır ya da yayından
   kaldırılır. Kurallar: `pinned` yalnızca mahalleye yönelik, acil olmayan duyuruda. Testler: ortak 79, kurallar 67 geçti;
   panel derlendi. Ekranlar tarayıcıda denenmedi (küçük değişiklik: kutucuk, etiket, sıralama). PR #8 birleşti.

23. **Keşfet, 1. aşama** (PROJE.md 5.5). Ana sayfada geniş "Keşfet" kutusu (alt gezinme gelene kadar). Sekmeler:
   Mahallem (yalnızca kendi mahallesi), Bölgesel (kendi ili, istenirse kendi ilçesi), Genel (herkes). Acil duyurular
   Mahallem ve Bölgesel'in en üstünde. Akış 20'şer gönderiyle sayfalanır (aşağı kaydırdıkça), aşağı çekince yenilenir,
   sekme başına 5 dk önbellek. Paylaşma: yazı (en çok 2000), kategori (madde 6), "Nerede paylaşırsın?" birden çok hedef
   (Karar Eren 28 Ekim), Mahallem'de gizlilik notu, taziyede "yakınıyım" beyanı, emlak ilanı sezgisi (madde 9, paylaşmayı
   durdurur ve Emlak bölümüne yönlendirir). Gönderi ayrıntısı: beğeni, şikâyet (7 neden, kişi başına bir), sahibi kaldırır.
   3 şikâyette gönderi akıştan düşer; Panel > Moderasyon > "Keşfet şikâyetleri" (admin hepsi, il yöneticisi/moderatör kendi
   ili): kaldır ya da yerinde kalsın, işlem kaydına yazılır. Hesap silmede gönderiler boşaltılır, beğeniler geri alınır.
   Veritabanı: `posts/{id}` (hedefler `{mahallem, bolgesel, genel}: true/false` haritası; kurallar sorguları bununla
   doğrular), `posts/{id}/likes/{uid}`, `postReports/{postId}_{uid}`; 4 yeni akış dizini. Kural: Mahallem gönderisini
   yalnızca o mahallede kayıtlı kişi, Bölgesel'i o ildeki okur (sorgu dahil); paylaşım yalnızca kayıtlı konumla.
   Testler: ortak 83 (4 yeni), kurallar 73 (6 yeni) geçti; uygulama ve panel derlendi. Uygulama emülatörde tarayıcıda
   denendi (Mahallem/Bölgesel süzme, beğeni, emlak engeli, iki hedefe paylaşma, kaldırma, şikâyet). Panel bölümü
   tarayıcıda açılmadı.
   PR #9 birleşti, kurallar yüklendi (Eren, 28 Ekim).

24. **Keşfet, 2. aşama: yorumlar ve kaydetme** (PROJE.md 5.5 madde 3). Gönderi ayrıntısında yorumlar (eskiden yeniye ilk
   50, 1-500 karakter); gönderiyi görebilen yazar. Gönderi sahibi "Yorumları kapat / aç" der. Yorumu yazan ve gönderi
   sahibi siler. Yorum şikâyet edilir (kişi başına bir); 3 şikâyette gizlenir. Panel > Moderasyon > "Keşfet yorum
   şikâyetleri": "Yorumu sil" ya da "Yerinde kalsın"; yorum yazısının şikâyet anındaki kopyası görünür; işlem kaydına
   yazılır. "Kaydet" düğmesi ve Keşfet'ten açılan "Kaydettiklerim" listesi (yalnızca kişinin kendisi görür). Kartta yorum
   sayısı. Hesap silmede yorumlar ve kaydedilenler de silinir. Veritabanı: `posts/{id}/comments/{cid}`,
   `commentReports/{postId}_{cid}_{uid}`, `users/{uid}/savedPosts/{postId}`; gönderide `commentCount`, `commentsOff`,
   `lastComment` (sayaç yalnızca adı geçen yorum eklenip silinirken değişir). Testler: ortak 84, kurallar 76 geçti;
   uygulama emülatörde tarayıcıda denendi (yorum yazma/silme, kaydet, Kaydettiklerim, yorumları kapatma). Panel derlendi,
   panel bölümü tarayıcıda açılmadı.
   PR #10 birleşti, kurallar yüklendi (Eren, 28 Ekim).

25. **Keşfet, 3. aşama: profil, takip, engelleme** (PROJE.md 5.5, 5.8). Herkese açık Keşfet profili (`publicProfiles/{uid}`:
   "Ayşe K." biçiminde ad, 160 karakterlik tanıtım, gizli hesap); Keşfet'e ilk girişte açılır, gizlilik kayıttaki tercihle
   başlar (13-17 yaş gizli). Yaş, cinsiyet, meslek, mahalle gösterilmez. Profil ekranı (`/u/<uid>`): takipçi / takip
   sayısı (sayım sorgusu), gönderiler (Genel; takipçiyse Takip de), kendi profilinde düzenleme, gizli hesap ve takip
   istekleri (kabul / reddet). Başkasının profilinde: Takip et (gizli hesapta istek), Takibi bırak, Engelle / Engeli kaldır,
   Profili şikâyet et. Gönderi kartında paylaşanın adına dokununca profil açılır. Yeni hedef **Takip**: yalnızca onaylı
   takipçiler görür; Keşfet'te dördüncü sekme (takip edilen her hesap için bir sorgu, en çok 30 hesap). Engelleme: iki
   yöndeki takip biter, engellenen takip edemez ve yorum yazamaz (kurallarla); engelleyen onun gönderilerini ve yorumlarını
   görmez (uygulamada süzülür). Panel > Moderasyon > "Keşfet profil şikâyetleri" (yalnızca admin, profilde bölge yok):
   şikâyet anındaki ad ve tanıtım görünür, "Tanıtımı kaldır" (kişi yeniden yazamaz) ya da "İşlem gerekmiyor"; işlem
   kaydına yazılır. Hesap silmede takipler, engeller ve profil silinir. Veritabanı: `publicProfiles`, `follows/{a}_{b}`,
   `blocks/{a}_{b}`, `profileReports/{hedef}_{şikâyetçi}`; 2 yeni gönderi dizini. Testler: ortak 84, kurallar 82 geçti;
   uygulama emülatörde tarayıcıda denendi (profil, takip, Takip sekmesi, engelleme, Profilim). Panel derlendi, panel
   bölümü tarayıcıda açılmadı. Bilinen sınırlar: gizli hesabın Genel'e paylaştığı gönderi Genel akışında yine görünür
   (kişi Genel'i kendisi seçer); takip edilen 30'dan fazla hesap varsa Takip akışı ilk 30'u okur; ad değişikliği eski
   gönderilerdeki ada yansımaz (3 Kasım'da giderildi). PR #11 birleşti, kurallar yüklendi (Eren, 28 Ekim).

26. **Keşfet, 4. aşama: resmî duyurular akışta ve yasaklı kelime süzgeci** (PROJE.md 5.5 akış sıralaması ve madde 8).
   Mahallem'de mahalleye ve ilçeye yönelik, Bölgesel'de ildeki (ilçe süzgecine uyan) resmî duyurular (muhtar, belediye,
   kurum) kullanıcı gönderileriyle tarih sırasına göre karışık akar; acil duyurular yine en üstte. Ek okuma yok (duyurular
   zaten önbellekte). Yasaklı kelimeler: Panel > Moderasyon > "Yasaklı kelimeler" (yalnızca admin; her satıra bir kelime ya da
   ifade, en çok 1000; kaydetme işlem kaydına yazılır; `config/bannedWords`). Uygulama listeyi oturum başına bir kez okur;
   gönderi, yorum ve profil adı/tanıtımında eşleşme varsa paylaşımı durdurur. Büyük-küçük harf, ı/i, ğ/g, rakamla yazım
   (s4l4k) ve harf tekrarı (salaaak) fark etmez; 4+ harfli kelimeler ekli hâlleriyle de yakalanır. Süzgeç uygulamada
   çalışır (kurallarla zorlanmaz); atlatılan içerik şikâyetle moderasyona düşer. Testler: ortak 88 (4 yeni), kurallar 83
   (1 yeni) geçti; tarayıcıda denendi (belediye duyurusu akışta, yasaklı kelimeli yorum durduruldu). Panel derlendi,
   panel bölümü tarayıcıda açılmadı. Yasaklı kelime listesi boş başlar: admin doldurmalı. PR #12 birleşti, kurallar
   yüklendi (Eren, 28 Ekim).

27. **Haberler, 1. adım: Kurum Haberleri** (PROJE.md 5.3, birinci kaynak resmî kurumlar). Panel > Duyurular'da yeni tür
   **"Kurum haberi"**: kategori zorunlu (Gündem, Belediye hizmetleri, Ulaşım, Kültür sanat, Spor, Eğitim, Sağlık, Çevre,
   Ekonomi), onay akışı duyuruyla aynı, sabitlenemez. Uygulama: Sosyal Harmoni > **Haberler** açıldı. Bölgesel: ilin,
   ilçen ve mahallen için kurum haberleri, kategoriye göre süzme (yalnızca haberi olan kategoriler). Genel: "izin veren
   yayıncılarla yakında" (ülke geneli kaynak henüz yok). Haber okuyucusu: kategori, kaynak (resmî hesap, profile
   bağlantı), okuma süresi, yazı boyu (A−/A+), paylaş. Haberler duyuru listelerinde (ana sayfa, Tüm duyurular, Mahalle
   Meydanı) görünmez; Keşfet'te Mahallem/Bölgesel akışına karışır. Ek okuma yok (duyurularla aynı sorgu). Kurallar:
   `kind` 'haber' eklendi, `category` yalnızca haberde ve orada zorunlu. Testler: ortak 89 (1 yeni), kurallar 84
   (1 yeni) geçti; tarayıcıda denendi (ana sayfada haber yok, Haberler'de var, okuyucu ve yazı boyu). Panel derlendi,
   panel formu tarayıcıda açılmadı. Sonraki adım (Haberler): yayıncı başvurusu (RSS, alan adı doğrulama, avukat
   teyidi; PROJE.md 5.3 madde 2) ve Keşfet > Genel'e haber akışı; "Son Dakika" yalnızca kaynağın işaretiyle.
   PR #13 birleşti, kurallar yüklendi (Eren, 28 Ekim).

28. **Ara** (PROJE.md 5.10). Ana sayfada arama kutusu > Ara ekranı (`apps/mobile/src/app/search.tsx`). Sekmeler: Tümü,
   Kişiler, İşletmeler, Yerler, Etkinlikler, Gönderiler (Tümü'nde her bölümden 3 sonuç + "Tümünü gör"). Boşken son
   aramalar (telefonda, tek tek ya da topluca silinir, en çok 10), önerilen aramalar, hızlı erişim (Hizmetler, Acil
   İhtiyaçlar, Etkinlikler, Benim Şehrim ve acil hizmet kategorileri). **Nasıl arıyor:** Firestore metin içinde arama
   yapamadığı ve ücretli arama hizmeti kullanılmadığı için kişi adı, işletme adı ve gönderi yazısından "arama
   anahtarları" (kelime başları, Türkçe karakter ve büyük harf farkı yok) yazılır (`searchKeys`, `packages/shared/src/search`).
   Sorgunun en uzun kelimesi veritabanına sorulur, öteki kelimeler telefonda süzülür; sonuç yoksa kelime kısaltılarak
   yeniden denenir ve 5+ harfli kelimelerde bir yanlış ya da eksik harf kabul edilir ("berbr" > berber). Kişiler yalnızca adla bulunur
   (gizli hesapta yalnızca ad, tanıtım görünmez), engellenenler ve kişinin kendisi çıkmaz. İşletmeler kişinin ilinden,
   doğrulanmışlar önce (`rankBusinesses`); eşleşen hizmet kategorileri de ("berber" > Berberler listesi) çıkar. Gönderiler
   yalnızca görebildiği akışlardan (Genel, ilindeki Bölgesel, mahallesindeki Mahallem; her biri ayrı sorgu, kurallar
   doğrular), en az 3 harfli kelimeyle. Yerler (Benim Şehrim bölümleri, "Nasıl yapılır?" hariç) ve etkinlikler telefondaki
   listelerden aranır (ek okuma yok ya da bölüm değiştiyse bir kez). Aynı arama 5 dakika yeniden okunmaz. Eski profillere
   anahtar ilk Keşfet açılışında eklenir; **Ara'dan önce eklenmiş işletmeler ve gönderiler, işletme düzenlenene kadar /
   aramada çıkmaz** (gerçek veride neredeyse yok). Silinen gönderinin anahtarları da silinir. **Panel > Moderasyon >
   Önerilen aramalar** (yalnızca admin): dil başına en çok 12 öneri, boş dilde uygulamanın varsayılan listesi; kayıt
   işlem kaydına yazılır (`config/searchSuggestions`). Kurallar: anahtar sayısı sınırlı (profil 40, işletme 60, gönderi
   300), 4 yeni bileşik dizin. Testler: ortak 94 (5 yeni), kurallar 88 (4 yeni). Panel derlendi, panel bölümü tarayıcıda
   açılmadı. Sonra: kullanıcı adı (şimdilik yok), etiket (#) araması, beş dilde içerik çevirisiyle arama (içerik Türkçe girilir).
   PR #14 birleşti, kurallar ve dizinler yüklendi (Eren, 28 Ekim).

29. **Mesajlar** (PROJE.md 5.11). Birebir, yalnızca yazı (fotoğraf, ses, video, grup yok; Eren onayladı). Giriş: Keşfet
   üst bandında sohbet simgesi > Mesajlar (`apps/mobile/src/app/messages/`), profilde "Mesaj gönder". Sohbetler ve
   **İstekler**: takipleşmeyen kişiden gelen ilk mesaj alıcıda istektir; "Kabul et" ya da cevap yazınca sohbete geçer,
   o zamana kadar gönderen "görüldü" bilgisini almaz. Takipleşenlerde sohbet baştan açık. Okunmamış sayısı, "Görüldü"
   (okundu bilgisi kapatılabilir; kapatan "görüldü" yazmaz, karşı tarafınkini de görmez; ayar telefonda). Mesaja
   dokununca kendi mesajında "Sil" ("Bu mesaj silindi"), karşı tarafınkinde "Şikâyet et" (5 neden; mesajın o anki kopyası
   saklanır). IBAN, kapora / ön ödeme ya da bağlantı geçen gelen mesajın altında dolandırıcılık uyarısı. Yasaklı kelime
   süzgeci mesajda da çalışır. İstek ekranından engelleme; engel iki yönde de yazmayı kapatır. **Kurallar (sunucuda):**
   sohbeti yalnızca iki taraf okur (admin dahil kimse okuyamaz); yetişkin ile 13-17 yaş arası arasında sohbet açılamaz;
   engelliyken mesaj yazılamaz; mesaj ile sohbet özeti (son mesaj, okunmamış) aynı yazımda değişir ve birbirini tutmak
   zorunda; adlar herkese açık Keşfet adından alınır; "kabul edilmiş" sohbet yalnızca karşılıklı takipte baştan açılır.
   **Spam sınırı (sunucu işlevi olmadan):** 24 saatte en çok 30 yeni sohbet, ilk 7 günlük hesapta 10 (`chatQuota`
   sayacı yalnızca +1 artar ya da 24 saat dolunca sıfırlanır, silinemez). Hesap silinince yazdığı mesajlar ve sohbetleri
   silinir. **Panel > Moderasyon > Mesaj şikâyetleri** (yalnızca admin): şikâyet edilen mesajın kopyası, "Mesajı kaldır"
   (sohbette "kaldırıldı" görünür) ya da "İşlem gerekmiyor"; işlem kaydına yazılır. Testler: ortak 99 (5 yeni), kurallar
   94 (6 yeni). Panel derlendi, panel bölümü tarayıcıda açılmadı. **Açık:** mesaj bildirimi (push; Blaze ya da EAS),
   mesaj saklama süresi (TTL Blaze ister; kullanım şartlarında yazılacak, avukat), ilan kartıyla başlayan sohbet (ilan
   platformu gelince), sohbeti kendinden silme. PR #15 birleşti, kurallar ve dizinler yüklendi (Eren, 28 Ekim).

30. **Bildirim merkezi** (PROJE.md 5.12, 7). Ana sayfanın üst bandında zil (okunmamış varsa altın nokta) > Bildirimler
   (`apps/mobile/src/app/notifications/`). Son 14 günün olayları, en yeni üstte, okunmamışlar vurgulu, "Tümünü okundu
   say": acil duyuru, duyuru, kurum haberi, yeni etkinlik (ilindeki), mesaj ve mesaj isteği, yeni takipçi, gelen SOS.
   **Nasıl çalışıyor:** sunucu işlevi olmadığı için her olaya ayrı bildirim belgesi yazılmaz; liste uygulamanın zaten
   okuduğu kaynaklardan telefonda toplanır (duyurular ve sohbetler ana sayfada da okunuyor; etkinlik ve takipçiler yalnızca
   bildirim ekranı açılınca). Okundu bilgisi telefonda. **Ayarlar** (`notifications/settings`): yedi tür için aç/kapa;
   acil duyuru ve SOS kapatılırken uyarı ve onay, kapalıyken kırmızı uyarı; sessiz saatler (başlangıç / bitiş, gece
   yarısını aşabilir). Tercihler kişinin özel belgesinde (`users/{uid}/settings/notifications`, yalnızca kendisi okur
   ve yazar; telefona bildirim gelince sunucu da bunu kullanacak). Hesap silinince silinir. **Panel > Bildirimler**
   (menüde artık "yakında" değil): admin hangi olayların bildirim ürettiğini seçer (`config/notificationTriggers`;
   acil ve SOS kapatılamaz, kurallar da zorlar), işlem kaydına yazılır; gruba bildirim gönderme (kampanya) notu.
   Testler: ortak 104 (5 yeni), kurallar 97 (3 yeni). Panel derlendi, panel sayfası tarayıcıda açılmadı. **Açık:**
   telefona anlık bildirim (EAS geliştirme derlemesi + Expo push; olay anında göndermek için Blaze sunucu işlevi),
   panelden gruba bildirim (bölüm 7: hedef, onay, günlük sınır), yarışma bildirimi (yarışmalar gelince), takip isteği
   bildirimi (istekler profil ekranında).

31. **OpenStreetMap ile şehir rehberi iskeleti** (PROJE.md 5.1). `scripts/osm-city-guide.ts` bir il için önemli kurumları,
   müzeleri, otoparkları, parkları, pazar yerlerini ve toplanma alanlarını Overpass'ten ilçe ilçe çeker, Benim Şehrim
   şablonunun sütunlarına çevirir, panelin Excel denetiminden geçirir ve `veri-denemesi/osm-<il>-<ad>.xlsx` yazar
   (klasör repoya girmez; yarıda kalırsa önbellekten devam eder). Çalıştırma: `npx vite-node scripts/osm-city-guide.ts -- 16`.
   Bursa denemesi (28 Ekim): kurumlar 311, parklar 228, otoparklar 47, pazarlar 35, müzeler 28, toplanma alanı 1. Ad ve
   konum iyi; telefon, saat, müze ücreti, pazar günü çoğunlukla boş (pazarların 33'ü, müzelerin 15'i, otoparkların 16'sı
   eksik alan yüzünden panelde "düzeltilecek"). Adsız 508 otopark, lojmanlar ve oto yıkama gibi işletmeler alınmaz.
   **Karar (Claude, Eren bıraktı):** OSM "ad + konum" iskeleti olarak kullanılır, ayrıntıları ekip/yapay zekâ kaynakla
   tamamlar. Toplanma alanları için AFAD / e-Devlet gerekir. Uygulamada "© OpenStreetMap katkıda bulunanlar" yazılmalı
   (ODbL; birleşik veritabanının paylaşımı avukata sorulacak).

32. **Tasarım uygulaması, ilk dalga** (PROJE.md 13. madde 27-30). Ölçüler tüm uygulamada küçüldü (yazı, düğme,
   kenar boşluğu; dokunma alanı en az 44). **Alt gezinme** (Ana Sayfa, Keşfet, Ara, Profil = Hesabım) ve ana sayfada
   **yan menü** (modüller, Profilim, Mesajlar, Bildirimler, Ayarlar, Çıkış). **Ana sayfa:** tarih, selamlama, konum,
   acil şerit (varsa), dört modül resimli kartta, tanıtım videosu (bağlantı Panel > Moderasyon > Tanıtım videosu,
   `config/introVideo`, yalnızca https, işlem kaydı; boşsa "yakında"). YouTube / Vimeo bağlantısı uygulama içinde,
   ekranın ortasında açılan pencerede oynar (`videoEmbedUrl`, çerezsiz YouTube adresi; react-native-webview), başka bağlantı tarayıcıda. **Benim Şehrim:** kapak, Belediye büyük kart,
   renkli kutucuklar (verisi olmayan "Yakında"), Mahalle Meydanı ve Şehir Vitrini (yakında). **Keşfet (Eren'in örnek ekranıyla, 2. tur):** üstte menü, "KEŞFET" ve açık sekme, + (yeni gönderi; açık
   sekme hedef olarak seçili gelir) ve zil; konum çipi yok. MAHALLEM / BÖLGESEL / GENEL / TAKİP şeridinde üçü görünür
   (Takip'te Mahallem gizlenir), parmakla sağa sola kaydırınca sekme değişir (sekme yalnızca açılınca okunur). Etiketler
   (#Tümü, #Yardım, #Kayıp...) kategoriye göre süzer. Gönderi: halkalı harf, ad, yer ve süre, Takip et / Takiptesin,
   iki kez dokun beğen, yorum, paylaş, kaydet (kaydettiklerim oturumda bir kez okunur), #kategori. Kaydedilenler yan
   menüde. Takip akışının önbellek anahtarı düzeltildi (Genel ile karışıyordu). **Profil:**
   halkalı harf, gönderi/takipçi/takip sayıları, Takip et ve Mesaj yan yana. **Sosyal Harmoni:** yana kaydırılan kartlar,
   arkada değişen sahne; forum kaldırıldı (madde 18). Başlığın altında il adı yalnızca bilgi olarak (konum burada değiştirilmez). Yukarı kaydırınca ikinci sayfa **Fırsatlar** (yemek, market, spor,
   eğlence, esnaf, sağlık, eğitim; indirim sistemi gelene kadar "yakında", örnek oran ve marka adı yok). **Karşılama:** beş sahne sırayla, "Kaydırarak başla" (dokunarak da),
   "Zaten hesabın var mı?". **Acil İhtiyaçlar:** nabız gibi atan büyük SOS kartı. Görseller şimdilik çizim
   (`components/scene-art.tsx`, "hareketi azalt" açıksa durur); gerçek fotoğraflar Storage (Blaze) ile panelden gelecek.
   Yeni paket: react-native-svg. Testler: ortak 104, kurallar 98 (1 yeni). Telefonda ana sayfa ve yan menü görüldü;
   Keşfet, profil, Sosyal Harmoni, karşılama, Acil web önizlemede / tip denetiminde kontrol edildi, telefonda bakılmadı.

33. **Profil, Mesajlar ve Ara** (PROJE.md 13. madde 31-32). Alt gezinme dört sekme (Ana Sayfa, Keşfet, Ara, Profil);
   **Mesajlar profilin sağ üstünde** (okunmamışta nokta), Mesajlar ekranında geri düğmesi. **Profil** (`/me`, başkasınınki `/u/[uid]`, ortak `components/profile-view.tsx`): Instagram düzeni;
   üstte solda geri (ana sayfaya), ortada ad (Plus Jakarta 800), sağda Mesajlar ve ☰ (Ayarlar = eski Hesabım sayfası, artık geri düğmeli, bildirim ayarları da orada). Halkalı harf,
   gönderi/takipçi/takip, ad ve tanıtım (il gösterilmez, isteyen tanıtıma yazar). Kendi profilinde Düzenle, Profili
   paylaş, Kişi bul (Ara'yı Kişiler sekmesiyle açar, ekran açıksa da geçer; arama tek yerde); Ailem (SOS) ve İşletmem kısayol kartları; takip
   istekleri. Sekmeler: Gönderiler (üçlü ızgara, fotoğraf gelene kadar kategoriye göre renkli yazı kareleri),
   Kaydedilenler, Katıldıklarım (etkinlik + aktivite; `eventRepository.listJoined`, kişinin kendi katılım kayıtları,
   mevcut kural ve dizinle). Başkasının profilinde Takip et ve Mesaj; paylaş, şikâyet ve engelle "…" alt menüsünde.
   Paylaşım yalnızca Keşfet'ten. **Mesajlar:** üstte kullanıcının adı, sağda yeni mesaj, altında sohbetlerde arama;
   yeni mesaj ekranı (`/messages/new`) takip ettiklerini listeler ve adla kişi arar. Başarımlar ve banner yok (Eren).
   **Ara** (tasarım ara.html, sadeleştirildi): üstte "Ne aramak istersin?", büyük arama kutusu ve altın ara düğmesi,
   altın seçili sekmeler; yazınca başlık küçülür. Boşken son aramalar, #önerilen aramalar, bölgendeki ustalar (hizmet
   kategorileri, acil olanlar önce), yaklaşan etkinlikler, hızlı erişim. Yapay zekâ asistanı, sesli arama, rotalar ve
   örnek sayılar konmadı (altyapısı yok / sahte veri olurdu). Testler: kurallar +1 doğrulama (events). Telefonda bakılmadı.

34. **İşletme sayfası, takip, yetkililer, işletme adına paylaşım** (PROJE.md 13. madde 33). **İşletme sayfası**
   (`/business/[id]`): profil iskeleti; halkalı harf, gönderi / takipçi / puan, ad + doğrulama rozeti, kategori ve
   ilçe, "Şu an açık · kapanış 23:00" (`openState`, gece yarısını geçen saatler dahil). Takip et, Ara, WhatsApp,
   Yol tarifi (Apple / Google Haritalar, adresle). Sekmeler: Gönderiler (ızgara, `components/post-grid.tsx`), Menü ya da
   Hizmetler (fiyat listesi), Yorumlar, Bilgiler (saat tablosu, ödeme, olanaklar, güven bilgisi). **Takip:**
   `businessFollows/{işletme_kişi}` + `followerCount` (kurallar sayacı tam bir değiştirir); takip edilen işletmenin
   "Takip" hedefli gönderileri Takip akışına düşer. **İşletmem formu:** mahalle (isteğe bağlı, gizli), haftalık saat
   (gün gün, ilk günü tüm haftaya kopyala), ödeme yöntemleri, olanaklar. **Yetkililer:** sahibi en çok 3 kişiyi adıyla
   bulup ekler; izinler: paylaşım kapalı / sahibinin onayıyla (varsayılan) / doğrudan, bilgileri düzenleme (telefon
   hariç), yorumlara cevap. Yetkili kendini çıkarabilir; İşletmem'de "Yetkili olduğun işletmeler". **İşletme adına
   paylaşım:** Keşfet + ekranında "Kimin adına?"; gönderi işletmenin adı ve konumuyla, akışta "İşletme" etiketiyle;
   adına dokununca işletme sayfası. Onaylı yetkilinin paylaşımı `onay-bekliyor` durumunda akışa düşmez; sahibi işletme
   sayfasında onaylar ya da reddeder. Kişisel profilde işletme paylaşımları görünmez. **Panel:** İşletmeler tablosunda
   takipçi sayısı ve yetkililer; admin yetkiliyi çıkarır (işlem kaydı). Hesap silmede işletme takipleri ve
   yetkililikler bırakılır. Testler: kurallar +4 (business-page), ortak +2. **Eren yapacak:** birleştirince kuralları
   ve dizinleri yükle (3 yeni dizin). Telefonda bakılmadı.

35. **Seyahat 1. aşama: Keşfet ve Öğren** (PROJE.md 5.2; 13. madde 34). Ana sayfa ve yan menüde Seyahat açıldı.
   **Giriş** (`/travel`, seyahat.html): ekran çaprazlamasına ikiye bölünür (döndürülmüş kesme kutusu, ek paket yok);
   "Keşfet ve Öğren" ve "Planla ve Navigasyon" (yakında). **Keşfet ve Öğren** (`/travel/explore`): solda ülke şeridi
   (yalnızca Türkiye), 7 bölge kartı (coğrafya kodda: `TR_REGIONS`, 81 il); tanıtımı yayında olmayan bölge "Yakında".
   **Bölge** (`/travel/region/[id]`): kapak, kısa etiket ve tanıtım, tanıtım videosu (uygulama içinde), il sayısı,
   kategori süzgeci, şehir kartları; tanıtımı olmayan iller altta "yakında". **Şehir** (`/travel/city/[kod]`): kapak,
   tanıtım, kaynaklı bilgiler (etiket / değer / kaynak / yıl), Kareler / Başkanlarla Keşif / Yöresel kutuları ve Hazır
   Rotalar şeridi ("yakında", 2. ve 3. aşama), kategoriye göre gezilecek yerler. **Yer** (`/travel/place/[id]`):
   hakkında, video, saat / ücret / adres / süre (yalnızca girilenler), "gitmeden kontrol et" notu, nasıl gidilir,
   yakındaki hizmetler, ipuçları, tarihçe, mimari, erişilebilirlik, yol tarifi / ara / web, paylaş, kaynak ve son
   güncelleme. Puan, "Premium", bütçe işareti, hava durumu, yapay zekâ rehberi yok. Görseller çizim (Storage gelince
   fotoğraf). Veri: `travelRegions`, `travelCities` (kimlik = plaka), `travelPlaces`; uygulama yalnızca yayındakini okur,
   oturumda bellekte tutar. **Panel > Seyahat** (admin): Bölgeler / Şehirler / Gezilecek yerler, taslak ↔ yayında,
   yer ekle / düzenle / sil, "Başlangıç içeriğini yükle" (Marmara, Bursa ve 9 Bursa yeri; saat, ücret, telefon bilerek
   boş), işlem kaydı (modül `seyahat`). Testler: kurallar +1 (travel), ortak +2. **Eren yapacak:** birleştirince
   kuralları yükle; panelde "Başlangıç içeriğini yükle", içeriği kontrol edip Marmara, Bursa ve yerleri yayına al.
   Telefonda bakılmadı (web önizlemede giriş ve bölge ekranları görüldü).
   **Düzeltme (Eren):** ülke şeridinde 15 ülke yazılı (Türkiye açık, diğerleri seçilince "yakında"); bölgeler içerik
   yayında olmasa da açılır (iller "yakında" listelenir). Büyük harf Türkçe kurala göre (TÜRKİYE).
   Uygulama boş sonucu önbelleğe almaz, dolu içeriği 30 dakikada yeniler. Panel > Yerler: şehir taslaktayken yayındaki
   yerler için uyarı (canlıda Bursa şehir kaydı taslakta kalmıştı, 29 Ekim).
- **Seyahat 2. aşama (29 Ekim, dal `claude/seyahat-2`):** Hazır Rotalar (`/travel/routes/[code]`: temalı kartlar, süre
   filtresi), rota ekranı (`/travel/route/[id]`: özet, "Rotayı başlat", durak durak ilerleme, yerin saat/ücret/ulaşım
   bilgisi, sonraki durağa nasıl gidilir), Yöresel (`/travel/local/[code]`: tür filtresi, açılır kartlar, rozet), Başkanlarla
   Keşif (`/travel/mayors/[code]`: il tanıtımı üstte, bütün ilçeler eşit kart, nüfusa göre sıra, bölge filtresi, "Belediye
   tanıtımı", rota ve video). Şehir sayfasındaki kutular açıldı (Kareler 3 Kasım'da açıldı). Veri: `travelRoutes`, `travelLocal`,
   `travelMunicipal` (kimlik = kurum kimliği). Panel > Seyahat: Hazır rotalar (durak düzenleyici), Yöresel, Başkanlarla
   Keşif (nüfus, bölge, başkan adı gösterimi, yayına alma) sekmeleri; başlangıç içeriğine 6 Bursa rotası ve 6 yöresel
   eklendi. Belediye paneli: kuruma "Seyahat" bölümü yalnızca belediyelere verilir; personel tanıtım ve rotalarını "Onaya
   gönder"ir, admin yayına alır, yayındaki tanıtım değişince yeniden onaya düşer. Kurallar + 3 yeni test (105 kural testi).
   **Eren yapacak:** PR birleştir, kuralları yükle, Panel > Seyahat > "Başlangıç içeriğini yükle" (yalnızca yeni rota ve
   yöresel eklenir), rotaları ve yöreselleri kontrol edip yayına al.
- **Mağaza öncesi, Claude'un üç işi (30 Ekim, dal `claude/magaza-oncesi`):** (1) Kök hata yakalayıcı: bir ekran çökerse
   "Bir sorun oldu" + "Tekrar dene" (`components/crash-screen.tsx`, `_layout.tsx` içinde `ErrorBoundary`; ayar ve oturuma
   bağlı değil, açılışta çökerse açılış görselini kapatır). (2) İnternet kesilince altta 5 saniyelik "Bağlantı yok" bildirimi
   (`components/offline-banner.tsx`, `@react-native-community/netinfo`; düğmeleri kapatmasın diye kaybolur, dokunmayı
   engellemez). (3) iPhone konum izni metni SOS + Yoldayım (yol üstü mola yerleri) + işletme konumunu anlatıyor, 5 dilde
   (`apps/mobile/locales/*.json`, `app.json` > `locales`; yalnızca EAS derlemesinde etkili, Expo Go kendi metnini gösterir).
   Web önizlemede çökme ekranı ve bildirim görüldü; telefonda bakılmadı. Panel karşılığı gerekmez (altyapı).
- **Arka uç 1. parça: sunucu işlevleri (31 Ekim, dal `claude/sunucu-islevleri`).** Karar (Eren): önce arka uç, sonra
   ekran tasarımları, sonra eksik bilgiler; panel tasarımı da iyileştirilecek. Yeni `functions/` paketi (Cloud Functions,
   Node 22, bölge europe-west1, işlev başına en çok 5 kopya; esbuild ortak kodu tek dosyaya gömer, buluta yalnızca
   firebase-admin ve firebase-functions kurulur). İşlevler: (1) `eventCancelled`: yayındaki etkinlik iptal edilince
   "Katılıyorum" diyenlere telefon bildirimi; (2) `activityCancelled`: aktivite iptalinde katılanlara (düzenleyen hariç);
   (3) `dailyCleanup`: süresi dolan SOS kayıtlarını siler (TTL yerine); (4) `userDeleted`: hesap silinince kalan kişisel
   kayıtlar (users/{uid} altı, pushTokens, publicProfiles, chatQuota) silinir, uygulamanın kendi silmesine güvenlik ağı.
   Bildirimler kişinin dilinde (5 dil, `notifications.push`), Panel > Bildirimler'deki "etkinlik" anahtarına, kişinin
   tercihine ve sessiz saatlere (Türkiye saati) uyar; Expo "geçersiz adres" derse adres silinir. Ortak kod:
   `packages/shared/src/notifications/push.ts` (`noticePushMessages`, `turkeyHour`). Telefonda bildirime dokununca
   etkinlik / aktivite ekranı açılır (yalnızca izinli ekranlar), Android'de "Genel bildirimler" kanalı. Testler: ortak 134
   (3 yeni), işlevler 6 (emülatörde); emülatör dört işlevi de yükledi. **Henüz çalışmıyor:** Blaze + yükleme gerekir;
   telefona bildirim için ayrıca EAS proje kimliği (telefon sürümü). Panel karşılığı: Panel > Bildirimler (tür anahtarı).
- **Arka uç 2. parça: duyuru bildirimi (31 Ekim, dal `claude/duyuru-bildirimi`).** `announcementPublished`: duyuru, acil
   duyuru ya da kurum haberi yayına girince (doğrudan yayın ya da onay) bölgedeki kişilere telefon bildirimi. Bölge,
   kişinin profilindeki konumla eşleşir (`users.location`: il > ilçe > mahalle); kural ve telefon değişikliği gerekmedi.
   Başlık türe göre, kişinin dilinde ("Acil duyuru · Nilüfer Belediyesi"; muhtarda "Muhtarlık", il yöneticisinde "CityJoy"),
   gövde duyurunun kendi başlığı. Acil duyuru sessiz saatte de ve yüksek öncelikle gider (iOS odak modunda görünür).
   Süresi geçmiş duyuruya gitmez; tetikleyici iki kez çalışsa da bir kez gönderilir (`pushLog/duyuru_{id}`, telefonlara
   kapalı). Dokununca duyuru ekranı açılır. Testler: ortak 135, işlevler 9; emülatör beş işlevi yükledi. Not: çok büyük
   illerde (yüz binlerce kişi) gönderim parçalara bölünmeli; kullanıcı sayısı artınca yapılacak.
- **Kapsam kararı ve 81 il durumu (31 Ekim, dal `claude/81-il`):** Karar (Eren): ilk sürüm Bursa içeriğiyle çıkar,
   altyapı 81 il için hazır olur. Tarama: kodda Bursa'ya sabit bir şey yok (yalnızca yorumlar, testler ve Seyahat
   başlangıç içeriği); konum 81 il / 973 ilçe, şehir rehberi, yetkiler ve OSM aracı (`scripts/osm-city-guide.ts <il kodu>`)
   her ilde çalışıyor, boş ilde "Bu ilde henüz bilgi yok" görünür. Yeni: Panel > Şehir rehberi > "81 il durumu" (yalnızca
   admin): her ilde Benim Şehrim bölümlerinin kayıt sayısı ve "dolu bölüm x / 9"; il adına basınca o il açılır. İl başına
   tek özet belgesi okunur, kural değişikliği yok. Derleme ve 131 test geçti; gerçek veriyle panelde bakılmadı.
- **Mesajlar: işletmeye mesaj, İşletmem, sohbeti sil (31 Ekim, dal `claude/mesaj-isletme`):** Eren'in isteği. İşletme
   sayfasında "Mesaj gönder" (sahibi ve ekibi görmez). İşletmeye yazılan sohbet ayrı bir sohbettir (kimlik
   `kişi_kişi__b_<işletme>`, `context {type:'isletme', id, title}`): aynı iki kişinin kişisel sohbetiyle karışmaz; istek
   aşaması yok; ilk mesajı yalnızca müşteri atar (işletme reklam mesajı başlatamaz). Kurallar: karşı taraf işletmenin sahibi,
   işletme yayında, ad işletmenin adı; engel, yaş kuralı ve günlük yeni sohbet sınırı aynen geçerli. Mesajlar ekranı:
   Sohbetler / İstekler / **İşletmem** (yalnızca işletmesi olana; müşteri adı ve altında "İşletmen için: ..."); okunmamış
   olan bölümde nokta. Sohbette sağ üstte seçenekler: profil ya da işletme, **Sohbeti sil**, Engelle. "Sohbeti sil"
   (`hidden.<uid>` = silme anı) sohbeti yalnızca kendi listesinden kaldırır, karşı tarafa dokunmaz; yeni mesaj gelince sohbet
   geri gelir ama silmeden önceki mesajlar görünmez. Panel > Moderasyon > Mesaj şikâyetleri: işletme sohbetinden gelen şikâyet
   işaretli. Bildirimdeki adres işletme sohbetini açar. Testler: kural 8 (2 yeni), ortak 137. Emülatörde web sürümüyle
   baştan sona denendi (müşteri yazdı, sildi; sahip İşletmem'de gördü, cevapladı; sohbet müşteride yalnızca yeni mesajla
   geri geldi). PR #42 birleşti, kurallar 31 Ekim'de yüklendi. İlan pazarı (İlanlar bölümü) sıradaki iş.
- **Yetkiliye mesaj izni (31 Ekim, dal `claude/carsi`):** Eren'in isteği. İşletmem > Yetkililer'de yeni izin "Müşteri
   mesajlarına cevap verebilir" (varsayılan kapalı). İzni olan yetkili, işletmeye yazılan sohbetleri Mesajlar > İşletmem'de
   görür ve işletme adına cevaplar; sohbetin üyesi olmaz. Okunmamış sayısı işletme tarafında ortaktır (sahip ya da yetkili
   okuyunca sıfırlanır). Yetkili "Sohbeti sil" yapamaz, "gördüm" yazmaz, kişisel sohbetleri göremez. Sohbette ekip
   arkadaşının mesajının altında "İşletme ekibi" yazar. Kurallar sunucuda denetler (`isBusinessStaff`); yeni sorgu için yeni
   dizin. Testler: kural 118, ortak 137 (yeni yetkili testi). PR #43 birleşti, kurallar 31 Ekim'de yüklendi.
- **Çarşı: ikinci el eşya ilanları (31 Ekim, dal `claude/carsi-ilan`):** Karar (Eren): önce eşya, adı Çarşı. Benim Şehrim >
   Çarşı: ildeki ilanlar (istenirse yalnızca ilçe), arama, tür (satılık / kiralık / ücretsiz / takas) ve kategori süzgeci
   (8 kategori, parlak simgelerle), sayfa sayfa yükleme. İlan sayfası: fiyat, durum, açıklama, yer, "Mesaj gönder",
   favori, şikâyet (7 neden), güvenli alışveriş önerileri. Sahibi: düzenle, satıldı / yeniden satışa aç, son 3 günde
   "yenile (30 gün)", kaldır. "İlanlarım" ve "Favorilerim". İlan ver: e-postası doğrulanmış 18+ kişi, kayıtlı mahallesiyle;
   yeni ilanda telefonun konumu bir kez kayıtlı ille karşılaştırılır (yaklaşık, sahte konumla aşılabilir); yasaklı ürünler
   formda yazılı; emlak / araç ilanı sezgiyle engelli; yasaklı kelime denetimi. Günlük ilan sınırı (ilk 7 gün 2, sonra 5;
   `listingQuota`), ilan 30 gün listede, 3 şikâyette moderatöre düşer. Telefon numarası alanı yok. Fotoğraf yok (Blaze
   ve Storage ile gelecek; kurallar şimdilik boş liste ister), yerine kategori simgesi. **Mesajlar > Çarşı:** ilandan açılan
   sohbet ayrı (`a_b__l_<ilan>`), istek aşaması yok, alıcı başlatır, iki tarafta Çarşı bölümünde, başlıkta kişinin adı ve
   altında ilan; sohbette güvenli alışveriş uyarısı ve "İlanı aç". Satılan ya da yayından kalkan ilana yeni sohbet açılmaz.
   **Panel > Moderasyon > Çarşı şikâyetleri** (admin hepsi, il yöneticisi / gönüllü moderatör kendi ili; kaldır / yerinde
   kalsın, işlem kaydı). Hesap silinince ilanlar da silinir. 5 dilde metinler. Ortak düzeltme: parlak simgelerin renk
   geçişi webde bazen boş görünüyordu (aynı kimlik), her simgeye ayrı kimlik verildi. Testler: kural 126 (8 yeni), ortak
   142. Emülatörde web sürümüyle denendi (liste, favori, ilan sayfası, mesaj, Mesajlar > Çarşı, ilan verme, satıldı,
   İlanlarım). PR #44 birleşti, kurallar ve dizinler 31 Ekim'de yüklendi.
   Eren'in isteği (31 Ekim): Çarşı'nın üstündeki konum değiştirme düğmesi kaldırıldı (il adı düz yazı); başka ile ilan
   verilemesin diye ilan verirken telefonun adres çözümlemesi (cihazda, ücretsiz) hangi ilde olduğunu söyler, kayıtlı ille
   aynı değilse ilan verilmez; il adı tanınmazsa ya da web'de il merkezlerine uzaklık denetimi. Ayrıca sayfa yenilenince favori kalplerinin boş görünmesi düzeltildi (React Compiler modül değişkenini izlemiyordu; `useSyncExternalStore`). Beğenilerde (`useLiked`) aynı sorun olabilir, bakılacak (dal `claude/carsi-belge`). Not: Windows'ta Expo'nun ürettiği rota türlerinde
   `/carsi` yerine `/carsi/index` çıkabiliyor (Expo hatası); `apps/mobile/.expo/types/router.d.ts` içinde düzeltilir.
- **Arka uç 3. parça: mesaj ve takip için telefon bildirimi (31 Ekim, dal `claude/carsi-belge`).** Uygulama içindeki zil
   listesinde bunlar zaten vardı; şimdi uygulama kapalıyken de telefona düşer. `messageSent`: yeni mesajda karşı tarafa,
   başlıkta gönderenin adı, gövdede mesajın ilk 150 harfi. İşletmeye yazılınca sahip ve mesaj izni olan yetkililer alır
   (başlık "Ali Y. · İşletme"); işletme adına cevap müşteriye işletmenin adıyla gider; Çarşı sohbetinde başlıkta ilanın adı.
   Mesaj isteğinde (takipleşmeyen iki kişi) metin kilit ekranında görünmez ("X sana mesaj göndermek istiyor") ve yalnızca ilk
   mesajda gider. `followChanged`: yeni takipçi ve takip isteği hesap sahibine, isteğin kabulü isteyene; takip bırakılıp
   yeniden edilirse 7 gün içinde tekrar gitmez (`pushLog`, günlük temizlik siler). Kişinin tür ayarları ve sessiz saatleri
   geçerli. Bildirime dokununca sohbet, profil ya da (takip isteğinde) kendi profili açılır; o an açık olan sohbetin
   bildirimi uygulama içinde çıkmaz. 5 dilde metinler. Testler: sunucu 17 (8 yeni), ortak 145. Blaze ve işlev yüklemesiyle
   çalışmaya başlar; gerçek telefonda deneme EAS ile. Kural değişikliği yok. PR #47 birleşti (31 Ekim).
- **Arka uç 4. parça: günlük sınırlar ve bildirim öncelikleri (31 Ekim, dal `claude/sinirlar`).** Eren onayladı
  (PROJE.md 15.3 ve 5.12). Sınırlar: her iş `usage/{sahip~iş}` sayacıyla aynı toplu yazımda sayılır, kurallar denetler
  (Blaze gerekmez); sayılar `config/limits` (Panel > Günlük sınırlar, yalnızca admin, işlem kaydı). Ortak kod
  `packages/shared/src/limits` ve `firebase/limits.ts` (`countUsage`, `LimitReachedError`). Telefonda gönderi, yorum,
  takip, aktivite, öneri ve şikâyet ekranları sınır dolunca yenilenme saatini söyler (5 dil). Panelde duyuru ve etkinlikte
  sınır dolunca "Onaya gönder" düğmesi; kimse kendi hazırladığını onaylayamaz (admin hariç). Var olan sohbet ve ilan
  sınırları da artık panelden. Bildirim öncelikleri: Panel > Bildirimler'de tür başına her zaman / normal / uygulama içi ve
  günlük sesli tavan (5); sunucu `pushCount/{uid}` ile sayar, tavandan sonra sessiz kanaldan gönderir; admin onayda "bildirim
  her zaman çalsın" (`ringAlways`). Düzeltilen hata: sunucu panelin kapattığı türleri yanlış alandan okuyordu. Testler:
  kurallar 130, sunucu 19, ortak 148. Birleşti, kurallar ve dizinler 31 Ekim'de yüklendi (Eren'in isteğiyle Claude).
- **Hesap silinince hizmet önerileri ve sınır sayaçları da silinir (31 Ekim, dal `claude/hesap-oneri`).** Kişi kendi
  önerilerini okuyup silebilir (kurallar), hesap ekranı siler; sunucudaki silme güvenlik ağı da öneri, sayaç ve günlük
  bildirim sayacını (`pushCount`) temizler. Testler: kurallar 130, sunucu 19. **Kurallar değişti: birleşince yüklenmeli.**
- **Keşfet'e fotoğraf (31 Ekim, dal `claude/foto`; hesap silme dalını da içerir).** Gönderiye en çok 4 fotoğraf; fotoğraf
  varsa yazı boş olabilir. Telefonda galeriden seçilir (`expo-image-picker`), en uzun kenar 1600 piksel JPEG'e küçültülür
  (`expo-image-manipulator`; konum ve cihaz bilgisi bu sırada atılır), gönderinin kimliğiyle
  `posts/{uid}/{postId}/{0-3}.jpg` yoluna yüklenir, sonra gönderi kaydedilir (kayıt olmazsa dosyalar geri silinir).
  Akışta ekran genişliğinde (oran 4:5 ile 1.91:1 arası), çoklu fotoğraf yana kaydırılır ("2/3" ve noktalar); profil
  ızgarasında ilk fotoğraf kare olur. Panel > Moderasyon şikâyet edilen gönderinin fotoğraflarını gösterir. Kurallar:
  Storage `firebase/storage.rules` (yalnızca sahibi, yalnızca JPEG, en çok 1,5 MB, üzerine yazma yok, okuma girişliye);
  Firestore fotoğraf alanını denetler (kendi klasörü, bu gönderinin kimliği, sıra, Storage adresi). Sunucu işlevi
  `postPhotosRemoved`: gönderi kaldırılınca (sahibi ya da moderatör) dosyaları siler; hesap silinince `posts/{uid}/`
  klasörü silinir. Testler: kurallar 133 (Storage emülatörüyle; emülatör "üzerine yazma"yı sınayamıyor), sunucu 21,
  ortak 148. **Henüz çalışmıyor:** Blaze, konsolda Storage'ı açmak, Storage kurallarını ve işlevleri yüklemek gerekir;
  o zamana kadar fotoğraflı paylaşım "yüklenemedi" der, yazılı paylaşım çalışır. Telefonda denenmedi (Blaze sonrası).
  Açık: yükleme yarıda kalırsa klasörde artık dosya kalabilir (ileride günlük temizlik).
- **Etkinlik kapağı, kurum logosu, işletme logosu ve vitrini (31 Ekim, dal `claude/foto`; Blaze ile çalışır).** Ortak
  altyapı `packages/shared/src/media/photo.ts`: dosyalar `media/{yükleyen}/{tür}/{rastgele}.jpg` (türler: etkinlik,
  kurum, isletme-logo, isletme-vitrin), seçilince küçültülüp hemen yüklenir, kayıtla birlikte kaydedilir. Panel:
  Etkinlikler formunda kapak, Profil sayfasında logo (`components/image-field.tsx`, tarayıcıda 1600 piksel JPEG).
  Uygulama: etkinlik kartında küçük kapak, ayrıntıda tam genişlik; resmî profil kartında yuvarlak logo; İşletmem
  formunda logo ve vitrin (`components/media-picker.tsx`), işletme sayfasında logo halkada ve vitrin yana kayan
  şerit, liste kartında küçük logo. **Vitrin sayısı kademeye göre** panel > Sınırlar'dan (karar 3 Kasım: ücretsiz 1, pro 10; eski öneri ücretsiz 3, standart 10,
  pro 20, premium 30; kesin üst sınır 30; kademeler gelir konusunda kesinleşecek). Kurallar: yeni bağlanan logo/kapak
  bağlayanın kendi dosyası olmalı, değişmeyen kalabilir; vitrinde kural motorunun 1000 işlem sınırı yüzünden yalnızca
  sayı denetlenir, uygulama yalnızca kendi depomuzdaki (Storage) adresleri gösterir (`photoFrom`). Sunucu işlevleri
  `eventMediaChanged`, `profileMediaChanged`, `businessMediaChanged`: kayıttan çıkan görselin dosyasını siler
  (vitrinde yalnızca sahibin ve yetkililerin dosyası). Testler: kurallar 137, sunucu 24, ortak 150. Aktivite görseli
  ve "{Şehir}'dan Kareler" sonra. Açık: panelde görsel seçip kaydetmeden çıkılırsa dosya artık kalır (günlük temizlik).
- **Panel internette (31 Ekim, Eren onayladı):** https://cityjoynew.web.app. `firebase/firebase.json` içinde Hosting
  ayarı (güvenlik başlıkları, arama motorlarına kapalı); `npm run panel:deploy` derler, `firebase/panel-dist`
  klasörüne kopyalar (Firebase yalnızca kendi klasörünün içinden yükler; klasör GitHub'a gitmez) ve yükler. Ücretsiz
  planda çalışır. Panelde her değişiklikten sonra yeniden yüklenmeli (birleşmiş `main` dalından yüklemek doğrusu;
  ilk yükleme `claude/foto` dalından yapıldı; PR #50 birleşince Firestore kuralları ve panel `main`den yeniden
  yüklendi, 31 Ekim). Storage kuralları ve sunucu işlevleri Blaze bekliyor.
- **Kişi profil fotoğrafı (1 Kasım, dal `claude/profil-foto`; Blaze ile çalışır).** Herkes (kullanıcı, muhtar, kurum
  ya da işletme yöneticisi; hepsi aynı kişisel Keşfet profilini kullanır) profil düzenleme formunda fotoğraf seçer:
  galeriden kare kırpılır, 800 piksele küçültülür, `media/{uid}/profil/` altına yüklenir, hemen kaydedilir
  (`publicProfiles.photo`). Fotoğraf baş harfin üstünde yuvarlak görünür: profil, gönderi kartı, mesaj listesi ve yeni
  mesaj, Ara > Kişiler, yan menü, işletme yetkilileri. Başkalarının fotoğrafı oturumda kişi başına bir kez okunur
  (`lib/profile-photos.ts`). Kurallar: yalnızca kendi yüklediği `profil` dosyası. Moderasyon: panel > Moderasyon >
  profil şikâyetlerinde fotoğraf küçük görünür, "Fotoğrafı kaldır" siler ve kişinin yenisini koymasını kapatır (işlem
  kaydına geçer). Sunucu `profilePhotoChanged` eski dosyayı siler (hesap silinince de). Testler: kurallar 138, sunucu
  25, ortak 150. Resmî profil ve işletme kendi logosunu kullanır (ayrı). PR #52 birleşti; Firestore kuralları ve
  panel `main`den yüklendi (1 Kasım). Storage kuralları ve işlevler Blaze bekliyor.
- **Beğeni ve kaydet işaretleri düzeltmesi (3 Kasım, dal `claude/pensive-mccarthy-xm0n7c`).** Keşfet'te kalpler ve
  kaydet işaretleri Çarşı favorileriyle aynı yöntemle tutuluyor (`apps/mobile/src/lib/posts.ts` içindeki `idStore`:
  her değişiklikte yeni nesne, `useSyncExternalStore`; açılışta okuma reddedilirse 2 sn sonra bir kez daha). Önceden
  sayfa yenilenince boş görünebiliyor, ilk okuma başarısız olursa oturum boyunca boş kalıyordu. Emülatörde web
  sürümüyle denendi (beğeni + kaydet, sayfa yenileme sonrası doğru). Kural değişikliği yok.
- **Çarşı ilan fotoğrafları (3 Kasım, aynı dal; Blaze ile çalışır).** İlan formunda en çok 6 fotoğraf (`MediaPicker`, tür
  `ilan`: `media/{sahip}/ilan/...`); seçilince küçültülüp hemen yüklenir, ilanla kaydedilir; düzenlerken eklenir/çıkarılır.
  Listede ilk fotoğraf kapak (yoksa kategori simgesi), ilan sayfasında yana kaydırılan fotoğraflar ("1/2", noktalar).
  Panel > Moderasyon > Çarşı şikâyetlerinde fotoğraflar küçük görünür. Kurallar: en çok 6, her dosya yolu ilan sahibinin
  `ilan` klasöründe (kural motorunun 1000 işlem sınırı yüzünden yalnızca yol; adresi uygulama denetler, `photoFrom`);
  fotoğraflar değişmediyse yeniden denetlenmez; sahibi kaldırırken fotoğraflar boşaltılır. Storage kurallarına `ilan`
  türü eklendi. Sunucu `listingPhotosChanged`: ilandan çıkan dosyayı siler; moderatör kaldırınca alanı boşaltır (dosyalar
  ardından silinir); hesap silinince `media/{uid}/ilan/` silinir. Fotoğraf şimdilik isteğe bağlı. **Karar (Eren, 3 Kasım):**
  Blaze sonrası yeni ilanda en az bir fotoğraf zorunlu olacak (Blaze'e geçişte yapılacaklar listesinde). Testler: kurallar 139, sunucu 27, ortak 150. Emülatörde web sürümüyle denendi (iki
  fotoğrafla ilan, düzenleyip birini değiştirme, başka kullanıcıda liste ve ilan sayfası). **Kurallar değişti:
  birleşince Firestore kuralları yüklenmeli;** Storage kuralları ve işlevler Blaze bekliyor.
- **Aktivite kapak fotoğrafı (3 Kasım, aynı dal; Blaze ile çalışır).** "Aktivite aç" formunda isteğe bağlı tek kapak
  (`MediaPicker`, tür `aktivite`); aktivite düzenlenemediği için yalnızca açarken eklenir. Kartta sağda küçük kapak,
  aktivite sayfasında üstte büyük kapak (etkinliklerle aynı görünüm); panel > Moderasyon > Aktivite şikâyetlerinde kapak
  görünür. Kurallar: kapak açanın kendi `aktivite` dosyası, sonradan eklenemez; hesap silmede kapak alanı da silinir.
  Sunucu `activityCoverChanged`: aktivite kaldırılınca (moderatör / hesap silme) alanı boşaltır ve dosyayı siler; iptalde
  kapak kalır. Hesap silinince `media/{uid}/aktivite/` silinir. Testler: kurallar 140, sunucu 28, ortak 150. Emülatörde
  web sürümüyle denendi (kapaklı aktivite açma, başka kullanıcıda liste ve sayfa). **Kurallar değişti.**
- **Seyahat ve belediye kapak fotoğrafları (3 Kasım, aynı dal; Blaze ile çalışır).** Bölge, şehir, gezilecek yer, hazır
  rota, yöresel ve Başkanlarla Keşif (belediye tanıtımı) kayıtlarına isteğe bağlı kapak (`cover`, tür `seyahat`). Panel >
  Seyahat'in altı formunda "Kapak fotoğrafı" (`ImageField`); belediye personeli kendi tanıtımına ve rotalarına Belediye
  paneli > Seyahat'ten koyar (onaya gönderilir). Uygulamada fotoğraf çizimin yerine geçer (`CoverArt`: Keşfet ve Öğren
  bölge kartları, bölge / şehir / yer / rota kapağı, şehir sayfasındaki yer kartları, rota kartları, rota durakları);
  yöresel ve belediye kartı açılınca üstte kapak. Fotoğraf yoksa çizim kalır. Kurallar: altı koleksiyonda `cover`, yeni
  bağlanan kapak bağlayanın kendi `seyahat` dosyası (`mediaKeptOrOwn`), değişmeyen kalır (admin belediyenin kapağını
  koruyarak yayına alır). Sunucu `travelCoverChanged-*` (6 işlev): kayıttan çıkan kapağın dosyasını siler. Testler:
  kurallar 141, sunucu 29, ortak 150. Emülatörde denendi: panelde Bursa'ya kapak yüklenip yayına alındı, uygulamada
  Bursa sayfasında göründü. **Kurallar değişti.**
- **"{Şehir} kareleri" (3 Kasım, aynı dal; PROJE.md 13. madde 34, Eren'in onayladığı biçim).** Keşfet'te fotoğraflı ve
  Genel'e açık paylaşımda "{İl} karelerinde de görünsün" kutucuğu (isteğe bağlı, işaretsiz başlar); gönderide
  `frames: true`, ek yükleme ya da kopya yok. Seyahat > şehir sayfasındaki Kareler kutusu açıldı: `/travel/frames/[kod]`
  üçlü ızgara, 30'ar (aşağı kaydırdıkça), üstte CityJoy'un öne çıkardıkları (yıldız, en çok 6), birden çok fotoğraflıda
  simge, dokununca gönderi; şikâyetle düşen görünmez; boşken "Fotoğraf paylaş". Panel > Seyahat > **Kareler** sekmesi
  (il seç): öne çıkar / öne çıkarmayı kaldır / karelerden kaldır (gönderi Keşfet'te kalır), işlem kaydı (modül `seyahat`).
  Kurallar: `frames` yalnızca fotoğraflı ve Genel gönderide; `framesFeatured` yalnızca admin; admin Karelere geri
  ekleyemez (yalnızca paylaşan seçer). **2 yeni dizin** (`firestore.indexes.json`). Türkçe başlık "Bursa kareleri"
  biçiminde (ek sorunu yok). Testler: kurallar 142, sunucu 29, ortak 150. Emülatörde denendi: iki fotoğraflı paylaşım
  kutucukla Karelere düştü, başka kullanıcı gördü, panelde öne çıkarılan yıldızla en üste geçti. **Kurallar ve dizinler
  değişti: birleşince yüklenmeli.** Fotoğraf yükleme Blaze ile çalışır.
- **Keşfet albümü 10 fotoğraf (3 Kasım, aynı dal; PROJE.md 5.5 madde 2).** Sınır 4'ten 10'a (`POST_LIMITS.photos`).
  Kurallar her fotoğrafta tam yolu (`posts/{uid}/{gönderi}/{sıra}.jpg`) denetler; kural motorunun 1000 işlem sınırı
  yüzünden biçim ve adres uygulamada denetlenir (`photoFrom`, yalnızca kendi depomuzdaki adres gösterilir). Storage'da
  dosya adı 0-9. İşletme adına 10 fotoğraflı paylaşım da denendi (kural testi). **Kurallar değişti.**
- **Keşfet videosu (3 Kasım, aynı dal; PROJE.md 5.5 madde 2; Blaze ile çalışır).** Gönderiye fotoğraf yerine tek video:
  en çok 60 sn ve 40 MB; `posts/{uid}/{gönderi}/video.mp4` (iPhone'da `.mov`). Paylaşım formunda "Video ekle" (fotoğraf
  yokken), seçilen videonun süresi ve kaldır; iPhone'da seçici 60 sn ile sınırlar ve 720p'ye sıkıştırır; uzun ya da büyük
  video seçilince uyarı. Web'de süre dosyanın kendi bilgisinden okunur (seçicinin değeri yanlış geliyordu, denemede
  bulundu). Akışta kendiliğinden oynamaz: süreli oynat düğmesi, dokununca oynatıcı (`expo-video`, yeni paket) açılır ve
  başlar. Profil ızgarasında video simgesi. Panel > Moderasyon şikâyet edilen videoyu oynatır. Kurallar: video fotoğrafla
  birlikte olmaz, yol bu gönderinin klasörü, süre 1-60; Storage: `video.mp4|mov`, video türü, en çok 40 MB. Sunucu
  `postPhotosRemoved` videoyu da siler ve alanı boşaltır. Testler: kurallar 143, sunucu 30, ortak 150. Emülatörde web
  sürümüyle denendi (75 sn reddedildi, 12 sn paylaşıldı, başka kullanıcıda dokununca oynadı). **Telefonda denenmedi**
  (EAS). Süreyi telefon bildirir (kural sunucuda dosyayı açamaz); maliyeti 40 MB sınırı korur. **Kurallar değişti.**
- **Keşfet: güncel ad ve doğrulanmış işletme rozeti (3 Kasım, aynı dal).** Gönderi kartında ve yorumlarda yazarın adı
  güncel herkese açık profilden gelir (`lib/profile-photos.ts`: `useAuthor`, profil fotoğrafıyla aynı tek okuma, oturumda
  kişi başına bir); ad değişikliği eski gönderilerde de görünür (bilinen sınır kapandı), kendi adını değiştirince hemen
  yenilenir. İşletme adına paylaşımda işletmenin güncel adı ve doğrulanmışsa yanında doğrulanmış işareti
  (`useBusinessInfo`, işletme başına bir okuma). Kural değişikliği yok. Emülatörde denendi (ad değişince eski gönderide
  yeni ad).
- **Keşfet: konum rozeti (3 Kasım, aynı dal; PROJE.md 5.5 madde 5).** Hesabım > "Konum rozeti" (`/location-badge`):
  "Konumumu doğrula" telefonun konumunu bir kez alır, adresi telefonun içinde çözer (`lib/location-badge.ts`,
  `locationBadgeFor`): il + ilçe tutarsa "İlçesi doğrulandı", mahalle adı da tutarsa "Mahallesi doğrulandı". Koordinat
  saklanmaz; herkese yalnızca rozet görünür (Keşfet profilinde adın altında, gönderide adın yanında simge), mahallenin
  adı görünmez. Kişi rozeti kaldırabilir; mahalle değişince rozet düşer. Veri: `users.locationCheck` (kişiye özel:
  mahalle, düzey, tarih) + `publicProfiles.locationVerified`. Kurallar: ikisi aynı yazımda ve aynı düzeyde değişir,
  doğrulama yalnızca şimdiki mahalle için geçerli (rozeti bırakarak mahalle değiştirilemez), tek başına sahte rozet
  yazılamaz. Ortak düzeltme: mahalle adı karşılaştırması "Mh." kısaltmasını da tanır. Web'de yapılamaz (telefonda;
  emülatörle denerken "mahalle" sayılır). Sahte konumla aşılabilir: güven işaretidir, kanıt değildir (ekranda yazılı).
  Testler: kurallar 146 (3 yeni), ortak 152 (2 yeni). Emülatörde denendi (doğrula > akışta ve profilde rozet > kaldır).
  **Telefonda denenmedi** (gerçek adres çözümlemesi EAS ile). **Kurallar değişti.**
- **Panel yeni tasarımı, 1. aşama (3 Kasım, `claude/panel-yeni-tasarim`; PROJE.md 6.1 "Panel düzeni").** Görünüm CityJoy
  kimliğinde (koyu turkuaz zemin, altın vurgu, cam kartlar). Sol menü uygulamanın bölümleriyle gruplu ve açılıp
  kapanır: Benim Şehrim, Seyahat, Sosyal, Acil, İşletmeler ve profiller, Yönetim (`components/shell.tsx` `MENU_GROUPS`).
  Menünün üstünde **il seçici** (`lib/city.tsx`): seçilen il bütün sayfalara başlangıç olur (İşletmeler, Onaylar,
  Şehir rehberi, Şehir Vitrini), il değişince sayfa yeni ille açılır; seçim tarayıcıda saklanır. Önceden gizli kalan
  Şehir Vitrini, Yol üstü verisi ve Yolculuk fiyatları menüde. **Bugün** (eski Genel bakış): bekleyen işler (onay,
  şikâyet), sayı kutuları, haftalık paylaşım grafiği, Keşfet kategorileri. **İstatistikler** (7/30/90 gün): paylaşım,
  yeni işletme, doğrulanmış oranı, şikâyet, 12 haftalık iki grafik, kategori dağılımı. **Profiller** (yalnızca admin):
  adla arama, yalnızca herkese açık bilgiler + takipçi sayısı. Sayılar yalnızca sayım sorgusuyla
  (`packages/shared/src/firebase/stats.ts`, 1.000 belge başına 1 okuma); yetki yetmeyen kutu "—". İstatistik yetkisi
  olmayan (belediye, muhtar) Bugün'de kendi bölümlerine kısayollar görür. Kural değişikliği yok; **4 yeni dizin**
  (gönderi: il+tarih, kategori+tarih, il+kategori+tarih; işletme: il+tarih). Panel derlendi, tür denetimi geçti;
  tarayıcıda örnek admin ve Nilüfer Belediyesi hesabıyla denendi (menü, il seçici, sayfalar). PR #58 birleşti; dizinler
  Firebase'e ve panel cityjoynew.web.app'e yüklendi (3 Kasım, Claude). Grafikler gerçek veriyle
  **denenmedi** (örnek hesap veri okumaz).
- **Panel 2. aşama: resmî hesap takibi, Takipçiler sayfası, belediye başkanı (3 Kasım, `claude/panel-istatistik-2`;
  PROJE.md 6.1).** Uygulamada kurum / muhtarlık / başkan sayfasında "Takip et" düğmesi; belediye sayfasında başkan kartı
  (başkan profili girildiyse), başkanın kendi sayfası. Veri: `officialFollows/{uid}__{profil}` (yalnızca sahibi okur:
  mahalle, ilçe, il, yaş aralığı) + `officialStats/{profil}` (toplam, takipten çıkan, il / ilçe / mahalle / yaş ve
  günlük sayaçlar). İkisi aynı yazımda değişir; kurallar anahtarları kişinin profiliyle karşılaştırır, her sayacın tam
  ±1 değiştiğini denetler (sunucu işlevi gerekmez). Mahalle değişince uygulama açılışta sayımı taşır
  (`apps/mobile/src/lib/official-follow-sync.ts`, yalnızca değişince). Yeni modüller: **Kitle istatistikleri**
  (`istatistik`) ve **Belediye başkanı** (`baskan`, yalnızca belediye; görüntüle = istatistik, düzenle = profil).
  Panel: **Takipçiler** (`/takipciler`): genel bakış kutuları tıklanır, ayrıntıya iner (ilçe > mahalle, iller, yaş,
  günlük), 10 kişiden küçük gruplar "Diğer"; belediye hesabında başkan kartı ve "Başkanın istatistikleri". Profiller
  sayfasında başkan profili. Örnek hesaplarda tutarlı örnek sayılar ("Örnek veri" etiketi). Testler: kurallar 8 yeni,
  ortak 6 yeni; panel derlendi, mobil tür denetimi geçti; tarayıcıda belediye, muhtar, admin örnek hesaplarıyla ve
  375 px genişlikte denendi. **Telefonda denenmedi.** PR #60 birleşti; kurallar Firebase'e, panel cityjoynew.web.app'e yüklendi (3 Kasım, Claude). Gönderi istatistikleri sonraki adım.
- **Acil numaralar güncellendi (3 Kasım, `claude/acil-numaralar`; PROJE.md 5.4).** 155, 156, 110 (ve 122, 177, 158) 112'ye
  bağlandığı için ayrı düğme değil, 112'nin açıklamasında. Yeni: 114 zehir danışma. Sıra: 112, 114, 186, 187, 185, 183.
  Canlı veritabanında kayıt yok (gömülü liste kullanılıyor); panelden "Başlangıç listesini yükle" yeni listeyi yazar.
  Testler güncellendi. Uygulama güncellenince telefonda görünür.
- **İşletme kademeleri: iki kademe (Karar Eren, 3 Kasım; PROJE.md 15 madde 2).** Ücretsiz: listeye kendiliğinden düşer,
  1 fotoğraf, Ara, WhatsApp. Pro: 10 fotoğraf, adres/yol, detaylı yazı, ücretler, yorumlar ve puan, video, istatistik,
  öne çıkma hakkı (en çok 2 Reklam, doğrulanmış Pro işletmeler sırayla). Önizleme tuvalde (H-Cekici, H-Isletme, H-Kademe).
  ~~Açık iş: kodda dört kademe~~ (6 Kasım yapıldı, Yapılanlar sonu).
- **İç ekranlar: Acil alt sayfaları, Sosyal Harmoni iç sayfaları, Seyahat > Planla (4 Kasım, dal `claude/ic-ekranlar`;
  PROJE.md 13. madde 35 ve 5.2).** **Acil:** Veteriner ve diğer hizmet sayfaları ortak liste kalıbında
  (`services/[id].tsx`); Taksi durakları (`components/taxi-stands.tsx`: en yakın durak büyük kartta, veri Önemli Kurumlar
  havuzundan, şehir rehberi şemasında yeni `taksi-duragi`, OSM betiği durakları da çeker); Diğer İhtiyaçlar ("Yeni
  taşındım" gibi durum kartları > ilgili hizmetler, `services/need.tsx`; Panel > İhtiyaç kartları, `needs-page.tsx`).
  **Sosyal Harmoni:** Anketler (`/polls`: tek oy, gizli, sonuç çubukları; oy için giriş + doğrulanmış e-posta), Yarışmalar
  (`/contests`, `/contests/[id]`: aşamalar, şartname, katıl formu, video https bağlantısı olarak ve ekip onayıyla, oy ver,
  kendine oy yok). Kulüpler bölümü 4 Kasım'da kaldırıldı (Eren; PROJE.md 5.3 spor notu). Günlük oy sınırı (Panel > Sınırlar, `oy` / `oyYeni`). Panel > Sosyal: **Anketler** ve **Yarışmalar** (admin;
  siyasi anket işaretiyle engellenir). Veri:
  `polls`, `pollVotes`, `contests` (+ `entries`), `contestVotes`.
  **Seyahat > Planla = tatil keşfi:** eski yol ücreti hesabı kaldırıldı (Yoldayım aynen). Türkiye / Yurt dışı; 9 tatil
  fikri (Deniz, Kayak, Termal, Kültür, Doğa, Lezzet, Aile, Balayı, Görülmesi gereken) > yerler (il, yol mesafesi, sezon,
  tesis sayısı, gece fiyat aralığı, not; `/travel/holiday/[theme]`) > konaklama (`/travel/stay`: "Şehri tanı" kartı,
  doğrulanmış tesisler, en çok 2 "Reklam" başta) > işletme sayfası. **İşletme ekle > "Otel ve konaklama"**: tesis türü
  (en çok 2), tatil fikirleri (en çok 4), belge numarası zorunlu, gece fiyatı, web sitesi; işletme sayfasında gece fiyatı,
  temalar, belge no, "rezervasyon tesisle doğrudan". Yalnızca doğrulanan tesis listelenir. **Panel > Seyahat:** "Keşfet ve
  Öğren" ve yeni **Tatil fikirleri** (yer sırası, sezon, not, gizle; uymayan tesis etiketini kaldır; yurt dışı ülkeleri aç).
  Panel > Yolculuk fiyatları kaldırıldı. Keşfet ve Öğren'deki ülke şeridi de panelde açılan ülkelere uyar.
  Kurallar değişti (anket, yarışma, ihtiyaç kartları, konaklama, `holidayThemes`, `config/travelCountries`).
  Testler: ortak 166 (yeni: anket, tatil yerleri); kural testleri bu bilgisayarda çalıştırılmadı (Java 21 klasörü yok).
  Tip denetimi üç pakette temiz. **Telefonda denenmedi.** **Eren yapacak:** PR'ı birleştir, kuralları yükle; Expo'da dene.
  Açık: yarışma videosu yükleme ve yayıncı
  başvurusu Blaze ve sonraki iş; Panel > Uygulama görselleri yükleme Blaze ile.

- **İşletme kademeleri koda geçti: Ücretsiz ve Pro (6 Kasım, dal `claude/iki-kademe`; PROJE.md 15 madde 2).**
  `MembershipTier` artık iki değerli (`ucretsiz`, `pro`); eski kayıtlardaki `premium` Pro, `standart` Ücretsiz sayılır
  (`toTier`, kurallarda da). Vitrin varsayılanı Ücretsiz 1, Pro 10 fotoğraf (Panel > Sınırlar'dan değişir, en çok 30).
  Panel > İşletmeler kademe seçimi ve Sınırlar sayfası iki kademeyi gösterir. Fırsat sınırı zaten Ücretsiz 1, Pro 5.
  **Hata düzeltmesi:** Panel > Sınırlar "Kaydet" vitrin sayılarını da yazıyordu ama kurallar bu alanlara izin vermiyordu,
  kayıt hep reddedilirdi; kurallar düzeltildi, yeni testle denetleniyor. Kural dosyası biraz küçüldü (sınıra yakınlık
  sorunu yok). Testler: ortak 166, kurallar 156 geçti; tür denetimi dört pakette temiz. PR #70 birleşti; kurallar
  ve dizinler Firebase'e, panel cityjoynew.web.app'e yüklendi (6 Kasım, Claude; kurallarda ilk iki denemede Google'da geçici 503).

- **"Çevir" düğmesi (6 Kasım, dal `claude/cevir-dugmesi`; Karar Eren, PROJE.md bölüm 2).** Kullanıcı içeriği kendiliğinden
  çevrilmez; metnin altında "Çevir", basınca okuyanın uygulama dilinde çeviri, "Aslını gör" ile geri. Düğme yalnızca metin
  okuyanın dilinde görünmüyorsa çıkar (`canOfferTranslation`: kaba dil tahmini; emin değilse gösterir). Yerler: Keşfet
  gönderisi ve yorumları, işletme değerlendirmesi ve cevabı, duyuru, Çarşı ilanı, işletme tanıtımı, etkinlik, aktivite,
  anket sorusu, yarışma açıklaması, gelen mesaj (`components/translatable-text.tsx`). Sunucu: çağrılabilir işlev
  `translate` (`functions/src/translate.ts`): Google Cloud Translation (anahtar yok, işlevin hizmet hesabı), aynı metin aynı
  dile bir kez çevrilip `translations/` içinde saklanır (90 gün, günlük temizlik), kişi başına günlük sınır
  `usage/u-{uid}~ceviri` (Panel > Sınırlar > "Çeviri", varsayılan 50; saklanan çeviriyi yeniden görmek sayılmaz). Girişsiz
  basınca "Çeviri için giriş yap". Metinler 5 dilde. Testler: ortak 169, kurallar 156, sunucu 34 geçti; tür denetimi temiz;
  web önizlemede görünüm ve girişsiz durum denendi. **Gerçek çeviri denenmedi:** Blaze + "Cloud Translation API"yi açmak
  gerekir (`docs/eren-yapilacaklar.md` Blaze maddesi); işlev yüklenince telefonda denenecek. Panelden girilen tek dilli
  içerik (anket, yarışma) için ayrı 5 dil alanı gerekmedi, aynı düğme çevirir. PR #72 birleşti; kurallar ve dizinler
  Firebase'e, panel cityjoynew.web.app'e yüklendi (6 Kasım, Claude; kurallarda Google'da 8 deneme geçici 503/409, 9.'da tamam).

- **Keşfet ve profil düzeltmeleri (7 Kasım, dal `claude/blaze-kurulum`; Eren telefonda denedi).** Çok fotoğraflı
  gönderide sağa-sola kaydırma artık sekme değil fotoğraf değiştirir (react-native-gesture-handler ScrollView/FlatList,
  kök `GestureHandlerRootView`). Gönderiye dokununca ayrı sayfa açılmaz: uzun metin "devamı" ile yerinde açılır, çift
  dokunuş beğenir; yorumlar ve gönderi işlemleri (şikâyet, sahibine kapatma/kaldırma) alttan açılan panelde
  (`components/post-sheet.tsx`, `post-actions.tsx`). Ayrıntı sayfası yalnızca bildirim/bağlantı için kaldı. Keşfet üst
  bölümü (Mahallem/bölge) aşağı kayarken gizlenir, biraz fazla yukarı kaydırınca geri gelir. Profil: fotoğrafa dokununca
  ekranda yuvarlak büyür; düzenlemede fotoğraf ekleme/kaldırma yalnızca "Kaydet" ile geçerli (vazgeçince kaydedilmemiş
  yeni dosya silinir). Çeviri: "Selam" gibi kısa selamlaşmalarda "Çevir" çıkmasın diye ek sözcükler. Tür denetimi temiz,
  ortak testler 169 geçti. Telefonda Eren'in onayı bekleniyor.

- **E-posta bağlantısından uygulamaya dönüş (7 Kasım).** Şifre sıfırlama ve e-posta doğrulama e-postalarına dönüş adresi
  eklendi: Firebase sayfasında işlem bitince "Devam" düğmesi `cityjoynew.web.app/uygulama.html` sayfasına gider (5 dil,
  Arapça sağdan sola, açık/koyu), oradan "CityJoy'u aç" uygulamayı açar (`cityjoy://`; Expo Go'da çalışmaz, mağaza
  sürümünde çalışır). Panelde dönüş panelin kendisi. Sayfa panelle birlikte yüklendi. Sonra: tamamen markalı kendi işlem
  sayfamız (Firebase'de "işlem adresini özelleştir" ayarı gerekir).
  Not: Eren'in iki hesabı var (`erensevinc3472@` boş, `zcayliyak@` gönderiler, işletme, profil fotoğrafı); şifre
  sıfırlayıp boş hesaba girince içerik "silindi" sandı, veri yerinde.

- **Doğrulama iste tek dokunuş (7 Kasım; Eren istedi).** İşletme sayfasında sahibi "Doğrulama iste"ye basınca düzenleme ekranına
  gitmeden istek gönderilir (`components/verify-request.tsx`, mevcut `verificationRequests`); panelde Bekleyen onaylar'a düşer,
  admin onaylar. Ekranda "Talebiniz alındı. En kısa sürede ekibimiz sizinle iletişime geçecek." (5 dil); reddedilirse gerekçe ve
  "Yeniden iste". Panelde admin Bekleyen onaylar'ı açınca artık tüm bekleyenleri görür. Panel Eren tarafından yüklendi (7 Kasım).
- **Benim Şehrim alt sayfaları, cam görünümü (7 Kasım; Eren taslağı onayladı, https://claude.ai/artifact/BeJFnNmKpDqrNMYB4KSic3).**
  Eren: "alt sayfalar çok sıradan, uzun liste olmasın, kategori olsun, ama bilgi eksik kalmasın, aşağı açılsın".
  **Benim Şehrim ana sayfası değişmedi** (Eren: en sona kalsın). `components/city-hub.tsx` (cam kutu, tırnaklı başlık,
  tür / ilçe kutuları, öne çıkan kart Ara + Yol tarifi, seçim şeridi, **aşağı açılan satır** `ExpandRow`: adres, telefon,
  saat, açıklama, Ara / Yol tarifi / Ayrıntılar), `components/line-icon.tsx` (lucide-react-native ince simgeler, karşılığı
  yoksa Material). `city-guide-list.tsx`: 10+ kayıtta sayfa önce "Türüne göre" / "İlçene göre" kutularıyla açılır
  (kullanıcının ilçesi altın, en çok 5 ilçe + "Tüm ilçeler"), kullanıcının ilçesinden öne çıkan kayıt, "Tümünü listele";
  seçince türlere ayrılmış (DEVLET / ÖZEL…) liste. Başlık yazı tipi Fraunces (`fonts.serif`, HeroHeader `serif`, yalnızca
  `app/city/*` alt sayfaları). Kurumlar kutularında ince simge. Tür denetimi temiz, telefon paketi derlendi; **telefonda
  denenmedi**. Sonraki parça: her il için şehir fotoğrafı (panelden yükleme, sayfa arkasında bulanık; taslaktaki gibi),
  fotoğrafı olmayan ilde düz zemin.
- **Benim Şehrim ana sayfası, yeni düzen (7 Kasım; Eren kendi görselini gönderdi: "böyle bir şey").** `app/city/index.tsx`:
  tırnaklı başlık, büyük il kapağı (Seyahat panelinde ile yüklenen kapak fotoğrafı `useTravelCity(il kodu).cover`; yoksa
  çizim), "Şehrinde keşfet" başlığı, altın Belediye Hizmetleri kartı + Önemli Kurumlar, iki sütunlu cam satırlar (ince simge,
  ok, "Yakında"), en altta aynı tarzda Mahalle Meydanı ve "{il} Vitrini". Yeni yazılar `city.hub.explore`,
  `city.hub.showcaseOf` (5 dil). Webde (8081) Bursa ile denendi; **telefonda denenmedi**. Bursa'nın Seyahat kapak
  fotoğrafı henüz yüklü değil (çizim görünüyor). Eren'in görselindeki "Sosyal Destek" / "Faydalı Bilgiler" adları
  uygulanmadı. **Karar (Eren, 7 Kasım): adlar kalır** (Gönüllülük = yardım etmek isteyen; Sosyal Destek = yardım almak
  isteyen, ayrı konu). Ayrı "Sosyal Destek" bölümü de istenmedi (Eren, 7 Kasım).
  8 Kasım: Eren "görseldeki hava yok, o resimleri koy" dedi. Görselinden kesilen iki süs uygulamaya kondu
  (`apps/mobile/assets/city/townhall.jpg` Belediye kartında altın örtüyle, `skyline.jpg` sayfanın en altında silüet; her
  ilde aynı). İl kapağı fotoğrafı kartı tamamen kaplar, soldan koyulaşır. Görseldeki Bursa resmi
  `Desktop/CityJoy-gorseller/bursa-kapak.jpg` (430x425, düşük çözünürlük) Eren panelden Seyahat > Bursa kapağına yükleyecek.
- **Küçük fotoğraf ve Çarşı fotoğraf zorunluluğu (7 Kasım).** Sunucu işlevi `photoThumbnail` (`functions/src/thumbs.ts`, sharp)
  her yüklenen JPEG'in 640 piksellik küçüğünü `thumbs/{asıl yol}` yoluna, asıl dosyanın erişim anahtarıyla yazar; uygulama
  adresi asıl adresten hesaplar (`thumbUrl`, kayıt değişmez). Listeler, kartlar, avatarlar, logolar ve kapaklar
  `components/thumb-image.tsx` ile küçüğü gösterir; küçük henüz yoksa (yeni ya da eski fotoğraf) asıl dosyaya döner. Tam ekran,
  albüm ve profil büyütme asıl dosyayı kullanır. Silme işlevleri `thumbs/` kopyalarını da siler; Storage kuralı `thumbs/`'u
  yalnızca okumaya açar. Eski fotoğrafların küçüğü yok (gerekirse sonra toplu üretilir). Çarşı: yeni ilanda en az bir fotoğraf
  (uygulama + kural); düzenlemede fotoğraflar sıfıra indirilemez (fotoğrafsız eski ilan hariç). Testler: ortak 171, sunucu 41,
  kurallar 159 (Storage dahil) geçti; tür denetimi temiz. Kurallar (Firestore + Storage) ve işlevler Eren tarafından yüklendi
  (7 Kasım 10:22 ve 10:27; Claude doğruladı; kural yüklemesi yanıltıcı 409 hatası verdi ama yüklenmişti). Telefonda denenmedi.
- **İşletme kademeleri (7 Kasım; Karar Eren, PROJE.md 5.6).** Doğrulanmamış işletme: dışarıdan sayfa yok, listede ve aramada
  dokununca yerinde büyüyen kart (`components/business-card.tsx`; yorumlar `reviews-sheet.tsx`), bağlantıyla açılan sayfa
  da kartı gösterir; ekibine "Doğrulama iste" kutusu. Doğrulanmış: sayfa, toplam 9 işletme gönderisi (sunucu işlevi
  `businessPostCounted` `postCount` sayar; kural `validBusinessPost`), Fırsatlarım soluk + kısa not (`components/toast.tsx`).
  Pro: sınır yok, fırsat açık (kural `dealBizOk` Pro ister). Sıralama: Reklam > Pro (etiketli) > doğrulanmış > doğrulanmamış
  (ayrı bölüm). Panel > Sınırlar'a "İşletme gönderisi (toplam, Ücretsiz)". Testler: ortak 169, sunucu 39, kurallar (deals,
  business-page) geçti; tür denetimi temiz. Panel yüklendi. Kurallar ve `businessPostCounted` işlevi Eren tarafından yüklendi (7 Kasım 03:26 ve 03:39; Claude doğruladı).
  Kural yüklemesinde Google birkaç kez geçici 503 verdi.
  Telefonda denenmedi.

- **Sosyal Harmoni resimleri (11 Kasım; Eren verdi).** 10 resim `assets/social/*.jpg` (720 genişlik), asılları masaüstünde
  `CityJoy-gorseller/sosyal-harmoni`. Kartta ve arkada tam ekran görünür; Spor ve Sağlık için resim yok, çizim kalır (Eren verince eklenir).
- **Sosyal Harmoni alt kısmı: canlı şerit ve sponsor bandı (11 Kasım; Eren iki katlı düzeni seçti).** Arkadaki resim
  bulanık (blurRadius 14) ve biraz daha koyu. Kartların altında ortadaki kartın bölümünden en yeni şey (`components/social-peek.tsx`):
  sıradaki etkinlik/aktivite, son haber, açık yarışma/anket, kategorinin fırsat sayısı ve ilk fırsatı; yalnızca ortadaki
  kartın verisi okunur, oturumda saklanır; içerik yoksa şerit görünmez. En altta "Sponsorlu" bant (`sponsors` koleksiyonu,
  `packages/shared/src/sponsors`): il ya da Türkiye geneli, Sosyal Harmoni ve/veya Fırsatlar, başlangıç-bitiş günü, açık/kapalı;
  ilin sponsoru Türkiye genelinden önce, birden çoksa her gün sırayla; sponsor yoksa bant yok. **Panel > Sosyal > Sponsorlar**
  (yalnızca admin; öneri: sponsoru yalnızca merkez ekler, Eren değiştirmek isterse il yöneticisine açılabilir). Logo `kurum`
  türüyle yüklenir; silinen logoyu `sponsorLogoChanged` işlevi siler. Kural testi `firebase/sponsors.test.ts` geçti.
  **Yayına alınacak:** Firestore kuralları ve sunucu işlevleri (birleştirmeden sonra Eren'e adım adım). Telefonda denenmedi.
- **Seyahat bölge sayfası: şehir seçimi (11 Kasım; Eren'in ChatGPT örneği, `docs/tasarim-ornekleri/seyahat-sehir-secimi.png`).**
  Akış aynı: bölge → şehirler → şehir sayfası. Üstte bölge kapağı (panelden yüklenen fotoğraf, yoksa çizim), aralıklı
  TRAVELJOY, yumuşak tırnaklı bölge adı, il sayısı ve tanıtım videosu. Altında bölgenin bütün illeri yatay kaydırılan büyük
  fotoğraf kartları (ortadaki büyük, yandakiler küçük); kart boyu ekrana göre. Tanıtımı yayında olmayan il "Yakında" etiketli,
  düğmesi "Tanıtım hazırlanıyor" (kapalı). "‹ 07 / 11 ›" gezinme, "Bursa’yı keşfet" düğmesi (Türkçe ek `lib/tr-grammar.ts`),
  en altta kartlarla birlikte kayan il adları; ada dokununca o karta gider. Tema süzgeçleri kaldırıldı. Açık temada alt kısım
  açık renk. Kart fotoğrafı Panel > Seyahat'te şehre yüklenen kapak (panel değişmedi). Şehir sayfasının yenisi sonra.
- **Seyahat şehir sayfası sadeleşti (11 Kasım; Eren istedi).** UNESCO ve "En yüksek nokta" bilgi kutuları sayfadan
  kalktı (panelde girilen bilgiler veride duruyor). Üst kapak alçaldı (en çok 220). Tanıtım 3 satır, uzunsa "Devamını oku".
  Kareler / Başkanlarla Keşif / Yöresel kutuları ve altın Hazır rotalar şeridi eski hâlinde kaldı (Eren, dört büyük kutuyu
  denedikten sonra eskisini istedi). Gezilecek yerler aynı. Şehir sayfasının Eren'in örneğine göre yenisi yine sonra yapılabilir.
- **Seyahat yer sayfası: "İçini gez" (11 Kasım; Eren'in fikri ve resimleri).** Yerin maket görünümlü resimleri (en çok 6
  sahne) arasında sinematik kamera geçişi (ileri giderken eski resim büyüyüp kaybolur, yenisi yakından gelip oturur; hareket
  azaltma açıksa yumuşak geçiş). Her resimde numaralı noktalar (en çok 8): dokununca krem kart "Neye bakmalı? / Neden
  önemli?", "Sesli dinle" (telefonun kendi sesi, ücretsiz, expo-speech) ve "Sonraki ayrıntı" (sahneler arası da geçer).
  Köşede "Temsilî çizim". Gezi varsa üstteki kapak yerine gelir, yoksa eski kapak kalır. Panel > Seyahat > yer formunda
  "İçini gez" düzenleyicisi: sahne resmi yükle, adını yaz, resmin üstüne tıklayıp nokta koy, yazılarını gir. Veride
  `travelPlaces.tour` (sahne: label, image, points[x,y 0-1, title, look, why]); kural yalnız yönetici, en çok 6 sahne;
  silinen resimler sunucuda temizlenir (`photos.ts` inner alanı). Eren'in Ulu Camii resimleri
  `Desktop/CityJoy-gorseller/ulu-camii/` klasöründe (Dış görünüm, Kesit, Giriş, İç mekân); gerçek yayında panelden yüklenecek.
  **Hikâye anlatımı (11 Kasım; Eren: rehber anlatımı hikâye gibi uzun olsun):** "Neden önemli?" yerine "Hikâyesi" (`story`,
  en çok 2000 karakter); "Neye bakmalı?" kısa kalır (300). Kartta hikâyenin ilk 5 satırı, "Devamını oku" ile tamamı; "Sesli dinle"
  başlık + bakılacak yer + hikâyeyi okur. Ulu Camii için 13 noktanın hikâyeleri yazıldı (rivayetler "anlatılır" diye):
  `Desktop/CityJoy-gorseller/ulu-camii/anlatimlar.txt`, panelden kopyalanacak.
  **Dört yer daha (11 Kasım; Eren'in resimleri):** Yeşil Türbe (Dış görünüm, İç mekân; 8 nokta), Cumalıkızık (Köy, Sokak,
  Köy evi; 12), Koza Han (Kuş bakışı, Avlu; 9), Tophane (Osman Gazi dış/iç, Orhan Gazi dış/iç; 14). Resimler ve
  hikâyeler `Desktop/CityJoy-gorseller/<yer>/` klasörlerinde (`anlatimlar.txt` noktaların yerini de yazar). Osman/Orhan
  iç resimlerinin eşleşmesi tahmin (mozaik zeminli olan Orhan Gazi); Eren yanlışsa değiştirilir.
  **Dört yer daha (11 Kasım, ikinci grup):** Muradiye (Genel, Türbeler bahçesi, Cem Sultan, Çini; 20 nokta), Emir Sultan
  (Genel, Avlu, İç, Türbe; 22), Kapalıçarşı ve Bedesten (Genel, Giriş, Geçitler, Dükkân; 20), Gölyazı (Genel, Taş sokak,
  Balıkçı kayıkları, Ağlayan Çınar; 19). Emir Sultan, Kapalıçarşı ve Gölyazı yer olarak da yoktu: deneme ortamına eklendi
  (`bursa-emir-sultan`, `bursa-kapali-carsi`, `bursa-golyazi`); yayında yer bilgileri de yüklenecek (anlatimlar.txt başında).
  Eren'in ChatGPT dosyası (`CityJoy-gorseller/chatgpt-hikayeler.md`) kaynak olarak kullanıldı (1958 çarşı yangını, Eski
  Aynalı Çarşı, Ağlayan Çınar). Eren: bundan sonra ekran görüntüsü göstermeden doğrudan yap, gerekirse sonra düzeltilir.
  **Beş yer daha (11 Kasım, üçüncü grup):** İznik Surları ve Lefke Kapı (Genel, Kapıya yaklaşırken, Roma kapısı, Taş ve
  tuğla; 20), İznik Yeşil Cami (Genel, Giriş, İç, Çinili minare; 21), İznik Ayasofya (Genel, Giriş, İç, Taş ve tuğla; 23),
  Tirilye (Genel, Tarihî sokak, Taş Mektep, Fatih Camii; 23), Mudanya Mütareke Evi (Genel, Giriş, Görüşme odası, Masa; 24).
  Beşi de yer olarak yoktu: deneme ortamına eklendi (`bursa-iznik-surlar`, `bursa-iznik-yesil-cami`, `bursa-iznik-ayasofya`,
  `bursa-tirilye`, `bursa-mutareke-evi`; ilçeler `16-iznik`, `16-mudanya`). Kaynak: `CityJoy-gorseller/chatgpt-hikayeler-2.md`.
  Eren'in gönderdiği Gölyazı resimleri zaten yüklü olanlarla aynıydı. Ulu Camii için 3B döndürmeli, sesli dinlemeli bir
  ekran örneği de gönderdi: `docs/tasarim-ornekleri/icini-gez-ulu-camii-3b.png` (yeni özellik; Eren'e sorulmadan yapılmaz).
  **Altı yer daha (11 Kasım, dördüncü grup):** Misi Köyü (Genel, Köprü, Taş sokak, Ahşap çıkma; 23), Kumyaka (Genel,
  Köy sokağı, Başmelekler Kilisesi, Pencere kemeri; 24), Balat Atatürk Ormanı (Genel, Patika, Açıklık, Orman tabanı; 24),
  Uludağ (Genel, Orman yolu, Sarıalan, Bakacak; 24), Suuçtu Şelalesi (Genel, Orman yolu, Şelalenin karşısı, Su ve kaya; 22),
  İznik Gölü (Genel, Kıyı yürüyüşü, Sazlıklar, Gün batımı; 25). Uludağ yer olarak zaten vardı, yalnız gezisi eklendi; öbür
  beşi deneme ortamına yeni yer olarak eklendi (`bursa-misi`, `bursa-kumyaka`, `bursa-balat-ormani`, `bursa-suuctu`,
  `bursa-iznik-golu`). Kaynak: Eren'in ChatGPT "Bölüm 3" dosyası. Sesli anlatım (yerin tamamını anlatan tek metin, telefonun
  kendi sesiyle) Eren'in fikri; bekliyor, bütün geziler bitince sorulacak. 3B döndürme maliyet yüzünden yapılmayacak.
  **Son grup (11 Kasım, Bölüm 4):** Panorama 1326 Bursa Fetih Müzesi (Genel, Salon ve galeri, Fetih panoraması, Panorama
  ayrıntısı; 24; yeni yer `bursa-panorama-1326`, `16-osmangazi`). Eren 23 yerin hepsini istedi, bu yüzden
  Sarıalan (Genel, Orman yolu, Çayırlık, Ormanın kenarı; 24; `bursa-sarialan`) ve Bakacak Seyir Noktası (Genel,
  Terasa giriş, Bursa Ovası, Akşam ışıkları; 25; `bursa-bakacak`) da ayrı yer oldu (ilçe yazılmadı, Uludağ gibi).
  md'deki 23 yer gezilerle tek tek karşılaştırıldı, hepsi doğru resimlerle eşli. Bakacak akşam resminde sağ altta
  istenmeyen küçük yazı var. Bütün Bursa gezileri bitti. Kaynak: `CityJoy-gorseller/chatgpt-hikayeler-4.md`.
  **Yayında (11 Kasım, Eren izin verdi):** 23 yerin gezisi (87 sahne) yayındaki projeye aktarıldı: 7 var olan yere
  yalnızca gezi eklendi, 16 yer yeni eklendi (yayında 25 Bursa yeri). Aktarma Panel > Seyahat > "Gezileri yayına
  aktar (Bursa)" düğmesiyle yapıldı: yalnızca geliştirme bilgisayarında (vite dev, emülatör dışı) admin'e görünür,
  emülatördeki gezileri okur, resimleri JPEG yapıp `media/{uid}/seyahat/` altına yükler (`apps/panel/src/lib/tour-import.ts`).
  Eren panele Google ile giriyor (şifre yok). Yazılar ileride gözden geçirilebilir.
- **Pratik bilgiler (11 Kasım; Eren istedi ve listeyi onayladı).** Yer sayfasında "Pratik bilgiler" başlığı altında
  ziyaret saatleri, giriş ücreti, önerilen süre ve yeni **Yaş ve çocuklar** (`ageInfo`); "Yakındaki hizmetler"de
  otopark, tuvalet, yemek, ATM (var olan `nearby`); "Ziyaretçi ipuçları" kartında üç başlık: **Yanına al** (`bring`),
  **Kurallar** (`rules`), **Bilmekte fayda var** (`tips`). Panel formunda yeni alanlar, beş dilde etiketler. Kurala
  yalnızca üç alan adı eklendi (boyut sınırı yüzünden uzunluk denetimi panelde/uygulamada). 23 Bursa yerinin bilgileri
  emülatörde (kaynak: `CityJoy-gorseller/pratik-bilgiler-bursa.cjs`); kesin saat ve fiyat yazılmadı (yalnızca
  ücretsiz/ücretli ve genel bilgi, "kontrol et" notu var). **Yayında (11 Kasım, Eren izin verdi):** kurallar
  yüklendi (ilk denemelerde 503, tekrarla geçti; boyut sınırına takılmadı), panelden aktarıldı: 23 yerin hepsinde
  pratik bilgiler yayında. Telefondaki uygulama yeni başlıkları yeni sürümle gösterir.
- **Yer kartlarında gezi resmi (11 Kasım; Eren istedi).** Kapak fotoğrafı olmayan yerin kartında (Bursa listesi, rota
  durakları) çizim yerine "İçini gez"in ilk sahnesi (dış görünüm) görünür: `placeImage()` (shared/travel). Panelden
  kapak yüklenirse kapak öne geçer. Gezisi olmayan yerlerde (İskender, kestane şekeri) çizim kalır.
- **İçini gez: parmakla kaydırma (11 Kasım; Eren istedi).** Sahne resmini sola kaydırınca sonraki, sağa kaydırınca önceki
  sahne gelir (Arapçada ters). Yalnızca belirgin yatay harekette çalışır; noktalara dokunma, sahne düğmeleri ve sayfayı
  aşağı kaydırma aynı. `place-tour.tsx` (PanResponder; başlangıç noktası ayrıca tutulur, web'de art arda kaydırma
  hatası yüzünden). Web kopyasında art arda sola/sağa kaydırma denendi. Eren telefonda denedi: sağa kaydırınca sayfa
  geri çıkıyordu (iOS 26 ekranın her yerinden geri kaydırma). Gezi olan sayfada geri hareketi sol kenardaki 30 noktalık
  şeritle sınırlandı (`gestureResponseDistance`); telefonda yeniden denenecek.
- **Ara ekranı: ışıklı ağaç (10 Kasım; Eren onayladı, PROJE.md 5.10 ve 13. madde 32).** Boştayken Eren'in ağaç resmi tam
  ekran: başlık "Ne arıyorsun?" (5 dil, `search.ask`), kişinin ilçe ve ili (dokununca konum değişir), arama kutusu.
  Kısayol düğmesi yok. Işık kökleri yakar, gövdeden dallara çıkar; 3,5. saniyede dal uçlarından kutuya bir kez uçar ve kutu
  parlak kalır; sonra kökler sönükleşir, ışık dalgaları gövdede akmaya devam eder. Kutuya dokununca (ya da aramayla
  gelince) ağaç kararır, geri düğmesi, sekmeler ve eski sonuç alanı açılır (bütün arama mantığı aynı). Teknik:
  `apps/mobile/src/components/search-tree/`: sahne tek HTML sayfası (canvas), telefonda WebView, webde iframe; resim
  sayfaya gömülü (`tree-image.ts`, resim değişirse `node scripts/search-tree-image.mjs`). Başka ekrandayken çizim durur,
  "hareketi azalt" açıksa ağaç canlandırılmadan yanar. Webde (emülatör, test hesabı) denendi; telefonda denenmedi.
  **Resim değişti (10 Kasım akşamı, Eren):** daha gerçekçi ağaç (`assets/search/agac.jpg`, kaynak masaüstü
  CityJoy-gorseller/ara-agac-yeni.png). Işık yolları yeni gövde, dal ve köklere göre yeniden çizildi; kabuk gri-zeytin
  olduğu için ışık katmanı formülü değişti (koyu dallar hafif, kabuk çıkıntıları güçlü yanar). Sahne tek başına webde denendi.

- **Bursa muhtarlık adresleri (10 Kasım, Eren sordu).** Masaüstü `CityJoy-Bursa-muhtarliklar-panel.xlsx`: 1060 muhtarlık, ad ve
  telefon tam (Büyükşehir muhtar rehberi), adres 144 (Mudanya ve Nilüfer belediyesi, Osmangazi'nin 11 muhtarlık binası,
  teyit notlu ikincil rehberler). Yeni: `scripts/bursa-muhtarlik-konum.ts` OSM'deki muhtarlık noktalarından 32 satıra
  harita konumu ekledi (ODbL notu; aynı adlı mahalleler atlandı); panel denetimi 0 hata. Google Haritalar'dan veri
  alınmaz (Google şartları). Kaymakamlık sitelerinde ve diğer belediye sitelerinde muhtarlık adresi yok. Kalan ~916 adres
  için yol: muhtar uygulamaya katılınca kendi profilinden girer; toplu liste için Büyükşehir'e bilgi edinme başvurusu.

- **Bursa panel dosyalarında eksik tamamlama (10 Kasım, Eren "tamamlayabileceklerine başla" dedi).** `scripts/bursa-tamamla.ts`
  dört masaüstü dosyasını (aile sağlığı, hastane-müze-otopark, kurumlar, kurumlar-ek) günceller; eski hâlleri scratchpad
  `yedek/`. Konumu eksik 623 satırdan 259'una konum: 77'si OSM'de aynı adla kayıtlı yer, 182'si adresteki sokağın doğru
  ilçe ve mahallede bulunması (notta "sokak düzeyi, kapı teyit edilmeli"). Kalan ~364 boş (uydurulmadı). Kaynak OSM ve
  Nominatim (ODbL, notta OSM bağlantısı); uygulamada haritada "© OpenStreetMap katkıcıları" yazısı gerekir. Çalışma
  saati yalnızca kuralı kesin türlere yazıldı (347 satır): emniyet, jandarma, itfaiye 7/24; devlet hastanesi poliklinik
  08:00-17:00 + acil 7/24; ASM hafta içi 08:00-17:00 (teyit notlu). Noter, PTT, kütüphane, özel hastane boş (şubeye göre
  değişir). Bakanlık müzeleri (6) muze.gov.tr'den: saat 08:00-17:00 (gişe 16:30), kapalı gün, ücret, Müzekart; Arkeoloji,
  17. yy Osmanlı Evi ve Yenişehir Şemaki Evi şu an kapalı (notta). Denetim 4 dosyada 0 hata. ASM telefonları: İl Sağlık
  Müdürlüğü'nün resmî "ASM iletişim" Excel'i indirildi; içinde telefon sütunu yok (ilçe, ad, birimler, adres). 241 ASM
  panel dosyasıyla birebir aynı (dosya zaten bu listeden yapılmış). Telefonlar boş kalır; ASM uygulamaya katılınca kurum
  profilinden girer.

- **Ana sayfa görselleri (10 Kasım, Eren istedi).** Benim Şehrim kartı yeni "ada" resmi (cami, teleferik, saat kulesi,
  tren), Sosyal Harmoni kartı yeni "park" resmi (konser, piknik, koşu, kayak); kare kırpıldı, ortalı (`assets/home`,
  kaynaklar masaüstü `CityJoy-gorseller/ana-sayfa-yeni`). Sayfanın altına Benim Şehrim'deki şehir silüeti eklendi; ortak
  parça `components/skyline.tsx`. Kaydırma alanı kenardan kenara yapıldı (silüet iki yanda kırpılıyordu; Benim Şehrim'de
  de düzeldi). Webde (koyu mod) denendi; telefonda denenmedi.

- **Benim Şehrim alt sayfalarında il fotoğrafı (10 Kasım; Eren'in tasarım örnekleri `onemli-kurumlar-*.png`, `muzeler.png`).**
  İlin kapak fotoğrafı (Seyahat panelinde ile yüklenen kapak) alt sayfaların tepesinde, başlığın arkasında: üstte başlık
  okunsun diye koyulaşır, altında bir şerit kadar açık görünür, sonra sayfa zeminine erir (açık modda açık zemine).
  Sayfalar: Önemli Kurumlar, bölüm listeleri (`[section]`), Belediye Hizmetleri, Cafe ve Restoran, Park & Pazar, Vitrin
  (ayrıntı sayfası `item` değil). Fotoğrafı olmayan ilde görünüm eskisi gibi. Teknik: `components/city-cover.tsx`
  (`useProvinceCover`, `CoverBackdrop`), `Screen` yeni `cover` alanı (fotoğraf varken bant uzar, altın ışık kapanır);
  ek okuma yok (il kaydı Benim Şehrim ana sayfasıyla aynı önbellekten); fotoğrafın küçük kopyası kullanılır. Tırnaklı
  başlığın altına örneklerdeki kısa altın çizgi. Emülatörde sahte Bursa kapağıyla webde açık ve koyu modda denendi;
  telefonda denenmedi. Gerçek projede henüz hiçbir ilin kapağı yok: Eren Panel > Seyahat > Bursa kapağını yükleyince
  görünür. (Not: emülatördeki `ara-deneme@cityjoy.test` hesabının şifresi bu denemede yenilendi.)
  Sırada (aynı örneklerden): Önemli Kurumlar'da arama + Tümü/Kamu/Sağlık/Acil süzgeci, Müzeler tür kutularında sayı ve
  en yakın kartta fotoğraf.
- **Önemli Kurumlar örneğe göre (10 Kasım).** Karar (Eren, 10 Kasım): örnekteki Tümü/Kamu/Sağlık/Acil yerine **ilçe
  düğmeleri** (Tümü, kullanıcının ilçesi, sonra abece sırasıyla ilin ilçeleri). Arama kutusu ve ilçe düğmeleri fotoğrafın
  üstünde, başlığın altında. Kartlar iki sütun: solda altın simge, ince altın çizgi, başlık + kısa açıklama, sağda ok.
  İlçe seçilince kartta o ilçedeki kayıt sayısı (yoksa "Bu ilçede kayıt yok", soluk); alt sayfa o ilçe seçili açılır
  (`[section]` yeni `district` alanı, `CityGuideList` yeni `initialDistrict`). Aramada eşleşen başlıklar ve en çok 12
  kurum listelenir. `Screen` yeni `coverPad` (fotoğraf altındaki boşluk). Beş dilde 3 yeni metin. Emülatörde örnek
  kurumlarla koyu/açık denendi, telefonda denenmedi. Sırada: alt sayfalarda (Hastaneler vb.) arama + ilçe düğmelerini
  de fotoğrafın üstüne taşıyıp altındaki boşluğu kaldırmak, aynı kart dili; sonra Müzeler.
  Düzeltme (10 Kasım akşam, Eren telefonda baktı: "sabit kalın başlık ve büyük yazılar kaba gösteriyor", "örnekteki gibi
  ekrana otursun, fotoğraf olmasa da olur"): üst kısım artık sabit değil, sayfayla kayıyor (`Screen` yeni `bleed`);
  başlık düz kalın yazı 22, altında kısa altın çizgi; arama cam kutu (`SearchField` yeni `glass`); kartlar daha geniş,
  açıklama en çok 2 satır, ekrana ~14 kart sığar. İl fotoğrafı daha aydınlık. Aynı düzen alt sayfalara da uygulanacak.
  Sonra (Eren: "arkadaki ışığı kaldır, biraz daha küçült"): altın ışık kapalı, başlık 19, ince ilçe düğmeleri
  (`FilterChip` yeni `small`, dokunma alanı korunur), kartlar 70 yükseklik, simge 36; ekrana ~20 kart sığar.
  Ayrıca Expo Go telefonda güncellenmişti: 12 Expo paketi uyduruldu (ExpoAsset hatası).
  Eren onayladı ("Şimdi oldu") ve "kalan sayfaları yap" dedi (10 Kasım). Yapılanlar:
  - Ortak `PageHead` (components/page-head.tsx): sayfayla kayan ince başlık, geri düğmesi, altın çizgi, isteğe bağlı il
    fotoğrafı ve altına arama/düğmeler. Tüm liste sayfaları (bölüm listeleri, Park & Pazar, Belediyeler, Yeme içme,
    Vitrin) buna geçti.
  - Ayrıntı sayfası (`city/item.tsx`, örnek `ayrinti-muze.png`): tür etiketi, açıklama "Daha fazla", simgeli bilgi şeridi
    (saatler, ücret…), adres kartı, Ara + Yol tarifi, diğer bilgiler, aynı ilçedeki diğer noktalar. Paylaş, favori, puan,
    sekmeler, gömülü harita yok (yeni özellik / maliyet).
  - Mahalle Meydanı (örnek `mahalle-meydani.png`): dört kutu (Muhtarlık, Eğitim, Sağlık, İbadethane), açılır satırlar
    (muhtarlık, duyurular "N yeni", etkinlikler, toplanma alanları, belediye), Çevredeki hizmetler, mahalle kartı ve
    "Değiştir". Bildirim / menü düğmesi ve harita yok.
  - Etkinlikler (örnek `etkinlikler.png`): kapaklı etkinlikler tepede kayan görsel, il geneli / yalnızca ilçe seçimi, yedi
    günlük gün şeridi, tür düğmeleri, yeni etkinlik kartı (görsel, Ücretsiz, tür ve ilçe, tarih aralığı, Detay). Kaydet,
    Bölgesel/Genel, alt menü yok.
  - Benim Şehrim ana sayfa zaten örneğe göreydi; başlık ince ve kayan oldu, açık modda satır okları görünür.
  - Dil seçimi 8 Kasım'da örneğe göre yapılmıştı; değişmedi.
  - `PillButton` açık modda beyaz zemin ve kenarlık (zeminde kayboluyordu).
  - Nöbetçi Eczane yapılmadı: ekran yok, veri kaynağı önerisi Eren'in onayını bekliyor (aşağıda SORULACAK).
  Telefonda henüz denenmedi (yalnızca web deneme sürümünde ekran görüntüsü).
  Sonra (10 Kasım gece, Eren'in isteği):
  - Benim Şehrim küçüldü (kapak 128, şehir adı 30, ince satırlar); kutular ortak dosyada (`components/city-tiles.tsx`:
    PhotoCard, GlassRow, SectionHeading, Chevron, Shade).
  - Etkinlikler: seçim artık "Bölgesel" (ilçe + il geneli etkinlikler, varsayılan) ve "Genel" (tüm il). Türkiye geneli
    istenirse ayrı sorgu gerekir.
  - Belediye Hizmetleri Benim Şehrim kutularıyla: ilçe belediyesi (altın) ve büyükşehir fotoğraflı kart, "Sık
    kullanılanlar" altın simgeli başlık ve cam satırlar, diğer ilçe belediyeleri açılır satır.
  - Müzeler (örnek `muzeler.png`; aynı yapı tüm bölüm sayfalarında): başlıklarda altın simge, "Tümü (N) >", türe göre
    kutular yatay (simge, ad, "3 müze", ok), ilçe kutularında "8 müze", üst yazıda "Bursa · 13 müze". Beş dilde bölüm
    birimleri (`city.hub.units`).
  - Park & Pazar: sekmeler yerine iki fotoğraflı kart (seçili olan altın).
  - Çarşı: Mahalle Meydanı gibi üstte il görseli; İlanlarım / İlan ver başlığın altında.
  - Vitrin: sayı yokken kayan boş panolar (Lezzet, Tarih, Doğa; "Yakında bu panoda", uydurma içerik yok) ve altında boş
    "Geçmiş sayılar" kutuları. Gerçek sayı çıkınca eski görünüm.
  - Etkinlikler "Genel" artık **Türkiye geneli** (Karar Eren, 10 Kasım 2026: "Bursa'daki bir fuar başka illerin de
    dikkatini çeker"). Yalnızca Genel seçilince tek sorgu (en yakın 100, 5 dk önbellek); başka ilin kartında il adı
    yazar. Yeni dizin (status + endsAt) `firebase/firestore.indexes.json`'da: **canlıda çalışması için dizinlerin
    Firebase'e yüklenmesi gerekir** (Eren, birleştirmeden sonra). İleride çok etkinlik olursa panelde "Türkiye genelinde
    göster" seçeneği düşünülebilir.
  - Keşfet: Mahallem / Bölgesel / Genel / Takip sekmeleri Benim Şehrim kutuları gibi dört simgeli cam düğme (seçili altın
    çerçeveli); yana kaydırma sürüyor. Benim Şehrim'in altındaki silüet kalktı, yerine alt çubuk (Ana Sayfa, Keşfet, Ara,
    Profil; Karar Eren, 10 Kasım 2026). `BottomNav` artık seçili sekmesiz de kullanılabiliyor.
  Web deneme sürümünde koyu/açık denendi (emülatöre örnek müzeler eklendi), telefonda denenmedi.
- Seyahat girişi (TravelJoy, 12 Kasım 2026): iki yarıdaki eski çizimin (gri daireler) yerine Eren'in resimleri: üstte eski dünya haritası ve yelkenli (Keşfet ve Öğren), altta valiz, telefon ve pusula (Planla ve Navigasyon; ilk denenen sahil yolu ve havalimanı resimleri Eren'in tercihiyle değişti). `assets/travel/kesfet.jpg`, `yolculuk.jpg` (`TRAVEL_ART`, app-art.ts); asılları masaüstünde CityJoy-gorseller/seyahat. Karartma 0,5 yerine 0,38. Web'de denendi, telefonda denenmedi.
- Başkanlarla Keşif ve Hazır Rotalar yeni görünüm (12 Kasım 2026; eski yer tutucu çizimler kalktı): iç ekranların ortak düzeni (`PageHead` + il kapak fotoğrafı, `FilterChip`, `ListSurface`). Başkanlar: il tanıtımı büyük fotoğraflı kartta (belediyenin kapağı, yoksa belediye resmi); ilçeler tek yüzeyde aynı boyutta satırlar (kapak ya da baş harf, slogan, rota sayısı, video simgesi), dokununca açılır. Rotalar: kart resmi rota kapağı, yoksa fotoğrafı olan ilk durak (gezilecek yerlerden), yoksa il kapağı; tema ve süre etiketi, ilk üç durak noktalı çizgide, "+N durak daha". Süre düğmeleri yalnızca birden çok süre varsa. Yeni ortak parça `BottomShade` (city-tiles). Web'de koyu/açık denendi; açılmış ilçe tanıtımı örnek veri olmadığından görülmedi. Telefonda denenmedi.
- Rota sayfası tepe resmi (12 Kasım 2026, Eren onayladı): özetin tepesinde eski çizim yerine rotanın kapağı, yoksa fotoğrafı olan ilk durak (ör. Camiler ve Türbeler için Ulu Camii), yoksa il kapağı. Durak ekranları zaten yerin fotoğrafını gösteriyordu; artık her durak (ve özet) en üstten açılıyor, önceden aşağı kaymış açılıyordu. Web'de denendi, telefonda denenmedi.
- Gezimi planla ve Yakınımda (12 Kasım 2026; Hazır Rotalar kartının yerine, Eren "Tamam sen yap"): **Veri:** gezilecek yere konum (`location`), açılış saatleri (`hours`: her zaman açık ya da açılış/kapanış, kapalı günler, namaz vakti), kalış süresi (`durationMinutes`, 10-720 dk); kurallar ve test, panel yer formunda "Gezimi planla bilgileri" (Google Haritalar bağlantısı ya da "40.18, 29.06" yapıştırınca konum), Excel sütunları konum, kalis_dk, acilis, kapanis, kapali_gunler, namaz. **Planlayıcı** (`packages/shared/src/travel/itinerary.ts`, kurallarla, yapay zekâ ve ücretli harita yok): gün sayısı (1-5), başlangıç bugün/yarın, ilgi alanları, tempo (sakin 3-4 yer / dolu dolu 5-6 yer); mutlaka görülecekler öne, yakın ve o saatte açık yerler, öğle ve akşam yemeği molası (lezzet yerlerinden öneri), cuma 12-14 camiler yok, saatler 5 dakikaya yuvarlı, yol süresi kuş uçuşundan yaklaşık (1,6 km altı yürüme). Durağa dokununca yeri aç, başka yerle değiştir, yarına taşı, programdan çıkar; bugünkü günde "Şu an / Sıradaki". Program yalnızca cihazda (`apps/mobile/src/lib/trip-plan.ts`). Hazır rotalar ekranın altında "Hazır planlar" olarak duruyor. **Yakınımda:** konuma göre (izin yoksa ya da il dışındaysa il merkezine göre) yürüme mesafesinde / biraz daha uzakta, şu an açık mı, kapanış saati. Konumu girilmemiş yer ikisinde de görünmez. Emülatörde 23 Bursa yerine örnek konum/saat girildi; yayındaki yerlere Eren girecek. Web'de koyu/açık denendi, telefonda denenmedi. Görünümü Eren onayladı (12 Kasım 2026).
- Başkanlarla Keşif il tanıtımı kartı geniş afiş (12 Kasım 2026, Eren istedi): kapak fotoğrafı çok genişse (en/boy 2,2 ve üstü; ör. Eren’in 17 başkanlı Bursa fotoğrafı) kesilmeden tam genişlikte gösterilir, ad ve slogan altında; dar kapaklarda eski görünüm. Fotoğraf masaüstünde CityJoy-gorseller/baskanlar-bursa.jpg (1600x533). Eren düzeltmesi (aynı gün): sayfanın tepesindeki il fotoğrafı kalktı, kartta belediye adı yerine "Yerel Yönetimler" (5 dil, travel.localGov), "İl tanıtımı" etiketi yok; ilçe satırlarında üstte başkan adı, altta belediye adı (başkan adı yoksa ilçe adı). Emülatörde denendi; yayında Bursa Büyükşehir tanıtımına kapak olarak girilmesi gerekiyor (panel > Seyahat > Başkanlarla Keşif). Telefonda denenmedi.
- Belediye tanıtım sayfası (12 Kasım 2026, Karar Eren: kart içinde açılmak yerine ayrı sayfa, başkanların görünürlüğü için): /travel/municipality/[id]. Üstte başkanın fotoğrafı (yoksa simge), adı, "X Belediye Başkanı" / "Başkan Vekili", "Belediye tanıtımı" etiketi (seçim döneminde yalnızca belediye adı); ilçenin büyük fotoğrafı ve sloganı, tanıtım yazısı, tanıtım videosu, belediyenin rotaları; paylaş düğmesi. Puan yok. Başkanlarla Keşif listesinde satıra ya da Yerel Yönetimler kartına dokununca bu sayfa açılır. Veri: geri alınan b8d7fea'nın yalnızca veri/panel kısmı geri geldi: `mayorPhoto`, `mayorActing` (kurallar, test, panelde admin ve belediye formunda "Başkanın fotoğrafı" ve "Başkan vekili"); slogan ve tanıtım boşken yalnızca başkan bilgisi kaydedilebilir. **Yayına alınmadı:** kurallar ve panel yüklenmeli (Gezimi planla alanlarıyla birlikte; Eren izni). Kural boyutu sınıra yakındı, yüklerken "Total size" hatası çıkarsa sadeleştir. Sayfa görüntülenme sayısı (belediyeye rapor) sonraya. Web'de denendi, telefonda denenmedi.
- Birden fazla tanıtım videosu (12 Kasım 2026, Eren: "başkan birden fazla video yüklemek isteyebilir"): `videos` listesi (bağlantı ve isteğe bağlı başlık, en çok 5); eski tek `videoUrl` okunur ve ilk kayıtta listeye taşınır. Panelde admin ve belediye formunda "Tanıtım videoları" (Video ekle / Videoyu kaldır). Uygulamada tek video altın düğme, birden fazlası "Videolar" listesi (başlık, YouTube/Vimeo). Kurallar (liste en çok 5) ve test eklendi. **Yayına alınmadı** (kurallar ve panel, yukarıdakilerle birlikte; Eren izni).
- Eren düzeltmeleri (12 Kasım 2026): Seyahat girişinde Keşfet altında bulunduğu ilin adıyla Yoldayım renginde düğme (doğrudan il sayfası), "Yolculuğunu planla" Keşfet rengi (turkuaz). Benim Şehrim: Belediye Hizmetleri ve Vitrin kartlarında altın renk kalktı (diğerleri gibi), üstteki iki kart 100→84 yükseklik; Belediye Hizmetleri sayfasındaki ilçe belediyesi kartında da altın kalktı.
- Belediye resmî profil sayfası (Eren, 12 Kasım 2026): `components/municipality-profile.tsx`, resmî profil belediyeyse açılır. Kapak (Başkanlarla Keşif kapağı, yoksa belediye resmi), logo, ad, "Resmî hesap", slogan; hızlı düğmeler (Ara, İnternet sitesi, E-posta, Yol tarifi); takip; e-Belediye işlemleri (vergi ödeme, istek-şikâyet, imar, nikâh, sosyal yardım, kültür, ihaleler, meclis): hepsi belediyenin internet sitesini açar (profilde site yoksa web araması); başkan; Başkanlarla Keşif bağlantısı; hakkında, saatler, adres. Veri panelden (Resmî profil + Başkanlarla Keşif); yeni alan yok. İleride: her işlem için ayrı bağlantı (panel alanı) istenirse eklenir.
- Keşfet (Eren, 12 Kasım 2026): dört bölüm tek parça sekme çubuğunda, altın gösterge parmakla birlikte kayar; yandaki sayfalar önceden hazırlanır. Süzgeçler bölüme göre: Mahallem Tümü/Yardım/Kayıp/Taziye, Bölgesel Tümü/Etkinlik/Fırsat/Duyuru, Genel Tümü/Yardım/Fırsat, Takip süzgeçsiz; tek satır, yana kaymaz. Bölgesel'deki il/ilçe düğmeleri kalktı (bütün il).
- Keşfet Genel gündem konuları (Eren, 12 Kasım 2026: "ekonomi, haber, spor gibi şeyler"): yeni gönderi türleri Haber, Ekonomi, Spor, Teknoloji, Kültür-Sanat, Sağlık (POST_TOPICS). Genel süzgeçleri: Tümü + bu altısı + Yardım, tek satırda sağa sola kaydırılır (Eren). Süzgeçler kutusuz yazı sekmesi: seçili olan koyu yazı + altında altın çizgi (Eren: "daha modern"), bütün bölümlerde aynı. Diğer bölümlerde 4 süzgeç eşit genişlikte, kaymaz. Paylaşırken bu türler yalnızca Genel seçiliyse çıkar (doğrulama da ister). Kurallar ve panel (şikâyet ekranı, istatistik adları) güncellendi; kurallar yüklenmeden canlıda bu türlerle paylaşım reddedilir.
- Konum değiştirme (Eren, 12 Kasım 2026: "Bursa yapamıyorum"): sebep büyük olasılıkla mahallenin ayda bir değişebilmesi. CityJoy yöneticisi (admins) artık bekleme olmadan değiştirebilir (uygulama + kurallar + test). **Kurallar yüklenmeden telefonda düzelmez** (Eren izni). Normal kullanıcılar için ayda bir kuralı aynen duruyor.

## Bu oturumlarda alınan kararlar (PROJE.md'ye işlendi)

- Seyahat > Planla (Eren onayladı 29 Ekim 2026: tek ekran, fiyatlar panelden elle): `/travel/planla`, Seyahat girişinde "Yolculuğunu planla". Nereden-nereye (il), tarih (7 gün), yolcu sayısı; Kendi aracım / Otobüs / Uçak / Tren kartları (süre, tahmini ücret); yolculuk kartı (İST ━ BUR, süre, km, maliyet, notlar); araba için güzergâh çevresindeki mola yerleri (OSM + yol üstü işletmeler, yaklaşık); varınca (şehri keşfet, yöresel, başkanlarla); hazırlık listesi; "Yola çık" Yoldayım'ı varış iliyle açar (kalan km, varınca "Vardın!" kartı). Planlar yalnızca telefonda (en çok 5). Hesap: il merkezleri arası kuş uçuşu x 1,3; araba 90 km/s + 2,5 saatte 15 dk mola; otobüs 70 km/s + 20 dk; uçak 650 km/s + 30 dk, iki ilde havalimanı ve 150 km üstü. Panel > Seyahat > Yolculuk fiyatları (yalnızca admin): akaryakıt (benzin, dizel, LPG, elektrik kWh), otobüs km aralığı, ay; boşsa ücret gösterilmez. **Kurallar değişti (config/travelPrices): yüklenmeli. Eren fiyatları girmeli.** Olmayanlar: bilet, sefer, firma adları, canlı yol durumu, yapay zekâ, hava durumu.
- Yol Arkadaşı 3. parça, OSM başlangıç verisi (29 Ekim 2026): Türkiye'deki akaryakıt istasyonları, şarj noktaları ve dinlenme tesisleri OpenStreetMap'ten (`scripts/osm-roadside.ts`, çıktı `veri-denemesi/yol-ustu-tr.json` ve masaüstünde `CityJoy-yol-ustu-turkiye.json`). 3 harflik geohash hücresi başına bir paket (`roadsidePacks`, herkes okur, yalnızca admin yazar). Panel > Şehir rehberi > Yol üstü verisi (yalnızca admin) dosyayı yükler; eskiyen hücreler silinir, işlem kayda geçer. Uygulamada "OSM kaydı, doğrulanmadı" ve "© OpenStreetMap katkıda bulunanlar"; aynı yerde (150 m) kayıtlı işletme varsa o gösterilir. Olanaklar yalnızca OSM etiketlerinden (bilinmeyen eklenmez). Telefon paketi bir gün saklar. Birkaç ayda bir yenilenmeli.
- Yol Arkadaşı 2. parça, Yoldayım ekranı (29 Ekim 2026; `/travel/yoldayim`, Seyahat girişindeki altın "Yoldayım" düğmesi): gece yolu canlandırması, yolda geçen süre / gidilen km / yön, büyük Tuvalet · Yakıt · Yemek · Şarj · Mescit düğmeleri, gidilen yöndeki en yakın tesis kartı (mesafe, tahmini süre, olanaklar, yol tarifi), 2 saat sonra mola önerisi, 112 düğmesi, "yolcu kullansın" uyarısı. Konum yalnızca ekran açıkken; tesisler geohash hücreleriyle (9 sorgu, 5 km'de bir) okunur. **Yeni dizin var: kurallar ve dizinler yüklenmeli.** Ayrıca düzeltildi: Rusça ve Arapçada 1'den farklı sayılarda metin Türkçeye düşüyordu (eksik çoğul biçimleri artık otomatik dolduruluyor). Sırada: OSM akaryakıt ve dinlenme tesisi başlangıç verisi, Planla.
- Yol Arkadaşı 1. parça, işletme tarafı (Eren, 29 Ekim 2026; PROJE.md 5.2): her işletme "Yol üstü tesis" olarak işaretlenebilir (olanaklar: tuvalet, akaryakıt, LPG, şarj, restoran, kafe, mescit, market, oyun alanı, bebek bakım, hediyelik) ve tesisteyken "Konumu al" ile tam yerini kaydeder (`geo`, geohash). "Yol üstü tesis" türü kendi çeşitlerinden seçer (dinlenme tesisi, akaryakıt, şarj, lokanta, büfe). İşletme sayfasında olanaklar ve koordinata yol tarifi; panelde "Yol üstü tesisler" süzgeci ve harita bağlantısı. Kurallar değişti (yüklenmeli). Sırada: Planla > Yoldayım (yakındaki tesisler, yöne göre) > Vardım; başlangıç verisi OSM akaryakıt ve dinlenme tesisleri.
- Belediye Hizmetleri (29 Ekim 2026; tasarım belediye-hizmetleri.html): Benim Şehrim'deki büyük kart artık her zaman açılır (`/city/belediyeler`): ilçe belediyesi ve büyükşehir/il belediyesi (profil özeti ve son duyurusu), arama, açılır "Diğer ilçe belediyeleri"; her biri resmî profile gider. Şehir rehberinde belediye hizmetleri verisi varsa "Hizmet rehberi" satırı çıkar. Panel karşılığı: belediye hesabı Panel > Resmî profil ve Duyurular (yeni panel işi yok). Başkan adı ve parti bilgisi tasarımda var, eklenmedi (siyasi bilgi; profil alanı yok).
- Benim Şehrim (Eren, 29 Ekim 2026): ana ekran önceki görünümünde kaldı (Eren daha güzel buldu), ama kategoriler toplu: Önemli Kurumlar tek liste (onemli-kurumlar.html sırasıyla; muhtarlıklar içinde), Park & Pazar tek bölüm iki sekme; toplanma alanları Mahalle Meydanı'nda. Liste sayfaları Müzeler tasarımı gibi (arama, altın filtreler, sayı kutuları).
- Benim Şehrim 1. parça (29 Ekim 2026; PROJE.md 5.1): Bursa OSM Excel'i (`veri-denemesi/osm-16-Bursa.xlsx`, masaüstüne de kopyalandı), "Nasıl yapılır?" ülke geneli Excel'i, Cafe ve Restoran (`/city/food`), Şehir Vitrini (`/city/showcase`, Panel > Şehir rehberi > Şehir Vitrini). Açık iş: boş Excel şablonu (`scripts/build-data-templates.py`) yeniden üretilmeli (3 sütun isteğe bağlı oldu; bu bilgisayarda Python yok).
- Acil İhtiyaçlar yeni düzen (Eren, 29 Ekim 2026; PROJE.md 5.4): "Hemen lazım olabilir" kutucukları Panel > Hizmet kategorilerindeki "acil" işaretinden ve sıradan gelir.
- Panel girişindeki "Örnek Nilüfer Belediyesi" hesabı belediye panelini (Seyahat > Başkanlarla Keşif) gösterir; kaydetme kapalı (29 Ekim 2026).
- Panelde sırası olan her liste sürükleyerek sıralanır (`apps/panel/src/components/sortable.tsx`; Eren, 29 Ekim 2026; PROJE.md 6.1).
- Keşfet'te gönderi birden çok hedefe paylaşılabilir (Eren, 28 Ekim 2026; PROJE.md 5.5).
- Ana sayfa ve Benim Şehrim için yeni tasarım yönü onaylandı (Eren, 28 Ekim 2026; PROJE.md 13. madde 29).
- Tasarım ölçütlerini Eren Claude'a bıraktı: daha derli toplu, keyifli, Keşfet'te Instagram hissi (hikâye halkaları
  istemiyor), mağaza incelemesinde sorun çıkaracak şeylerden kaçınılır (Eren, 28 Ekim 2026; PROJE.md 13. madde 30).

- STK ve kulüpler için ayrı "etkinlik yetkisi iste" başvurusu şimdilik yok (Eren, 28 Ekim 2026): gerekirse admin Panel >
  Kurumlar'dan "kurum" ya da "kulüp" olarak açar, etkinlik bölümünü verir (6.4 madde 18).

- Yetkiler kutucuklarla (6.6, 27 Ekim 2026): kurum yöneticisi ve il yöneticisi kişiye verdiği her eylemi işaretler,
  "Onaysız yayınla" ayrı kutucuk; işaretli değilse içerik onaya gider.
- Yetki zinciri (6.7, 27 Ekim 2026): admin herkese ve kurumlara; il yöneticisi kendi ilinde muhtar ve moderatöre; kurum
  kendi personeline. Form yok, e-postayla verilir. Belediye adları kilitli; kurum hesabı resmî e-postayla, şifreyi kurum koyar.
  Önemli konularda (bildirim, işletme doğrulama, kurum açma, yasaklama, ücret/iade, anket) onay admin'e de gider.
- Onay gereken işler önce il yöneticisi, sonra admin; admin panelinde "Bekleyen onaylar" ekranı, "Tümünü onayla",
  "Güvenli olanları onayla" ve şehir/ilçe/kategori kapsamlı güvenilir yöneticiler listesi (6.5).
- Belediyeler kendi alanında; büyükşehir ilçe içeriğini düzenleyemez (6).
- İşletmeler için ayrı panel yok, uygulamadaki İşletmem kullanılır (6).
- Kurum kendi personeline sınırlar içinde görev verir (kurum yöneticisi); belediye paneli 18. madde ilk sürümde (6.6).
- Görsel yön: koyu A, açık C (17).
- Hizmet listesi sıralaması (5.6): Reklam en çok 2 ve yalnızca doğrulanmış; sonra doğrulanmış, puan, ilçe, güncellik.
- SOS türü seçimi yok, tek düğme; SOS = gönderen yardım istiyor; konum arka planda da gider; aileye bildirim (5.4).
- Değerlendirme kuralları (5.6, Eren "gerekeni yap" dedi): uygulamadan arama şartı, kişi başına bir, cevap hakkı, şikâyet ve gizleme.

## Açık işler ve bilinen eksikler

- **Kitle istatistiği (3 Kasım):** gönderi istatistikleri "kurum / başkan adına gönderi" ile gelecek; 10 kişi eşiği şimdilik
  panelde (sunucuda Blaze ile); takip / bırakma tekrarına sınır yok; seçim dönemi başkan gizleme resmî profile
  uygulanmadı; avukat: verinin siyasi kullanımı; aydınlatma metnine "isimsiz, toplu istatistik" satırı (PROJE.md 6.1).
- **Blaze'e geçince Claude'un yapacakları:** **ilk iş otomatik harcama sigortası** (Eren istedi, 6 Kasım: bütçe Pub/Sub bildirimi > işlev > tutar aşılınca projenin faturalandırmasını kapatır; öneri aylık 20 dolar, ayrıca 10 dolar e-posta uyarısı; `docs/eren-yapilacaklar.md`); sonra sunucu işlevleri ve Storage kurallarını yüklemek; ~~listelerde küçük önizleme görseli~~ (7 Kasım); Storage bölgesi **europe-west1** (Karar Eren, 6 Kasım: Firestore da Avrupa'da, eur3; Firebase'in ücretsiz Storage kotası yalnızca ABD bölgelerinde, bu yüzden ilk bayttan ücretli, başta ayda en çok ~10-12 $, maliyeti izlemek); **fotoğraf/video gösterimi** (Eren ile konuşuldu, 6 Kasım): asıl gider görüntüleme; fatura ayda ~50 doları geçince yalnızca medya Cloudflare R2'ye (indirme ücretsiz) ya da Bunny CDN'e taşınacak, Firebase giriş/veri/bildirim için kalır; tamamen kendi sunucusu önerilmedi (bakım, güvenlik, KVKK); video dokununca oynar; "Çevir" düğmesinin işlevini yükleyip gerçek çeviriyle denemek; ~~Çarşı'da yeni ilana en az bir fotoğraf zorunluluğu~~ (7 Kasım; uygulama + kurallar; Karar
  Eren 3 Kasım); fotoğraflı akışları gerçek projede deneme.
- **Görseller (8 Kasım):** Eren yapay zekâyla (ChatGPT) görsel hazırlayacak; liste ve tarifler `docs/gorsel-listesi.md`. Gelince masaüstü `CityJoy-gorseller` klasöründen alınıp yerleştirilecek (ortaklar `apps/mobile/assets`, il kapakları panelden). **1. grup geldi ve kondu (8 Kasım):** belediye, kurumlar, mahalle, vitrin, siluet `apps/mobile/assets/city/` (960 px jpg; eski kesitler townhall/skyline silindi); Önemli Kurumlar kartı da artık resimli. Eren ayrıca gece Bursa manzarası yaptı: 16:9 kesilip masaüstüne `bursa-kapak.jpg` kondu, Eren panelden Seyahat > Bursa kapağına yükleyecek. **2. ve 3. grup da kondu (8 Kasım):** ana sayfanın dört kartı `assets/home/` (çizim yerine resim), giriş resimleri `assets/auth/` (karşılama üç resim sırayla; dil seçimi, giriş/kayıt, konum izni ve profil tamamlama arkada tam ekran resim + alttan koyulaşma). Tek yer: `src/lib/app-art.ts`. Panel > Uygulama görselleri (Blaze) gelince bunlar varsayılan kalır. Telefonda denenmedi. **Giriş ekranlarında içerik ekranın ortasında (Karar Eren, 8 Kasım).** **Dil seçimi yeni tasarımda (Eren, 8 Kasım; `docs/tasarim-ornekleri/dil-secimi.png`):** satırda bayrak (Karar Eren: bayrak kalsın, emoji; telefonda bayrak, Windows tarayıcısında harf görünür), dilin adı, sağda dile ait resim (`assets/lang/`), altın ok; tek dokunuş seçip devam eder, Devam et düğmesi kalktı. Arka plan `dil-arka.png` (Eren yeniledi: üstte balonlar ve karlı dağ, altta İstanbul silüeti, ortası boş) kondu; satırlar o boşluğa sığacak kadar sıkı (62 px); bu ekranda alttan koyulaşma kapalı. **İl kapakları (8 Kasım):** Eren Bursa tarzında 67 il kapağı yaptı; masaüstü `CityJoy-gorseller/il-kapaklari/` içinde, her biri için panele yüklenecek 1600x900 `-kapak.jpg` hazır. Adı `il-belirsiz-...` olanların ili Eren'e soruldu; Çanakkale resmi İstanbul köprüsü ve Rumeli Hisarı içerdiği için yeniden yapılacak. Eren panelden tek tek yükleyecek. **Bursa şehir rehberi verisi (9 Kasım):** Eren ChatGPT ile ayrı ayrı arıyor (`docs/veri-sablonlari/bursa-ayri-aramalar.md`, 18 arama); gelen her Excel `scripts/check-city-guide.ts` ile denetlenip şablona çevriliyor. Masaüstünde panele hazır: `CityJoy-Bursa-muhtarliklar-panel.xlsx` (1060 mahalle; muhtar telefonları görünsün, Karar Eren), `CityJoy-Bursa-hastane-muze-otopark-panel.xlsx` (135 satır). Muhtar dosyasına 144 adres eklendi (kaynak/teyit notuyla). `CityJoy-Bursa-toplanma-alanlari-panel.xlsx`: 1206 AFAD/BBB toplanma alanı, konumlu; Bursa Büyükşehir açık verisinin GeoJSON'undan (`scripts/bursa-toplanma-acikveri.ts`, Bursa Açık Veri Lisansı, kaynak bağlantısı her satırda). Panele yükleme Eren'de. `CityJoy-Bursa-ulasim-panel.xlsx`: 56 satır (raylı sistem, teleferik, BUDO, havalimanı, 15 BursaKart türü, 31 ana otobüs hattı); iki uzun not kısaltıldı, aynı adlı iki ring hattına hat kodu eklendi. `CityJoy-Bursa-parklar-panel.xlsx`: 575 park (17 ilçe), 544'ü konumlu; Eren'in dosyasındaki 530 park BBB toplanma alanı verisiyle eşleştirilip konum eklendi, tür sütunu addan dolduruldu (park, botanik, mesire, kent ormanı). BBB'nin ayrıca 17 noktalık "parklar" (turizm) verisi var: `veri-denemesi/acikveri/parklar.geojson`. `CityJoy-Bursa-pazarlar-panel.xlsx`: 168 pazar (17 ilçe; gün, açık/kapalı, sebze/giyim, konum), doğrudan BBB "Çarşı ve Pazar Alanları" açık verisinden `scripts/bursa-pazar-acikveri.ts` ile (koordinatlar ED50/TM30'dan WGS84'e çevriliyor). Eren'in köylü/organik/balık dosyası işlendi: 7 satır BBB kaydıyla aynı çıktı, tür ve ürün sınıflaması iyileştirildi, 3 yeni satır eklendi; dosya 171 pazar. `CityJoy-Bursa-aile-sagligi-panel.xlsx`: 241 aile sağlığı merkezi (Önemli Kurumlar, kaynak Bursa İl Sağlık Müdürlüğü listesi; telefon ve konum yok). Eren'in dosyasındaki 15 "sağlık kabini" alınmadı: kaynak Yandex/dizin siteleri, ruhsat doğrulanmamış, bir kısmında cep numarası. `CityJoy-Bursa-avm-otoparklari-panel.xlsx`: 13 AVM otoparkı (tip avm, işletici Özel; ücret bilgisi notta; 3'ü harita kaydı kaynaklı, teyit notlu). Panel Excel yüklemesi ekler/günceller, silmez; önceki 55 otoparkla ad çakışması yok. **Kalan aramaları Claude yaptı (9 Kasım, Eren istedi):** `CityJoy-Bursa-kurumlar-panel.xlsx` 131 kurum (`scripts/bursa-kurumlar-resmi.ts`): valilik ve 17 kaymakamlık, 38 emniyet (ilçe emniyetleri ve polis merkezleri, yalnız sabit hat), 10 adliye, itfaiye başkanlığı ve 28 istasyon (istasyon telefonu yayımlanmıyor, acil 112), 25 kütüphane (Kültür Turizm listesi ve BBB açık verisi), 11 halk eğitim merkezi. `CityJoy-Bursa-belediye-hizmetleri-rehber-panel.xlsx`: 12 belediye hizmeti (BBB, Osmangazi, Nilüfer, Yıldırım) ve 7 "Nasıl yapılır" (BursaKart, 65+ ve engelli kart, cenaze, nikâh, emlak vergisi, şikâyet), `scripts/bursa-hizmetler-rehber.ts`. Bulunamayan/eksik: jandarma, nüfus, göç, vergi dairesi, SGK, noter, PTT (resmî siteler okumaya izin vermedi ya da liste haritada), il müdürlükleri, taksi durakları (resmî kaynak yok), BUSKİ su aboneliği (site sertifika hatası), otopark aboneliği (BURPARK sayfasında yok), diğer 14 ilçe belediyesi hizmetleri. **Mahalleden geçen otobüsler (açık soru, 9 Kasım):** bu dosya yalnızca hattın başını/sonunu ve ücretini verir; "mahallemden hangi otobüs geçer" için durak konumları ve her hattın durak sırası gerekir. BBB açık verisinde yok, OpenStreetMap çok eksik (21 hat), bursaotobus.com.tr resmî değil ve veri çekilmesini istemiyor. Önerilen yol: Eren BURULAŞ/BBB'den hat-durak verisini (GTFS biçiminde) resmî olarak ister; gelirse uygulamaya "Duraklar ve hatlar" bölümü eklenir (yeni özellik, Eren onayı gerekir).
- **Seyahat Keşfet içeriği Excel ile (9 Kasım, Eren istedi: "Keşfet kısmı dolu olmalı"):** Panel > Seyahat sayfasına "Excel şablonu" ve "Excel'den yükle" düğmeleri eklendi. `packages/shared/src/travel/sheet.ts` dosyayı okur ve denetler, `importContent` kaydeder: yeni kayıt taslak girer, var olanın durumu ve kapağı korunur, aynı il + ad güncellenir (tohum kayıtlarıyla da eşleşir), her parti denetim kaydına yazılır. Sekmeler: Bölgeler, Şehirler, Gezilecek Yerler. Şablon `apps/panel/public/seyahat-sablon.xlsx` (`scripts/seyahat-sablon.ts`; `-- --check dosya.xlsx` denetler). İçerik `scripts/seyahat-icerik/` altında bölge bölge yazılıyor; `build.ts -- marmara` masaüstüne `CityJoy-Seyahat-marmara-panel.xlsx` üretir. **Marmara bitti:** 7 bölge tanıtımı, 10 il (Bursa tohumda var), 43 gezilecek yer, 0 hata. Metinler CityJoy'un kendi cümleleri (Kültür Portalı ve başka sitelerin metni kopyalanmaz, yalnız ad/tür/adres gibi bilgiler resmî kaynakla teyit edilir); saat, ücret ve telefon boş, resmî kaynaktan bakılıp panelden girilecek. **Diğer altı bölgeyi Eren getirdi (9 Kasım, ChatGPT ile; kaynaklar muze.gov.tr, il kültür turizm müdürlükleri, EBA, Kültür Portalı bağlantısı):** biçim hataları `scripts/seyahat-icerik/duzelt.ts` ile düzeltildi (boş "hakkında" özetle dolduruldu, türsüz yakındakiler/ulaşım ipuçlarına taşındı ya da türü bulundu, "A / B" ilçeler, 3 cep telefonu silindi, Google izleme ekleri temizlendi; Bölgeler sekmesi bizim metinle). `birlestir.ts` ile hepsi tek dosya: masaüstü `CityJoy-Seyahat-tum-turkiye-panel.xlsx`, 7 bölge, 80 il (Bursa tohumda), 497 yer, 0 hata. **Claude tamamladı (9 Kasım, Eren istedi):** 454 yerin "Hakkında" metni Claude'un kendi cümleleriyle yazıldı (`hakkinda-bati.ts`, `hakkinda-orta.ts`, `hakkinda-dogu.ts`), 18 ile UNESCO bilgisi eklendi, Bursa'ya 7 ek yer (Emir Sultan, Irgandı, İznik Ayasofya ve surlar, Gölyazı, Mudanya Mütareke Evi, Oylat); `zenginlestir.ts` birleşik dosyaya işler. Son dosya: 7 bölge, 80 il, 504 yer, 0 hata. Kalan: ziyaret saatlerinin bir kısmı mevsimlik (ör. 1 Nisan 2027'ye kadar), baharda yenilenecek; deprem bölgesindeki (Hatay, Kahramanmaraş, Gaziantep) müze ve kalelerin açık olup olmadığı yayına almadan kontrol edilmeli.
  **Pratik bilgiler (11 Kasım, Eren istedi):** Excel'e üç isteğe bağlı sütun: `yas_bilgisi`, `yanina_al`, `kurallar`
  (eski dosyalar da yüklenir; şablon yenilendi). `scripts/seyahat-icerik/pratik.ts`: yer türüne göre genel bilgi (cami,
  türbe, müze, ören yeri, kale, mağara, doğa, şelale/kanyon, plaj, köy, kaplıca, kayak...) ve 56 tanınmış yere özel not;
  `pratik-uygula.ts` boş saat/ücret/süre/yakındakiler/erişilebilirlik alanlarını doldurur, var olan bilgiye dokunmaz.
  Kesin saat ve fiyat yazılmadı, genel bilgi "genellikle" diye. Deprem bölgesindeki 6 ilde ipucu: gitmeden açık mı bak.
  Masaüstü `CityJoy-Seyahat-tum-turkiye-pratik-panel.xlsx`: 7 bölge, 80 il, 497 yer, 0 hata. **Bursa satırları çıkarıldı**
  (Bursa yerleri yayında, kendi pratik bilgileri var; Excel yüklemesi onların üstüne yazardı). Yüklemeden önce panel
  yeniden yüklenmeli (`npm run panel:deploy`), yoksa yayındaki eski panel yeni sütunları okumaz. Yüklenen yerler taslak girer. **Bekliyor (Eren, 11 Kasım):** Eren her ilden 5 yer (gezi görselleriyle) hazırlıyor; gelince liste ona göre toparlanacak, panel yüklemesi ve Excel o zaman.
- **Bursa eksik veriler (9 Kasım, Eren "Eksikleri sen tamamla" dedi):** Eren'in `CityJoy-Bursa-Eksik-Veriler.xlsx` dosyası (147 kurum, 21 belediye hizmeti, veri talepleri, BURULAŞ GTFS mektup taslağı) işlendi. Kaymakamlık ve valilik sitelerindeki birim sayfaları okundu (`scripts/bursa-kaymakamlik-birimler.ts`, sayfadaki konum bloğu; çıktı `veri-denemesi/acikveri/kaymakamlik-birimler.json`), Eren'in satırlarıyla birleştirildi (`scripts/bursa-kurumlar-ek.ts`): aynı birimde resmî kayıt öne geçer, 6 telefon resmî siteye göre düzeltildi (Kestel, Yenişehir, Yıldırım nüfus; Büyükorhan, Orhaneli, Gemlik mal müdürlüğü), Bursa dışına düşen 2 konum silindi. Masaüstü `CityJoy-Bursa-kurumlar-ek-panel.xlsx`, 0 hata: 169 kurum (12 jandarma, 18 nüfus, Göç İdaresi, 3 il müdürlüğü, 14 SGK, 19 vergi dairesi/mal müdürlüğü, 9 tapu "diğer" türünde, 71 noter, 21 PTT), 29 belediye hizmeti (BUSKİ su aboneliği, BURPARK, Gemlik/İnegöl/Mudanya/Gürsu, kalan 9 ilçenin e-Devlet ya da e-belediye bağlantısı, açık olduğu denetlendi), 1 "Nasıl yapılır" (su aboneliği). Noter ve PTT ikincil rehberden (resmî siteleri yalnız arama sunuyor), "teyit" notlu; GİB vergi listesi arşiv kaydı. Hâlâ eksik: İnegöl, Keles, Orhaneli, Orhangazi, Yenişehir ilçe jandarma (sitelerinde yok; acil 156/112), taksi durakları (UKOME/Şoförler Odası'ndan istenecek), BURULAŞ hat-durak verisi (Eren'in mektubu gönderilecek).
- **Eren'in tasarım örnekleri (8 Kasım, bilgi için; zamanı gelince uygulanacak):** `docs/tasarim-ornekleri/` (Benim Şehrim ana, Önemli Kurumlar koyu ve açık). Önemli Kurumlar için anlaşılanlar: tepede ilin kapak fotoğrafı sayfaya eriyerek (tüm Benim Şehrim alt sayfalarında aynı il fotoğrafı), arama + Tümü/Kamu/Sağlık/Acil filtreleri, iki sütun kart (simge, başlık, açıklama, ok). Açık modda zemin de açık olacak (görseldeki koyu zemin + beyaz kart değil). Alttaki bilgi kutusu konmayacak ("siz" dili de uymuyor). Kaydet düğmesi ve alt menü çubuğu yeni özellik, ayrıca konuşulacak. Müzeler örneği (`muzeler.png`): bugünkü hub düzeninin (Türüne göre, İlçene göre, Sana en yakın, Tümünü listele) zenginleşmiş hâli; tepede il fotoğrafı, tür kutularında sayı, en yakın kartta fotoğraf + Yol tarifi. Karar (Eren, 8 Kasım): her alt sayfaya ayrı tasarım gerekmez, Claude bu örneklerden türetir; Eren yalnızca farklı tipteki ekranları (ayrıntı sayfası, Mahalle Meydanı, Nöbetçi Eczane, Vitrin, Etkinlik) çizebilir. Gelenler (8 Kasım): `ayrinti-muze.png`, `mahalle-meydani.png`, `nobetci-eczane.png`, `etkinlikler.png`; Eren "yeterli mi" dedi, yeterli (Vitrin Claude türetir). Uygularken: Etkinlikler başlığındaki "StiJoy" yanlış, CityJoy olacak; Eczane başlığındaki 3B hap simgesi yerine ince simge; Eczane kaynak notu (TEB) kalır (kaynak belirtmek gerekli). Yeni özellik sayılanlar, ayrıca konuşulacak: yorum/puan, favori/kaydet, paylaş, alt menü çubuğu, Bölgesel/Genel etkinlik ayrımı. Harita gömme maliyet ilkesine göre değerlendirilecek (bölüm 9.1).
- **Eren'in yapacakları tek listede:** `docs/eren-yapilacaklar.md` (31 Ekim). Eren bir maddeyi bitirdim deyince işaretle.
- **Mağaza öncesi kontrol listesi (30 Ekim 2026, 20 maddelik liste üzerinden):** Claude'un üç işi yapıldı (konum izni metni,
  çökme ekranı, "Bağlantı yok" bildirimi; Yapılanlar'da). EAS ile gelecekler: çökme
  raporu ve analiz (Sentry ya da Crashlytics), gerçek bildirim denemesi, TestFlight ile 5-10 kişiyle gerçek kullanıcı testi
  (Apple geliştirici hesabı), Android'de deneme. Eren/avukat: gizlilik politikası ve kullanım şartları metni.

- Toplu güvenlik taraması (`/security-review`, tüm kod: Firebase kuralları, giriş, yönetici yetkileri): Eren mağazaya
  çıkmadan önce en sonda toplu yapılmasını istedi (29 Ekim 2026).
- **Sonra bakılacak (Eren, 3 Kasım):** Keşfet konum rozeti (Hesabım > "Konum rozeti", `/location-badge`). Eren
  daha sonra birlikte gözden geçirmek istedi; ne değişeceği henüz konuşulmadı.
- **İç ekranların yeni tasarımı, Eren'in kararları (3 Kasım 2026):** PROJE.md 13. madde 35. Tüm iç ekranlar (Müzeler, Keşfet,
  Cafe ve Restoran, Benim Şehrim'in 12 alt sayfası) hepsi birlikte koda geçecek; Eren tekrar önizleme istemedi. Önizleme:
  https://claude.ai/artifact/KtJc51bopnoZd2DSHY625r. Öne çıkanlar: Büyükşehir de büyük kartta, Mahalle Meydanı'nın yeni içeriği,
  Otoparkta kapasite / canlı takip yok, Satılık ve Kiralık için Çarşı tasarımı, **il Vitrini reklam panosu ve gelir kaynağı**
  (önceki "para karşılığı girilmez" notunun yerine).
  Eklendi (3 Kasım akşam): Acil alt sayfaları (H-Veteriner, H-Taksi, H-Diger) ve Sosyal Harmoni iç sayfaları (SH-*),
  Eren onayladı (3 Kasım). Koda geçti (4 Kasım, dal claude/ic-ekranlar; Yapılanlar sonu).
  Fırsatlar (Eren): kaydırmalı kategori kartları, kategori sayfası, fırsattan işletme sayfasına (geri: listeye), İşletmem >
  Fırsatlarım; fırsat sınırı Ücretsiz 1, Pro 5 (PROJE.md 13 madde 35 ve 15 madde 2).
  Profil, Mesajlar, İşletme ekle, Gönderi paylaş: Expo'daki hâli iyi, aynen kalır (Eren); U-* panoları o hâli gösterir.
  Duyurular (Eren): sayfa olmuş; tek yeri Mahalle Meydanı > Duyurular, Ana sayfa acil şeridi kalır, bildirim duyuruyu açar
  (geri: liste). Koda geçerken: Belediye Hizmetleri'ndeki son duyuru satırı kaldırılacak (`city/belediyeler.tsx`), bildirim
  yönlendirmesi ve geri tuşu buna göre.
  Giriş akışı (Eren): karşılama > dil > giriş/kayıt > izinler > ana sayfa; resimler şimdilik çizim, Panel > Uygulama
  görselleri'nden değişir (yükleme Blaze ile). G-* panoları ve P-Gorseller Eren onayladı (buzlu cam kart) (PROJE 13, madde 35).
  Seyahat (Eren): Yoldayım aynen kalır. Planla = tatil keşfi: Türkiye / Yurt dışı (sonra) > tatil fikri > yerler >
  konaklama (İşletme ekle > "Otel ve konaklama"dan kendiliğinden, Ücretsiz / Pro). PL-* (6) ve P-Tatil Eren onayladı (PROJE 5.2).
  Panel > Seyahat: Keşfet ve Öğren (kodda var, P-Sy* panoları eklendi; yeni: Ülkeler sekmesi) ve Tatil fikirleri.
- ~~Gönderi beğenileri sayfa yenilenince boş görünebilir~~ (3 Kasım düzeltildi, Yapılanlar'ın sonunda).
- Telefonda Google ile giriş ve "Apple ile giriş" yok: geliştirme derlemesi (EAS, Expo hesabı) gerekiyor.
- Yönetici iki aşamalı doğrulaması: Firebase Blaze (ücretli) plan gerekiyor.
- Yasal metinler boş (yalnızca "avukat kontrolünden geçecek" notu).
- Misafir gezinti, telefon doğrulaması: `PROJE.md` 3.1'de onay bekleyen öneriler.
- Onay merkezi yalnızca işletme doğrulamasıyla çalışıyor; diğer onaylı işler (kampanya bildirimi, etkinlik yetkisi, kulüp ve
  yayıncı başvurusu, kurum içi hazırla > onayla akışı) ilgili bölümler yapılınca eklenecek. Onay bekleyen iş için ilgiliye
  bildirim (e-posta/push) yok. Belge yükleyerek doğrulama Storage (Blaze) ister. İl bazlı şikâyet kuyruğu henüz yok. Kurum içeriği (gönderi,
  etkinlik, bildirim) bölümleri henüz yok; personel görevleri hazır, bölümler yapılınca çalışır. Yeni admin yalnızca Firebase
  konsolundan (`admins/<uid>`). Belde belediyeleri konum listesinde yok (gerekirse "kurum" olarak açılır). Panel metinleri
  şimdilik yalnızca Türkçe. E-posta şablonları konsolda değiştirilemiyor (Firebase: "Email template updates
  are currently unavailable for this project", 27 Ekim). Bu yüzden panel ve uygulama Firebase'in hazır şablonunun Türkçesini
  ister (`languageCode = 'tr'`); gönderen adı ve metin CityJoy'a özel değil. Kalıcı çözüm: ileride kendi e-posta sunucusu
  (SMTP settings) ya da Firebase Destek'ten şablon izni. Proje ayarlarındaki "Herkese açık ad" CityJoy olmalı (%APP_NAME%).
- **PR #55 kuralları ve 2 yeni dizin yüklendi (3 Kasım 2026)** (Çarşı ilan fotoğrafları, aktivite ve Seyahat/belediye
  kapakları, "{Şehir} kareleri", Keşfet albümü 10 fotoğraf ve video, konum rozeti; Eren'in isteğiyle Claude bu bilgisayardan
  yükledi; ilk denemede Google tarafında geçici 503 hatası, ikincisinde "Deploy complete!"). Storage kuralları ve sunucu
  işlevleri Blaze bekliyor. Panel (Seyahat > Kareler sekmesi) henüz yeniden yüklenmedi: `npm run panel:deploy`.
- **Kurallar ve dizinler 31 Ekim'de yüklendi** (işletmeye mesaj, sohbeti sil; PR #42 birleştikten sonra, Eren'in isteğiyle Claude
  bu bilgisayardan yükledi).
- **Kurallar ve dizinler 29 Ekim akşamı yüklendi** (yol üstü tesis, Yoldayım dizini, roadsidePacks; PR #36 sonrası).
- **Kurallar ve dizinler 28 Ekim'de yüklendi** (etkinlikler ve resmî profiller dahil, PR #6 birleştikten sonra, Eren'in
  bilgisayarından). Derlemedeki 7 "Invalid type ... null" uyarısı `get(..., null)` kalıbından, zararsız.
- **Güvenlik kuralları ve dizinler 27 Ekim 2026'da Firebase'e yüklendi** (Eren, kendi bilgisayarından:
  `npx firebase-tools@15.34.1 deploy --only firestore:rules,firestore:indexes --project cityjoynew`). Kurallar ya da
  dizinler her değiştiğinde aynı komutla yeniden yüklenmeli; Eren'e hatırlat.
- Acil İhtiyaçlar'ın kalanı: nöbetçi eczane, asistan (SOS, hizmetler ve taksi durakları yapıldı).
- Hizmet önerileri: admin hepsini, il yöneticisi kendi ilininkileri görür ve inceler. Günlük sınır ve hesap silinince
  önerilerin silinmesi yapıldı (31 Ekim; uygulama siler, sunucudaki günlük temizlik Blaze ile güvenlik ağı).
- **SOS bildirimi ve arka plan konumu telefonda denenmedi:** kod hazır, ama Expo push adresi için `app.json` içinde EAS proje
  kimliği (`extra.eas.projectId`) gerekir; `eas init` ile gelir. Telefonda denenecekler: kilitli ekranda bildirim sesi,
  uygulama kapalıyken konum güncellemesi, bildirime dokununca SOS ekranı. Expo push güvenliği: bildirim adresleri yalnızca aile
  üyelerine açık; ileride Expo erişim anahtarıyla sunucudan gönderime geçilebilir (Blaze). Sonra: QR'ı kamerayla okutma
  (expo-camera), fotoğraf/ses ekleme (Storage, Blaze), "ID ile istek" yöntemi, iOS "kritik uyarı" başvurusu (isteğe bağlı).
- **SOS kayıtlarının 30 gün sonra silinmesi:** TTL ücretsiz planda yok (27 Ekim). Yerine sunucu işlevi `dailyCleanup`
  yazıldı (her gün 04:00, `deleteAt` geçenleri siler); Blaze ve işlev yüklemesiyle çalışmaya başlar, TTL gerekmez.
  Gizlilik metninde "30 gün" sözü buna göre yazılmalı.
- Değerlendirme: şikâyet sayısı eşiğinde otomatik geçici gizleme ve il yöneticisi kuyruğu, yasaklı kelime süzgeci, yorum
  bildirimi (işletmeye "yeni değerlendirme") sonraki adımlarda. "Arama kaydı" kişisel veridir: aydınlatma metnine eklenecek
  (avukat kontrolü). Aynı telefonla kayıtlı işletmenin "sahiplik talebi" akışı henüz yok (mesaj CityJoy ile iletişime yönlendiriyor).
- İşletme: fotoğraf/video vitrini (kademeye göre kapasite; Firebase Storage Blaze ister), yorum ve puan verme, telefonla
  sahiplik doğrulaması (SMS, Blaze), belge yükleme ve ücretli doğrulama, aynı işletmenin ikinci kaydını engelleme, kategoriye
  özel alanlar (konaklama, yeme-içme...), mobil ustalar için hizmet verdiği ilçeler, "bilgileriniz hâlâ doğru mu?" hatırlatması,
  işletme başına günlük ekleme sınırı. (İl yöneticisi kendi ilinin işletmelerini panelde görür, doğrulama admin'de.)
- SORULACAK (öneri hazır, Eren'in onayı bekleniyor): Nöbetçi eczane veri kaynağı ve günlük çekimin yeri.
  Öneri `docs/oneri-nobetci-eczane.md`: NosyAPI (yedek CollectAPI) + GitHub Actions, sabah 08:15 ve 10:00 (yalnızca
  başarısız iller). Eren'den gerekenler: onay, NosyAPI anahtarı, GitHub Actions seçilirse Firebase hizmet hesabı anahtarı.
- **Panel 2. aşama (Eren istedi, 3 Kasım):** belediye panelinde gönderi istatistikleri (görüntülenme, beğeni, yorum,
  paylaşım, kaydetme) ve **Belediye Başkanı** kartı + başkan sayfası istatistikleri (video izlenme ve sonuna kadar
  izlenme oranı, yorum oranı, takipçi, takipten çıkan, Bursa içi / dışı takipçi, en çok takip eden iller). Uygulamada
  isimsiz ve toplu sayım başlatılmalı (izlenme kişi başına bir kez); sağlam hâli Blaze ile. Parti adı / logosu yok.
  Başkan istatistiklerini başkan ve yetki verdiği personel görür. Şehir doluluk kartı ve "uygulamada nasıl görünür"
  önizlemesi de önerildi. "Uygulama görünümü" bölümü sonraya (Eren). Şehir Vitrini panel sayfasındaki "para karşılığı
  girilmez" metni 3 Kasım kararıyla eskidi; Vitrin yenilenirken değişecek.
- Panel internette: https://cityjoynew.web.app (31 Ekim). Uygulamanın web sürümü yayında değil.
- Ana sayfadaki arama kutusu ve hava durumu ilgili özelliklerle gelecek (duyurular ana sayfada).
- `tasarim/firebase-config.js` ve `tasarim/belediye-panel-osmangazi.html` eski `cityjoy-d5d29` projesinin
  bağlantı bilgilerini içeriyor; Eren'e o projeyi kapatması önerildi.

## Sıradaki adım (Eren seçecek)

**Arka uç yol haritası (Eren'in sırası: arka uç > ekran tasarımları > eksik bilgiler; panel tasarımı da):**
1. ~~Sunucu işlevleri paketi, iptal bildirimleri, SOS temizliği, hesap silme güvenlik ağı~~ (31 Ekim).
2. ~~Acil duyuru ve duyuruda bölgedeki kişilere telefon bildirimi~~ (31 Ekim).
3. ~~Mesaj ve yeni takipçi bildirimleri~~ (31 Ekim; telefona bildirim, Blaze ile çalışır).
   Araya giren (Eren, 31 Ekim): mesajlar. ~~İşletmeye mesaj, İşletmem, sohbeti sil~~ (31 Ekim). Sırada ilan pazarı
   (Marketplace) ve "İlanlar" bölümü; Karar (Eren): önce ikinci el eşya, emlak ve araç sonra.
   Karar (Eren): bölümün adı **Çarşı**; Benim Şehrim kartı "Satılık & Kiralık" yerine "Çarşı" yapıldı (5 dil),
   Mesajlar'daki bölüm de "Çarşı" olacak. ~~Çarşı (eşya ilanları) ve Mesajlar > Çarşı~~ (31 Ekim). Çarşı'da kalan:
   fotoğraflar (Blaze), emlak ve araç (avukat ve kimlik doğrulama sonrası).
4. ~~Günlük sınırlar ve bildirim öncelikleri; hesap silinince hizmet önerileri ve sayaçların silinmesi~~ (31 Ekim).
5. Fotoğraf yükleme: ~~Keşfet gönderisi, etkinlik kapağı, kurum ve işletme logosu, işletme vitrini, kişi profil fotoğrafı~~ (31 Ekim - 1 Kasım, Blaze
   bekliyor), ~~Çarşı ilan fotoğrafları, aktivite kapağı, Seyahat ve belediye kapakları, "{Şehir} kareleri"~~ (3 Kasım).
   Fotoğraf işleri tamam (Blaze ile çalışır). Video sonra.
6. Nöbetçi eczane günlük çekimi (Eren'in onayı ve anahtar). 7. Yönetici iki aşamalı doğrulama.
Hepsi emülatörde yazılıp test edilir; Blaze gelince tek komutla yüklenir.

**Eren'in fikri, bekliyor (31 Ekim; Eren plan yapacak, şimdilik bir şey yapılmayacak):** afet / deprem modu. Bölgedekilere
"Güvende misin?" (Güvendeyim / Yardıma ihtiyacım var), güvende olana toplanma alanları ve yardım noktaları, yardım isteyenin
konumu panelde kırmızı harita ve liste, kurumlarla paylaşım, önceden izinle ailesine otomatik konum; dron / internetsiz
iletişim fikri. Claude'un görüşü konuşuldu: ilk iki aşama yapılabilir (KVKK ve 112 sorumluluğu avukata), konumu izinsiz
toplamak olmaz, dron ve Wi-Fi Direct ayrı bir Ar-Ge projesi. Temeli bu duyuru bildirimi altyapısı.

00. Seyahat: Keşfet'e fotoğraf paylaşımı (telefonda sıkıştırma, Storage) ve ardından "{Şehir}'dan Kareler" (kutucukla, ek
   yükleme yok; PROJE.md 13. madde 34). Sonra Planla ve Navigasyon.
0. Benim Şehrim: Eren'in Excel'i gelince kaynak kontrolü + yükleme (ekranlar hazır). OSM iskeleti (31. madde) başlangıç
   olarak kullanılabilir. Sonra aynı yöntemle Seyahat şablonu
   (Keşfet ve Öğren şehir bilgileri). Kullanıcının "bilgi hatası bildir" düğmesi ve belediyenin kendi ilçesini düzenlemesi sonra.
0a. 30. madde (Bildirim merkezi): Eren PR'ı birleştirince kurallar ve dizinler yüklenmeli (1 yeni dizin). Admin Panel >
   Moderasyon'dan yasaklı kelime listesini (26. madde) ve isterse önerilen aramaları (28. madde) doldurmalı.
0b. Keşfet'in kalanı: fotoğraf/video (Storage, Blaze). Kalan ekranların tasarım uygulaması (32. madde: liste ve
   ayrıntı ekranları, formlar) Claude'un ölçütleriyle sürüyor. Blaze ve Eren gerektirmeyen büyük iş kalmadı: sıradakiler
   Eren'e bağlı (Benim Şehrim Excel'i, nöbetçi eczane onayı, Expo hesabı / EAS ile telefon sürümü; Blaze 6 Kasım'da
   tamam, işlevler 7 Kasım'da yüklendi, harcama sigortasının iki ayarı Eren'de) ya da avukat teyidi isteyen haber
   yayıncısı başvurusu. Blaze ile artık yapılabilecekler:
   aktivite/etkinlik değişiklik bildirimleri, günlük sınırlar. (Kurum içerikleri tamam: profil, Mahalle Meydanı, aktiviteler, sabit duyuru.)
1. Telefonda deneme sürümü (Expo hesabı, EAS): SOS bildirimini ve arka plan konumunu gerçek telefonda denemek, QR okutma,
   Google/Apple girişi bununla gelir. Eren'den ücretsiz Expo hesabı ve erişim anahtarı gerekir.
2. Nöbetçi eczane: öneri hazır (`docs/oneri-nobetci-eczane.md`), Eren onaylayınca ekran, panel "Veri kaynakları"
   sayfası ve çekim kodu sahte sağlayıcıyla emülatörde yapılır; anahtarlar gelince bağlanır.
3. İşletme, 3. parça: belge yükleyerek doğrulama başvurusu (Firebase Storage; Blaze plan gerekir). ~~Fotoğraf vitrini~~ (31 Ekim).
4. ~~Paneli internete koyma~~ (31 Ekim, https://cityjoynew.web.app).

## PROJE.md bölümleri (gerektiğinde ilgili bölümü oku)

| Bölüm | Konu |
|---|---|
| 0-4 | Çalışma biçimi, uygulama, temel ilkeler (1.1 sürprizsiz bilgi, 1.2 tarafsızlık, 1.3 premium), diller, kayıt (3.1), konuma göre içerik |
| 5.1-5.4 | Benim Şehrim (emlak hukuku dahil), Seyahat, Sosyal Harmoni, Acil İhtiyaçlar |
| 5.5-5.12 | Keşfet, İşletmem, işletme kaydı, profil, Reels, Ara, Mesajlar, Bildirimler |
| 6-6.6 | Roller, panel mimarisi, belediye / il yöneticisi / admin paneli, onay merkezi, kurum içi personel |
| 7-9.1 | Filtreli bildirim, hukuk ve mağaza, teknik yaklaşım, veri havuzu ve maliyet |
| 10-12 | Yapım sırası, tasarım dosyaları, açık sorular |
| 13 | Tasarım değişiklik listesi |
| 14-15 | Gelir modeli, mağaza gereklilikleri, ödemeler |
| 16-18 | Yönetim şeması, ön yüz kuralı (görsel yön kararı), geçiş hazırlığı |
