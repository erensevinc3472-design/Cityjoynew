# CityJoy: güncel durum (oturumlar arası özet)

> Her oturumun başında `CLAUDE.md`'den sonra bunu oku. `PROJE.md` uzundur (yaklaşık 50 bin token);
> baştan sona okuma, yalnızca üzerinde çalışılan konunun bölümünü oku (bölüm listesi en altta).
> Bir iş bitince bu dosyayı güncelle: "Yapılanlar", "Açık işler" ve "Sıradaki adım" bölümleri.

Son güncelleme: 27 Ekim 2026.

## Depo ve ortam

- GitHub: `erensevinc3472-design/Cityjoynew` (gizli), dal `main`. Eski `cityjoy` deposu kullanılmıyor.
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
| `packages/shared` | Ortak: 5 dil metinleri (`src/i18n/locales`), konum verisi, acil numaralar (`src/emergency`), hizmet kategorileri (`src/categories`), işletmeler ve sıralama (`src/business`), SOS ve aile (`src/sos`), yetki, veri yapıları, hizmet arayüzleri, Firebase uygulaması (`src/firebase`, `@cityjoy/shared/firebase` olarak alınır) |
| `firebase/` | `firestore.rules` ve emülatör testleri |
| `tasarim/` | Eren'in 135 tasarım HTML dosyası. İçerikleri değiştirilmez (`CLAUDE.md`) |
| `docs/stil-rehberi.md` | Renk, yazı tipi, bileşen kuralları (görsel yön kararı) |

## Komutlar

```sh
npm install
npm test                      # ortak paket testleri (43)
npm run test:rules            # güvenlik kuralları + depo testleri, emülatörde (26; Java gerekir)
npm run typecheck
npm run env:write             # FIREBASE_WEB_CONFIG -> apps/*/.env.local
npm run locations:build       # PTT verisinden il/ilçe/mahalle dosyalarını üret
# Mobil web sürümü: cd apps/mobile && EXPO_OFFLINE=1 CI=1 npm run export:web  (dist/)
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

## Bu oturumlarda alınan kararlar (PROJE.md'ye işlendi)

- Yetkiyi yalnızca admin verir; il yöneticisi talep açar (6, 6.5).
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

- Telefonda Google ile giriş ve "Apple ile giriş" yok: geliştirme derlemesi (EAS, Expo hesabı) gerekiyor.
- Yönetici iki aşamalı doğrulaması: Firebase Blaze (ücretli) plan gerekiyor.
- Yasal metinler boş (yalnızca "avukat kontrolünden geçecek" notu).
- Misafir gezinti, telefon doğrulaması: `PROJE.md` 3.1'de onay bekleyen öneriler.
- Panelde onay merkezi, yetki atama ve personel ekranları yok (veri yapıları hazır).
- **Güncel güvenlik kuralları Firebase'e yüklenmedi (Eren bilgisayardan yapacak; her oturum başında ona hatırlat):** `firebase/firestore.rules` değişti (acil numaralar eklendi). Konsola
  yüklenene kadar gerçek projede panelden acil numara kaydedilemez (uygulama gömülü listeyi gösterir).
- Acil İhtiyaçlar'ın kalanı: nöbetçi eczane, SOS (aile listesi, QR; bildirim için geliştirme derlemesi gerekir), asistan,
  taksi durağı. Hizmetlerde işletme listesi İşletmem (5.7) ile gelecek.
- Hizmet önerileri: şimdilik yalnızca admin görür (il yöneticisi yetki kayıtları gelince kendi ilini görecek). Günlük gönderim
  sınırı ve hesap silinince kullanıcının önerilerinin silinmesi sunucu işleviyle eklenecek (Blaze plan gerektirir).
- **Dizinler Firebase'e yüklenmedi:** `firebase/firestore.indexes.json` (işletme listesi, değerlendirme listesi, hesap
  silmede kullanıcının yorumlarını bulma). Gerçek projede
  kurallarla birlikte yüklenmeli; yüklenmezse hizmet listesi açılmaz. Konsoldan yüklemek zahmetli: `firebase deploy` için
  dağıtım anahtarı ya da Eren'in bilgisayarından tek komut gerekir (Eren'e sade anlatılacak).
- **SOS bildirimi ve arka plan konumu telefonda denenmedi:** kod hazır, ama Expo push adresi için `app.json` içinde EAS proje
  kimliği (`extra.eas.projectId`) gerekir; `eas init` ile gelir. Telefonda denenecekler: kilitli ekranda bildirim sesi,
  uygulama kapalıyken konum güncellemesi, bildirime dokununca SOS ekranı. Expo push güvenliği: bildirim adresleri yalnızca aile
  üyelerine açık; ileride Expo erişim anahtarıyla sunucudan gönderime geçilebilir (Blaze). Sonra: QR'ı kamerayla okutma
  (expo-camera), fotoğraf/ses ekleme (Storage, Blaze), "ID ile istek" yöntemi, iOS "kritik uyarı" başvurusu (isteğe bağlı).
- **Firestore TTL politikası** (`sosAlerts.deleteAt`, 30 gün) konsolda açılmalı; indexes dosyasında tanımlı.
- Değerlendirme: şikâyet sayısı eşiğinde otomatik geçici gizleme ve il yöneticisi kuyruğu, yasaklı kelime süzgeci, yorum
  bildirimi (işletmeye "yeni değerlendirme") sonraki adımlarda. "Arama kaydı" kişisel veridir: aydınlatma metnine eklenecek
  (avukat kontrolü). Aynı telefonla kayıtlı işletmenin "sahiplik talebi" akışı henüz yok (mesaj CityJoy ile iletişime yönlendiriyor).
- İşletme: fotoğraf/video vitrini (kademeye göre kapasite; Firebase Storage Blaze ister), yorum ve puan verme, telefonla
  sahiplik doğrulaması (SMS, Blaze), belge yükleme ve ücretli doğrulama, aynı işletmenin ikinci kaydını engelleme, kategoriye
  özel alanlar (konaklama, yeme-içme...), mobil ustalar için hizmet verdiği ilçeler, "bilgileriniz hâlâ doğru mu?" hatırlatması,
  işletme başına günlük ekleme sınırı. Panelde il yöneticisinin kendi ilini görmesi yetki kayıtlarıyla gelecek.
- SORULACAK: Nöbetçi eczane veri kaynağı (PROJE.md 5.1) ve günlük çekimin nerede çalışacağı (Firebase Spark planında
  zamanlanmış işlev yok: Blaze planı ya da GitHub Actions gibi ücretsiz bir zamanlayıcı).
- Panel ve web sürümü internette yayında değil (Firebase Hosting için dağıtım anahtarı gerekir).
- Ana sayfadaki arama kutusu ve "Bugün" bölümü (duyuru, hava durumu) ilgili özelliklerle gelecek.
- `tasarim/firebase-config.js` ve `tasarim/belediye-panel-osmangazi.html` eski `cityjoy-d5d29` projesinin
  bağlantı bilgilerini içeriyor; Eren'e o projeyi kapatması önerildi.

## Sıradaki adım (Eren seçecek)

1. Telefonda deneme sürümü (Expo hesabı, EAS): SOS bildirimini ve arka plan konumunu gerçek telefonda denemek, QR okutma,
   Google/Apple girişi bununla gelir. Eren'den ücretsiz Expo hesabı ve erişim anahtarı gerekir.
2. Nöbetçi eczane: Claude veri kaynağı ve günlük güncelleme için sade bir öneri hazırlayacak, Eren onaylayacak.
3. İşletme, 3. parça: belge yükleyerek doğrulama başvurusu ve fotoğraf vitrini (Firebase Storage; Blaze plan gerekir).
4. Paneli internete koyma (Firebase Hosting).

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
