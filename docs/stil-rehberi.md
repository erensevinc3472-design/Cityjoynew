# CityJoy stil rehberi

Kaynak: `tasarim/` klasöründeki 135 tasarım dosyası (Eren'in örnekleri) ve `tasarim/cityjoy-core.css`.
Değerler tasarımlarda en sık kullanılanlardan çıkarıldı. Uygulamadaki karşılığı:
`apps/mobile/src/theme/tokens.ts` (mobil) ve `apps/panel/src/styles.css` (panel).

## Genel görünüm

- **Koyu tema:** koyu petrol yeşili zemin, yarı saydam kartlar, ince açık kenarlıklar.
- **Ana vurgu altın** (başlıklar, seçili sekme, ana düğme). **İkinci vurgu turkuaz** (bilgi, "canlı", bağlantılar).
- Büyük yuvarlak köşeler, yumuşak gölgeler, bol boşluk. Alt gezinme yüzen bir hap şeklinde.

## Renkler

| Ad | Değer | Kullanım |
|---|---|---|
| Zemin (derin) | `#081F24` | Sayfa zemini, alt gezinme |
| Zemin | `#0B2B2D` | Zemin geçişinin açık ucu |
| Kart | `#17464B` (%75 saydam) | Kartlar, liste satırları |
| Kart (koyu) | `#0D3238` | İç içe kart, giriş alanı zemini |
| Kenarlık | `#3F6E70` (%40 saydam) | Kart ve alan kenarları |
| Metin | `#C7D8DA` | Ana metin |
| Metin (ikincil) | `#9FB6B8` | Açıklamalar |
| Metin (soluk) | `#6E8C8E` | Küçük etiketler, pasif öğeler |
| Altın (ana vurgu) | `#E0B07A` | Başlık vurgusu, ana düğme, seçili öğe |
| Altın (koyu) | `#D9A066` | Basılı durum, simge çerçevesi |
| Altın yumuşak | `#E0B07A` %10-30 saydam | Seçili satır zemini, rozet zemini |
| Turkuaz | `#25C6CF` | Bilgi, bağlantı, "canlı" işareti |
| Yeşil (başarı) | `#10B981` | Açık, onaylı, doğrulanmış |
| Kırmızı (acil) | `#EF4444` | SOS, acil numaralar, hata |

Altın zemin üzerindeki yazı koyu (`#081F24`) olur. Kontrast oranı yaklaşık 9:1 (erişilebilirlik için yeterli).

## Yazı tipleri

| Rol | Yazı tipi |
|---|---|
| Başlık ve düğme | Plus Jakarta Sans (600-700) |
| Gövde metni | Inter (400-600) |
| Slogan vurgusu | Playfair Display, italik ("Senin *Keyfin*") |

Not: Tasarımlarda Space Grotesk, Public Sans, Cinzel ve Outfit de geçiyor. `PROJE.md` bölüm 11'e göre
Plus Jakarta Sans + Inter'de birleştirildi.

## Biçim

- **Köşe yuvarlaklığı:** kart 20, liste satırı ve alan 16, küçük öğe 12, düğme ve rozet tam yuvarlak (hap).
- **Boşluk:** 4, 8, 16, 24, 32. Kenar boşluğu 16-24.
- **Simgeler:** Material simgeleri (yuvarlak hatlı).
- **Kartlar:** yarı saydam kart rengi, %40 saydam kenarlık, hafif gölge.

## Bileşenler

- **Ana düğme:** altın zemin, koyu yazı, hap biçimi. **İkincil düğme:** kart zemini, altın kenarlık ve yazı.
  **Metin düğmesi:** yalnızca altın yazı.
- **Giriş alanı:** koyu kart zemini, kenarlık; odakta altın kenarlık; hata durumunda kırmızı kenarlık ve hata metni.
- **Liste satırı:** kart zemini, solda yuvarlak simge kutusu, sağda ok; seçiliyse altın yumuşak zemin.
- **Rozet:** küçük hap, yumuşak zemin + aynı renkte yazı (Kurumsal, Açık, 7/24).
- **Alt gezinme:** yüzen koyu hap; seçili sekme altın zeminli.

## Tasarımlarda görülen ve uygulamada düzeltilen tutarsızlıklar

Bunlar görünümü belirgin biçimde değiştirmeyen standart düzeltmelerdir (`PROJE.md` bölüm 17).
Görünümü değiştirenler önce Eren'e gösterilir.

1. Giriş ve kayıt ekranları gri cam kartla tasarlanmış, diğer ekranlar ise koyu petrol yeşili. Uygulamada
   bu ekranlar da koyu temayla tutarlı yapıldı (Eren'e gösterilecek).
2. Kayıt ekranında "en az 6 karakter" yazıyor. Kural 8 karakter (bölüm 13 madde 27).
3. "CİTYJOY" büyük harfle Türkçe İ ile yazılmış. Marka her yerde "CityJoy" (bölüm 13 madde 32).
4. Yazı tipleri sayfadan sayfaya değişiyor. Uygulamada tek bir yazı tipi çifti kullanılıyor.
5. "Premium şehir deneyimi", "Lüks rotalar" gibi ifadeler bölüm 1.3 ve 13'e göre gözden geçirilecek.

## Açık soru

Tasarımlar yalnızca koyu temalı. Uygulama da koyu tema ile açılıyor. Telefon açık temadaysa açık renkli
bir sürüm de sunulsun mu? (Eren'e soruldu.)
