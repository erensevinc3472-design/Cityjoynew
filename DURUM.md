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
| `packages/shared` | Ortak: 5 dil metinleri (`src/i18n/locales`), konum verisi, yetki, veri yapıları, hizmet arayüzleri, Firebase uygulaması (`src/firebase`, `@cityjoy/shared/firebase` olarak alınır) |
| `firebase/` | `firestore.rules` ve emülatör testleri |
| `tasarim/` | Eren'in 135 tasarım HTML dosyası. İçerikleri değiştirilmez (`CLAUDE.md`) |
| `docs/stil-rehberi.md` | Renk, yazı tipi, bileşen kuralları (görsel yön kararı) |

## Komutlar

```sh
npm install
npm test                      # ortak paket testleri (19)
npm run test:rules            # güvenlik kuralları + depo testleri, emülatörde (13; Java gerekir)
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

## Bu oturumlarda alınan kararlar (PROJE.md'ye işlendi)

- Yetkiyi yalnızca admin verir; il yöneticisi talep açar (6, 6.5).
- Onay gereken işler önce il yöneticisi, sonra admin; admin panelinde "Bekleyen onaylar" ekranı, "Tümünü onayla",
  "Güvenli olanları onayla" ve şehir/ilçe/kategori kapsamlı güvenilir yöneticiler listesi (6.5).
- Belediyeler kendi alanında; büyükşehir ilçe içeriğini düzenleyemez (6).
- İşletmeler için ayrı panel yok, uygulamadaki İşletmem kullanılır (6).
- Kurum kendi personeline sınırlar içinde görev verir (kurum yöneticisi); belediye paneli 18. madde ilk sürümde (6.6).
- Görsel yön: koyu A, açık C (17).

## Açık işler ve bilinen eksikler

- Telefonda Google ile giriş ve "Apple ile giriş" yok: geliştirme derlemesi (EAS, Expo hesabı) gerekiyor.
- Yönetici iki aşamalı doğrulaması: Firebase Blaze (ücretli) plan gerekiyor.
- Yasal metinler boş (yalnızca "avukat kontrolünden geçecek" notu).
- Misafir gezinti, telefon doğrulaması: `PROJE.md` 3.1'de onay bekleyen öneriler.
- Panelde onay merkezi, yetki atama ve personel ekranları yok (veri yapıları hazır).
- Panel ve web sürümü internette yayında değil (Firebase Hosting için dağıtım anahtarı gerekir).
- Ana sayfadaki arama kutusu ve "Bugün" bölümü (duyuru, hava durumu) ilgili özelliklerle gelecek.
- `tasarim/firebase-config.js` ve `tasarim/belediye-panel-osmangazi.html` eski `cityjoy-d5d29` projesinin
  bağlantı bilgilerini içeriyor; Eren'e o projeyi kapatması önerildi.

## Sıradaki adım (Eren seçecek)

1. Telefonda deneme sürümü (Expo hesabı, EAS).
2. Paneli internete koyma (Firebase Hosting).
3. İlk gerçek modül: Acil İhtiyaçlar (acil numaralar, nöbetçi eczane veri havuzu, SOS), panel karşılığıyla birlikte.

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
