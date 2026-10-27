# CityJoy stil rehberi

Kaynak: `tasarim/` klasöründeki tasarım dosyaları (Eren'in örnekleri) ve Eren'in seçtiği görsel yön
(`PROJE.md` bölüm 17). Uygulamadaki karşılığı: `apps/mobile/src/theme/tokens.ts`.

## Görsel yön (Karar, Eren)

- **Koyu mod = A "Gece ve Altın":** koyu petrol yeşili zemin, düz koyu kartlar, ana vurgu altın.
- **Açık mod = C "Karma":** ekranın üst bandı koyu petrol yeşili ve altın (marka hissi), içerik açık
  zeminde beyaz kartlarla (okunaklılık). Ana düğme petrol yeşili.
- Uygulama telefonun ayarına uyar. Kullanıcı Hesabım > Görünüm'den "Açık" ya da "Koyu"yu sabitleyebilir.

## İlkeler

- **Tek yazı tipi ailesi:** başlık ve düğme Plus Jakarta Sans (600-700), gövde Inter (400-600).
- **Az efekt:** parlama, renk geçişi ve yoğun gölge yok. Açık modda kartlarda çok hafif gölge.
- **Tek renk simgeler:** simge kutuları ana rengin açık tonunda. Gökkuşağı renkli kutular yok.
  İstisna: acil öğeler kırmızı tonda.
- **Okunaklılık:** gövde metni en az 15-16, açıklama en az 13. Küçük büyük harfli yazı yalnızca bölüm
  etiketlerinde. Metin ve zemin kontrastı WCAG AA (en az 4.5:1).
- **Sürprizsiz bilgi:** bilgi kartlarında kaynak ve son güncelleme görünür (ör. "Kaynak: ... · bugün 08.00").

## Renkler

| Rol | Koyu (A) | Açık (C) |
|---|---|---|
| Zemin | `#0B2328` | `#F4F5F1` |
| Kart | `#123238` | `#FFFFFF` |
| Giriş alanı zemini | `#163C43` | `#FFFFFF` |
| Kenarlık | beyaz %7 | `#E3E8E6` |
| Başlık / ana metin | `#EAF1F1` | `#14262B` |
| İkincil metin | `#A3B9BB` | `#56696D` |
| Soluk metin | `#7F9799` | `#7A8B8E` |
| Ana renk (düğme, seçili) | altın `#E2B277` | petrol `#0E4F57` |
| Ana renk üstündeki yazı | `#1A1408` | `#FFFFFF` |
| Simge kutusu zemini | altın %12 | `#E3EEEC` |
| Üst bant | zeminle aynı | `#0B2E33` |
| Üst bant vurgusu | altın `#E2B277` | altın `#E2B277` |
| Başarı (açık, onaylı) | `#4FD1A5` | `#16855F` |
| Hata, acil | `#F87171` | `#C0392B` |
| Duyuru kutusu | altın %10 zemin | `#FFF6E8` zemin, `#F0D2A2` kenar |

## Biçim

- **Köşe yuvarlaklığı:** kart 18, liste satırı ve alan 14-16, simge kutusu 12, düğme ve rozet tam yuvarlak.
- **Boşluk:** 4, 8, 12, 16, 20, 24, 32. Ekran kenar boşluğu 20.
- **Simgeler:** Material, yuvarlak hatlı, ince çizgi; seçili alt menü simgesi dolu.

## Bileşenler

- **Üst bant:** geri / menü düğmesi, ortada başlık, sağda işlem düğmesi; altında konum çipi.
- **Ana düğme:** ana renk zemin, hap biçimi. **İkincil:** kart zemini + kenarlık, ana renk yazı.
  **Metin düğmesi:** yalnızca ana renk yazı.
- **Modül kartı:** simge kutusu, kalın başlık, iki satıra kadar açıklama.
- **Liste satırı:** kart zemini, başlık + açıklama, sağda ok; seçiliyse simge kutusu tonunda zemin.
- **Rozet:** küçük hap, yumuşak zemin + aynı renkte yazı (650 m, Açık, 7/24).
- **Duyuru kutusu:** sıcak tonlu zemin, başlık, metin, kaynak ve zaman.
- **Bilgi kutusu:** simge kutusu tonunda zemin, doğrulama simgesi, kaynak ve teyit notu.

## Eski tasarımlardan farklar

1. Giriş ve kayıt ekranları da diğer ekranlarla aynı tema kullanır (gri cam kart yok).
2. Şifre kuralı 8 karakter (tasarımda 6).
3. Marka "CityJoy" yazılır ("CİTYJOY" değil).
4. Space Grotesk, Public Sans, Cinzel, Outfit ve Playfair kullanılmaz.
5. "Premium", "Lüks" ifadeleri kullanılmaz (`PROJE.md` bölüm 1.3 ve 13).
