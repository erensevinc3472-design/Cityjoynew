# CityJoy: güncel durum (oturumlar arası özet)

> Her oturumun başında `CLAUDE.md`'den sonra bunu oku. `PROJE.md` uzundur (yaklaşık 50 bin token);
> baştan sona okuma, yalnızca üzerinde çalışılan konunun bölümünü oku (bölüm listesi en altta).
> Bir iş bitince bu dosyayı güncelle: "Yapılanlar", "Açık işler" ve "Sıradaki adım" bölümleri.

Son güncelleme: 28 Ekim 2026 (tasarım uygulaması ilk dalga; önceki: OSM iskeleti, Bildirim merkezi).

> **Eren'in bilgisayarında çalışma (28 Ekim):** `Desktop\Cityjoynew-main` artık GitHub deposunun git kopyası (`origin`,
> `core.autocrlf=false`). Her iş `claude/...` dalında; bu bilgisayarda `gh` yok, git Eren'in tarayıcıdan verdiği GitHub
> girişiyle gönderir, PR'ı Eren bağlantıdan açıp birleştirir (20. madde PR #6). Sistem Java'sı 8; kural testleri için
> Temurin JDK 21 zip olarak `%TEMP%\cj-jdk21` klasörüne açıldı (kurulmadı): `JAVA_HOME` ve `PATH` o klasörü gösterecek
> şekilde ayarlanıp `npm run test:rules`. Klasör silinmişse yeniden indirilir. Kurallar Eren'in bilgisayarından yüklenir:
> `npx firebase-tools@15.34.1 deploy --only firestore:rules,firestore:indexes --project cityjoynew` (giriş kayıtlı).

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
npm test                      # ortak paket testleri (106)
npm run test:rules            # güvenlik kuralları + depo testleri, emülatörde (98; Java 21 gerekir)
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
   gönderilerdeki ada yansımaz. PR #11 birleşti, kurallar yüklendi (Eren, 28 Ekim).

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

## Bu oturumlarda alınan kararlar (PROJE.md'ye işlendi)

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
- **Kurallar ve dizinler 28 Ekim'de yüklendi** (etkinlikler ve resmî profiller dahil, PR #6 birleştikten sonra, Eren'in
  bilgisayarından). Derlemedeki 7 "Invalid type ... null" uyarısı `get(..., null)` kalıbından, zararsız.
- **Güvenlik kuralları ve dizinler 27 Ekim 2026'da Firebase'e yüklendi** (Eren, kendi bilgisayarından:
  `npx firebase-tools@15.34.1 deploy --only firestore:rules,firestore:indexes --project cityjoynew`). Kurallar ya da
  dizinler her değiştiğinde aynı komutla yeniden yüklenmeli; Eren'e hatırlat.
- Acil İhtiyaçlar'ın kalanı: nöbetçi eczane, asistan, taksi durağı (SOS ve hizmetler yapıldı).
- Hizmet önerileri: admin hepsini, il yöneticisi kendi ilininkileri görür ve inceler. Günlük gönderim
  sınırı ve hesap silinince kullanıcının önerilerinin silinmesi sunucu işleviyle eklenecek (Blaze plan gerektirir).
- **SOS bildirimi ve arka plan konumu telefonda denenmedi:** kod hazır, ama Expo push adresi için `app.json` içinde EAS proje
  kimliği (`extra.eas.projectId`) gerekir; `eas init` ile gelir. Telefonda denenecekler: kilitli ekranda bildirim sesi,
  uygulama kapalıyken konum güncellemesi, bildirime dokununca SOS ekranı. Expo push güvenliği: bildirim adresleri yalnızca aile
  üyelerine açık; ileride Expo erişim anahtarıyla sunucudan gönderime geçilebilir (Blaze). Sonra: QR'ı kamerayla okutma
  (expo-camera), fotoğraf/ses ekleme (Storage, Blaze), "ID ile istek" yöntemi, iOS "kritik uyarı" başvurusu (isteğe bağlı).
- **SOS kayıtlarının 30 gün sonra kendiliğinden silinmesi (TTL `sosAlerts.deleteAt`) ücretsiz planda yok:** 27 Ekim'de
  yüklerken Firebase "billing disabled" dedi, ayar indexes dosyasından çıkarıldı. `deleteAt` alanı yazılmaya devam ediyor;
  Blaze plana geçilince `firestore.indexes.json` > `fieldOverrides` içine TTL geri eklenecek (ya da gönderen kendi eski
  kayıtlarını uygulamadan silecek). Gizlilik metninde "30 gün" sözü buna göre yazılmalı.
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
- Panel ve web sürümü internette yayında değil (Firebase Hosting için dağıtım anahtarı gerekir).
- Ana sayfadaki arama kutusu ve hava durumu ilgili özelliklerle gelecek (duyurular ana sayfada).
- `tasarim/firebase-config.js` ve `tasarim/belediye-panel-osmangazi.html` eski `cityjoy-d5d29` projesinin
  bağlantı bilgilerini içeriyor; Eren'e o projeyi kapatması önerildi.

## Sıradaki adım (Eren seçecek)

0. Benim Şehrim: Eren'in Excel'i gelince kaynak kontrolü + yükleme (ekranlar hazır). OSM iskeleti (31. madde) başlangıç
   olarak kullanılabilir. Sonra aynı yöntemle Seyahat şablonu
   (Keşfet ve Öğren şehir bilgileri). Kullanıcının "bilgi hatası bildir" düğmesi ve belediyenin kendi ilçesini düzenlemesi sonra.
0a. 30. madde (Bildirim merkezi): Eren PR'ı birleştirince kurallar ve dizinler yüklenmeli (1 yeni dizin). Admin Panel >
   Moderasyon'dan yasaklı kelime listesini (26. madde) ve isterse önerilen aramaları (28. madde) doldurmalı.
0b. Keşfet'in kalanı: fotoğraf/video (Storage, Blaze). Kalan ekranların tasarım uygulaması (32. madde: liste ve
   ayrıntı ekranları, formlar) Claude'un ölçütleriyle sürüyor. Blaze ve Eren gerektirmeyen büyük iş kalmadı: sıradakiler
   Eren'e bağlı (Benim Şehrim Excel'i, nöbetçi eczane onayı, Expo hesabı / EAS ile telefon sürümü, Blaze plana geçiş)
   ya da avukat teyidi isteyen haber yayıncısı başvurusu. Blaze isteyenler:
   aktivite/etkinlik değişiklik bildirimleri, günlük sınırlar. (Kurum içerikleri tamam: profil, Mahalle Meydanı, aktiviteler, sabit duyuru.)
1. Telefonda deneme sürümü (Expo hesabı, EAS): SOS bildirimini ve arka plan konumunu gerçek telefonda denemek, QR okutma,
   Google/Apple girişi bununla gelir. Eren'den ücretsiz Expo hesabı ve erişim anahtarı gerekir.
2. Nöbetçi eczane: öneri hazır (`docs/oneri-nobetci-eczane.md`), Eren onaylayınca ekran, panel "Veri kaynakları"
   sayfası ve çekim kodu sahte sağlayıcıyla emülatörde yapılır; anahtarlar gelince bağlanır.
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
