# Benim Şehrim bilgileri: ChatGPT tarifi (8 Kasım 2026)

Bu tarif Bursa için yazıldı. Başka illerde "Bursa" yerine ilin adını yaz.

## Nasıl yapılır

1. ChatGPT'de yeni bir sohbet aç. Mümkünse **Deep research** ya da **İnternette ara** açık olsun. İnternete bakamazsa uydurur.
2. Masaüstündeki `CityJoy-Bursa-sehir-rehberi.xlsx` dosyasını sohbete ekle. Bu dosyada OpenStreetMap'ten gelen bir başlangıç var.
   Bu dosya yoksa `CityJoy-sablon-bos.xlsx` dosyasını ekle.
3. Önce aşağıdaki **ana tarifi** yapıştır.
4. Sonra **sekme tariflerini** sırayla, birer birer yapıştır. Her seferinde tek sekme işlenir.
5. Son Excel'i indir. Panel > Şehir rehberi > Bursa > Excel'den yükle ile yükle. Panel hataları satır satır gösterir.

## Ana tarif

```
Sen Türkiye'deki şehir bilgilerini resmî kaynaklardan derleyen dikkatli bir araştırmacısın.
Ekteki Excel, CityJoy uygulamasının Benim Şehrim şablonu. Her sekme bir bölüm. Sütun adları ve
ikinci satırdaki açıklamalar kuraldır.

Kurallar:
1. Yalnızca Bursa için çalış. Sütunları, sekme adlarını ve seçenek listelerini değiştirme.
2. Her satır için bilgiyi internette bul. "Kaynak" sütununa bilgiyi aldığın sayfanın tam adresini yaz
   (önce resmî site: valilik, belediye, bakanlık, AFAD, müze sitesi). "Kaynak tarihi" bugünün tarihi
   (GG.AA.YYYY). Kaynağını bulamadığın satırı ekleme.
3. Emin olmadığın hiçbir şeyi uydurma. Telefon, saat, ücret, enlem/boylam bilinmiyorsa hücreyi BOŞ bırak.
   Şüpheli satıra "Not" sütununda "teyit edilmeli" yaz.
4. Telefon yalnızca kurumun resmî numarası, sadece rakam. Kişisel cep numarası asla yazma.
5. Seçenekli sütunlarda yalnızca listedeki değeri kullan (örnek: hastane-devlet). Evet/Hayır sütunlarına
   "Evet" ya da "Hayır" yaz. Liste sütunlarında virgülle ayır. Adımları " | " ile ayır.
6. İl ve ilçe adlarını "İlçeler" sekmesindeki yazımla yaz (Osmangazi, Nilüfer, Yıldırım...).
7. Dosyada önceden olan satırları silme. Eksik hücrelerini kaynakla doldur, yanlışsa düzelt.
   Aynı yeri iki kez ekleme.
8. Her sekmeden sonra kısa bir özet ver: kaç satır eklendi, kaç satır düzeltildi, neler eksik kaldı.
   Sonra Excel dosyasını indirmem için hazırla.

Şimdilik sadece "anladım" de. Sekme sekme ilerleyeceğiz.
```

## Sekme tarifleri (her biri ayrı mesaj)

```
"Önemli Kurumlar" sekmesi: Bursa'nın 17 ilçesi için valilik, kaymakamlıklar, devlet hastaneleri ve
büyük özel hastaneler, emniyet müdürlüğü ve ilçe emniyetleri, itfaiye merkezleri, nüfus müdürlükleri,
göç idaresi, adliye, vergi daireleri, SGK merkezleri, il ve ilçe halk kütüphaneleri, halk eğitim
merkezleri. Önce merkez ilçeler (Osmangazi, Nilüfer, Yıldırım), sonra diğerleri.
```

```
"Müzeler" sekmesi: Bursa'daki tüm devlet, belediye ve özel müzeler. Açılış saatleri, kapalı gün,
bilet ücreti ve Müzekart bilgisi muze.gov.tr ve müzenin kendi sitesinden.
```

```
"Otoparklar" sekmesi: Bursa Büyükşehir ve ilçe belediyelerinin otoparkları (BBB otopark sayfası,
BURULAŞ) ve büyük AVM otoparkları. Ücret tarifesi resmî sayfada yoksa boş bırak.
```

```
"Parklar" sekmesi: Bursa'nın büyük parkları, millet bahçeleri, kent ormanları, mesire alanları,
botanik bahçesi. Belediye sitelerinden.
```

```
"Pazarlar" sekmesi: Bursa ilçe belediyelerinin semt pazarı listeleri (hangi gün, hangi mahallede).
Kapalı pazar yerleri, köylü/organik pazarlar ve balık pazarı.
```

```
"Ulaşım" sekmesi: BursaRay hatları, T1/T2 tramvay, teleferik, BUDO deniz otobüsü, havalimanı servisleri,
BursaKart bilgisi ve en çok kullanılan ana otobüs hatları. Ücretler BURULAŞ'ın güncel tarifesinden.
```

```
"Toplanma Alanları" sekmesi: AFAD'ın Bursa için yayımladığı afet ve acil durum toplanma alanları.
Mümkün olduğu kadar çok ilçe. Yalnızca AFAD ya da e-Devlet kaynaklı.
```

```
"Muhtarlıklar" sekmesi: Osmangazi, Nilüfer ve Yıldırım ilçe belediyelerinin sitelerindeki mahalle
muhtarlıkları. Muhtar adını yalnızca resmî sitede yayımlanmışsa yaz. Telefon yalnızca resmî
muhtarlık numarası, cep numarası asla yazılmaz.
```

```
"Belediye Hizmetleri" sekmesi: Bursa Büyükşehir, Osmangazi, Nilüfer ve Yıldırım belediyelerinin
e-belediye hizmetleri: ruhsat, emlak vergisi ödeme, su aboneliği, cenaze hizmetleri, sosyal yardım
başvurusu, kurslar, veteriner. Gerekli evrak ve başvuru bağlantısı belediyenin kendi sitesinden.
```

```
"Nasıl Yapılır" sekmesi (İl = Bursa): BursaKart nasıl alınır / indirimli kart, su aboneliği
açma, emlak vergisi ödeme, nöbetçi eczane bulma, Bursa'da ikametgâh, otopark aboneliği gibi Bursa'ya
özel pratik rehberler. Adımları " | " ile ayır.
```

## Son kontrol (en son mesaj)

```
Tüm sekmeleri bir kez daha kontrol et: kaynaksız satır, seçenek listesinde olmayan değer,
uydurma telefon ya da konum kalmasın. Son Excel dosyasını indirmem için ver.
```
