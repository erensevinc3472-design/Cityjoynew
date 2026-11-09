# Bursa bilgileri: ayrı ayrı aramalar (8 Kasım 2026)

Her aramayı ChatGPT'de **ayrı bir sohbette** yap (İnternette ara ya da Deep research açık). Çıkan Excel'i Claude'a gönder; Claude denetleyip panele yüklenecek dosyayı hazırlar.
Muhtarlıklar tamam (1060 mahalle, 91 adres). 2. aramadan hastaneler geldi (46); aile sağlığı merkezleri eksik.

İşaretle: [ ] yapılmadı, [x] gönderildi.

- [ ] 1. Önemli Kurumlar: Valilik, 17 kaymakamlık, il müdürlükleri
- [ ] 2. Önemli Kurumlar: Devlet hastaneleri, şehir hastanesi, büyük özel hastaneler, aile sağlığı merkezleri (ilçe ilçe)
- [ ] 3. Önemli Kurumlar: Emniyet, jandarma, itfaiye, nüfus müdürlükleri, göç idaresi, adliye
- [ ] 4. Önemli Kurumlar: Vergi daireleri, SGK merkezleri, noterler, PTT şubeleri
- [ ] 5. Önemli Kurumlar: Halk kütüphaneleri, halk eğitim merkezleri
- [ ] 6. Önemli Kurumlar: Taksi durakları (tarife sütunu dahil)
- [x] 7. Müzeler: Bursa'daki tüm müzeler (muze.gov.tr, belediye müzeleri, özel müzeler)
- [x] 8. Otoparklar: Büyükşehir ve ilçe belediyesi otoparkları (BURULAŞ, belediye siteleri)
- [ ] 9. Otoparklar: AVM otoparkları
- [x] 10. Parklar: Büyük parklar, millet bahçeleri, kent ormanları, mesire alanları, botanik bahçesi
- [x] 11. Pazarlar: Semt pazarları ilçe ilçe (hangi gün, hangi mahalle)
- [ ] 12. Pazarlar: Kapalı pazar yerleri, köylü/organik pazarlar, balık hali
- [x] 13. Ulaşım: BursaRay, tramvay, teleferik, BUDO, havalimanı servisleri, BursaKart, ana otobüs hatları
- [x] 14. Toplanma Alanları: AFAD toplanma alanları, ilçe ilçe
- [ ] 15. Belediye Hizmetleri: Bursa Büyükşehir Belediyesi hizmetleri
- [ ] 16. Belediye Hizmetleri: Osmangazi, Nilüfer, Yıldırım belediyeleri hizmetleri
- [ ] 17. Belediye Hizmetleri: Diğer 14 ilçe belediyesinin başlıca hizmetleri
- [ ] 18. Nasıl Yapılır: Bursa'ya özel pratik rehberler (BursaKart, su aboneliği, emlak vergisi, otopark aboneliği, ikametgâh...)

### 1. Önemli Kurumlar: Valilik, 17 kaymakamlık, il müdürlükleri

```
Bursa için şunu araştır: Valilik, 17 kaymakamlık, il müdürlükleri.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Önemli Kurumlar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
kategori | ad | il | ilce | mahalle | adres | telefon | web | calisma_hafta_ici | calisma_hafta_sonu | aciklama | tarife | enlem | boylam | kaynak | kaynak_tarihi | not
kategori sütununda yalnızca şunlardan biri: valilik, kaymakamlik, il-mudurlugu, hastane-devlet, hastane-ozel, aile-sagligi-merkezi, emniyet, jandarma, itfaiye, nufus-mudurlugu, goc-idaresi, noter, ptt, vergi-dairesi, sgk, adliye, kutuphane, okul, halk-egitim, ibadethane, banka, atm, taksi-duragi, diger
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 2. Önemli Kurumlar: Devlet hastaneleri, şehir hastanesi, büyük özel hastaneler, aile sağlığı merkezleri (ilçe ilçe)

```
Bursa için şunu araştır: Devlet hastaneleri, şehir hastanesi, büyük özel hastaneler, aile sağlığı merkezleri (ilçe ilçe).
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Önemli Kurumlar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
kategori | ad | il | ilce | mahalle | adres | telefon | web | calisma_hafta_ici | calisma_hafta_sonu | aciklama | tarife | enlem | boylam | kaynak | kaynak_tarihi | not
kategori sütununda yalnızca şunlardan biri: valilik, kaymakamlik, il-mudurlugu, hastane-devlet, hastane-ozel, aile-sagligi-merkezi, emniyet, jandarma, itfaiye, nufus-mudurlugu, goc-idaresi, noter, ptt, vergi-dairesi, sgk, adliye, kutuphane, okul, halk-egitim, ibadethane, banka, atm, taksi-duragi, diger
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 3. Önemli Kurumlar: Emniyet, jandarma, itfaiye, nüfus müdürlükleri, göç idaresi, adliye

```
Bursa için şunu araştır: Emniyet, jandarma, itfaiye, nüfus müdürlükleri, göç idaresi, adliye.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Önemli Kurumlar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
kategori | ad | il | ilce | mahalle | adres | telefon | web | calisma_hafta_ici | calisma_hafta_sonu | aciklama | tarife | enlem | boylam | kaynak | kaynak_tarihi | not
kategori sütununda yalnızca şunlardan biri: valilik, kaymakamlik, il-mudurlugu, hastane-devlet, hastane-ozel, aile-sagligi-merkezi, emniyet, jandarma, itfaiye, nufus-mudurlugu, goc-idaresi, noter, ptt, vergi-dairesi, sgk, adliye, kutuphane, okul, halk-egitim, ibadethane, banka, atm, taksi-duragi, diger
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 4. Önemli Kurumlar: Vergi daireleri, SGK merkezleri, noterler, PTT şubeleri

```
Bursa için şunu araştır: Vergi daireleri, SGK merkezleri, noterler, PTT şubeleri.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Önemli Kurumlar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
kategori | ad | il | ilce | mahalle | adres | telefon | web | calisma_hafta_ici | calisma_hafta_sonu | aciklama | tarife | enlem | boylam | kaynak | kaynak_tarihi | not
kategori sütununda yalnızca şunlardan biri: valilik, kaymakamlik, il-mudurlugu, hastane-devlet, hastane-ozel, aile-sagligi-merkezi, emniyet, jandarma, itfaiye, nufus-mudurlugu, goc-idaresi, noter, ptt, vergi-dairesi, sgk, adliye, kutuphane, okul, halk-egitim, ibadethane, banka, atm, taksi-duragi, diger
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 5. Önemli Kurumlar: Halk kütüphaneleri, halk eğitim merkezleri

```
Bursa için şunu araştır: Halk kütüphaneleri, halk eğitim merkezleri.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Önemli Kurumlar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
kategori | ad | il | ilce | mahalle | adres | telefon | web | calisma_hafta_ici | calisma_hafta_sonu | aciklama | tarife | enlem | boylam | kaynak | kaynak_tarihi | not
kategori sütununda yalnızca şunlardan biri: valilik, kaymakamlik, il-mudurlugu, hastane-devlet, hastane-ozel, aile-sagligi-merkezi, emniyet, jandarma, itfaiye, nufus-mudurlugu, goc-idaresi, noter, ptt, vergi-dairesi, sgk, adliye, kutuphane, okul, halk-egitim, ibadethane, banka, atm, taksi-duragi, diger
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 6. Önemli Kurumlar: Taksi durakları (tarife sütunu dahil)

```
Bursa için şunu araştır: Taksi durakları (tarife sütunu dahil).
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Önemli Kurumlar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
kategori | ad | il | ilce | mahalle | adres | telefon | web | calisma_hafta_ici | calisma_hafta_sonu | aciklama | tarife | enlem | boylam | kaynak | kaynak_tarihi | not
kategori sütununda yalnızca şunlardan biri: valilik, kaymakamlik, il-mudurlugu, hastane-devlet, hastane-ozel, aile-sagligi-merkezi, emniyet, jandarma, itfaiye, nufus-mudurlugu, goc-idaresi, noter, ptt, vergi-dairesi, sgk, adliye, kutuphane, okul, halk-egitim, ibadethane, banka, atm, taksi-duragi, diger
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 7. Müzeler: Bursa'daki tüm müzeler (muze.gov.tr, belediye müzeleri, özel müzeler)

```
Bursa için şunu araştır: Bursa'daki tüm müzeler (muze.gov.tr, belediye müzeleri, özel müzeler).
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Müzeler
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
tur | ad | il | ilce | mahalle | adres | telefon | web | acilis_saatleri | kapali_gunler | ucret_durumu | tam_ucret_tl | indirimli_ucret_tl | muzekart_gecerli | aciklama | enlem | boylam | kaynak | kaynak_tarihi | not
tur sütununda yalnızca şunlardan biri: tarih, arkeoloji, sanat, sanayi, kultur, etnografya, bilim, kent, diger
ucret_durumu sütununda yalnızca şunlardan biri: Ücretsiz, Ücretli
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 8. Otoparklar: Büyükşehir ve ilçe belediyesi otoparkları (BURULAŞ, belediye siteleri)

```
Bursa için şunu araştır: Büyükşehir ve ilçe belediyesi otoparkları (BURULAŞ, belediye siteleri).
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Otoparklar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
tip | ad | isletici | il | ilce | mahalle | adres | telefon | web | kapasite | ilk_saat_tl | ek_saat_tl | gunluk_en_fazla_tl | aylik_abonelik_tl | calisma_hafta_ici | calisma_hafta_sonu | odeme_yontemleri | engelli_ucretsiz | ozellikler | enlem | boylam | kaynak | kaynak_tarihi | not
tip sütununda yalnızca şunlardan biri: kapali, acik, katli, yeralti, avm
isletici sütununda yalnızca şunlardan biri: Belediye, Özel
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 9. Otoparklar: AVM otoparkları

```
Bursa için şunu araştır: AVM otoparkları.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Otoparklar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
tip | ad | isletici | il | ilce | mahalle | adres | telefon | web | kapasite | ilk_saat_tl | ek_saat_tl | gunluk_en_fazla_tl | aylik_abonelik_tl | calisma_hafta_ici | calisma_hafta_sonu | odeme_yontemleri | engelli_ucretsiz | ozellikler | enlem | boylam | kaynak | kaynak_tarihi | not
tip sütununda yalnızca şunlardan biri: kapali, acik, katli, yeralti, avm
isletici sütununda yalnızca şunlardan biri: Belediye, Özel
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 10. Parklar: Büyük parklar, millet bahçeleri, kent ormanları, mesire alanları, botanik bahçesi

```
Bursa için şunu araştır: Büyük parklar, millet bahçeleri, kent ormanları, mesire alanları, botanik bahçesi.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Parklar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
tur | ad | il | ilce | mahalle | adres | acilis_saatleri | olanaklar | engelli_erisimi | aciklama | enlem | boylam | kaynak | kaynak_tarihi | not
tur sütununda yalnızca şunlardan biri: park, millet-bahcesi, kent-ormani, mesire-alani, botanik-bahcesi
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 11. Pazarlar: Semt pazarları ilçe ilçe (hangi gün, hangi mahalle)

```
Bursa için şunu araştır: Semt pazarları ilçe ilçe (hangi gün, hangi mahalle).
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Pazarlar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
tur | ad | il | ilce | mahalle | adres | gunler | saatler | kapali_alan | urunler | enlem | boylam | kaynak | kaynak_tarihi | not
tur sütununda yalnızca şunlardan biri: semt-pazari, koylu-pazari, organik-pazar, bit-pazari, balik-pazari
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 12. Pazarlar: Kapalı pazar yerleri, köylü/organik pazarlar, balık hali

```
Bursa için şunu araştır: Kapalı pazar yerleri, köylü/organik pazarlar, balık hali.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Pazarlar
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
tur | ad | il | ilce | mahalle | adres | gunler | saatler | kapali_alan | urunler | enlem | boylam | kaynak | kaynak_tarihi | not
tur sütununda yalnızca şunlardan biri: semt-pazari, koylu-pazari, organik-pazar, bit-pazari, balik-pazari
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 13. Ulaşım: BursaRay, tramvay, teleferik, BUDO, havalimanı servisleri, BursaKart, ana otobüs hatları

```
Bursa için şunu araştır: BursaRay, tramvay, teleferik, BUDO, havalimanı servisleri, BursaKart, ana otobüs hatları.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Ulaşım
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
tur | il | hat_kodu | ad | baslangic | bitis | durak_sayisi | ilk_sefer | son_sefer | sefer_sikligi | tam_ucret_tl | ogrenci_ucret_tl | kart_adi | isletici | web | aciklama | kaynak | kaynak_tarihi | not
tur sütununda yalnızca şunlardan biri: metro, tramvay, banliyo, otobus-hatti, teleferik, vapur, dolmus, bisiklet, ulasim-karti, havalimani-servisi
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 14. Toplanma Alanları: AFAD toplanma alanları, ilçe ilçe

```
Bursa için şunu araştır: AFAD toplanma alanları, ilçe ilçe.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Toplanma Alanları
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
ad | il | ilce | mahalle | adres | kapasite_kisi | enlem | boylam | kaynak | kaynak_tarihi | not

Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 15. Belediye Hizmetleri: Bursa Büyükşehir Belediyesi hizmetleri

```
Bursa için şunu araştır: Bursa Büyükşehir Belediyesi hizmetleri.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Belediye Hizmetleri
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
il | belediye | kategori | hizmet_adi | aciklama | gerekli_evrak | ucret | basvuru_baglantisi | telefon | kaynak | kaynak_tarihi | not
kategori sütununda yalnızca şunlardan biri: imar-ruhsat, vergi-odeme, su-altyapi, temizlik, zabita, sosyal-yardim, kultur-sanat, spor, egitim-kurs, cenaze, veteriner, diger
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 16. Belediye Hizmetleri: Osmangazi, Nilüfer, Yıldırım belediyeleri hizmetleri

```
Bursa için şunu araştır: Osmangazi, Nilüfer, Yıldırım belediyeleri hizmetleri.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Belediye Hizmetleri
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
il | belediye | kategori | hizmet_adi | aciklama | gerekli_evrak | ucret | basvuru_baglantisi | telefon | kaynak | kaynak_tarihi | not
kategori sütununda yalnızca şunlardan biri: imar-ruhsat, vergi-odeme, su-altyapi, temizlik, zabita, sosyal-yardim, kultur-sanat, spor, egitim-kurs, cenaze, veteriner, diger
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 17. Belediye Hizmetleri: Diğer 14 ilçe belediyesinin başlıca hizmetleri

```
Bursa için şunu araştır: Diğer 14 ilçe belediyesinin başlıca hizmetleri.
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Belediye Hizmetleri
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
il | belediye | kategori | hizmet_adi | aciklama | gerekli_evrak | ucret | basvuru_baglantisi | telefon | kaynak | kaynak_tarihi | not
kategori sütununda yalnızca şunlardan biri: imar-ruhsat, vergi-odeme, su-altyapi, temizlik, zabita, sosyal-yardim, kultur-sanat, spor, egitim-kurs, cenaze, veteriner, diger
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```

### 18. Nasıl Yapılır: Bursa'ya özel pratik rehberler (BursaKart, su aboneliği, emlak vergisi, otopark aboneliği, ikametgâh...)

```
Bursa için şunu araştır: Bursa'ya özel pratik rehberler (BursaKart, su aboneliği, emlak vergisi, otopark aboneliği, ikametgâh...).
Sonucu tek sekmeli bir Excel olarak ver. Sekmenin adı: Nasıl Yapılır
İlk satır tam olarak şu sütun adları olsun (aynen, sırası ve yazımı değişmesin):
il | kategori | baslik | kisa_metin | adimlar | gerekli_belgeler | ilgili_baglanti | kaynak | kaynak_tarihi | not
kategori sütununda yalnızca şunlardan biri: resmi-islem, ulasim, tasarruf, zaman, pratik, saglik, egitim
Kurallar: Her satıra kaynak sayfanın tam adresi (kaynak) ve bugünün tarihi (kaynak_tarihi, GG.AA.YYYY). Kaynağı olmayan satırı ekleme. Bilmediğin hücreyi boş bırak, uydurma. Enlem/boylamı yalnızca kaynakta varsa yaz. Telefon sadece rakam. Evet/Hayır sütunlarına Evet ya da Hayır. Listeleri virgülle, adımları " | " ile ayır. İlçe adları: Büyükorhan, Gemlik, Gürsu, Harmancık, İnegöl, İznik, Karacabey, Keles, Kestel, Mudanya, Mustafakemalpaşa, Nilüfer, Orhaneli, Orhangazi, Osmangazi, Yenişehir, Yıldırım. Sonunda kaç satır bulduğunu ve neyin eksik kaldığını söyle.
```
