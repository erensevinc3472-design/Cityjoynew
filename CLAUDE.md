# CityJoy: Claude Code çalışma notları

Bu dosya proje klasörünün kökünde durur. Claude Code her oturumda önce bunu, sonra `PROJE.md` dosyasını okur.

## İlk adım
- `PROJE.md` dosyasını baştan sona oku. Projenin tüm kararları, önerileri ve açık soruları orada.
- "Karar (Eren)" ve "Eren onayladı" işaretli yerler kesindir.
- "SORULACAK" işaretli yerlerde kendin karar verme, Eren'e sor.
- Onayı beklenen öneriler kesin sayılmaz.

## Eren ile çalışma biçimi
- Eren'in kodlama bilgisi yok. Sade Türkçe konuş, her adımda ne yaptığını ve nasıl deneyebileceğini anlat. Komut çalıştırmadan önce ne yapacağını kısaca söyle.
- Küçük adımlarla ilerle. Her aşamada çalışan bir hâl göster. Büyük kararlardan önce planı anlat.
- Standart uygulama gereklilikleri (Apple App Store, Google Play, KVKK, güvenlik, erişilebilirlik; `PROJE.md` bölüm 15) Eren'e sorulmadan eklenir.
- Hukuki konularda `PROJE.md`'de belirtilen avukat uyarılarını koru. Avukat/mali müşavir soru listesini yalnızca Eren isterse hazırla.

## Mimari ilkeler
- **Panel ilkesi:** Her özellik, yönetim panelindeki karşılığıyla birlikte yapılır (bölüm 6.1). Panel hazır değilse özellik bitmiş sayılmaz.
- **Konuma göre içerik:** İçerik veritabanından gelir, il/ilçe/mahalleye bağlıdır. Tasarımlardaki Bursa'ya sabit içerik örnektir.
- **Maliyet ilkesi:** Dış kaynaklardan her kullanıcı isteğinde veri çekilmez. Zamanlanmış çekimle veri havuzuna yazılır (bölüm 9.1). Nöbetçi eczane günlüktür.
- **Güvenlik:** API anahtarları, şifreler ve kimlik belgeleri koda gömülmez, repoya konmaz (ortam değişkenleri kullan). Yetki kontrolü sunucuda yapılır, yalnızca ekranda gizlemek yetmez. Veri tabanı güvenlik kurallarını kur.
- **Yetki:** Rol × bölge × modül × eylem matrisi (bölüm 6). Her yönetici işlemi kayıt altında olur.
- **Ödeme sistemi ilk sürümde yok** (bölüm 15.2), ama kademe ve bitiş tarihi alanları veri yapısında hazır olsun.
- **Beş dil** (Türkçe, İngilizce, Almanca, Arapça, Rusça), Arapça için sağdan sola yerleşim. Metinler dil dosyalarından gelir.

## Tasarım dosyaları
- Tasarım HTML dosyaları Eren'in örnekleridir. Tasarım değişiklik listesi `PROJE.md` bölüm 13'tedir. Tasarım çalışması bitince toplu uygulanır, o zamana kadar tasarım dosyalarını değiştirme.
- Marka yazımı: **CityJoy** (Seyahat alt adı TravelJoy).
- Ön yüzde görsel kimliği koru (renk, yazı tipi, yerleşim). Standart kalite iyileştirmelerini (tutarlı bileşenler, durum ekranları, erişilebilirlik, Arapça RTL, farklı ekran boyutları) sormadan yap. Görünümü belirgin biçimde değiştiren bir şeyi önce Eren'e göster (`PROJE.md` bölüm 17).
- Teknik seçim: React Native + Expo (TypeScript), web yönetim panelleri React, arka uç Firebase. Veri katmanını Firebase'e sıkı bağlamadan ayrı tut. Eren teknik kararları sana bıraktı, değiştirirsen sade Türkçe bildir.
