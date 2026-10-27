# Nöbetçi eczane: veri kaynağı ve günlük güncelleme önerisi

> Durum: **öneri, Eren'in onayını bekliyor** (PROJE.md 5.1, 9.1, 12. madde 5).
> Hazırlayan: Claude, 27 Ekim 2026. Fiyatlar internet aramasından alındı; ödeme yapmadan önce sağlayıcının
> sitesinden doğrulanacak.

## Kısaca

1. **Veri kaynağı:** hazır bir nöbetçi eczane servisi (API) kullanalım. İlk tercih **NosyAPI**, yedek **CollectAPI**.
2. **Günlük çekim:** her sabah bir kez, 81 ilin listesi çekilip veritabanına yazılır. Kullanıcılar yalnızca
   veritabanından okur (maliyet ilkesi). Çekimi **GitHub Actions** (ücretsiz zamanlayıcı) yapar; Blaze plana
   geçilirse aynı iş Firebase'e taşınır.
3. **Tahmini maliyet:** ayda yaklaşık **6-13 dolar** (servis ücreti). Zamanlayıcı ve veritabanı ücretsiz kotada kalır.

## 1. Veri nereden gelecek?

Nöbet listesini il sağlık müdürlükleri onaylar, Türk Eczacıları Birliği (TEB) ve bölge eczacı odaları yayımlar.
e-Devlet'te de sorgulama ekranı var. Ama **resmi kurumların yazılımcılara açık bir servisi (API) yok** (araştırmada
bulunamadı). Bu yüzden üç yol var:

| Yol | Artısı | Eksisi | Öneri |
|---|---|---|---|
| **A. Hazır ücretli servis** (NosyAPI, CollectAPI vb.) | 81 il tek yerden, düzenli biçimde; çabuk kurulur | Aylık küçük ücret; veri doğruluğu servise bağlı | **Önerilen** |
| B. Eczacı odası sitelerinden okuma ("kazıma") | Ücretsiz | 54 ayrı site, sık bozulur; sitelerin kullanım şartları ve telif sorunu olabilir | Önerilmez |
| C. TEB ile resmi anlaşma | En güvenilir kaynak | Süreç uzun, sonucu belirsiz | İleride denenebilir (Eren'in ekibi yazışabilir) |

**Neden NosyAPI:** arama sonuçlarına göre aylık 500 ücretsiz deneme kredisi var (deneme için yeter),
ücretli paketler aylık 5.000 kredi 6 dolar, 20.000 kredi 13 dolar. İl/ilçe listesi sorguları ücretsiz.
Kesin bilgi için sitesinde doğrulanacaklar: bir sorgu kaç kredi düşüyor, tek sorguda bir ilin tamamı geliyor mu,
koordinat (harita için) veriliyor mu, ticari uygulamada kullanım izni.

**Hesap:** 81 il × günde 1 sorgu × 30 gün ≈ 2.430 kredi/ay → 5.000'lik paket (≈6 dolar) yeter.
Sorgu ilçe başına yapılmak zorundaysa (973 ilçe) maliyet artar; o zaman yalnızca kullanıcısı olan iller/ilçeler
çekilir (ilk sürümde çoğu il boş olacağı için bu da ucuz kalır).

Servis değişirse uygulama etkilenmez: çekim kodu servisi "çevirmen" (bağdaştırıcı) üzerinden okur, veritabanına hep
aynı biçimde yazar (veri katmanını tek sağlayıcıya bağlamama ilkesi).

## 2. Günlük güncelleme nerede çalışacak?

Firebase'in ücretsiz Spark planında zamanlanmış iş yok. İki seçenek:

| Seçenek | Ne gerekir | Maliyet | Öneri |
|---|---|---|---|
| **GitHub Actions** (deponun içindeki ücretsiz zamanlayıcı) | Firebase'den bir "hizmet hesabı anahtarı" ve servis anahtarı, GitHub'da gizli ayar olarak saklanır (koda girmez) | Ücretsiz (gizli depoda ayda 2.000 dakika; bu iş ayda ~60 dakika) | **Şimdilik önerilen** |
| Firebase Blaze plan + zamanlanmış işlev | Kredi kartı tanımlamak | Bu iş için büyük olasılıkla 0 (ücretsiz kota içinde); karta bütçe uyarısı konur | Blaze'e geçince buraya taşınır |

Blaze plan zaten başka işler için de gerekecek (yönetici iki aşamalı doğrulama, fotoğraf yükleme, SMS). Eren
Blaze'e geçmeye karar verirse çekimi doğrudan Firebase'de kurarız, GitHub Actions'a gerek kalmaz.

**Zamanlama:** nöbet genelde sabah 08:30-09:00'da değişir. Çekim her sabah **08:15'te** (Türkiye saati) çalışır.
GitHub'ın zamanlayıcısı yoğunlukta birkaç dakika gecikebilir; bu yüzden **10:00'da ikinci bir deneme** çalışır ve
yalnızca ilk turda başarısız olan illeri tekrar çeker (ek maliyet yok denecek kadar az). Not: nöbet değişim saatini
ve servisin listeyi ne zaman yenilediğini deneme kredisiyle bir hafta izleyip saatleri ona göre ayarlarız.

## 3. Uygulamada nasıl görünecek?

- Acil İhtiyaçlar > **Nöbetçi eczane** (şu an "yakında"): kullanıcının ilindeki (önce kendi ilçesi) nöbetçi eczaneler.
  Her kartta ad, ilçe, adres, telefon (**Ara**), **Haritada aç**, konum izni varsa uzaklık.
- Üstte **"Son güncelleme: bugün 08:16"**. Liste bugüne ait değilse sarı uyarı: "Liste güncel olmayabilir,
  eczaneyi arayarak teyit edin" (PROJE.md 9.1). Hiç veri yoksa en yakın eczacı odası/e-Devlet yönlendirmesi ve 112 notu.
- **Maliyet:** kullanıcı günde en fazla bir kez kendi ilinin belgesini okur (tek okuma), liste telefonda saklanır.
- Misafir gezinti önerisi (3.1) onaylanırsa bu ekran girişsiz de açılır.

## 4. Panelde karşılığı (panel ilkesi)

- **Veri kaynakları** sayfası (PROJE.md 6.4, 13. satır): her il için son başarılı çekim, kaç eczane geldi, hata
  varsa nedeni. Bugün çekilemeyen iller kırmızı görünür.
- **"Şimdi yeniden çek"** düğmesi (admin): bir ili ya da tüm illeri elle günceller.
- **Düzeltme notu** (admin / il yöneticisi): servis yanlış bilgi verirse bir eczaneyi o gün için gizleme ya da not
  ekleme; işlem kaydına yazılır. İl yöneticisi yalnızca kendi ilini görür.
- Servis anahtarı panelde görünmez, yalnızca sunucu tarafında (GitHub gizli ayarı / Firebase) durur.

## 5. Teknik özet (Claude için)

- Firestore: `dutyPharmacies/{ilKodu}` → `{ date: 'YYYY-MM-DD', fetchedAt, source, items: [{ name, district,
  address, phone, lat?, lng? }], hidden: [...] }`. Herkes okur, yalnızca sunucu (hizmet hesabı) ve admin yazar.
  `dataSourceRuns/{runId}` → çekim kayıtları (panel durumu için).
- Çekim betiği: `scripts/pharmacy-sync` (Node, `firebase-admin`), sağlayıcı bağdaştırıcısı `packages/shared` içinde
  ortak tip ile. Ortam değişkenleri: `PHARMACY_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`.
- `.github/workflows/pharmacy-sync.yml`: `cron: '15 5 * * *'` ve `'0 7 * * *'` (UTC = 08:15 ve 10:00 TR).
- Emülatörle denemek için örnek veriyle çalışan "sahte sağlayıcı".

## Eren'den gerekenler (onaylarsan)

1. Öneriyi onayla ya da değiştir: **NosyAPI + GitHub Actions** mı, yoksa doğrudan **Blaze** mı?
2. NosyAPI'de ücretsiz hesap açıp **API anahtarını** ortam ayarına eklemek (sohbete yapıştırma). Ücretli paket,
   bir hafta denedikten sonra.
3. GitHub Actions seçilirse: Firebase konsolundan hizmet hesabı anahtarı indirip GitHub deposunun gizli ayarlarına
   eklemek (adım adım anlatacağım).

Bu adımlar beklenirken ekranı, panel sayfasını ve çekim kodunu sahte sağlayıcıyla emülatörde hazırlayabilirim;
anahtarlar gelince yalnızca bağlamak kalır.
