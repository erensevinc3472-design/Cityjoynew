# CityJOY Proje Belgesi

> Bu belge projenin "planı"dır. Claude Code her yeni oturumda önce bunu okumalıdır.
> Durum: **Taslak v5**. Eren, 17 öneriyi onayladı, ardından kayıt, profil, ara, mesajlar, bildirimler ve acil ihtiyaçlar ayrıntıları eklendi. Kalan "SORULACAK" işaretli yerler açık sorulardır, "Karar (Eren)" işaretli yerler kesinleşmiş kararlardır.
> Eren'in söylediği kararlar kesindir. "Öneri" yazanlar Claude'un önerisidir, onaylanmadıkça karar sayılmaz.

---

## 0. Çalışma biçimi (Claude Code için)

- Proje sahibi Eren'in **kod bilgisi yoktur**. Açıklamalar sade Türkçe olmalı, her adımda ne yapıldığı ve nasıl denenebileceği anlatılmalı.
- Eren fikri ve iş kurallarını söyler. **Hukuki gereklilikler ve uygulama mağazası şartları Claude'un sorumluluğundadır**, Eren'e ayrıca sorulmadan hazırlanır. Hukuk metinleri yayından önce avukat kontrolüne gönderilmelidir.
- Eren'in anlatmadığı detayları Claude kendisi tamamlar, ama kendi eklediği şeyleri "öneri" diye işaretler.
- **Avukat ve mali müşavir görüşme listesi** yalnızca Eren isteyince hazırlanır. **Yönetim şemasını** Eren çizip verecek, bölüm 6'ya işlenecek.
- **Standart gereklilikler (Eren'in kararı):** Uygulamalarda olması gereken standart şeyler (Apple App Store ve Google Play kuralları dahil) Eren'e sorulmadan eklenir. Liste bölüm 15'te tutulur.
- **Arka plan işleri (Eren'in kararı):** Veri yapıları, sunucu tarafı, sesli asistanın arka planı ve benzeri işleri Claude, Claude Code'da kurar. Veri sonradan geldiğinde çalışacak şekilde hazırlanır.
- İş küçük aşamalara bölünür. Her aşama bitince Eren'e çalışan hali gösterilir.
- **Panel ilkesi (Eren'in kararı):** Uygulamaya eklenen her özellik, **aynı anda** yönetim panelindeki karşılığıyla birlikte yapılır. Bir özellik, paneli (içerik yönetimi, yetki, bildirim tetikleyicisi, kayıt) hazır değilse "bitti" sayılmaz. Amaç: uygulama bittiğinde panellerin büyük bölümü (Eren'in hedefi yaklaşık %90) de bitmiş olsun. Ayrıntı bölüm 6.1'de.

## 1. Uygulama nedir

- **Ad:** CityJoy (tasarımlarda bazen "CityJOY" yazıyor, yazım CityJoy olarak birleştirilecek).
- Türkiye'deki şehir yaşamı için mobil uygulama. Kullanıcının il, ilçe ve mahallesine göre şekillenen modüller sunar.
- **81 ilin hepsinde ilk günden geçerli** olacak. Eren'e göre bu olmazsa kullanıcı kitlesi yakalanamaz.
- Üç tür taraf vardır: kullanıcılar, belediyeler/kurumlar/belediye başkanları (Eren bunlarla anlaşma yapacak) ve yönetim (admin, il yöneticileri).

### 1.1 Temel ilke: sürprizsiz bilgi platformu (Eren: uygulamanın en önemli özelliği)

- Kullanıcı usta ararken, restoran seçerken, müze gezerken ya da bir parka bakarken **sürpriz yaşamadan, tam detaylı ve doğru bilgiye** ulaşmalı. Bu her yer ve her kategori için geçerli. Eren'in örneği: park sayfasında tuvalet sayısı bile olmalı.
- **Öneri (Eren onayladı): kategori bilgi şablonu.** Her kategori için hazır bir alan listesi tanımlanır (örn. park: tuvalet sayısı, oturma yerleri, engelli erişimi, çocuk oyun alanı, aydınlatma, güvenlik, otopark, ücret, çalışma saati). Her alanda son güncelleme tarihi ve kaynak görünür, "yanlış bilgi bildir" ve "eksik bilgi ekle" düğmeleri olur, sayfada bilgi doluluk oranı gösterilir. Şablon alanları panelde form olarak otomatik çıkar (bölüm 6.1).
- **Hizmet sağlayıcılar (usta vb.): uygulama yalnızca bilgi platformudur (Eren'in kararı).** Kullanıcı kategori seçer, usta kartını inceler, kendisi iletişime geçer. Pazarlık, anlaşma ve ödeme kullanıcı ile usta arasındadır. Uygulama taraf değildir ve kefil olmaz. İletişim arama ve WhatsApp ile sınırlıdır, uygulama içi yazışma yoktur. Kartta ustayla ilgili her detay bulunur: bilgiler, **fiyat listesi**, yaptığı işler, tanıtım videosu.
- **Ücretli kademeler (Eren):** Normal kullanıcı hesabında resim, rozet ve video gibi vitrin öğeleri yoktur. İşletme hesaplarında üyelik kademesine göre sayfa kapasitesi artar (fotoğraf sayısı, video, iş örnekleri vb.). Kademe ve fiyatlar gelir konusunda belirlenecek.
- **Öneri (Eren onayladı): güven bilgisi ücretli olmasın.** Doğrulama durumu, hangi belgenin ne zaman doğrulandığı, puan ve yorumlar, çalışma saatleri ve temel iletişim bilgisi tüm işletmelerde ücretsiz görünür. Ücretli olan vitrin kapasitesi ve öne çıkmadır. Doğrulama rozeti "güvenilir" ya da "garantili" gibi vaatler vermez, "Belgeleri doğrulandı (tarih)" der ve yılda bir yenilenir. Fiyat listesinde son güncelleme tarihi ve "tahmini, keşiften sonra değişebilir" notu olur.
- **Karar (Eren onayladı):** güven bilgisi (doğrulama, belgeler, puan, çalışma saati, iletişim) tüm işletmelerde ücretsiz, ücretli olan yalnızca vitrin kapasitesi ve öne çıkma.
- Platformun "aracı" konumu ve sorumluluk reddi metinleri avukatla netleştirilecek.

**Başlangıç verisi nasıl toplanır (öneri, Eren onayladı):**
- Claude internetten araştırma yapıp veri toplayabilir, ama tek başına "doğru" sayılamaz: sayfalar eski olabilir, kaynaklar çelişebilir, tuvalet sayısı gibi detaylar çoğu zaman internette yoktur. Telifli metin ve fotoğraf kopyalanmaz, harita ve işletme sitelerinin kullanım şartları ihlal edilmez.
- Katmanlı yaklaşım: (1) **açık ve resmi kaynaklar** (kurum siteleri, bakanlık müze listeleri, belediye açık verileri, OpenStreetMap gibi lisansı uygun açık veri), (2) Claude'un kaynaklı araştırması, (3) **belediye ve işletme panelleriyle doğrulama**, (4) kullanıcı düzeltmeleri.
- Her alanda kaynak ve durum görünür: "otomatik toplandı (kaynak, tarih)", "belediye onaylı", "işletme onaylı", "kullanıcı bildirdi". Doğrulanmamış veri doğrulanmış gibi gösterilmez.

### 1.2 Tarafsızlık ilkesi (Eren)

- Uygulama siyasi olarak tarafsızdır. Hesapların akışta öne çıkması, ürettikleri içeriğe ve etkileşime göre olur.
- Öneri (Eren onayladı): Sıralama kuralları herkes için aynıdır ve yayımlanır. Yalnızca içerik **miktarına** bakmak spam'i ödüllendirir ve büyük kurumları kayırır. Bu yüzden günlük gönderi sınırı, kalite/etkileşim ve güncellik de hesaba katılır. Tüm belediyeler aynı kurallar, aynı panel ve aynı boyutta "Başkan" kartı alır (Seyahat'teki başkan öne çıkarma her ilde aynı kuralla uygulanır). **Karar (Eren):** ilçe tanıtımlarını ilçe belediye başkanı, il geneli tanıtımları il belediye başkanı yapar. Seçim dönemleri için ayrı kurallar hukuk incelemesinde belirlenir.

### 1.3 Üyelik ve Premium (Eren onayladı)

- Kullanıcı hesapları ücretsizdir. **Kullanıcı Premium'u ilk sürümde yoktur.**
- SOS, acil bilgiler ve güven bilgisi (doğrulama, belgeler, puan, çalışma saati, iletişim) hiçbir zaman ücretli olmaz (öneri).
- "Premium" yalnızca **işletme kademelerinde** kalır. Öneri: Ücretsiz, Standart, Pro, Premium (fotoğraf sayısı, video, iş galerisi, öne çıkma, istatistik). Fiyatlar gelir konuşulurken belirlenir.
- İleride gerekirse kullanıcıya özel ek bir paket düşünülebilir (örn. asistan soru sınırı artışı, daha fazla aile üyesi). Karar verilmedi.

## 2. Diller

Türkçe, İngilizce, Almanca, Arapça, Rusça.

- Arapça sağdan sola (RTL) yazılır, tasarım ve kod baştan RTL'ye uygun kurulmalı.
- Metinler kodun içine gömülmez, dil dosyalarından gelir.
- Kullanıcı içeriğinin (gönderi, duyuru) çevirisi **SORULACAK** (otomatik çeviri olsun mu).

## 3. Kullanıcı akışı

1. Giriş / kayıt
2. Dil seçimi
3. İl, ilçe ve mahalle seçimi
4. Ana sayfa

Kullanıcı sonradan konumunu değiştirebilir (tasarımda "Konum Değiştir", "Mevcut Konum", "Tüm 81 İl" seçenekleri var).

### 3.1 Kayıt ve giriş (Eren'in örnek ekranları: `giris.html`, `kayit.html`)

- **Akış:** Karşılama ekranı → Kayıt/Giriş → Dil seçimi (`dil-secimi.html`) → ana sayfa.
- **Prototiplerde olanlar:** Giriş: e-posta, şifre, Google ile giriş, "şifremi unuttum". Kayıt: ad soyad, e-posta, şifre, şifre tekrar, Google ile kayıt. Prototipler Firebase Authentication ve Firestore kullanıyor. Konum, cinsiyet, meslek gibi alanlar bu iki ekranda henüz yok, ayrı adım olarak tasarlanacak.
- **Karar (Eren):** Kayıtta istenecek bilgilerin hepsi yazılı olur (il, ilçe, mahalle, cinsiyet, meslek vb.). **İl, ilçe ve mahalle zorunlu değildir** (meslek için sonradan alınan karar: aşağıda madde 8), ekranda "uygulamayı tam kapasite kullanmak için bilgileri doğru giriniz" uyarısı olur. Konum bilgisi girmemiş kullanıcı Benim Şehrim'e girerse bir sayfa açılır ve konum girmek o noktada **zorunlu** olur.
- **Öneriler (ONAY BEKLİYOR):**
  1. Benim Şehrim için il ve ilçe zorunlu, mahalle önerilir (Mahallem sekmesi ve mahalle sayfası için gerekir).
  2. Konum izni verilirse "Konumunuzdan X Mahallesi bulundu, doğru mu?" önerisi, elle seçim yedek olarak durur.
  3. **Misafir gezinti:** acil numaralar ve nöbetçi eczane hesapsız erişilebilir, diğer bölümler kayıt ister.
  4. **Kademeli telefon doğrulaması:** kayıtta zorunlu değil, oy verme, ilan, işletme ve yorum gibi işlemlerde istenir (SMS doğrulama maliyetini ve kayıt sürtünmesini azaltır).
  5. E-posta doğrulaması, şifre en az 8 karakter (prototipte 6).
  6. Doğum yılı alınır. 13 yaş altına kayıt yok, 13-17 yaş için kısıtlı mod (kampanya bildirimi yok, mesaj kısıtı). Hukuk teyidi gerekir. **Eren: küçük yaş gruplarına yetişkinler mesaj atamaz** (Keşfet kuralı 4 ile aynı). Yaş beyana dayandığı için yaş değişikliği kilitlenir ve şüpheli davranış (bir yetişkin hesabının çok sayıda küçüğe mesaj isteği göndermesi gibi) otomatik tespit edilir (öneri).
  7. **KVKK ve izinler:** kullanım şartları ve aydınlatma metni (zorunlu onay), yaş/cinsiyet/ilgi alanıyla hedefli bildirim için ayrı isteğe bağlı rıza, konum izni açıklaması, ticari elektronik ileti (kampanya bildirimi) için ayrı izin (İYS kaydı gerekebilir, avukatla teyit).
  8. **Veri minimizasyonu:** kullanılmayacak bilgi toplanmaz. **Meslek (Eren):** Meslek bilgisi, mesleğe ait haber ve bildirimlerin herkese değil yalnızca işine yarayacak kişilere gönderilmesi için kullanılır. Eren meslek alanının **zorunlu** olmasını istiyor. **Karar (Eren onayladı):** meslek serbest yazı yerine admin tarafından yönetilen bir **listeden seçilir**. Seçim zorunludur ama listede "Öğrenci", "Emekli", "Çalışmıyor" ve "Belirtmek istemiyorum" seçenekleri bulunur. Oda veya sendika üyeliği sorulmaz (özel nitelikli kişisel veri), yalnızca meslek. Meslek bildirim filtrelerine eklenir.
  9. **Karar (Eren): "Apple ile giriş" eklenecek** (Google ile girişle birlikte). Mobilde Google girişi açılır pencere yerine uygulamaya özgü yöntemle yapılmalıdır (Claude Code'da).
  10. Uygulama dili cihaz diline göre önerilir. Hesap silme uygulama içinden yapılır.

## 4. Ana fikir: konuma göre şekillenen içerik

Tasarım dosyalarındaki içerik şu an **Bursa'ya sabit yazılmış** (örnek veridir). Gerçek uygulamada ekranlar şablon olacak, içerik veritabanından gelecek:

- Her içerik (gönderi, duyuru, hizmet, etkinlik, indirim) bir konuma (il / ilçe / mahalle) bağlıdır.
- Kullanıcı hangi ilden girdiyse modüller o ile göre dolar.
- **Boş il sorunu:** Bir ilde yerel içerik yoksa ekran boş kalmamalı. Öneri: ülke geneli ortak içerik (acil numaralar, hava durumu, nöbetçi eczane, haberler, Genel akış) her ilde hazır gelir. Yerel içerik belediyeler panelden girdikçe artar.

## 5. Ana sayfa ve dört modül

Ana sayfa (`anasayfa.html`): "Senin Keşfin, Senin Keyfin" başlığı, dört modüle kısayol, kenar menü, alt gezinme (Ana Sayfa, Keşfet, Ara, Profil), hava durumu, tanıtım videosu bağlantısı. Kullanıcı kartında "Premium Üye" ibaresi var.

Eren her modülü sırayla ayrıntılı anlatacak. Aşağıdakiler tasarım dosyalarından çıkarılan özettir.

### 5.1 Benim Şehrim (`benim-sehrim.html`)
Şehir paneli: konum seçici, canlı hava durumu (saatlik tahmin, gün doğumu/batımı), Belediye Hizmetleri (hizmetler ve başvurular), Önemli Kurumlar, Müzeler, Cafe ve Restoranlar, Etkinlikler, Nöbetçi Eczane, Ulaşım, Park ve Pazar, Satılık ve Kiralık, Otopark, Gönüllülük, "Nasıl yapabilirim?" rehberi, Mahalle Meydanı, il vitrini (örnekte "Bursa Vitrini", Premium işaretli).
- Alt sayfalar: belediye-hizmetleri, onemli-kurumlar, muzeler, cafe-restaurant, etkinlikler, nobetci-eczane, ulasim, park-pazar, emlak, otopark, gonulluluk, rehber, mahalle-meydani, bursa-vitrini.
- **Mahalle Meydanı = mahalle bilgi sayfası (Eren onayladı).** Akış değil, mahallenin "künyesi". Sosyal konuşma Keşfet > Mahallem'de kalır. İçerik: muhtar bilgisi (ad, iletişim, çalışma saatleri), mahalle haritası ve temel bilgiler, yakındaki hizmetler (nöbetçi eczane, sağlık merkezi, okul, cami, park, pazar günü, otopark), afet toplanma alanları, sabitlenmiş mahalle duyuruları ve yaklaşan etkinlikler, mahallenin ücretsiz/takas ilanları ve kayıp-buluntu, "Mahallem akışına git" düğmesi.
  - **Yapıldı (28 Ekim 2026), ilk parça:** muhtarlık (resmî profil; yoksa şehir rehberindeki kayıt, doğrulanmadıysa uyarıyla), mahalleye özel duyurular, yakındaki etkinlikler, afet toplanma alanları (şehir rehberinden; yoksa ilçedekiler ve e-Devlet/AFAD notu), belediyelerin resmî profilleri. Sonra: harita, yakındaki hizmetler, ilanlar ve kayıp-buluntu, Mahallem akışı (Keşfet ile). **Sabit duyuru yapıldı (28 Ekim 2026):** mahalleye yönelik duyuru panelde "Mahalle Meydanı'nda sabitle" ile acil duyurulardan sonra en üstte kalır.
  - **Yönetim (Eren'in fikri: muhtar; ayrıntılar Eren onayladı):** Sayfanın bilgi ve duyurularını doğrulanmış **muhtar** hesabı yönetir, yalnızca kendi mahallesi için. Muhtar hesabı yoksa ya da aktif değilse ilçe belediyesi paneli sayfayı düzenler. Muhtar hesapları ilçe belediyesi veya il yöneticisi aracılığıyla doğrulanır. Muhtarlık seçimle değişince hesap devri yapılır (eski hesabın yetkisi kapanır). Muhtar mahalle içi duyuru bildirimi gönderebilir (günlük sınır; reklam, kampanya ve siyasi içerik yasak; kötüye kullanımda yetki kısıtlanır). Muhtar yardımcı personel ekleyebilir. Kullanıcılar bilgi hatası bildirebilir.
- **İş kuralı (Eren):** Veriler çoğunlukla 81 il için sabit ve ortaktır (otoparklar, müzeler, ulaşım, park ve pazar). Kafe ve restoranlar çok sık değişmez. Etkinlikleri yetkili hesaplar girer (belediye paneli, Eren'in ekibi, yetki verilen kurum ve kişiler), kullanıcılar ise aktivite açar. Nöbetçi eczane bir API ile otomatik gelir (söylenişte "APK" geçti, API olarak anlaşıldı).
- **Yapıldı (27 Ekim 2026): sabit bilgiler şablonla.** Önemli kurumlar, müzeler, otoparklar, parklar, pazarlar, ulaşım, toplanma alanları, muhtarlıklar, belediye hizmetleri ve "Nasıl yapılır?" tek bir şablonla tutulur; veri Excel'den panelden yüklenir (Eren'in önerisi: başka bir yapay zekâyla ya da ekiple doldurulur, kaynak ve tarih zorunlu, bilinmeyen boş bırakılır). Yüklenen bilgi "doğrulanmadı" etiketiyle ve kaynağıyla görünür, doğrulanınca etiket kalkar. Uygulamada bölümler, liste ve ayrıntı hazır. Kafe-restoran (İşletmem), nöbetçi eczane, etkinlik, ilan ve Mahalle Meydanı ayrı gelecek. Seyahat'in sabit bilgileri aynı yöntemle yapılacak.
- **OpenStreetMap iskeleti (Claude karar verdi, Eren bıraktı; 28 Ekim 2026):** ekip veya belediyelerden veri toplamak uzun süreceği için şablon önce OSM'den doldurulur (`scripts/osm-city-guide.ts`). Bursa denemesinde ad ve konum iyi, ayrıntılar (telefon, saat, ücret, pazar günü) çoğunlukla boş; ayrıntıları ekip/yapay zekâ kaynakla tamamlar. Toplanma alanları için AFAD / e-Devlet gerekir. Lisans ODbL: uygulamada "© OpenStreetMap katkıda bulunanlar" yazılır; birleşik veritabanının paylaşım koşulu avukata sorulacak. Uygulama Overpass'e hiç gitmez (maliyet ilkesi).
- **Benim Şehrim, her düğme çalışsın (Eren bıraktı, 29 Ekim 2026):** (1) Bursa'nın müze, otopark, park, pazar, önemli kurum ve toplanma alanı bilgileri OpenStreetMap'ten Excel olarak hazırlandı (650 kayıt), panelden yüklenir; müze ücret durumu, otopark tipi ve pazar günleri bilinmiyorsa boş kalabilir (uydurulmaz). (2) "Nasıl yapılır?" ülke geneli 12 rehber (`scripts/nasil-yapilir.ts`, resmî kaynaklı). (3) **Cafe ve Restoran:** İşletmem'de "yeme-içme" türündeki işletmeler; bu tür hizmet kategorisi yerine yemek türü seçer (kafe, restoran, kahvaltı, kebap, pide, ev yemekleri, balık, tatlı, fast food); filtre ve "Şu an açık"; sıralama hizmet listeleriyle aynı kural. (4) **Şehir Vitrini:** il başına haftalık sayılar (konular + seçilen işletme / gezilecek yerler), panelden hazırlanır (admin ve il yöneticisi), editör seçkisi, para karşılığı girilmez, "Premium" yazmaz. Kalanlar: nöbetçi eczane (servis onayı), Satılık ve Kiralık ile Gönüllülük (ilan sistemi, ayrıca konuşulacak), hava durumu (ticari kullanıma uygun servis), Ulaşım / Muhtarlıklar / Belediye hizmetleri verisi.
- **Karar (Eren):** Belediye hizmetlerinde uygulama hizmeti, gerekli evrakı ve başvuru bağlantısını gösterir, başvuru belediyenin kendi sistemine yönlendirilir. Uygulama içi başvuru ilk sürümde yok (istekli belediyelerle sonra düşünülebilir).
- SORULACAK: Veri kaynakları neler (özellikle nöbetçi eczane, ulaşım)?
  - **Nöbetçi eczane önerisi (Claude, 27 Ekim 2026, ONAY BEKLİYOR):** resmi kurumların açık servisi yok; hazır ücretli servis (ilk tercih NosyAPI, yedek CollectAPI, tahmini ayda 6-13 dolar), her sabah 81 il bir kez çekilir, ikinci deneme yalnızca başarısız illeri tamamlar. Zamanlayıcı şimdilik GitHub Actions (ücretsiz), Blaze'e geçilirse Firebase'e taşınır. Ayrıntı: `docs/oneri-nobetci-eczane.md`.
- **Ziyaretçi Modu (Eren onayladı; eşik değerleri sonra belirlenecek):** Benim Şehrim kullanıcının o an bulunduğu şehre göre değişebilir. Örnek: Bursa'dan Antalya'ya giden kullanıcıya "Konumunuz Antalya görünüyor, Antalya olarak devam etmek ister misiniz?" sorulur.
  - Kayıtlı il/ilçe/mahalle her zaman "Evim" olarak durur. Farklı bir ilde olunduğu algılandığında (konum izni verilmişse) sorulur, sessizce değişmez. Seçenekler: "Antalya'yı göster", "Bursa'da kal", "Bir daha sorma".
  - Seçilirse ekranın üstünde "Antalya (ziyaretçi) · Evim: Bursa" şeridi ve tek dokunuşla eve dönüş bulunur. Ziyaretçi modunda yerleşik kullanıcıya özel bölümler (belediye başvuruları, mahalle duyuruları) geri çekilir, gezilecek yerler, eczane, acil numaralar, ulaşım ve etkinlikler öne çıkar.
  - Gereksiz sormamak için il değişimi ve belli bir kalış süresi şartı aranır (eşik değerleri sonra belirlenir). Yolculuk planı oluşturulmuşsa varış tarihinde mod önerilir.
  - **Gizlilik:** Konum izni açık rıza ister, "yalnızca uygulama açıkken" yeterlidir, arka planda sürekli takip yapılmaz. Mahalle bildirimleri anlık konuma değil kayıtlı adrese göre gider. Ziyaret edilen ilin afet/acil uyarılarının gösterilmesi kullanıcının onayıyla düşünülebilir.
- **Emlak (Satılık ve Kiralık) ve hukuk (araştırma sonucu, avukatla teyit edilecek):**
  - Eren bireylerin de ilan verebilmesini istiyor (yoksa kullanım düşer), ama işlemlerin güncel hukuka uygun olması gerekiyor.
  - Taşınmaz Ticareti Hakkında Yönetmelik'e 31 Ağustos 2023'te eklenen hükümle **ilan platformlarına kimlik ve yetki doğrulama yükümlülüğü** geldi (EİDS, Ticaret Bakanlığı). İlanı yalnızca taşınmaz sahibi, sahibinin 1. ve 2. derece kan hısımları veya eşi, ya da sahibince yetkilendirilen **yetki belgeli emlak işletmeleri** verebilir. Bireysel ilanda taşınmaz numarası zorunlu alandır. Yetki belgesiz emlak işletmeleri ilan giremez. Kaynak: ticaret.gov.tr (EİDS duyurusu).
  - Kiralık ilanlar için EİDS 1 Ocak 2025'ten itibaren zorunlu oldu. Satılık için zorunluluk tarihinin ayrıca bildirileceği açıklanmıştı, güncel durum teyit edilmeli. Yönetmelik son olarak 29.04.2026'da değişmiş görünüyor.
  - Bakanlık sosyal medyadaki taşınmaz ilanlarını da denetliyor ve yönetmeliğe aykırı hesaplara erişim engeli getirdiği açıklandı. Bu yüzden Keşfet'te emlak ilanı kuralı gerekli (bkz. Keşfet kuralları, madde 9).
  - **Tasarım önerisi:** iki ayrı etiket/kategori: "Sahibinden (bireysel)" ve "Emlak işletmesi (yetki belgeli)". Bireysel ilanda kimlik doğrulama ve taşınmaz numarası, işletmede yetki belgesi numarası doğrulaması. "Doğrulanmış ilan" rozeti yalnızca resmi doğrulamadan geçen ilana verilir. EİDS entegrasyonunun koşulları Ticaret Bakanlığı'ndan ve avukattan teyit edilecek. Uygulama taraf değildir, kapora/ödeme almaz.
  - **Karar (Eren):** bireysel emlak ve araç ilanı ilk sürümde açılır (aşağıdaki karara bakın).
  - **Yetki belgesi doğrulaması:** Eren'in notu: bunu uygulamanın kendi başına yapması zor. Resmi doğrulama sistemine (EİDS) bağlanılırsa yetki kontrolünü sistem otomatik yapar, elle kontrol gerekmez. Entegrasyon yoksa doğrulama elle ve zahmetli olur. Entegrasyonun koşulları Ticaret Bakanlığı'ndan ve avukattan teyit edilecek.
  - **`emlak.html` (Eren'in örnek tasarımı):** Yalnızca emlak değil, genel bir **ilan platformu**. İlan türleri: Satılık, Kiralık, Ücretsiz, Takas. Kategoriler: Emlak, Araç, Elektronik, Moda, Mobilya, Spor, Kitap, Diğer. İlçe filtresi, VIP/Öne Çıkan ilanlar, "Ücretsiz İlan Ver" formu (başlık, açıklama, fiyat, ilçe, en fazla 10 fotoğraf, iletişim telefonu), favoriler, güvenli alışveriş uyarısı (yüz yüze görüşmeden kapora ödememe).
  - **Hukuki olarak incelenecek noktalar (avukatla teyit):** (a) Emlak kategorisi: yukarıdaki EİDS kuralları. (b) Araç kategorisi: ikinci el araç ticareti ve araç kiralama için de yetki şartları olabilir (araştırılacak). (c) Ücretli VIP ilan satan, pazaryeri gibi çalışan bir platform için elektronik ticaret mevzuatındaki aracı hizmet sağlayıcı yükümlülükleri (kayıt, şikâyet ve kaldırma süreci, yasaklı ürünler) araştırılacak. (d) **Eren'in kararı:** ilanda telefon numarası yer almaz, alıcı ve satıcı uygulama içinden yazışır (kişisel veri ve spam riskini de azaltır). (e) Dolandırıcılık ve çalıntı ürün riski (özellikle elektronik): yasaklı ürün listesi, şikâyet düğmesi, ilan sahibi doğrulaması.
  - **Öneri (Eren emlak ve araç için farklı karar verdi, aşağıdaki karara bakın): kademeli açılış.** İlk sürümde düşük riskli kategoriler: Ücretsiz, Takas, Mobilya, Kitap, Spor, Moda (mahalle dayanışması ve kullanım çeker). Emlak ve Araç, yasal doğrulama altyapısı hazır olana kadar yalnızca kurum/belediye duyurusu ve yetkili işletme tanıtım kartı olarak açılır. Bireysel emlak ve araç ilanları sonra eklenir. Elektronik için ek kurallar gerekir.
  - **Eren'in ilan modeli (karar):** Amaç bölgesel alışverişi artırmak. İlanda telefon numarası yoktur, alıcı ve satıcı uygulama içinden yazışır, ilan sahibi isterse numarasını kendisi paylaşır. Konumu teyit edilemeyen kullanıcı ilan paylaşamaz. Alıcı ve satıcı aynı şehirde olduğu için ödeme öncesi ürünü yerinde görebilir. Dolandırıcılığa karşı uyarılar gösterilir, işlemin geri kalan sorumluluğu kullanıcılardadır (kullanım şartlarında yazılır).
  - **Öneri (Eren onayladı):** (1) Sohbette IBAN, "kapora", dış bağlantı gibi ifadeler geçerse otomatik uyarı çıksın. (2) Yeni hesaplara telefon doğrulaması ve günlük ilan sınırı. (3) İlanda gerçek fotoğraf zorunluluğu. (4) Şikâyet ve engelleme Keşfet kurallarıyla aynı. (5) Konum teyidi sahte GPS ile aşılabilir, tek önlem sayılmaz. (6) **Emlak ve araç istisnası:** emlak ilanında kimlik ve yetki doğrulama yükümlülüğü platforma ait olduğundan "sorumluluk kullanıcıda" modeli bu kategoride tek başına yeterli sayılmaz. Kullanım şartlarındaki sorumluluk reddi, mevzuattaki platform yükümlülüklerini ortadan kaldırmaz (avukatla teyit).
  - **Karar (Eren): bireysel emlak ve araç ilanı ilk sürümde açılır.** Çıkabilecek sorunları Eren çözecek. Claude yasal riski belirtti: yönetmelikteki platform yükümlülükleri, idari yaptırım ve erişim engeli riski vardır, bunun sonuçları şirketi etkiler.
  - **Claude'un önerdiği asgari önlemler (Eren onayladı):** (a) Emlak ilanında taşınmaz numarası zorunlu alan. (b) İlan sahibi kimlik doğrulaması. (c) "Taşınmazın sahibi, birinci/ikinci derece kan hısımı veya eşiyim" beyanı. Emlak işletmeleri için yetki belgesi numarası alanı. Yetki belgesi olmayan işletme ilan veremez. (d) Bu alanlar ve "doğrulandı" durumu baştan veri yapısında yer alır, böylece resmi doğrulama (EİDS) entegrasyonu sonradan takılabilir. (e) Araç ilanında benzer beyan ve ruhsat/plaka bilgisi alanı (kurallar araştırılacak). (f) Yayından önce avukatın kısa görüşü alınır, bu "sonra" değil yayından önceki bir adımdır.

### 5.2 Seyahat (`seyahat.html`)
İkiye bölünmüş ekran:
- **Keşfet ve Öğren (Curiosity Mode):** rastlantısal yolculukla gizli hikâyeler ve şehrin ruhu. Sayfa: `kesfet-ogren.html`.
- **Planla ve Navigasyon (Efficiency Mode):** otobüs, tren, harita ve rota planlama. Sayfa: `seyahat-anasayfa.html`.
- **İş kuralı (Eren):** Keşfet ve Öğren bölümündeki bilgilerin hepsi sabittir. Belediye başkanlarını ön plana çıkarmak için bu bölüme ek veriler girilecek. Planla ve Navigasyon başlangıçta yolculukta kullanılacak araç ve otobüs hakkında bilgilendirme olacak. Bilet satışı duruma göre sonra eklenebilir.
- **Keşfet ve Öğren akışı (Eren'in örnek tasarımı):** `kesfet-ogren.html` (Türkiye, 7 bölge, 81 şehir) → `marmara.html` (bölge: tanıtım videosu, şehir/müze/tarihi yer sayıları, filtre ve sıralama, şehir listesi) → `bursa.html` (şehir: puan, nüfus, UNESCO, rakım, yöresel ürünler, fotoğraf galerisi, "Başkanlarla Keşif", "Yöresel Bursa", hazır rotalar, deneyim listesi, il rehberi yapay zekâsı) → `bursa-belediye-kesif.html` (17 ilçe, her ilçe kendi belediye başkanı tarafından tanıtılır: slogan, rotalar, süre, tanıtım videosu, rota detayları, "Diğer İlçeler"). Eren'in amacı: başkanlar hem öne çıksın hem görünürlükleri artsın.
  - **Kararlar ve öneriler (Eren onayladı; 1, 2 ve 5'te Eren'in kararı yazılı):** (1) **Karar (Eren): puanlama bu bölümden tamamen kaldırılır.** Başkan kartında yıldız ve yorum sayısı yok, rotalara da puan yok (siyasi tarafsızlık, hakaret ve manipülasyon riskini de ortadan kaldırır). (2) **Eşit görünürlük:** tüm ilçeler aynı boyutta kart alır (tasarımda küçük ilçeler yalnızca yazıyla "Diğer İlçeler"de kalıyordu, bu değişecek). **Karar (Eren): sıralama ilçe nüfusuna göre** (büyükten küçüğe), objektif ve herkese açık bir ölçüt. Bölge filtreleri (Merkez, Sahil, Dağ, Ova) küçük ilçelerin bulunmasına yardım eder. (3) İçerik "Belediye tanıtımı" olarak etiketlenir, kişi odaklı olmaz, siyasi mesaj ve parti işareti yasak. (4) **Seçim dönemleri:** başkan adı, fotoğrafı ve videosu kurala göre gizlenir ya da yalnızca "Belediye" olarak gösterilir (hukuk teyidi). (5) **Karar (Eren):** il tanıtımını büyükşehir belediye başkanı yapar. Büyükşehir olmayan illerde il merkez belediye başkanı (varsayım, Eren düzeltebilir). (6) Başkanlar rota ve videoyu belediye panelinden girer (6.2 madde 25). Belediyelerle ticari ilişki (panel ücreti, tanıtım) kamu mevzuatına tabi olabilir, avukatla netleştirilecek. (7) Nüfus, UNESCO, rakım gibi sabit bilgiler kaynak ve tarihle gösterilir.
- **Planla ve Navigasyon: bilgi odaklı yolculuk rehberi (Eren: bilet satışından çok bilgi vermek; yöntem Claude'dan istendi).** Örnek tasarımlar: `seyahat-anasayfa.html` ("Rotanı Oluştur", "Trend Rotaları", ulaşım türleri, konaklama türleri, "Paketler") ve `rota.html` (4 adımlı planlayıcı: Rota, Ulaşım, Konaklama, Özet ve tahmini toplam).
  - **Öneri (Eren onayladı): "Yolculuk Planı" yaklaşımı.** Kullanıcı bir yolculuk planı oluşturur (nereden, nereye, tarih, kaç kişi, bütçe). Uygulama aşamaya göre rehberlik eder, hiçbir şey satmaz:
    1. *Karar:* nereye gideyim? Kapalı bilgi tabanlı asistan sorularla ("bütçe, süre, ilgi alanı, mevsim, kiminle") öneri yapar, şehirleri karşılaştırır (iklim, en iyi dönem, tahmini maliyet aralığı, ulaşım).
    2. *Ulaşım:* araç türüne göre süre, tahmini ücret aralığı, ne zaman almak mantıklı, resmi bilet sitelerine bağlantı. Kendi aracıyla gidenler için tahmini yakıt ve ücretli yol maliyeti, mola noktaları, harita uygulamasına yönlendirme.
    3. *Konaklama:* bilgi ve kontrol listesi: belgeli tesis mi, iptal koşulları, ek ücretler, konum. Doğrulanmış işletmeler listelenir, rezervasyon tesisle doğrudan ya da resmi sitesinden yapılır.
    4. *Hazırlık:* kontrol listesi (belgeler, hava, para, sağlık).
    5. *Yolda:* mola, akaryakıt, hava ve yol uyarıları, isteğe bağlı olarak yolculuk boyunca konumu aile ile paylaşma (SOS aile listesiyle).
    6. *Varışta:* "Ziyaretçi Modu" (aşağıda, Benim Şehrim): gezilecek yerler, yemek, nöbetçi eczane, acil numaralar, ulaşım, yerel etkinlikler ve yerel dolandırıcılık uyarıları.
    7. *Dönüş:* deneyimi Keşfet'te paylaşma, kaydedilenler.
  - **"Paketler" (öneri):** satış paketi değil, **hazır yolculuk planları** (aile, balayı vb.): çocuk dostu yerler, romantik rotalar gibi derlenmiş bilgi. "Tahmini Toplam" kesin fiyat değil, **tahmini maliyet aralığı** olarak ve kaynak/tarihle gösterilir. Örneklerdeki marka adları (Metro Turizm, Hilton) ortaklık olmadıkça kullanılmaz, "otobüs firması", "otel" gibi kategorilerle gösterilir.
  - **İhtiyaç keşfi (öneri):** İnsanların yolculukta en çok ne istediği tahmindir (ne kadar tutar, güvenilir mi, ne zaman gitmeli, nasıl giderim, ne yapılır, sorun çıkarsa ne olur). Doğrulamak için birkaç kişiyle konuşulabilir, ayrıca asistanın cevaplayamadığı sorular otomatik bir ihtiyaç listesine dönüşür (panelde görünür).
  - **Gelir fikri (sonra):** Resmi bilet ve konaklama sitelerine yönlendirme ortaklıkları olabilir. Sıralamayı etkilemez, "ortaklık/reklam" diye işaretlenir.
- **Yol Arkadaşı (Eren'in fikri, 29 Ekim 2026; Planla ve Navigasyon ile birlikte kurulur):** aracıyla yolculuk eden kullanıcının yol boyunca ihtiyaçlarını karşılamak. Akış: Planla (nereden, nereye, hangi araç) > Yoldayım (büyük Tuvalet · Yakıt · Yemek · Şarj · Mescit düğmeleri, gidilen yöndeki en yakın tesisler, yakın ilçelerin eczane ve acil numaraları; yol tarifi Google/Apple Haritalar'a açılır, kendi navigasyonumuz yok) > Vardım (Ziyaretçi Modu önerisi). İşletmeler (dinlenme tesisi, restoran, akaryakıt istasyonu) kendilerini "yol üstü tesis" olarak işaretleyip olanaklarını ve konumlarını girer. Maliyet: konum yalnızca uygulama açıkken, liste yaklaşık 5 km'de bir yenilenir; boş görünmesin diye başlangıçta OSM akaryakıt ve dinlenme tesisi kayıtları. Ekranda "sürücü değil yolcu kullansın" uyarısı. İleride gelir: öne çıkan tesis. Canlı takip ve yapay zekâ sohbeti (yol-arkadasi.html'deki) ilk sürümde yok. **Yapıldı (29 Ekim 2026): işletme tarafı.** **Yapıldı (29 Ekim 2026): Yoldayım ekranı** (Seyahat girişinden; 2 saatte mola önerisi, 112 düğmesi; mesafe kuş uçuşu, süre ortalama 80 km/s ile tahmin).
- **Konaklama rehberliği (Eren'in kararı, ayrı gelir kaynağı).** Ulaşımda yalnızca kullanılan araca göre bilgilendirme yapılır. Konaklamada (otel, bungalov, apart, günlük kiralık ev vb.) tam detaylı rehberlik verilir. İnsanların gitmeden öğrenmek istedikleri: temizlik, ücretin tam belli olması, aileye uygunluk.
  - **Öneri (Eren onayladı) - bilgi şablonu:** tür, konum, **ücret tablosu** (sezon, kişi/çocuk, ek ücretler, depozito, iptal koşulları, güncellenme tarihi), olanaklar, aile uygunluğu için **somut ölçütler** (çocuk havuzu, bebek yatağı, aile odası, çocuk menüsü, sessizlik saatleri, güvenlik). Öznel "aileye uygun" etiketi yerine ölçütler gösterilir.
  - **Temizlik ve doğruluk (öneri):** Yıldız puanı yerine kısa evet/hayır geri bildirimi (temiz miydi, fiyat ilandaki gibi miydi, aileye uygun muydu) ve toplu oran + cevaplayan sayısı gösterilir (örn. "%92 evet, 48 kişi"). Yalnızca o ilde bulunduğu doğrulanan (Yolculuk/Ziyaretçi Modu) kullanıcı geri bildirim verebilir. Sahte geri bildirime karşı şikâyet, denetim ve işletmeye cevap hakkı.
  - **Yasal belgeler (araştırma sonucu, avukatla teyit edilecek):** Oteller ve benzeri tesisler için Kültür ve Turizm Bakanlığı veya belediye işletme belgesi (ayrıca araştırılacak). **Günlük kiralık ev:** 1 Ocak 2024'te yürürlüğe giren 7464 sayılı Kanun'a göre bir konutu 100 günden kısa süreyle turizm amacıyla kiralamak için Kültür ve Turizm Bakanlığı'ndan **izin belgesi** zorunludur, platformlar izin numarasını göstermek zorundadır. Belgesiz ilan yayınlanmaz, izin belgesi numarası alanı zorunlu olur. Platformda ilan vermek izin yükümlülüğünü ortadan kaldırmaz.
  - **Gelir (öneri):** doğrulanmış konaklama sayfası, doğrulama ücreti, vitrin kademeleri, "reklam" etiketli öne çıkma. Rezervasyon tesisle doğrudan ya da resmi sitesinden yapılır.
- **Sesli Yol Asistanı (Eren onayladı: ilk sürümün yapısına dahil edilir, veri geldikçe devreye girer; ayrıntılar Eren onayladı).** Yolcu haritaya yönlendirilince uygulamayı kullanmamış olur. Çözüm: yolculuk sırasında sesli komut, örn. "CityJoy, tuvalet lazım" ya da "yol üstünde yemek yiyebileceğim bir yer söyle". Asistan yol kenarındaki dinlenme tesislerini ve yola yakın ilçe/kasaba içindeki yerleri önerir.
  - **Sürüş güvenliği:** yalnızca sesli ve kısa cevap, ekrana bakmayı gerektirmez, "güvenli bir yerde durun" uyarısı. Araç içi sistemlerin (CarPlay, Android Auto) uygulama kategorileri kısıtlı olabilir (araştırılacak), ilk adım telefonun sesli modu.
  - **Yolculuk Modu:** Kullanıcı başlatır, konum yalnızca yolculuk sürerken kullanılır, varışta kapanır. Arka planda sürekli takip yapılmaz, açık rıza alınır.
  - **Veri:** Yol üstü tesis veritabanı (otoyol dinlenme tesisleri, akaryakıt, restoran, ilçe/kasaba mekanları) bilgi şablonuyla (tuvalet temizliği, mescit, çocuk olanakları, şarj, fiyat, çalışma saati, son doğrulama tarihi). En çok kullanılan güzergâhlardan başlanır, açık veri + elle doğrulama. Harita/mekân verisi sağlayıcılarının kullanım şartları ve maliyeti araştırılacak.
  - **Kapalı bilgi tabanı:** Bilgi yoksa "bilmiyorum" der, doğrulanmamış öneriyi belirtir. Sponsorlu öneri tuvalet, akaryakıt ve acil gibi ihtiyaç sorgularında en yakın uygun yeri gizleyemez ve reklam olarak söylenir. "Kaza", "yardım" gibi ifadelerde 112 önerilir ve aile SOS paylaşımı sorulur.
  - **Teknik riskler:** konuşma tanıma maliyeti, yol gürültüsünde ve Türkçede doğruluk testleri.
  - **Veri toplama (Eren'in kararı):** İşletmem kaydında kategori olarak "yol üstü tesis" işareti bulunur. İşaretlenen işletmeler Seyahat'teki sesli sorularda değerlendirilir. Ziyaret eden kullanıcıların geri bildirimleriyle bilgiler sürekli güncel tutulur. İşletmelerin kendini kaydetmesini sağlayacak yolu Eren sonra bulacak.
  - **Öneri (Eren onayladı):** (1) İşaretlenen işletme hizmetlerini seçer (tuvalet, yemek, akaryakıt, mescit, şarj, konaklama, çocuk alanı, 7/24). (2) Veri yetersiz bölgelerde asistan "bu yolda henüz yeterli bilgi yok" der ve ilk sürümde yalnızca veri yeterli olan güzergâhlarda tanıtılır, böylece ilk izlenim bozulmaz. (3) Doğrulanmış tesisler önce önerilir, doğrulanmamışlar "doğrulanmadı" diye söylenir. (4) Geri bildirim kısa evet/hayır olur ("açıktı, temizdi, fiyat doğruydu"), konum doğrulamalıdır, bilgi "son doğrulama tarihi" ile görünür. (5) İşletmem formuna yol üstü tesis için güzergâh ve yön alanları eklenir, konumdan otomatik güzergâh eşleme Claude Code'da kurulur.
- SORULACAK: Rota ve navigasyon için hangi harita/ulaşım verisi kullanılacak (ücretli servisler maliyet getirir)?

### 5.3 Sosyal Harmoni ve Fırsatlar (`sosyal-harmoni.html`)
Üst bölüm: Etkinlikler, Aktiviteler, Haberler, Yarışmalar, Anketler, Forum, yerel spor takımı sayfası (örnekte Bursaspor).
"Fırsatları Keşfet" bölümü: Süper Market, Yemek, Market, Spor, Eğlence, Esnaf, Sağlık, Eğitim kategorilerinde indirimler.
- Alt sayfalar: etkinlikler, aktiviteler, haberler, yarismalar, anketler, forum, bursaspor, *-indirimleri.
- **Spor: "Şehir Kulüpleri" (Eren'in kararı).** "Bursaspor" başlığı yerine "Şehir Kulüpleri". Şehrin kulübü kendi sayfasının yönetimine yetkilendirilir (doğrulanmış kulüp hesabı, kendi paneli).
  - **Öneri (Eren onayladı): büyük/küçük şehir farkını tek yapıyla çözmek.** (1) Üstte şehrin ana kulübü veya kulüpleri: il yöneticisi belirler. Küçük şehirlerde çoğunlukla tek kulüp, şehir adını taşıyan kulüp yoksa ya da birden çok büyük kulüp varsa il yöneticisi birden fazla seçebilir. (2) Altında başvurup doğrulanan diğer profesyonel ve amatör kulüpler. Başvuru yoksa listede görünmez, yani elle doldurmak gerekmez. Sıralama tarafsız: lig düzeyi, sonra alfabetik. Hiçbir kulüp ücretle öne çıkarılmaz.
  - Kulüp başvurusu: yetkili kimliği ve kulüp belgesi, il yöneticisi onaylar. Kulüp adı/logosu izne bağlıdır. İlk sürümde fikstür ve skor kulübün girişi ve resmi lig bağlantısıyla, canlı skor sonra (lisanslı veri ücretlidir). Taraftar alanında sıkı moderasyon ve maç günü ek moderasyon, şiddet çağrısı yasak (avukatla teyit). Spor tesisleri (halı saha, salon, havuz) bilgi şablonuyla eklenir.
- **İş kuralı (Eren):** Bu modül en az emekle, işi başkalarına devrederek yönetilecek. Etkinlik ve aktivite ayrı mantıktadır (aşağıdaki "Etkinlik ve aktivite" maddesine bakın). Belediyeler de kendi panelinden etkinlik, aktivite, haber ve yarışma girer. **Anketler tamamen ücretlidir** ve hepsini Eren'in ekibi girer. Alt bölümde indirimler yer alır.
- **Etkinlik ve aktivite (Eren'in kararı): iki ayrı mantık.**
  - **Etkinlik:** Yalnızca **onaylı/yetkili** kişi ve kurumlar açabilir. Yetkiyi admin panelinden atar ve geri alır (admin tablosunda madde 18). Örnek organizatörler: belediye, kurum, STK, doğrulanmış işletme.
  - **Aktivite:** Her kullanıcı kendisi oluşturabilir (insanların bir araya gelmesi için, + düğmesiyle).
  - **Adres:** Tam adres yalnızca "Katılıyorum" diyenlere görünür. Herkese yalnızca genel konum (mahalle/yaklaşık nokta) gösterilir. **Karar (Eren onayladı):** Bu kural yalnızca kullanıcıların kendi açtığı aktivitelerde geçerlidir. Yetkili organizatörün halka açık etkinliklerinde adres herkese açıktır.
  - **Bildirim:** Etkinlik veya aktivitede olası her değişiklikte (tarih, saat, yer, ücret, iptal vb.) "Katılıyorum" diyenlere bildirim gider.
  - **Yapıldı (28 Ekim 2026), etkinlikler:** panelde hazırla / onayla / yayınla, iptal, kontenjan, resmî bilet bağlantısı, siyasi etkinlik onayı; uygulamada Sosyal Harmoni > Etkinlikler, ayrıntı ve "Katılıyorum" (ad yalnızca izinle). Etkinlik yetkisi şimdilik kurumlara ve muhtar / il yöneticisi yetkisine bağlı (STK, kurum olarak açılır). Değişiklik bildirimi, başvuru formu ve kullanıcı aktiviteleri sonra.
  - **Yapıldı (28 Ekim 2026), kullanıcı aktiviteleri:** Sosyal Harmoni > Aktiviteler, "+ Aktivite aç", tam yer yalnızca katılana, "Katılıyorum", iptal, ilk buluşma ipuçları, şikâyet ve panelde il bazlı moderasyon. Claude'un standart güvenlik seçimleri: yalnızca 18 yaş ve üstü; kendi ilinde, en çok 30 gün sonrası ve 12 saat; tarih ve yer sonradan değişmez (bildirim gelene kadar), yalnızca iptal; 3 şikâyette moderatör karar verene kadar listeden düşer. Değişiklik bildirimi ve günlük açma sınırı sunucu işleviyle (Blaze) gelecek.
  - **Öneriler (Eren onayladı):** (1) Yetki türleri: kurum bazlı ve kişi bazlı, bölge kapsamlı (il/ilçe), isteğe bağlı süreli, her atama kayıt altında. (2) "Etkinlik düzenleme yetkisi iste" başvuru formu, admin onaylar. ~~İl yöneticisi kendi ilinde yetki verebilir.~~ **Karar (Eren): yetkiyi yalnızca admin verir ve geri alır** (bölüm 6.5). (3) Yalnızca açıklama metni gibi küçük düzenlemelerde bildirim gitmez, bildirim spam'i önlenir. (4) Organizatör katılımcı sayısını görür, isim listesini yalnızca katılımcının rızasıyla. (5) Aktivitede 18 yaş altı ve yabancılarla buluşma güvenliği için ilk buluşma ipuçları, şikâyet ve engelleme. (6) Siyasi parti etkinlikleri, miting ve gösteri duyuruları kapalı (tarafsızlık, hukuk teyidi). (7) Bilet satılmaz, resmi bilet bağlantısı verilir.
- **Haberler (Eren'in kararı): Bundle benzeri haber toplayıcı.** Haber sitelerinle anlaşma şu an zor. Amaç, insanların kendi bölgelerindeki ve genel haberlere kolay ve kullanışlı ulaşması. `haberler.html` örneği: "Son Dakika" şeridi, Bölgesel/Genel anahtarı, kategoriler (Tümü, Son Dakika, Siyaset, Ekonomi, Spor, Kültür), liste görünümü, haber detayında kaynak adı ve süre, paylaş, kaydet, yazı boyutu, haber özeti, ilgili haberler.
  - **Karar (Eren onayladı): izne dayalı kademeli model, anlaşma müzakeresi gerektirmeden.**
    1. *Birinci kaynak: resmi duyurular.* Belediye, valilik, kaymakamlık ve kurum duyuruları doğrudan panellerden gelir (hukuki risk en düşük). Her bölge için dolu bir "Kurum Haberleri" akışı baştan olur.
    2. *Yayıncı başvurusu (opt-in):* Yerel haber siteleri kendi RSS adreslerini "Haber Yayıncısı" panelinden ekler. Kullanım şartlarını kabul ederek başlık, kısa özet ve "haberin tamamı için kaynağa git" yönlendirmesine izin verir. Karşılığında uygulamadan trafik ve tıklama istatistiği alır. Alan adı doğrulaması yapılır, bölge (il/ilçe) ve kategori yayıncı tarafından seçilir. Böylece müzakere gerekmeden yazılı izin alınmış olur.
    3. *Genel haberler:* Ulusal siteler için de önce izin veren yayıncılarla başlanır. İzinsiz RSS toplamak kullanım şartlarına ve telife takılabileceğinden yapılmaz (avukatla teyit).
    - **Durum (28 Ekim 2026):** birinci kaynak yapıldı (DURUM.md 27): panelde "Kurum haberi" türü (kategorili), uygulamada Sosyal Harmoni > Haberler (Bölgesel, kategori, okuyucu: okuma süresi, yazı boyu, paylaş). Sırada yayıncı başvurusu.
  - **Tasarım ilkeleri (öneri):** Her haberde kaynak adı görünür ve "haberin tamamı için kaynağa git" düğmesi olur (tasarımda henüz yok). Haber metninin tamamı kopyalanmaz, yalnızca başlık ve kısa özet. "Son Dakika" etiketi yalnızca kaynağın kendi işaretiyle verilir, uygulama kendi kendine "son dakika" demez. Aynı olayı anlatan farklı kaynaklar "İlgili Haberler"de bir arada gösterilir. Kaynak listesi herkese açık, siyasi yelpazeden çeşitli kaynaklar olur ve sıralama kronolojik ya da etkileşime göredir, editoryal seçim yok (tarafsızlık ilkesi). Mahkeme kararlı kaldırma/erişim engeli talepleri için süreç gerekir (avukatla teyit).
  - **Keşfet ile ilişkisi:** Keşfet > Genel zaten haber kategorileri taşıyor. Aynı haber motoru iki yeri besler: Keşfet'te özet akış, Haberler sayfasında tam okuyucu.
- **Yarışmalar (Eren'in kararı):** Bölge ve şehir bazında ödüllü veya ödülsüz yarışmalar olur. Admin yayınlar. Amaç uygulamayı yaygınlaştırmak. Örnek: ses yarışması, katılımcılar video yükler. Aşamalar: il birincisi, sonra bölge birincisi, sonra Türkiye birincisi. Birinciler **beğeniyle** seçilir, böylece katılımcılar çevresini uygulamaya çağırıp oy toplar. Belediyeler, STK'lar ve kaymakamlıklar da kendi yarışmalarını açabilir.
  - **Öneri (Eren onayladı) - oy güvenliği:** Beğeni sistemi en çok sahte hesap ve satın alınmış beğeniyle bozulur. Önlemler: oy vermek için giriş ve telefon doğrulaması, yeni açılan hesaplara oy kısıtı, kişi başı yarışmacıya tek oy ve günlük oy sınırı, kendine oy yok, olağandışı oy artışının otomatik tespiti, admin'in diskalifiye hakkı, sonuç açıklanmadan önce denetim.
  - **Öneri - adil sonuç:** Nüfus farkı (büyük il, küçük il) beğeniyle seçimde büyük ile avantaj sağlar. İl aşamasında beğeni yeterli. Bölge ve Türkiye aşamasında jüri + halk oyu karması ya da nüfusa göre düzeltilmiş oy önerilir.
  - **Öneri - hukuk ve şartname:** Her yarışmanın şartnamesi olur: katılım koşulları, 18 yaş altı için veli izni, içerik kullanım izni (yarışma videosunu tanıtımda kullanma), müzik ve eser telifi, ödül ve vergi, KVKK rızası, diskalifiye hakkı. **Ses yarışmasında müzik telifi:** kullanıcılar telifli şarkıları söylerse platform sorun yaşayabilir, lisans konusu avukatla netleştirilecek. Katılım ücretsizdir. Çekiliş (şansa dayalı) yarışmalar mevzuat araştırması bitene kadar yok.
  - **Karar (Eren): ses yarışmasında herkes istediği şarkıyı söyleyebilir** (sosyal medyadaki cover/düet kültürü gibi, ünlülerin düet istemesi yarışmayı büyütür). Claude riski belirtti: büyük platformlar müzik şirketleri ve meslek birlikleriyle lisans anlaşması yapıyor, CityJoy'un henüz böyle bir lisansı yok.
  - **Önerilen önlemler (Eren onayladı):** (1) Hak sahibi şikâyeti için hızlı kaldırma süreci ve şikâyet düğmesi. (2) Kullanım şartlarında içerik sorumluluğu ve telif beyanı. (3) Telifli parçalı videolar tanıtım ve reklamda kullanılmaz. (4) Lisans seçenekleri (meslek birlikleri, maliyet) araştırılır. (5) Yayından önce avukat görüşü. (6) Ödüllü final için orijinal eser şartı düşünülebilir. (7) Düet özelliği ileride değerlendirilir.
  - **Kurum yarışmaları:** Belediye, STK ve kaymakamlık kendi panelinden talep açar, admin şartname uygunluğunu onaylar, kendi bölgesinde yayınlanır.
  - **Öneri - yapım:** Yarışma motoru aşamalı olacak şekilde kurulur, ilk kampanya tek aşamayla başlayabilir.
- **Forum (Eren'in kararı): ilk sürümden çıkarıldı, gerekirse sonra eklenir.** Aşağıdaki plan o zaman için saklanıyor. Kalıcı soru-cevap ihtiyacı ilk sürümde Keşfet'teki "Soru/Yardım" kategorisi, kaydetme ve kategoriye göre filtre ile karşılanır (öneri).
  - Planlanan yapı (sonraya): kalıcı konu başlıkları. Amaç, bir bölgede açılan konunun Keşfet akışında kaybolmasını engellemek. Forum bölge (il/ilçe) etiketli kalıcı soru-cevap ve tavsiye yeridir. Keşfet akıp giden paylaşımdır.
  - **Kötüye kullanım riskleri ve önlemler (öneri, Eren onayladı):**
    1. *Gizli reklam ve sahte tavsiye* (işletme sahibinin kendini önermesi): "işletme sahibi" etiketi, yeni hesaplara kısıt, konu içinde telefon/dış bağlantı engeli, aynı işletmenin tekrar önerilmesinde uyarı.
    2. *Hatalı sağlık, hukuk ve finans tavsiyesi:* bu kategorilerde "profesyonel tavsiye yerine geçmez" uyarısı. İleride doğrulanmış meslek rozeti (doktor, avukat) düşünülebilir.
    3. *İftira ve hakaret* (örn. "şu usta dolandırıcı"): isim vererek suçlama yerine deneyim anlatımı kuralı, işletmeye cevap hakkı, şikâyet üzerine inceleme ve kaldırma süreci.
    4. *Troll, kavga, siyaset:* konu kilitleme, siyasi tartışma kategorisi kapalı veya ayrı.
    5. *Kişisel veri* (telefon, adres, plaka): otomatik tespit ve gizleme.
    6. *Eski bilgi:* konu tarihi görünür, belli süre sonra "bu bilgi eski olabilir" etiketi, "en yararlı cevap" seçimi.
    7. *Dolandırıcılık ve link spam'i:* günlük konu açma sınırı, otomatik filtre, şikâyet düğmesi.
  - **Moderasyon ölçeği (öneri):** 81 ilde moderasyonu tek merkezden yapmak zor. Güvenilir kullanıcılara il yöneticisinin verdiği yetkiyle "gönüllü moderatör" rolü (aşağıdaki rol tablosu).
- **Anketler (Eren'in kararı):** Admin panelinden yönetilir. Talep geldiğinde admin ücreti tahsil eder, ardından anketi yayınlar.
  - **Öneri (Eren onayladı) akış:** talep formu (talep eden, hedef bölge ve kitle, sorular, süre) → admin içerik ve hukuk uygunluğunu inceler → fiyat teklifi → ücret tahsilatı ve fatura → yayın → sonuç raporu. Sonuçlar toplu ve anonimdir, çok az cevap alan kırılımlar gösterilmez, talep eden katılımcıların kişisel verisini görmez. Sipariş edebilecekler: belediyeler, kurumlar, işletmeler, dernek ve STK'lar. Siyasi parti, aday ve seçimle ilgili anketler hukuk görüşü alınana kadar kapalı. Sonuçlar "uygulama kullanıcılarının görüşü" olarak etiketlenir, bilimsel veya temsili anket iddiası yapılmaz. Bölge/yaş/ilgi alanı hedeflemesi KVKK rızasına tabidir.
- **İndirimler (Eren onayladı):** Yalnızca doğrulanmış işletmeler indirim yayınlayabilir. İşletme kampanyayı kendi profilinden girer. Kampanyada tarih, şartlar ve geçerlilik kapsamı açıkça yazılır (sürprizsiz bilgi ilkesi). Doğrulanmamış işletme listede görünür ama indirim yayınlayamaz. Doğrulama ücretli olduğu için bu işletmelere teşvik de sağlar.
- SORULACAK: Kampanya sayısı ve öne çıkma için ücret kademeleri (gelir konusunda belirlenecek).

### 5.4 Acil İhtiyaçlar (`acil-ihtiyaclar.html`)
- **SOS - Aileme haber ver:** konumu anlık gönderir (7/24). Sayfa: `sos-aile.html`.
  - **Kurallar (Eren):** SMS yoktur, aile üyeleri uygulamayı indirmek zorundadır. Aile üyeleri profildeki "Ailem (SOS)" bölümünden CityJoy ID ile eklenir (`profil.html`). SOS'ta konum **yalnızca kayıtlı aile üyelerine** gider.
  - **Tasarımda olanlar:** 30 dakika canlı konum paylaşımı, "Güvendeyim" ve "Yardım Gerek" düğmeleri, fotoğraf/ses ekleme, her kişi için Teslim Edildi / Görüldü durumu, SOS geçmişi, test gönderimi.
  - **Karar (Eren, 27 Ekim 2026):** SOS türü seçimi (Acil, Yardım, Eve Dön, İlaç) yok; tek düğme. Durum gönderimden sonra "Güvendeyim" / "Yardım gerek" ile bildirilir.
  - **Karar (Eren, 27 Ekim 2026): SOS = gönderenin yardıma ihtiyacı var.** Başkasının durumunu sormak için değildir. Aileye "X yardım istiyor" diye gider ("Yardım gerek" düğmesi kaldırıldı; "Güvendeyim" kalır). **Konum, uygulama kapansa ya da ekran kilitlense de gitmeli** (başına bir şey gelirse telefon uygulamadan çıkabilir): SOS süresince arka planda konum, süre dolunca / "Güvendeyim" / "Durdur" ile kendiliğinden kapanır; Android'de bu sırada sistem bildirimi görünür. **Aile üyesi başka uygulamadayken de öğrenmeli:** telefonuna yüksek öncelikli, sesli bildirim (push) gider, kendi dilinde. Bildirim izni aile kurulurken ve SOS ekranındaki "SOS hazırlığı" bölümünde istenir. Bu bölümün telefonda denenmesi geliştirme derlemesiyle (EAS) yapılacak.
  - **Yapıldı (27 Ekim 2026):** Aile listesi (davet kodu: QR / bağlantı / elle; tek kullanımlık, 24 saat; karşılıklı; en çok 10 kişi), SOS (geri sayım + iptal, uygulama açıkken 30 dk canlı konum, Güvendeyim / Yardım gerek, Teslim edildi / Görüldü, geçmiş, deneme gönderimi; kayıtlar 30 gün sonra silinir), panelde yalnızca SOS ayarları. Eksik: telefona bildirim (geliştirme derlemesi), QR'ı kamerayla okutma, fotoğraf/ses ekleme, ID ile istek.
  - **Hukuki düzeltme (Eren onayladı, `sos-aile.html` içinde yapıldı):** `sos-aile.html` şu an "ailenize ve acil durum ekiplerine konumunuzu gönderebilirsiniz" diyor. Uygulama acil servislere bildirim göndermediği için bu cümle "kayıtlı aile üyelerinize" olarak düzeltilmeli. Ekranda ve kullanım şartlarında "Bu özellik resmi acil çağrı değildir, hayati tehlikede 112'yi arayın" uyarısı olur. Uygulama hiçbir acil servisi kendiliğinden aramaz. 112 vb. numaralar listesi (`acil-ihtiyaclar.html`) kullanıcı dokununca telefon aramasını açan düz bağlantı olarak kalır (Eren onayladı: bu liste kalır; avukat onayına tabi).
  - **Aile ekleme QR ile (Eren onayladı):** Bir kişi profilindeki "Ailem (SOS)" bölümünde kendi QR kodunu açar. Diğeri aynı bölümden kamerayı açıp QR'ı okutur ve kişi eklenir. Öneri: QR süreli ve yenilenebilir olsun, kamera izni gerekir. Prototiplerdeki telefon numarası ve düz ID alanları (`profil.html`, `sos-aile.html` örnek aile listesi) kaldırılacak. **Karar (Eren):** ekleme karşılıklıdır. SOS'a basınca konum aile listesindeki herkese aynı anda gider (aile bağı güçlensin). Öneri: karşı tarafın onayı ve istediği an listeden ayrılabilmesi korunur (istenmeyen bildirimi önlemek için).
  - **Uzaktaki aile üyesini ekleme (Eren onayladı, QR + davet bağlantısı + ID ile istek üçü birlikte):** QR yüz yüze ekleme içindir. Uzaktakiler için öneri iki yol: (1) **davet bağlantısı:** kullanıcı bağlantıyı kendi seçtiği uygulamadan (WhatsApp vb.) gönderir, bağlantı tek kullanımlık ve süreli olur (örn. 24 saat). Karşı tarafta uygulama yoksa mağazaya yönlendirir, kurulumdan sonra daveti kabul eder. (2) **Kullanıcı adı/ID ile istek:** istek gider, karşı taraf kabul etmeden hiçbir bildirim gitmez. Günlük istek sınırı olur, reddedilen veya engellenen kişi tekrar istek gönderemez. Uygulamanın kendisi SMS göndermez (Eren'in kararı).
  - **Önerilen güvenlik önlemleri:** Aile kişisi ekleme karşı tarafın onayıyla tamamlanır ve karşı taraf istediği zaman ayrılabilir (istenmeyen SOS bildirimlerini önlemek için). ID yerine QR ile ekleme kullanılır (aşağıya bakın). SOS yüksek öncelikli bildirimle gider. Ulaşılabilir aile üyesi yoksa ya da internet yoksa kullanıcıya açıkça söylenir ve 112'yi araması önerilir.
- Hayati acil numaralar, dokunup arama: 112, 155, 110, 156, 183, 187, 186.
- **Yeni düzen (Eren onayladı, 29 Ekim 2026):** ince SOS şeridi; "Dokun ve ara" (112 büyük, üç numara küçük, kalanlar "Diğer" ile açılır, uyarı tek satır); hizmet araması; "Hemen lazım olabilir" (panelde acil işaretli alt hizmetler, panel sırasıyla; nöbetçi eczane yakında); açılır "Tüm hizmetler" (ilk 3 kategori, kalanı "Diğer N kategori"); "Aradığın hizmet yok mu? Bildir". Örnek işletme listeleri, taksi durağı (veri yok), mikrofon ve robot asistan alınmadı. Acil ekranı için ayrı kırmızı tonları (açık ve koyu mod, beyaz yazı okunaklı).
- "Sana en yakın": nöbetçi eczane, taksi durağı.
- 50'den fazla hizmet kategorisi: sağlık, araç ve ulaşım, ev ve tesisat, tamirat, güvenlik, temizlik, kişisel bakım, evcil hayvan, nakliye, teknik servis, eğitim/ders, danışmanlık, organizasyon, gıda/market. "Eksik hizmet mi var? Bildir" ve hizmet sağlayıcı listesi.
- **CityJoy Asistan:** yapay zekâ destekli sohbet, il bazlı bilgi verir.
  - **Karar (Eren):** Asistan kapalı bir bilgi tabanıyla çalışır, bu verinin dışına çıkamaz (sınırları belli bir asistan). Uygulamada bilgi tabanı tek dosya değil, doğrulanmış veriler olur (il bazlı).
  - Öneri: Cevabın altında kaynağı gösterir. Bilgi tabanında yoksa "bilmiyorum" der, uydurmaz. Sağlık ve hukuk tavsiyesi vermez, acil durumda 112'ye yönlendirir. Günlük soru sınırı olur (maliyet). Cevaplayamadığı sorular kaydedilir ve "eksik bilgi" listesine döner (panelde görünür). Yayından önce yanlış cevap testleri yapılır.
- **Acil İhtiyaçlar'ın geri kalanı (standart ve öneri, Eren'in "standart şeyleri sormadan ekle" kararıyla):**
  - **Hizmet kategorileri:** iki seviyeli ağaç (ana kategori > alt kategori), admin yönetir. Başlangıç ana kategorileri tasarımdan: sağlık, araç ve ulaşım, ev ve tesisat, tamirat, güvenlik, temizlik, kişisel bakım, evcil hayvan, nakliye, teknik servis, eğitim ve ders, danışmanlık, organizasyon, gıda ve market (50'den fazla alt kategori). İşletmem'den eklenen işletmeler kategorisine göre otomatik buraya düşer. "Eksik hizmet mi var? Bildir" şikâyetleri il yöneticisi kuyruğuna gider.
  - **Yapıldı (27 Ekim 2026):** Kategori ağacı (14 ana, 88 alt, 5 dil) uygulamada ve panelde. Nöbetçi eczane kategori değil, ayrı özellik. Tekrarlar birleştirildi (psikolog yalnızca Sağlık'ta, boya badana tek). Acil işaretli alt kategoriler: özel ambulans, acil veteriner, acil diş, yol yardım, çekici, oto kurtarma, çilingir, tesisatçı, elektrikçi, doğalgaz servisi (panelden değiştirilebilir). "Eksik hizmet bildir" önerileri şimdilik admin panelinde; il yöneticisi kuyruğu yetki kayıtlarıyla gelecek.
  - **Doğrulanmış hizmet yoksa (öneri, ONAY BEKLİYOR):** Acil kategorilerde (çilingir, çekici, acil tesisat vb.) yalnızca doğrulanmış işletme listelenir. İlk sürümde doğrulanmış işletme sayısı az olacağından liste boş kalabilir. Bu durumda ilgili resmi numara veya kurum gösterilir, doğrulanmamış seçenekler ayrı bölümde "doğrulanmadı" etiketi ve belirgin uyarıyla sunulur.
  - **Sana en yakın:** nöbetçi eczane (veri havuzu, günlük güncellenir) ve taksi durağı. Konum izniyle mesafe gösterilir. Taksi durağı ve sağlık kuruluşları (hastane, acil servis) için veri kaynağı araştırılacak.
  - **Acil numaralar:** 112, 155, 110, 156, 183, 187, 186 (tasarımdaki liste). Ülke genelinde ortak veri, dokununca telefon aramasını açan düz bağlantı.
  - **Yapıldı (27 Ekim 2026):** Uygulamada Acil İhtiyaçlar ekranı ve panelde "Acil numaralar" sayfası (yalnızca admin değiştirir, il yöneticisi görür; silinmez, pasifleştirilir; her değişiklik işlem kaydına). Liste herkese açık okunur (girişsiz de), telefonda saklanır ve uygulamaya gömülü başlangıç listesiyle internetsiz de çalışır. **Numara düzeltmesi (Claude, güvenlik):** tasarımda 183 "Su Arıza", 187 "Elektrik", 186 "Doğalgaz" yazıyordu. Doğrusu: 183 ALO Sosyal Destek (aile, kadın, çocuk), 185 su arızası, 186 elektrik arızası, 187 doğalgaz acil. Başlangıç listesi: 112, 155, 110, 156 (bu üçü "112'ye bağlanır" notuyla), 183, 185, 186, 187. Panelden numara eklenebilir/değiştirilebilir.
  - **Asistan limitleri (öneri):** ilk sürümde metin tabanlı, kullanıcı başına günlük soru sınırı (başlangıç önerisi günde 10, panelden ayarlanır), beş dilde. Cevaplayamadığı sorular "eksik bilgi" listesine düşer.
- **İş kuralı (Eren):** Kullanıcının profilindeki "İşletmem" bölümünden eklediği işletme, kategorisine göre bu modülde (araç/ulaşım, ev/tesisat, tamirat, güvenlik/sigorta, tüm şehir hizmetleri vb.) **otomatik görünür**. Böylece kişi şehrindeki bir hizmeti burada da bulabilir (bkz. 5.6).
- SORULACAK: Hizmet sağlayıcıların doğrulaması kim yapar, ücret var mı? (Yapay zekâ asistanının sınırı bölüm 5.4'te öneri olarak yazılı.)

### 5.5 Keşfet: uygulamanın sosyal medyası
Alt gezinme: Keşfet, Reels, Mesajlar, Ara, Profil. Gönderi paylaşma: `yeni-gonderi.html`.

Sekmeler:
- **Mahallem** (`kesfet-mahallem.html`): mahalledeki belediye, muhtar, esnaf ve komşu paylaşımları.
- **Bölgesel** (`kesfet-bolgesel.html`): il ve ilçe etiketleriyle akış (örnekte BursaGenel, Osmangazi, Nilüfer, Yıldırım, Gürsu). Alt sayfalar: kesfet-bursagenel, kesfet-osmangazi, kesfet-nilufer, kesfet-yildirim, kesfet-gursu.
- **Genel** (`kesfet-genel.html`): haber akışı, kategoriler: Tümü, Gündem, Dünya, Ekonomi, Spor, Teknoloji.
- **Takip** (`kesfet-takip.html`): takip edilen hesapların gönderileri.

**Görünürlük kuralları (Eren):**
- Mahallem sekmesinde kullanıcı yalnızca kendi kayıtlı mahallesinin gönderilerini görür. Bölgesel sekmesinde yalnızca kendi ilini. Genel sekmesinde Türkiye ve dünya gündemini. Takip sekmesinde sadece takip ettiklerini.
- Gönderi paylaşırken (sağ üstteki + düğmesi, `yeni-gonderi.html`): yazı, video, fotoğraf veya albüm eklenir, altta **"Nerede paylaşırsın?"** seçimi gelir: Mahallem, Bölgesel, Genel, Takip. Kullanıcı gönderisinin kime görüneceğini kendisi belirler.
- **Karar (Eren, 28 Ekim 2026): birden fazla hedef seçilebilir.** Aynı gönderi işaretlenen her sekmede (Mahallem, Bölgesel, Genel, Takip) görünür.
- **Akış sıralaması (Eren onayladı):** Acil duyurular akışın en üstünde sabit görünür. Diğer resmi gönderiler (muhtar, belediye) kullanıcı gönderileriyle zaman sırasına göre karışık akar.

**Keşfet kuralları (Eren onayladı):**
1. **Hesap türleri:** kişisel, işletme, muhtar, belediye/kurum, başkan. Resmi hesaplar doğrulanmış rozetle çıkar.
2. **Gönderi sınırları:** albümde en fazla 10 fotoğraf. Video süre sınırı: gönderi videosu 60 sn, Reels 90 sn (depolama maliyeti nedeniyle).
3. **Yorumlar:** gönderi sahibi yorumları kapatabilir. Belediye gönderilerinde yorum modu açık, onaylı ya da kapalı seçilebilir.
4. **Mesajlaşma:** takipleşilmeyen kişilerden gelen mesaj "istek" olarak düşer. 18 yaş altı kullanıcılara yetişkin yabancılar mesaj atamaz.
5. **Mahalle istismarı önlemi:** mahalle değişikliği ayda bir kez yapılabilir. İsteyen konumunu doğrulayıp rozet alabilir.
6. **Gönderi kategorileri:** Duyuru, Etkinlik, Fırsat, Soru/Yardım, Kayıp-Buluntu, Taziye, Genel. Taziye gönderisini yalnızca muhtar ya da yakını paylaşabilir.
7. **Anonim paylaşım yoktur.**
8. **Moderasyon:** otomatik kelime filtresi, şikâyet düğmesi, birkaç şikâyette gönderi geçici gizlenir ve il yöneticisinin kuyruğuna düşer. Yasaklı içerik: nefret söylemi, taciz, dolandırıcılık, spam reklam, uygunsuz görsel.
9. **Emlak ilanı (Eren onayladı):** Keşfet gönderilerinde satılık/kiralık taşınmaz ilanı verilemez. Algılanan gönderiler kullanıcıya Emlak bölümüne yönlendirilir (yetki doğrulaması orada yapılır). Gerekçe: bölüm 5.1'deki emlak ilanı yükümlülükleri.

**Durum (28 Ekim 2026): 1. aşama yapıldı** (DURUM.md 23): yazılı gönderi, Mahallem/Bölgesel/Genel sekmeleri ve çoklu hedef, kategoriler, beğeni, şikâyet ve panel moderasyonu, emlak ilanı sezgisi, taziyede yakınlık beyanı. **2. aşama yapıldı** (DURUM.md 24): yorumlar (sahibi kapatır, yorum şikâyeti ve panel moderasyonu), kaydetme ve Kaydettiklerim. **3. aşama yapıldı** (DURUM.md 25): Keşfet profili, takip ve Takip sekmesi, gizli hesap ve takip istekleri, engelleme, profil şikâyeti. **4. aşama yapıldı** (DURUM.md 26): resmî duyurular akışta karışık, yasaklı kelime süzgeci (liste panelden). Sırada: fotoğraf/video (Storage, Blaze), Genel sekmesine haber akışı, alt gezinme çubuğu (tasarım uygulamasıyla).

Gönderi türleri (örneklerden): Kurumsal (belediye), Duyuru (muhtar), Yeni/Hoş geldin (işletme), Vefat/taziye, Fırsat (indirimli kampanya), kullanıcı paylaşımı (ruh hali etiketiyle, örn. "Keyifli"), yetkili hesaplar için "Başkan" etiketi. Beğeni, yorum, paylaş (WhatsApp, Telegram, Twitter, link), kaydet.
Doğrulanmış hesap işareti (mavi tik) ve profil sayfaları var (profil-belediye, profil-muhtar, profil-baskan vb.).
- SORULACAK: Kim doğrulanmış hesap olur ve nasıl doğrulanır? Mahalle muhtarı hesapları nasıl açılır? (Mesajlaşma birebirdir, grup sohbeti ve Reels ilk sürümde yok: karar verildi.)

### 5.6 Profil: "İşletmem"
- Kayıtlı her kullanıcı profilinden işletme ekleyebilir: dükkân sahibi, evden satış yapan biri (örn. yumurta), evden tesisat işi yapan biri veya sanal mağaza açmak isteyen herkes.
- Eklenen işletme, kategorisine göre Acil İhtiyaçlar modülünde ve "Tüm Şehir Hizmetleri" listesinde otomatik görünür. İçerik kapasitesi sınırlı olacak, her şeyi satan bir mağaza platformu hedeflenmiyor.
- **Doğrulama modeli (Eren):** Eklenen işletme önce "doğrulanmadı" görünür. Doğrulanmak için ücret öder (Eren'in verdiği örnek: yaklaşık 1000 TL, kesin tutar sonra belirlenecek), gerekirse ekiple görüntülü görüşür ve evrak sunar. Evrak listesi hazırlanacak ve araştırılacak. Doğrulanan işletme kendi sayfasına ve yorum bölümüne kavuşur.
- **Vizyon (Eren):** İşletmeleri şehirlerde yeni bir pazar yerine dönüştürmek.
- Öneri (Eren onayladı): Doğrulanmamış işletmeler "doğrulanmadı" etiketiyle ve daha aşağıda listelenir. Şikâyet ve puanlama olur. Özellikle çilingir, çekici, ambulans gibi acil kategorilerde dolandırıcılık riskine karşı doğrulama aranır. İlk sürümde işletme vitrini ve iletişim bilgisi yeterlidir, uygulama içi ödeme ve satış sonraya bırakılır (elektronik ticaret mevzuatı yükümlülükleri doğurur).
- **Karar (Eren, 27 Ekim 2026): hizmet listelerinde sıralama.** En üstte "Reklam" etiketli, sayısı sınırlı (en fazla 2) ücretli öne çıkan kart. Öne çıkma yalnızca belgeleri doğrulanmış işletmelere verilir (Claude, güvenlik standardı: acil kategorilerde dolandırıcılık riski). Altında herkes aynı kuralla sıralanır: önce doğrulanmışlar, sonra yorum sayısını da hesaba katan puan (az yorumla yüksek puan öne geçemez), sonra yakınlık (ilçe) ve bilgi güncelliği. Üyelik kademesi sırayı gizlice yükseltmez; kademe yalnızca vitrin kapasitesini artırır. Kural herkese açık yazılır (bölüm 1.2). Reklam mevzuatı avukatla netleştirilecek.
- **Değerlendirme kuralları (Claude, Eren "gerekeni yap" dedi; 27 Ekim 2026, yapıldı):** Yalnızca giriş yapmış ve işletmeyi uygulamadan arayan ya da WhatsApp'tan yazan kişi değerlendirir (bölüm 13 madde 17'deki kural). Kişi başına işletme başına bir değerlendirme (1-5 yıldız, 10-500 karakter), düzenlenebilir ve silinebilir; sahibi kendine yazamaz. Ad "Ayşe K." biçiminde gösterilir. İşletmenin cevap hakkı vardır. Her yorum şikâyet edilebilir (hakaret/iftira, sahte, kişisel bilgi, ilgisiz, diğer); yönetim gizler, gizlenen yorum puandan düşer. Puan, yorum sayısını hesaba katan sıralamada kullanılır. Aynı telefon numarasıyla ikinci işletme kaydı açılamaz. Sonra: şikâyet eşiğinde otomatik gizleme ve il yöneticisi kuyruğu, kelime süzgeci, sahiplik talebi.

### 5.7 İşletme kayıt akışı: Profil > İşletme ekle (Eren onayladı)

**Eren'in hedefi:** İşletme bilgilerini kullanıcı **tek sefer** girer, bilgiler bir **veri havuzuna** yazılır, işletme kategorilenir ve gereken bilgiler gereken yerlere otomatik işlenir. Böylece insanların ihtiyaçları bu toplanan verilerle karşılanır.

**Akış (Eren onayladı):**
1. **İşletme türü:** esnaf/dükkân, hizmet veren (usta vb.), evden üretim/satış, yeme-içme, konaklama, yol üstü tesis, emlak işletmesi. Belediye, kurum, STK, kulüp ve muhtar hesapları bu akıştan ayrı, kendi onay sürecinden geçer. Bir işletme birden çok kategoriye girebilir, bir kişi birden çok işletme ekleyebilir.
2. **Ortak bilgiler (bir kez girilir):** ad, kategori(ler), konum (haritada işaretleme), il/ilçe/mahalle, çalışma saatleri (7/24, tatil günleri), iletişim (arama, WhatsApp), hizmet bölgesi (mobil hizmet veren ustalar için hizmet verdiği ilçeler), kısa tanıtım, hizmet dilleri (5 dil), ödeme yöntemleri, erişilebilirlik, fotoğraflar (üyelik kademesine göre).
3. **Kategoriye özel alanlar (bilgi şablonu):** usta: hizmet ve fiyat listesi, yaptığı işler, belgeler. Konaklama: oda tipleri, ücret tablosu, olanaklar, aile ölçütleri, izin/işletme belgesi numarası. Yeme-içme: menü ve fiyat, çocuk menüsü, aile alanı. Yol üstü: hizmet işaretleri (tuvalet, yemek, akaryakıt, mescit, şarj, 7/24), güzergâh ve yön. Emlak işletmesi: yetki belgesi numarası. Kampanya (indirim) modülü yalnızca doğrulanmış işletmelerde.
4. **Otomatik dağıtım ve önizleme:** Kayıt bitince sistem kategoriye göre bilgiyi ilgili yerlere yerleştirir: Acil İhtiyaçlar (hizmet kategorisi), Benim Şehrim (kafe-restoran vb.), mahalle sayfası, Sosyal Harmoni (indirimler), Seyahat (konaklama, yol üstü), ilan platformu. İşletme sahibi **önizlemede** "bu bilgilerle şu yerlerde görüneceksiniz" listesini görür ve istemediği yeri kapatabilir.
5. **Doğrulama (ücretli):** belge yükleme, ücret, riskli kategorilerde görüntülü görüşme, onay, rozet ve açılan özellikler (kampanya, üst kademeler). Doğrulanmadan da işletme listelenir ama "doğrulanmadı" etiketiyle.
6. **Güncel tutma:** Belirli aralıkla "bilgileriniz hâlâ doğru mu?" hatırlatması. Güncellenmeyen sayfada "bilgi eski olabilir" etiketi. Kullanıcılar "yanlış/eksik bilgi bildir" ve konum doğrulamalı kısa geri bildirim verir.

**Öneri (Eren onayladı) - güvenlik ve kalite:**
- **Sahiplik doğrulaması:** Başkası adına veya rakibinin işletmesini kaydetmeyi önlemek için işletme telefonuna doğrulama kodu ya da arama. Aynı işletmenin ikinci kaydı engellenir, "bu işletme zaten kayıtlı, sahibiyseniz sahiplik talep edin".
- **Önceden doldurulmuş sayfalar ve "Sahiplen" modeli:** Açık veri ve resmi kaynaklardan hazırlanmış işletme sayfaları, sahibi tarafından sahiplenilerek doğrulanır. Boş başlangıcı çözer, ama veri kaynaklarının lisansı araştırılmadan kullanılmaz.
- **Ev işletmeleri için gizlilik:** Evden satış veya hizmet verenlerin ev adresi gösterilmez, mahalle düzeyinde konum yeterlidir. Telefonun herkese açık olup olmaması sahibinin seçimidir.
- **Kişisel veri ayrımı:** Herkese açık iş bilgileri ile gizli belgeler (kimlik, vergi levhası) ayrı tutulur, belgeleri yalnızca doğrulama ekibi görür, saklama süresi tanımlanır (KVKK).
- **Gıda ve sağlık gibi düzenlemeli kategoriler** için ek yasal şartlar ve uyarılar araştırılacak.
- **Doğrulama ücreti ödemesi:** Uygulama mağazalarının (özellikle Apple) uygulama içi ödeme kuralları nedeniyle ücretin web üzerinden/panelden tahsil edilmesi araştırılacak (mağaza kuralları ve vergi/fatura düzeni).

### 5.8 Profil ve ayarlar (Eren: Instagram'daki profil örneği gibi)

- **Herkese açık (Eren'in kararı):** kullanıcı adı, ad, profil fotoğrafı, kısa tanıtım, gönderi/takipçi/takip sayıları, gönderiler (paylaşırken seçilen hedefe göre), doğrulanmış hesap rozeti, istenirse işletme sayfası bağlantısı.
- **Gizli (Eren'in kararı):** yaş (doğum yılı), cinsiyet, meslek ve **mahalle** diğer kullanıcılara gösterilmez. Bu bilgiler yalnızca bildirim hedefleme ve içerik filtreleme için sistem tarafından kullanılır.
- **Aile (SOS) listesi** yalnızca sahibine ve listedeki aile üyelerine görünür. İşletme bilgileri işletme sayfasında sahibinin seçtiği kadar görünür.
- **Not (Mahalle gizliliği):** Mahallem sekmesinde paylaşılan gönderi o mahalledekilere görünür, bu yüzden paylaşan kişinin o mahallede olduğu dolaylı olarak anlaşılır. İlk Mahallem paylaşımında bunu söyleyen kısa bir bilgilendirme gösterilir.
- **Standart Instagram benzeri ayarlar (sormadan eklenir):** açık/gizli hesap ve takip istekleri (13-17 yaş hesapları varsayılan gizli), kimin yorum yapabileceği, etiketleme ve mesaj isteği ayarları (yetişkinler küçük yaşa mesaj atamaz), engelle, sessize al, şikâyet et.
- **Standart hesap ayarları (sormadan eklenir):** bildirim kategorileri ve sessiz saatler, dil değiştirme, konum izni yönetimi, parola değiştirme, oturum ve cihazlar, verilerimi indir, hesabı sil, yasal metinler (kullanım şartları, gizlilik, aydınlatma), yardım ve destek, hakkında.

### 5.9 Reels (Eren'in kararı: ilk sürümde yok)

Ayrı Reels sekmesi ilk sürümde yoktur (video depolama ve aktarım maliyeti, moderasyon yükü, ayrı akış sistemi nedeniyle). Kısa videolar Keşfet gönderisi (60 sn) ve yarışma videosu (90 sn) olarak yüklenir. Reels ikinci sürümde kullanım ve veriye göre değerlendirilir. Alt gezinmeden Reels kaldırılır.

### 5.10 Ara (standart, sormadan eklenir)

Üstte arama kutusu. Sekmeler: Tümü, Kişiler, İşletmeler, Yerler, Etkinlikler, Gönderiler. Son aramalar (silinebilir), önerilen aramalar, hizmet kategorilerine hızlı erişim (usta, nöbetçi eczane, tuvalet vb.). Sonuçlar seçili il/ilçeye göre süzülür, doğrulanmış işletmeler önce gelir. Yazım hatası ve Türkçe karakter toleransı, beş dilde arama. Engellenen kullanıcılar sonuçlarda görünmez, gizli hesaplar yalnızca ad ve kullanıcı adıyla bulunur.

- **Yapıldı (28 Ekim 2026):** ana sayfadaki arama kutusundan açılan Ara ekranı, altı sekme, son aramalar, panelden yönetilen önerilen aramalar (Panel > Moderasyon), hızlı erişim. Ücretli arama hizmeti olmadan: ad ve yazılardan kelime başı "arama anahtarları" üretilir (Türkçe karakter ve tek harf hatası toleranslı). Arayüz beş dilde; içerik Türkçe girildiği için arama içeriğin kendi diliyle yapılır. Kullanıcı adı alanı henüz yok, kişiler adla bulunur. Ayrıntı DURUM.md 28. madde.

### 5.11 Mesajlar (standart ve öneri)

- **Standart (sormadan eklenir):** birebir mesajlaşma, takipleşilmeyen kişilerden gelenler "mesaj isteği" olarak düşer, **yetişkinler küçük yaş gruplarına mesaj atamaz**, engelle ve şikâyet et, mesaj silme, okundu bilgisi kapatılabilir, yeni hesaplara günlük mesaj sınırı (spam), sohbette IBAN/kapora/dış bağlantı geçerse dolandırıcılık uyarısı, ilan kartıyla başlayan sohbetler (ilan platformu).
- **Kapsam (Eren onayladı):** ilk sürümde metin ve fotoğraf, video ve ses mesajı yok. **Grup sohbeti ilk sürümde yok** (moderasyon ve maliyet).
- **KVKK ve güvenlik:** mesaj saklama süresi tanımlanır, şikâyet edilen mesajlar inceleme için görülebilir, bu kullanım şartlarında belirtilir.
- **Yapıldı (28 Ekim 2026):** birebir yazılı sohbet, mesaj istekleri (takipleşmeyenler), yetişkin ile 13-17 yaş arası yazışma kapalı, engel, mesaj silme, şikâyet (admin yalnızca şikâyet edilen mesajın kopyasını görür), okundu bilgisini kapatma, günlük yeni sohbet sınırı (yeni hesapta 10, sonra 30), IBAN / kapora / bağlantı uyarısı. Kalan: mesaj bildirimi, saklama süresi (TTL, Blaze), ilan kartıyla başlayan sohbet. Ayrıntı DURUM.md 29. madde.

### 5.12 Bildirimler (standart)

Bildirim merkezi, kategorilere göre (duyuru, etkinlik, mesaj, takip, yarışma, güvenlik/SOS), okundu/okunmadı. Kategori bazında açma-kapama ve sessiz saatler. Acil kamu duyuruları ve SOS bildirimleri varsayılan olarak açıktır, kapatılırsa kullanıcı uyarılır. Kampanya bildirimleri için ayrı izin (bölüm 3.1).

- **Yapıldı (28 Ekim 2026):** uygulama içi bildirim merkezi (ana sayfada zil, son 14 gün, okundu/okunmadı), tür başına aç/kapa (acil ve SOS kapatılırken uyarı), sessiz saatler; Panel > Bildirimler'de admin bildirim üreten olayları seçer (acil ve SOS kapatılamaz). Sunucu işlevi olmadan: liste uygulamanın okuduğu kaynaklardan toplanır. Telefona anlık bildirim ve panelden gruba bildirim (bölüm 7) sonra. Yarışma türü yarışmalarla gelecek. Ayrıntı DURUM.md 30. madde.

## 6. Roller ve yönetim panelleri

| Rol | Kapsam | Ne yapabilir (öneri taslağı) |
|---|---|---|
| Admin | Tüm uygulama | Her şeyi yönetir: iller, roller, modüller, denetim, bildirim |
| İl yöneticisi | Kendi ili | İlin içeriğini ve ilçe/belediye hesaplarını yönetir |
| Belediye / kurum / belediye başkanı | Anlaşmalı olduğu bölge | Yetkilendirildiği modüllerde içerik girer, duyuru ve bildirim gönderir |
| Kulüp / spor kuruluşu | Kendi sayfası | Sayfasını, duyurularını ve fikstürünü yönetir (il yöneticisi onaylar) |
| Gönüllü moderatör (öneri) | İl yöneticisinin atadığı bölge | Şikâyetleri görür, forum konusunu kilitler veya gizler, il yöneticisine yükseltir |
| Haber yayıncısı (öneri) | Kendi sitesi | RSS adresini ekler, bölge ve kategori seçer, tıklama istatistiğini görür (alan adı doğrulanır) |
| Kullanıcı | Kendi hesabı | Okur, paylaşır, yorum yapar, takip eder |

Eren'in kuralı: **herkes yalnızca kendi panelinden, kendine yetkilendirilen kadarını** uygulamaya etki ettirebilir.
- Yetki iki eksenlidir: **bölge** (il/ilçe/mahalle) ve **modül** (hangi bölüme yazabilir).
- ~~Karar (Eren): yetkiyi yalnızca admin verir ve geri alır. İl yöneticisi yetki veremez.~~ **27 Ekim 2026'da değişti, bkz. 6.7:** admin herkese ve tüm kurumlara verir; il yöneticisi kendi ilindeki muhtarlara (ve gönüllü moderatörlere) verir; kurum kendi personeline verir. Kimse kendinde olmayan yetkiyi veremez.
- **Karar (Eren): herkes kendi alanında.** Büyükşehir belediyesi il geneli içerik girer, ilçe belediyesi yalnızca kendi ilçesine. İkisi aynı yere içerik girerse her içerikte kimin girdiği yazar. Kimse diğerinin içeriğini düzenleyemez.
- **Karar (Eren): işletmeler için ayrı panel yok (ilk sürüm).** İşletme sahipleri her şeyi mobil uygulamadaki Profil > İşletmem bölümünden yapar. İhtiyaç olursa sonra eklenir.

### 6.1 Panel mimarisi (Eren'in "panel her özellikle birlikte büyür" ilkesi)

- **Tek yönetim paneli (web), menüsü yetkiye göre değişir.** Admin, il yöneticisi ve belediye/kurum kullanıcıları aynı panel uygulamasına girer, ama her biri yalnızca yetkisi olan bölgeyi, modülü ve işlemi görür. Dört ayrı panel yazılmaz.
- **Her içerik türü bir tanımla kaydedilir:** ad, alanlar (5 dilde metin dahil), hangi modüle ve konum düzeyine (il/ilçe/mahalle) bağlı olduğu, kimler ekleyip onaylayabileceği. Yeni bir içerik türü eklenince panelde liste, ekleme, düzenleme, silme ve onay ekranları bu tanımdan hazır şablonla oluşur.
- **Yetki matrisi:** rol × bölge kapsamı × modül × eylem (görüntüle, ekle, düzenle, sil, onayla, bildirim gönder).
- **Karar (Eren, 29 Ekim 2026): sürükleyerek sıralama.** Sırası olan her listede (gezilecek yerler, hazır rotalar, yöresel, rota durakları, acil numaralar, meslekler, hizmet kategorileri) satırın solundaki tutamaktan tutup sürükleyerek sıra değiştirilir; fare, dokunmatik ve klavye (↑ ↓) ile çalışır. Yeni sıra "Yeni sıralamayı kaydet" ile yazılır ve işlem kaydına girer. Yeni sıralı liste eklenince aynı bileşen kullanılır. Başkanlarla Keşif bilerek dışarıda: sıralama nüfusa göre (Karar, Eren). Bölgeler ve iller coğrafi, elle sıralanmaz.
- **Her özelliğin "bitti" tanımı:** (1) uygulamada çalışır, (2) panelde yönetilebilir, (3) yetki kuralı tanımlı, (4) yapılan işlem kayıt altına alınır, (5) gerekiyorsa bildirim tetikleyicisi vardır, (6) KVKK/mağaza etkisi kontrol edilmiştir.
- **Gerçekçi beklenti:** İçerik yönetimi ve yetkilendirme ekranlarının büyük kısmı bu şekilde kendiliğinden oluşur. Ama bazı özel ekranlar ayrıca yapılmalı: işletme doğrulama inceleme kuyruğu, ücret/fatura ve ödeme takibi, anket siparişleri, istatistik ve raporlar, şikâyet/moderasyon kuyruğu. Bunlar ilgili özellikle birlikte planlanır.

### 6.2 Belediye paneli özellik listesi (Eren onayladı)

Aşağıdaki 24 madde belediye panelinin kapsamıdır. Her biri 6.1'deki ilkeye göre uygulamadaki karşılığıyla birlikte yapılır. Belediye başkanı ve muhtarlıklar da aynı panelin farklı yetki düzeyleridir.

**A. Yayın ve duyuru**
1. Resmi gönderi paylaşma (yazı, fotoğraf, video, albüm) ve hedef seçme (mahalle, bölgesel, genel)
2. Belediye profili: doğrulanmış rozet, logo, iletişim, çalışma saatleri
3. Etkinlik ve aktivite girme (takvim, kontenjan, katılım listesi)
4. Haber ve duyuru yayınlama (taslak, planlı yayın)
5. Yarışma açma
6. Acil duyuru: kesinti, yol kapanması, afet uyarısı (doğrudan gider)
7. Anket sipariş etme (ücretli, Eren'in ekibi girer)

**B. Hizmet bilgileri**
8. Belediye hizmetleri: açıklama, gerekli evrak, başvuru bağlantısı
9. Önemli kurumlar, müzeler, parklar, pazar yerleri, otopark bilgilerini güncelleme
10. Ulaşım duyuruları (hat değişikliği, sefer iptali)
11. Vatandaş talep kutusu: şikâyet/istek, panelden cevap ve durum takibi

**C. Bildirim**
12. Hedefli bildirim (kendi bölgesi içinde, yaş/cinsiyet/ilgi filtresiyle)
13. Hazır şablonlar ve planlı gönderim
14. Kampanya bildirimleri için onay kuyruğu

**D. Etkileşim**
15. Gönderi yorumlarına cevap, uygunsuz yorumu şikâyet etme veya gizletme
16. Vatandaş mesajları için ortak gelen kutusu (birden çok personel)

**E. Ekip ve yetki**
17. Personel ekleme ve rol verme (hazırlayan, onaylayan, izleyen)
18. İç onay akışı (hazırla, onayla, yayınla)
19. Faaliyet kaydı (kim, neyi, ne zaman yaptı)
20. Belediye başkanı için ayrı hesap ve başkan duyuruları (Seyahat'te öne çıkarma dahil)
21. Muhtarlık hesaplarını bağlama (her muhtar yalnızca kendi mahallesi)

**F. Rapor**
22. Gönderi ve bildirim performansı
23. Anonim bölge istatistikleri
24. Talep kutusu raporu
25. Keşif rotası ve tanıtım videosu girme (ilçe tanıtımı: Seyahat > Keşfet ve Öğren > Başkanlarla Keşif)

**Yapıldı (27 Ekim 2026):** 1 (yazılı resmî duyuru, hedef il / ilçe / mahalle; fotoğraf sonra), 4 (taslak; planlı yayın sonra), 6 (acil duyuru: en üstte, bitiş tarihli, il / admin onayına girmez), 17 ve 18 (kutucuklu görevler, hazırla > onayla > yayınla), 19 (işlem kaydı). Muhtar duyurusu "Onaysız yayınla" yoksa il yöneticisinin onayına gider (6.7).

**Yapıldı (28 Ekim 2026), 2. madde:** resmî profil (rozet, tanıtım, iletişim, adres, çalışma saatleri; logo sonra, Storage). Panel > Resmî profil: kurum yöneticisi kendi kurumunu, muhtar kendi mahallesini, admin her kurumu düzenler; ad ve bölge kurum kaydından gelir. Uygulamada duyuru ve etkinlikte yayınlayana dokununca açılır.

**İlk sürüm önerisi (Eren onayladı):** 1, 2, 3, 4, 6, 8, 12, 14, 15, 17, 18, 19. (18. madde, Eren'in kurum içi onay kararıyla ilk sürüme eklendi, bölüm 6.6.) Talep kutusu (11) ikinci aşamaya: cevap beklentisi doğurur, belediyenin hazır olması gerekir. Geri kalanı sonraki aşamalarda.
- Onay kuyruğu (14): **Karar (Eren): önce il yöneticisi, sonra admin** (iki aşamalı onay, bölüm 6.5).

### 6.3 İl yöneticisi paneli (kapsam: kendi ili)

Eren'in onayıyla ilk sürüm seçimi Claude'a bırakıldı. Tam liste ve ilk sürüm işareti:

| # | Özellik | İlk sürüm |
|---|---|---|
| 1 | İlçe/mahalle yapısını görme; belediye, kurum, muhtar hesabı açma ve yetki **talebi** oluşturma (yetkiyi admin verir, bölüm 6.5) | Evet |
| 2 | İldeki belediye hesaplarının faaliyetlerini izleme | Sonra |
| 3 | Moderasyon kuyruğu (şikâyet edilen gönderiler, onay bekleyen etkinlikler) | Evet |
| 4 | İşletme doğrulama: evrak inceleme, görüntülü görüşme planı, onay/ret ve gerekçe | Evet |
| 5 | Uygunsuz içeriği kaldırma, kullanıcı uyarma veya geçici engelleme | Evet |
| 6 | İl geneli sabit veriler (müze, otopark, ulaşım, park/pazar, il vitrini) | Evet |
| 7 | Seyahat > Keşfet ve Öğren hikâyeleri, başkan öne çıkarma verileri | Sonra |
| 8 | İl haberleri ve il geneli etkinlikler | Sonra |
| 9 | İl geneli bildirim gönderme | Evet |
| 10 | Kampanya bildirimleri onay kuyruğu | Evet |
| 11 | Doğrulama ücreti ve anket siparişi takibi | Sonra |
| 12 | İşletme paketleri ve öne çıkan işletmeler | Sonra |
| 13 | Gelirden il yöneticisine pay verilip verilmeyeceği | SORULACAK |
| 14 | İl raporu: kullanıcı, aktif kullanıcı, modül kullanımı, işletme sayısı, belediye performansı | Evet |

**Onay seviyeleri ve il yöneticisi için ayrı uygulama (Eren'in fikri, ayrıntılar SORULACAK):** Eren, il yöneticisi için ayrı bir uygulama düşünüyor. Bazı işlemler doğrudan onaylanacak, bazıları haftalık onaya girecek.
- **Öneri - üç seviye:** (A) *Doğrudan yetki:* düşük riskli işler (kendi ilinde sabit veri güncelleme, ilçe duyurusu). (B) *Haftalık onay:* işlem hemen yürür ya da bekletilir (türüne göre), admin haftalık toplu inceler, gerekirse geri alır (örn. işletme doğrulamaları, etkinlik yetkisi verme, kulüp onayları). (C) *Her seferinde admin onayı:* yüksek riskli işler (iade ve ücret işlemleri, hesap kapatma veya yasaklama, il geneli bildirim, belediye hesabı açma).
- **Yetki seviyesi il yöneticisi başına ayarlanır:** yeni yöneticiler daha sıkı başlar, güven kazandıkça seviye yükseltilir. Her işlem kayıt altındadır, admin'e otomatik haftalık özet rapor gider.
- **Uygulama biçimi (öneri):** İlk sürümde aynı web panelinin mobil uyumlu hali, saha işleri için (işletme ziyareti, görüntülü görüşme, belge inceleme) ayrı bir mobil uygulama sonraki aşamada.

### 6.4 Admin paneli (kapsam: tüm uygulama)

| # | Özellik | İlk sürüm |
|---|---|---|
| 1 | 81 il, ilçe ve mahalle verisini yönetme ve içe aktarma | Evet |
| 2 | Rol ve yetki matrisi tanımlama; il yöneticisi atama ve geri alma | Evet |

**Yapıldı (27 Ekim 2026), 2. ve 12. madde:** Panel > Yetkiler (rol × bölge × bölüm × eylem, süreli, geri al / yeniden ver; e-postayla, form yok) ve Panel > Kurumlar (kurum açma, resmî e-postayla hesap ve şifre belirleme bağlantısı, sözleşme bitişi, pasifleştirme, kurum yöneticisinin personel yönetimi), İşlem kayıtları sayfası. Ayrıntı 6.7. Güvenlik (Claude, standart): admin rolü panelden verilmez (yalnızca Firebase konsolu); yetki yalnızca doğrulanmış e-postada geçer; ülke geneli listeler admin'de kalır; kurallar sunucuda aynı sınırları denetler.

| 3 | İl bazında modül/özellik açıp kapatma | Evet |
| 4 | Çeviri dosyaları ve uygulama metinleri (5 dil) | Evet |
| 5 | Zorunlu uygulama güncelleme uyarıları | Sonra |
| 6 | Ülke geneli ve afet bildirimleri, bildirim sınırları ve kuralları | Evet |
| 7 | Platform geneli şikâyet merkezi, yasaklı kelime listesi, kullanıcı engelleme | Evet |
| 8 | Mahkeme ve resmi kurum içerik kaldırma taleplerini yönetme | Sonra (hukuk süreci kurulunca) |
| 9 | Yönetici işlem kayıtları, zorunlu iki aşamalı doğrulama, oturum/cihaz kontrolü | Evet |
| 10 | KVKK talepleri: veri indirme/silme, hesap silme | Evet |
| 11 | Fiyatlar, paketler, fatura, iade | Evet |
| 12 | Belediye/kurum sözleşmeleri (başlangıç, bitiş, hesap açma, süre bitince kapatma) | Evet |
| 13 | Veri kaynakları durumu (nöbetçi eczane API'si, hava durumu vb.) ve hata uyarıları | Sonra |
| 14 | Sistem sağlığı ve maliyet takibi (depolama, harita, yapay zekâ asistanı) | Sonra |
| 15 | Ülke geneli raporlar | Sonra |
| 16 | Anket siparişleri: talep alma, içerik/hukuk incelemesi, ücret tahsilatı, yayın, sonuç raporu | Evet |
| 17 | Yarışma yönetimi: yarışma ve şartname oluşturma, aşamalar ve takvim, katılımcı onayı, oy denetimi, diskalifiye, sonuç ve ödül takibi, kurum taleplerini onaylama | Evet |
| 18 | Etkinlik düzenleme yetkisi atama: hangi hesap/kurum/kişi hangi bölgede etkinlik açabilir (ver/geri al, süreli yetki, kayıt), yetki başvurularını onaylama | Evet (başvuru kısmı şimdilik yok, aşağıdaki not) |

**Karar (Eren, 28 Ekim 2026):** STK ve kulüpler için ayrı başvuru akışı şimdilik yapılmaz. Etkinlik yetkisi Panel > Kurumlar (admin kurumu açar, "etkinlikler" bölümünü verir) ve Yetkiler sayfasıyla verilir.

Not: 9 ve 10 numaralı güvenlik ve KVKK maddeleri mağaza onayı ve yasal uyum için ilk sürümden çıkarılmaz.

### 6.5 Onay merkezi: iki aşamalı onay (Karar, Eren)

- **İki aşama:** Onay gerektiren her işlem önce il yöneticisinin, sonra admin'in onayından geçer. Örnekler: kampanya ve tanıtım bildirimleri, işletme doğrulamaları, etkinlik yetkisi talepleri, kulüp ve yayıncı başvuruları, kurum yarışma talepleri. Acil duyurular onaysız, doğrudan gider.
- **"Bekleyen onaylar" ekranı (admin paneli):** Bütün bekleyen işler türüne bakılmaksızın tek ekranda listelenir. Filtreler: il, ilçe, kategori. Her satırda talep eden, bölge, kategori, il yöneticisinin onay tarihi ve kimin onayladığı görünür. Satır satır onay ve ret (ret gerekçesi zorunlu).
- **Toplu onay düğmeleri:**
  - **"Tümünü onayla":** O an listede görünen (filtrelenmiş) işlerin hepsini onaylar.
  - **"Güvenli olanları onayla":** Yalnızca *güvenilir yöneticilerin* ilk aşamada onayladığı işleri onaylar.
- **Güvenilir yöneticiler listesi:** Admin bu listeye yönetici ekler ve listeden çıkarır. Her kayıt bir yönetici ile bir kapsamdan oluşur. Kapsam şehir, ilçe ve kategoriye göre seçilir. Örnek: "Ahmet Bey, Bursa, yalnızca bildirimler." Bir iş, onu ilk aşamada onaylayan yönetici bu listede o iş için uygun şehir, ilçe ve kategoriyle kayıtlıysa "güvenli" sayılır.
- **Öneri (standart güvenlik):** Toplu onaydan önce "X iş onaylanacak" özeti gösterilir ve onay istenir. Toplu onaylar da tek tek işlem kaydına yazılır. Yüksek riskli işler (hesap kapatma, ücret/iade, il geneli bildirim) "Güvenli olanları onayla" kapsamına girmez, her seferinde tek tek onaylanır.
- **Yapıldı (27 Ekim 2026), ilk kullanım işletme doğrulaması:** Panel > Bekleyen onaylar (il / ilçe / kategori / aşama süzgeci, satır satır onay, gerekçeli ret, "Tümünü onayla", "Güvenli olanları onayla", güvenilir yöneticiler listesi). İşletme sahibi uygulamadan doğrulama ister, il yöneticisi onaylar ya da kendisi önerir, admin son kararı verir. Claude'un standart seçimleri: yüksek riskli işler (hesap kapatma, ücret/iade, il geneli bildirim, kurum hesabı açma) iki toplu düğmeye de girmez; il yöneticisi olmayan ildeki işi admin doğrudan onaylayabilir; kimse kendi isteğine ya da kendi işletmesine karar veremez; ret gerekçesi istek sahibine gösterilir. Diğer iş türleri ilgili özelliklerle eklenecek.

### 6.6 Kurum içi personel ve onay akışı (Karar, Eren)

- **Karar (Eren): kurum kendi personeline sınırlar içinde görev verir.** "Yetkiyi yalnızca admin verir" kuralı kurumlara verilen yetki içindir. Admin kurumu (belediye, muhtarlık, kurum, kulüp) açar, bölgesini ve bölümlerini belirler ve bir **kurum yöneticisi** atar. Kurum yöneticisi kendi personelini ekler, çıkarır ve görev verir. Admin'in kuruma vermediği bölge ya da bölümü kimseye veremez.
- **Karar (Eren, 27 Ekim 2026): görevler kutucuklarla seçilir.** Kurum yöneticisi (ve il yöneticisi muhtara verirken) her bölümde kişiye vereceği eylemleri tek tek işaretler: Görüntüle, Ekle, Düzenle, Sil, Onayla, **Onaysız yayınla**, Bildirim gönder. "Onaysız yayınla" işaretli değilse kişinin hazırladığı içerik onaya gider. Aşağıdaki roller artık örnek kalıplardır (yapıldı, 27 Ekim 2026).
- **Personel rolleri (her bölüm için ayrı, örnek):** *Hazırlayan* taslak yazar ve onaya gönderir, kendisi yayınlayamaz. *Onaylayan* inceler; onaylarsa yayınlanır, reddederse gerekçe notuyla hazırlayana geri döner. *İzleyen* yalnızca görür. Kurum yöneticisi bir bölümde bazı kişilere **"onaysız yayınlayabilir"** yetkisi verebilir (örn. acil duyuruda fen işleri müdürü). Onaylayan taslakta düzeltme yapabilir, değişiklik kayda geçer (öneri).
- **Örnek (Eren'in örneği):** Basın müdürü gönderi ve etkinlikte hazırlayan, özel kalem onaylayan. Basın müdürü "Onaya gönder" der, özel kaleme bildirim gider, onaylanınca yayınlanır.
- **Dış onaylarla ilişkisi:** Kurum içi onaydan sonra, iki aşamalı onay gereken işler (kampanya bildirimi vb.) bölüm 6.5'teki il yöneticisi → admin akışına girer.
- **Kayıt ve güvenlik (standart):** Kim hazırladı, kim onayladı, ne zaman yayınlandı kayda geçer. Personel ayrılınca yetki tek tuşla kapatılır, süreli görev verilebilir. Aynı yapı muhtarlıkta (muhtar yardımcısı hazırlar, muhtar onaylar) ve diğer kurumlarda geçerlidir.

### 6.7 Hesap açma, kilitli adlar ve yetki zinciri (Karar, Eren, 27 Ekim 2026)

- **Kilitli adlar (Karar, Eren):** Tüm belediye adları (30 büyükşehir, 51 il, ilçe belediyeleri) baştan kilitlidir; hiçbir kullanıcı bu adları (işletme adı, profil adı, ileride kullanıcı adı) alamaz. Ad yalnızca admin'in açtığı resmî kurum hesabına verilir. Standart olarak "belediye, valilik, kaymakamlık, muhtarlık, CityJoy" gibi resmî sözcükler de kullanıcı adlarında kullanılamaz (Claude, güvenlik).
- **Kurum hesabını CityJoy açar (Karar, Eren):** Anlaşma yapılan kurumun hesabı kurumun resmî e-postasıyla açılır. Şifreyi kurum kendisi belirler: sisteme kayıtlı e-postaya "şifrenizi belirleyin" bağlantısı gider (Eren onayladı; şifre CityJoy'da, mesajda ya da e-postada hiç durmaz). Hesap kurum yöneticisinindir (örn. özel kalem); personel ortak şifre kullanmaz, herkes kendi hesabıyla çalışır, kayıtlarda kişinin adı görünür.
- **Form yok, yetki yukarıdan verilir (Karar, Eren):** Yetki alacak kişi form doldurmaz, panele başvurmaz. Yetkiyi veren, kişinin e-postasını yazar, rolünü ve bölgesini/bölümünü seçer; kişi o e-postayla (doğrulanmış) uygulamaya ya da panele girince yetkisi açılır. Zincir: **admin** herkese ve tüm kurumlara; **il yöneticisi** kendi ilindeki muhtarlara (ve gönüllü moderatörlere); **kurum yöneticisi** kendi personeline (kurumun bölgesi ve bölümleri içinde). Kimse kendinde olmayan yetkiyi veremez; verenin kendisi ve admin geri alabilir; her işlem kayda geçer.
- **Yapıldı (27 Ekim 2026):** kilitli adlar, kurum açma ve personel, e-postayla yetki zinciri (panel ve kurallar). Onay zinciri onay merkeziyle (6.5) gelecek.
- **Panel kimlerde (Eren onayladı):** Admin, kurumlar ve il yöneticileri panel sahibidir. Muhtar ve kurum personeli aynı web panelini kendi hesabıyla, yalnızca aldıkları erişim kadar kullanır (panel telefonda da açılır). Mobil uygulamada "Yönetim" bölümü sonraya bırakıldı.
- **Onay zinciri (Karar, Eren):** Personelin onay gereken işi kendi yetkilisine (kurum içi onaylayan / il yöneticisi) gider. Admin onayı gereken işleri il yöneticisi ve kurum admin'e sorar (Bekleyen onaylar, 6.5). Aşağıdaki **önemli konularda** il yöneticisi ya da kurum onaylasa bile iş admin'e de gider (Eren onayladı): il geneli ve kampanya bildirimleri, işletme doğrulaması, yeni kurum hesabı açma, hesap kapatma ve yasaklama, ücret ve iade işlemleri, anket yayını.

## 7. Filtreli bildirim

Paneller şu filtrelerle bildirim gönderebilecek: **il, ilçe, mahalle, yaş, cinsiyet, ilgi alanı**.
- Bunun için kayıtta ilgili bilgiler alınır. Yaş, cinsiyet ve ilgi alanıyla hedefleme **KVKK kapsamında ayrı açık rıza** ister.
- Öneri: Bildirim türleri (acil duyuru, hizmet, etkinlik, kampanya) ayrılır. Kullanıcı türlere göre kapatabilir. Acil kamu duyuruları ayrı sınıfta olur. Bir panelin bir günde gönderebileceği bildirim sayısına sınır konur (kötüye kullanımı önlemek için).
- Belirli bir kişiye değil, **gruba** gönderilir. Panel kullanıcıların kişisel verisini görmez, yalnızca "kaç kişiye ulaşır" bilgisini görür (öneri).

**Bildirim tasarımı (öneri, bildirim her modülün temelinde olacak):**
- Bir bildirim kampanyası şunlardan oluşur: başlık ve metin (5 dilde, çeviri yoksa varsayılan dil), tür (acil kamu duyurusu, hizmet, etkinlik, kampanya), hedef (il, ilçe, mahalle, yaş aralığı, cinsiyet, ilgi alanı, meslek), zamanlama.
- **Hedef seçimi yetkiye bağlıdır:** panel sahibi yalnızca kendi bölgesi içinde hedef seçebilir (örn. ilçe belediyesi sadece kendi ilçesine gönderir).
- Göndermeden önce tahmini ulaşılacak kişi sayısı gösterilir. Çok küçük gruplarda (örn. 50 kişiden az) bir kişiyi tanıtmayı önlemek için hedef sınırlanır.
- **Karar (Eren onayladı):** Acil duyurular (su kesintisi gibi) doğrudan gider. Kampanya ve tanıtım türü bildirimler önce onaya düşer. **Karar (Eren): önce il yöneticisi, sonra admin onaylar** (bölüm 6.5).
- Günlük ve haftalık gönderim sınırı vardır. Kullanıcı türlere göre bildirimleri kapatabilir. Acil kamu duyuruları ayrı sınıftır.
- Kayıtta/profilde istenecekler: doğum yılı (yaş için), cinsiyet (isteğe bağlı), ilgi alanları, bildirim izni. Hedefleme için gereken bilgilere **ayrı açık rıza** alınır. 18 yaş altı kullanıcılara kampanya türü bildirim gönderilmez (öneri).
- Modüller bildirimi otomatik tetikleyebilir: yeni etkinlik (mahalleye), muhtar duyurusu (su kesintisi gibi), yeni belediye hizmeti, takip edilen hesabın gönderisi. Her tetikleyici panelde açılıp kapatılabilir.
- Her bildirim için gönderen, hedef, saat, ulaşan ve açan sayısı kayıt altına alınır.
- **Siyasi içerik riski:** Belediye ve başkan hesaplarının bildirimleri seçim dönemlerinde propaganda sınırlarına takılabilir. Bu konuda kurallar ve panel uyarıları hukuk incelemesinde netleştirilecek.

## 8. Hukuk ve mağaza gereklilikleri (Claude hazırlar)

Tümü yayından önce avukat tarafından kontrol edilmelidir.
- KVKK aydınlatma metni, açık rıza metinleri, gizlilik politikası, kullanım şartları, çerez/izin metinleri
- Hesabı uygulama içinden silme (Apple için zorunlu), veri indirme/silme talepleri
- Konum, bildirim, kamera/galeri izin açıklamaları
- Kullanıcı içeriği için: şikâyet etme, kullanıcı engelleme, içerik denetimi ve kaldırma süreci, topluluk kuralları
- Yaş sınırı ve yaş derecelendirmesi
- SOS ve acil özellikler için sorumluluk metni (uygulama resmi acil hizmetin yerine geçmez)
- Premium üyelik: mağazaların kendi ödeme sistemi kurallarına uygun satın alma
- Mağaza kayıtları: uygulama başlığı/açıklamaları, ekran görüntüleri, gizlilik beyanı formları, test hesabı
- Apple ve Google geliştirici hesapları (Eren açar, onay süreci zaman alır) ve alan adı

## 9. Teknik yaklaşım (öneri, onay bekliyor)

- Tasarımlar HTML + Tailwind ile hazırlanmış, `manifest.json` var (web uygulaması olarak da çalışabilir).
- Mağazalarda yayın için ya tek kod tabanlı bir mobil çatı (ör. Flutter veya React Native) ya da web tasarımının mobil kabuğa sarılması düşünülebilir. **Karar: yön onaylandı** (mağaza için mobil uygulama + web panelleri). Hangi mobil çatının seçileceği Claude Code'da seçenekler artı/eksileriyle sade dille anlatılarak netleşecek.
- Arka uçta: kullanıcı hesapları, konum hiyerarşisi (il > ilçe > mahalle), roller ve yetki kapsamı, içerik, bildirim, dosya depolama, dil dosyaları.
- Güvenlik: yetki kontrolü sunucuda yapılır (sadece ekranda gizlemek yetmez). Kişisel veriler korunur, panellere gereğinden fazla veri gösterilmez.
- **Prototiplerde Firebase kullanılıyor** (giriş ve kayıt ekranları Firebase Authentication ve Firestore ile yazılmış). Yönetilen servis tercihiyle uyumlu. Dikkat: Firestore okuma ve yazma sayısına göre ücretlendirilir. Keşfet akışı ve sonsuz kaydırma çok okuma üretir, bu yüzden sayfalama ve önbellek baştan tasarlanır (maliyet ilkesi, bölüm 9.1). Filtreli bildirim için hedefleme sunucu tarafında yapılır. Güvenlik kuralları (kim neyi okuyabilir/yazabilir) Claude Code'da kurulur.
- **Karar: React Native + Expo (TypeScript).** Eren teknik seçimi Claude'a bıraktı. Claude Code'da kısa bir doğrulama yapılır, seçim değişirse Eren'e sade dille bildirilir. Gerekçe: (1) Prototipler zaten JavaScript ve Firebase ile yazılmış, aynı dünyada kalınır. (2) Web yönetim panelleri React ile yazılırsa mobil uygulama ve paneller aynı dili ve ortak parçaları paylaşır, Eren'in yönetmesi gereken teknoloji sayısı azalır. (3) Expo'nun bulut derleme hizmeti sayesinde iOS uygulaması için Mac şart olmayabilir (kontrol edilecek). Gerekli özellikler (bildirim, konum, kamera ve QR, video yükleme, sesli komut, çoklu dil, sağdan sola yerleşim) bu ekosistemde mevcut. Alternatif: Flutter. Veri katmanı, Firebase'e bağımlılığı azaltacak şekilde ayrı tutulur (maliyet büyürse geçişi kolaylaştırmak için).

### 9.1 Veri havuzu, güncelleme sıklığı ve maliyet ilkesi

- **Eren'in kararı:** Maliyetler en makul seviyede tutulur. Dış kaynaklardan (API) her kullanıcı isteğinde veri çekilmez. Veri zamanlanmış çekimle **veri havuzuna** yazılır, kullanıcılar havuzdan okur.
- **Karar (Eren onayladı): nöbetçi eczane günlük çekilir.** Çekim sıklığı veri türüne göre değişir: Sabit bilgiler (müze, otopark, rehber): haftalık/aylık veya değişince. **Nöbetçi eczane: günlük**, çünkü nöbet her gün değişir. Haftalık çekim yanlış eczaneyi gösterir, bu bir güvenlik meselesidir. Eczane verisi il/ilçe başına günde bir ya da iki kez çekilir, kullanıcı sayısından bağımsız sabit maliyettir. Hava durumu: birkaç saatte bir, il/ilçe bazında önbellekle.
- **API anahtarı sunucuda** saklanır, uygulamaya gömülmez (güvenlik ve maliyet kontrolü).
- Her veride "son güncelleme" zamanı görünür. Çekim başarısız olursa son bilinen veri "güncel olmayabilir" uyarısıyla gösterilir, nöbetçi eczanede ayrıca "eczaneyi arayarak teyit edin".
- **Ziyaretçi Modu:** Kullanıcı farklı bir ilde algılandığında sorulur. Her modülde kendiliğinden açılmaz. Kendi adresine tek dokunuşla döner.
- **Keşfet davranışı:** Sekmeler (Mahallem, Bölgesel, Genel, Takip) arasında hızlı geçiş, aşağı çekince yenileme, aşağı kaydırdıkça akışın otomatik dolması (sonsuz kaydırma), paylaşırken hedef bölüm seçimi.

## 10. Önerilen yapım sırası (öneri)

1. **Temel:** proje kurulumu, kayıt/giriş, dil seçimi (5 dil, RTL dahil), il-ilçe-mahalle seçimi, veritabanı ve konum yapısı
2. **Roller, yetki matrisi, panel iskeleti ve bildirim altyapısı** (yetki kapsamı ve panel mimarisi en başta doğru kurulmalı; sonraki her özellik panel karşılığıyla birlikte eklenir)
3. **Keşfet** (gönderi, takip, yorum, şikâyet/engelleme) ve **bildirim sistemi**
4. **Acil İhtiyaçlar** (ülke geneli veriyle 81 ilde çalışacak şekilde)
5. **Benim Şehrim**, **Sosyal Harmoni**, **Seyahat**
6. Belediye/kurum panelleri ve il yöneticisi paneli
7. Hukuk metinleri, mağaza hazırlığı, kapalı test, yayın

(Hukuk ve KVKK işleri 2. adımdan itibaren paralel hazırlanır, en sona bırakılmaz.)

## 11. Tasarım dosyaları

Hepsi Eren'in bilgisayarında. Not: bazı dosyalar henüz bu belgeyi hazırlayan oturuma gelmedi, Claude Code dosyaların tam listesini klasörden görüp bu bölümü güncellemeli.

Görülenler: anasayfa, benim-sehrim, acil-ihtiyaclar, sosyal-harmoni, seyahat, kesfet-genel, kesfet-mahallem, kesfet-takip, kesfet-bolgesel.
Görsel kimlik: koyu petrol yeşili ve turkuaz ağırlıklı, altın/bakır vurgu, yuvarlak köşeli kartlar, Plus Jakarta Sans ve Inter yazı tipleri, Material ikonları. Yeni sayfalar aynı stilde yapılmalı.

## 12. Açık sorular listesi

1. Uygulama adı: **Karar (Eren): CityJoy** (Seyahat modülünün alt adı TravelJoy). Eren alan adını ve temel kayıtları aldı. Marka tescili (TürkPatent) ayrıca kontrol edilecek, domain tek başına marka hakkı sağlamaz.
2. Gelir modeli: Kullanıcılar ücretsiz. Anketler tamamen ücretli. Diğer kalemler (indirimler, öne çıkan işletme, belediye anlaşmaları, Premium üyelik) en sona bırakıldı, birlikte kararlaştırılacak.
3. Kullanıcı içeriği çevirisi (otomatik çeviri): birlikte düşünülecek.
4. Hesap doğrulama süreci (belediye, muhtar, esnaf)
5. Veri kaynakları: nöbetçi eczane, ulaşım, hava durumu, harita
6. Yetkilendirme: kim verir, kim geri alır
7. Teknik yol (bölüm 9)
8. Her modülün ayrıntılı iş kuralları (Eren anlatacak)
9. Bir gönderi aynı anda birden çok alanda (mahalle, bölge, genel) paylaşılabilir mi?
10. İşletmem doğrulaması: kesin ücret, hangi kategoride hangi evrak, görüntülü görüşme kimlerde zorunlu, ücret iadesi (ret durumunda), fatura ve şirket yapısı

## 13. Tasarım değişiklik listesi (Eren: şimdi kod yazılmayacak, tasarım çalışması bitince toplu uygulanacak)

1. Kullanıcı profilindeki ve ana sayfadaki **"Premium Üye"** ibaresi kaldırılacak (bölüm 1.3). "Bursa Vitrini" gibi "Premium" işaretli yerler işletme/il vitrini kademesi olarak yeniden düşünülecek.
2. `sos-aile.html`: "acil durum ekiplerine" cümlesi düzeltildi (yapıldı, dosya verildi). Örnek aile listesindeki **telefon numaraları kaldırılacak**, ekleme QR/davet bağlantısı/ID isteği ile yapılacak.
3. `profil.html`: "Ailem (SOS)" bölümüne **QR göster / QR okut** düğmeleri, davet bağlantısı ve ID ile istek eklenecek. Düz "ID: 12345678" gösterimi kaldırılacak.
4. Her yerde Bursa'ya sabit yazılmış içerik (Bursa Vitrini, Bursaspor, Osmangazi hava durumu vb.) veriye bağlı alanlara dönüşecek.
5. Kategori bilgi şablonlarına göre yer sayfalarında "son güncelleme", "kaynak/doğrulama durumu", "yanlış bilgi bildir" ve "bilgi doluluk oranı" alanları eklenecek (bölüm 1.1).
6. Usta/işletme kartı: doğrulama durumu ve belge tarihleri, fiyat listesi ("son güncelleme", "tahmini" notu), yaptığı işler, video, arama ve WhatsApp düğmeleri.
7. Gönderi paylaşma ekranına hedef seçimi (Mahallem, Bölgesel, Genel, Takip) ve kategori seçimi (Keşfet kuralları).
8. Alt bilgi telif yılı (2024) güncellenecek.
9. `emlak.html`: "Bursa'nın güvenilir ilan platformu" ifadesi kaldırılacak (garanti/güvence vaadi verilmez, bölüm 1.1). Ayrıca Bursa, ilçe listesi ve örnek ilanlar veriye bağlanacak.
10. `emlak.html`: Emlak ve Araç kategorileri için özel ilan formu adımları (kimlik doğrulama, taşınmaz numarası, yetki belgesi), diğer kategorilerde sade form.
11. `emlak.html`: ilandaki iletişim telefonu alanı kaldırılacak, yerine "Mesaj gönder" (uygulama içi yazışma) gelecek. İlan sahibi isterse numarasını yazışmada paylaşır. VIP ilanlar ücretli öne çıkarma olarak gelir konusunda fiyatlanacak.
12. `sosyal-harmoni.html` ve alt sayfalar: "Bursaspor" başlığı ve sayfası "Şehir Kulüpleri" olarak değişecek (kulüp listesi ve kulüp sayfası şablonu).
13. İndirim sayfaları: kampanya kartında geçerlilik tarihi, şartlar, geçerli olduğu yerler ve "doğrulanmış işletme" işareti.
14. `yemek-indirimleri.html` ve `spor-indirimleri.html`: "Tüm indirimler ekibimiz tarafından günlük kontrol edilir" ve "fiyatlar anlık olarak güncellenir" ifadeleri kaldırılacak. Yerine "doğrulanmış işletme tarafından yayınlandı, son güncelleme: tarih" yazılacak (yapılamayacak bir vaat verilmez).
15. `spor-indirimleri.html`: "Rezervasyon Yap" kaldırılacak veya "Ara / WhatsApp" ile değiştirilecek (bilgi platformu ilkesi). `yemek-indirimleri.html`: "Toplam İndirimli Fiyat" sepet alanı kaldırılacak, menü yalnızca indirimli fiyat listesi olarak kalacak.
16. İndirim sayfalarındaki "Günün Fırsatı / Popüler / Favori" etiketleri: ücretli öne çıkarma ise "Reklam/Sponsorlu" olarak işaretlenecek. Hangi kritere göre verildiği belirlenecek.
17. İndirim sayfalarındaki yorum formu: serbest "Adınız" alanı yerine yalnızca giriş yapmış kullanıcı yorum yazabilecek (uygulamadan arama yapmış olma kuralı). İndirim oranı gösterme ve eski fiyat kuralları hukuken araştırılacak.
18. `sosyal-harmoni.html`: Forum kartı ve alt sayfası kaldırılacak (ilk sürümde yok). Keşfet'te "Soru/Yardım" kategorisi için kategoriye göre filtre eklenecek.
19. `haberler.html`: haber detayına "Haberin tamamını kaynakta oku" düğmesi eklenecek. "Son Dakika" etiketi kaynağın işaretine bağlanacak. Örnek haberler ve "Bursa" ibareleri veriye bağlanacak.
20. Seyahat sayfalarındaki "TRAVELJOY" markası **kalacak** (Eren: kullanıcılar uygulamanın Seyahat bölümünde olduklarını anlasın). CityJoy ana marka, TravelJoy Seyahat modülünün alt adı olur. Ad için marka tescili ve alan adı kontrolü yapılacak.
21. `bursa-belediye-kesif.html`: başkan kartlarındaki yıldızlı puan ve yorum sayısı kaldırılacak (bu bölümde puanlama tamamen kalkacak), tüm ilçeler eşit boyutta kart alacak ve nüfusa göre sıralanacak, "Belediye tanıtımı" etiketi eklenecek.
22. `marmara.html`: "Premium Destinasyon" ibaresi gözden geçirilecek (bölüm 1.3).
23. Seyahat sayfalarında Bursa, başkan adları, nüfus, UNESCO ve rakım gibi sabit içerik veriye bağlanacak, kaynak ve tarih gösterilecek. Tasarımda bağlantısı verilen ama henüz görülmeyen sayfalar: `bursa-hazir-rotalar.html`, `filtre-seyehat.html`.
24. `seyahat-anasayfa.html` ve `rota.html`: "Paketler" bölümü "Hazır Yolculuk Planları"na dönüşecek. "Seçildi: Metro Turizm / Hilton Bodrum" gibi marka adları kategorilerle değişecek. "Tahmini Toplam" tahmini maliyet aralığı olarak ve kaynak/tarihle gösterilecek. "Seferleri gör / Otelleri gör" düğmeleri resmi sitelere yönlendirme olarak yeniden adlandırılacak.
25. Benim Şehrim: üstte "ziyaretçi/evim" şeridi ve konum değişikliği sorusunun diyaloğu eklenecek.
26. Profil sayfası: "İşletme ekle" akışı (bölüm 5.7): işletme türü seçimi, ortak bilgiler, kategoriye özel alanlar, önizleme ve doğrulama adımları tasarlanacak.
27. Karşılama ekranı (`index.html`, Eren beğendi): 5 görsel yavaş geçişle sırayla değişir, "Kaydırmaya Başla" tutamacı. Dokununca da başlar (erişilebilirlik), "hareketi azalt" açıksa görseller sabit durur. Görseller panelden değiştirilir (Storage, Blaze); Blaze gelene kadar uygulamaya gömülü görsellerle yapılabilir. Eren: tasarım işleriyle birlikte yapılacak (28 Ekim 2026). **Yapıldı (28 Ekim 2026)**, görseller şimdilik çizim.
28. `sosyal-harmoni.html`: kaydırmalı kartlar ve arkada soluklaşarak değişen görseller korunacak (Eren beğendi). **Yapıldı (28 Ekim 2026).** İkinci sayfa Fırsatlar (yukarı kaydırınca) eklendi; kartlar indirim sistemi gelene kadar "yakında" (madde 13-17).
29. **Ana sayfa ve Benim Şehrim (Eren onayladı, 28 Ekim 2026):** sade, tek bakışta, ama gösterişli. Ana sayfa tek ekran: CityJoy, tarih, "Günaydın, <ad>", konum ve hava, acil uyarı şeridi (yalnızca varsa), dört modül büyük resimli kartlarda (her biri kendi renginde, arkada yavaşça kayan görsel), tanıtım videosu düğmesi, alt gezinme. Benim Şehrim: üstte şehir fotoğrafı kapağı, şehir/ilçe/mahalle, hava, "Konum değiştir"; altında tek ızgara (Belediye Hizmetleri büyük kart, diğer 11 bölüm renkli kutucuk, canlı rozetler: eczane "Açık", pazar "Bugün", etkinlik sayısı; verisi olmayan bölüm soluk "Yakında"); en altta Mahalle Meydanı ve Şehir Vitrini resimli kartları. Gruplara ayırma ve "Şu an lazım olanlar" listesi denendi, Eren beğenmedi. Örnek ekranlar: https://claude.ai/artifact/VnZjvC23TmxFbXwXEgq8Z7 (görseller yer tutucu çizim). "Hareketi azalt" açıksa görseller sabit durur. **Yapıldı (28 Ekim 2026):** hava durumu verisi olmadığı için konum çipi; canlı rozetler (eczane, pazar) veri gelince.
30. **Tasarım ölçütleri (Karar, Eren, 28 Ekim 2026):** ölçüleri, yerleşimi ve animasyonları Claude belirler, Eren'e sorulmaz; amaç derli toplu ve keyifli bir uygulama. Keşfet Instagram hissi verir (çerçevesiz akış, iki kez dokun beğen, paylaş), hikâye halkaları istenmiyor. Mağaza incelemesinde sorun çıkaracak şeylerden kaçınılır (dokunma alanı en az 44, erişilebilirlik, "hareketi azalt", yanıltıcı ifade yok).
31. **Profil (Eren onayladı, 28 Ekim 2026):** paylaşım yalnızca Keşfet'ten; profil paylaşılanları gösterir. Instagram düzeni, CityJoy renkleriyle (benzer düzen mağaza sorunu değil; Instagram'ın simge, renk ve "Reels/Hikaye" gibi adları kullanılmaz). İl gösterilmez, isteyen tanıtımına yazar. Ailem (SOS) ve İşletmem profilde kısayol. Sekmeler: Gönderiler, Kaydedilenler, Katıldıklarım. Başarımlar ve banner yok. Arama tek yerde: Ara her şeyi (kişiler dahil) arar, profildeki "Kişi bul" Ara'yı Kişiler seçili açar. Alt menü: Ana Sayfa, Keşfet, Ara, Profil; Mesajlar yalnızca profilin sağ üstünde (Eren). Profilde solda geri (ana sayfaya), ad ortada. Mesajlar: üstte kullanıcı adı, arama çubuğu, sağ üstte yeni mesaj. **Sonra:** Seyahat ve fotoğraf (Blaze) gelince profile **Gezilerim** sekmesi kolaj kartlarla (bir büyük iki küçük fotoğraf, gezi adı ve tarih); "aramada görünme" seçeneği. **Yapıldı (28 Ekim 2026)**, Gezilerim ve aramada görünme hariç.
32. **Ara (ara.html, Eren):** tasarımdaki gibi büyük başlık ve arama kutusu; dengesiz ya da altyapısı olmayan parçalar (yapay zekâ asistanı, sesli arama, popüler rotalar, sahte sayılar) Claude tarafından çıkarıldı. **Yapıldı (28 Ekim 2026).**
33. **İşletme sayfası (Eren onayladı, 28 Ekim 2026):** tek hesap, ayrı işletme sayfası. Akışta işletmenin adına dokununca işletme sayfası açılır; kullanıcı profiliyle aynı iskelet, içi işletmeye göre (puan, şu an açık, Ara / WhatsApp / Yol tarifi, Menü-Hizmetler, Yorumlar, Bilgiler). İşletme takip edilir (takipçi önemli). Paylaşım yine Keşfet'ten, "Kimin adına?" seçimiyle; işletme paylaşımı "İşletme" etiketiyle görünür. Profil > İşletmem formu sayfayı doldurur (haftalık saat, ödeme, olanaklar, menü/fiyat). **Yetkili (Eren):** sahibi en çok 3 kişiyi kullanıcı adıyla bulup atar ve izin seçer; Claude önerisi: paylaşım kapalı / sahibinin onayıyla (varsayılan) / doğrudan, bilgileri düzenleme (telefon hariç), yorumlara cevap. **Yapıldı (28 Ekim 2026).** **Sonra:** logo, fotoğraf ve video (Storage, Blaze; kademeye göre vitrin), kampanya şeridi (Fırsatlar), işletme paylaşım sayısı sınırı kademeye göre (gelir konusunda), işletmeye mesaj.
34. **Seyahat (Eren onayladı, 28 Ekim 2026):** tasarımlar seyahat.html, kesfet-ogren.html, marmara.html, bursa.html (+ alt sayfalar) korunarak, mantık gereği: sahte puan / yorum sayısı / "Premium" / bütçe işareti yok, sayılar kaynak ve tarihle; içeriği olmayan ülke gösterilmez (şimdilik yalnızca Türkiye); hava durumu ve uzaklık sonra (ücretli servis); yapay zekâ rehberi bilgi tabanı dolunca; fotoğraflar Storage ile. İçerik panelden, önce taslak, kontrol edilip yayına. **Aşamalar:** 1) giriş, Keşfet ve Öğren, bölge, şehir, yer detayı, Panel > Seyahat, Marmara/Bursa taslak içerik: **Yapıldı (28 Ekim 2026).** 2) Hazır Rotalar ve Sinematik Rota, Yöresel, Başkanlarla Keşif (madde 5.2 kuralları, belediye paneli): **Yapıldı (29 Ekim 2026).** **Karar (Eren, 29 Ekim 2026):** "Bursa'da 1 gün" yerine temalı rotalar (Osmanlı'nın Doğuşu, Camiler ve Türbeler, Gastro Bursa, Uludağ, Çarşı ve Hanlar, Cumalıkızık); her rotada süre ayrıca yazılır, süre filtresi 2-3 saat / yarım gün / 1 gün. Duraklar gezilecek yerlere bağlanabilir (yerin saat, ücret, ulaşım bilgisi rotada görünür). Belediye, kurumunda Seyahat bölümü işaretliyse kendi tanıtımını ve rotalarını hazırlar, onaya gönderir; CityJoy yayına alır. Nüfus (sıralama), bölge filtresi ve başkan adının gösterilmesi yalnızca admin'de. 3) Kareler (Blaze), Planla ve Navigasyon. **Öneri (Eren onayladı, 29 Ekim 2026): Kareler** serbest etiketle değil, Keşfet'te fotoğraf paylaşırken konum o şehirse çıkan "{Şehir}'dan Kareler'de de görünsün" kutucuğuyla: ek yükleme ve kopya yok, aynı gönderi iki yerde görünür; sayfa 30'ar küçük önizleme yükler; panelde kaldır / öne çıkar. Önce Keşfet'e fotoğraf paylaşımı (telefonda sıkıştırma) gelir.

## 14. Gelir modeli taslağı (1-6. kaynaklar Eren onayladı; fiyatlar ve il yöneticisi payı açık)

Eren'in kararları: kullanıcılar ücretsiz, güven bilgisi ücretsiz, SOS ve acil bilgiler hiçbir zaman ücretli olmaz, kullanıcı Premium'u yok. Aşağıdaki kaynaklar bu kararlara uyar. **Fiyatlar henüz belirlenmedi.** Fiyatlamadan önce piyasa araştırması (benzer ilan ve işletme platformlarının ücretleri) yapılacak.

**Gelir kaynakları (tahmini öncelik sırasıyla):**
1. **İşletme doğrulama ücreti** (Eren'in örneği: yaklaşık 1000 TL). Hem gelir hem sahte ilan filtresi. Ücret incelemenin bedelidir, rozet otomatik satılmaz.
2. **İşletme üyelik kademeleri** (yinelenen gelir): Ücretsiz, Standart, Pro, Premium. Fark vitrin kapasitesidir: fotoğraf sayısı, video, iş galerisi, istatistik, öne çıkma ("reklam" etiketli).
3. **Belediye reklam ve tanıtım protokolü** (yıllık, Eren'in kararı): Belediyelerle reklam ve tanıtım amaçlı yıllık protokol imzalanır, panel bu protokole göre verilir. Kamu mevzuatı (alım usulü, bütçe, ihale/doğrudan temin sınırları, çıkar çatışması) avukatla netleştirilecek.
4. **Anket siparişleri** (Eren'in kararı: ücretli).
5. **Konaklama sayfaları**: doğrulama, vitrin, öne çıkma. Daha sonra resmi bilet/rezervasyon sitelerine yönlendirme ortaklığı (sıralamayı etkilemeden, "ortaklık" etiketiyle).
6. **VIP/öne çıkan ilanlar** (ilan platformu).
7. **Sponsorlu yarışmalar** (marka sponsorluğu, ödül sponsorluğu).
8. **Reklam**: ilk sürümde sınırlı tutulur, güveni zedelememek için.

**Başlıca maliyetler:** video depolama ve aktarım, bildirim altyapısı, harita/mekân verisi (lisans), yapay zekâ asistanı ve konuşma tanıma, doğrulama ekibinin emeği (belge inceleme, görüntülü görüşme), moderasyon, hukuk ve avukat, muhasebe/fatura, mağaza hesapları, il temsilcisi payı.

**Zamanlama notu (Eren'in kararı: ödeme sistemi sonra):** İlk sürümde uygulama içi ödeme olmadığı için işletme doğrulama ücreti ve üyelik kademeleri geç devreye girer. İlk gelir kaynakları uygulama dışında faturayla yapılanlardır: belediye reklam ve tanıtım protokolü, anketler, sponsorlu yarışmalar. Ayrıca hibe ve destekler.

**Büyüme önerisi (ONAY BEKLİYOR):**
- **Kurucu işletme programı:** İlk dönemde ilk kayıt olan işletmelere doğrulama indirimi veya ilk dönem ücretsiz üyelik. Amaç, veri havuzunu (ustalar, yol üstü tesisler, konaklama) hızla doldurmak. Veri olmadan ücretli kademelerin değeri düşük.
- **İl temsilcisi / il yöneticisi payı:** İl yöneticisinin, o ilin işletme doğrulama ve üyelik gelirinden belirli bir yüzde alıp almayacağı henüz SORULACAK. Motivasyon sağlar ama maliyet getirir. Sözleşme ve vergi düzeni avukat/mali müşavirle kurulur.
- Hibe başvurularında kullanılmak üzere gelir-gider tablosu ve ilk 12-24 aylık bütçe, rakamlar netleşince hazırlanabilir (Excel).
27. `kayit.html`: kayıt sonrası ek bilgi adımı (il, ilçe, mahalle, cinsiyet, doğum yılı, meslek, ilgi alanları) ve KVKK/izin onay kutuları eklenecek. Şifre kuralı 8 karakter olacak.
28. `giris.html` ve `kayit.html`: misafir olarak gezinme seçeneği, gerekiyorsa "Apple ile giriş", ve telefon doğrulaması gereken işlemlerde doğrulama ekranı eklenecek.
29. Profil: "Ödemeler" bölümü normal kullanıcı hesabından kaldırılacak. İşletme hesabında "Üyelik ve Ödemeler" olarak yeniden tasarlanacak (bölüm 15.2).

## 15. Standart mağaza ve uygulama gereklilikleri (Claude sormadan ekler)

Eren'in kararı: bunlar tartışmasız eklenir. Güncel kurallar yayından önce mağazaların resmi sayfalarından yeniden kontrol edilir (kurallar sık değişir).

### 15.1 Kontrol listesi

- **Hesap ve kimlik:** uygulama içinden hesap silme (Apple ve Google zorunlu tutar), Google ile giriş varsa "Apple ile giriş", parola sıfırlama, e-posta doğrulama, yönetici hesaplarında iki aşamalı doğrulama.
- **Kullanıcı içeriği (Keşfet, ilan, yorum, aktivite, yarışma):** içerik şikâyet düğmesi, kullanıcı engelleme, uygunsuz içeriği filtreleme, şikâyetlere hızlı yanıt süreci, kullanım şartlarında yasaklı içerik tanımı, iletişim bilgisi. Mağazalar bu dört şeyi sosyal içerik taşıyan uygulamalardan ister.
- **Gizlilik ve izinler:** gizlilik politikası bağlantısı, App Store gizlilik etiketi ve Google Play "Veri güvenliği" formunun doğru doldurulması, her izin için (konum, bildirim, kamera, mikrofon, fotoğraf) açıklayıcı metin, gereksiz izin istememe, arka planda konum izni istememe (Yolculuk Modu hariç, o da açık rıza ile). İzleme (tracking) yapılacaksa Apple'ın izleme izni penceresi.
- **Çocuklar ve yaş:** yaş derecelendirme soruları (kullanıcı içeriği, konum, mesajlaşma) dürüst doldurulur. Çocuklara yönelik bir uygulama olmadığı belirtilir, 13 yaş altı kayıt kapalıdır.
- **Satın alma ve abonelik:** bölüm 15.2.
- **İnceleme için:** test hesapları (kullanıcı, işletme, belediye, yönetici rolleri), her özelliği gösteren kısa açıklama notu, çalışan destek bağlantısı ve iletişim e-postası.
- **Kalite:** en az minimum işlevsellik (yalnızca web sitesi sarmalayıcı olmamak), çökme ve donma testleri, yavaş internette çalışma, çevrimdışı durumda anlaşılır hata mesajları, her ekranda yükleniyor ve boş durum tasarımı.
- **Teknik ve güvenlik:** tüm trafik HTTPS, anahtarlar sunucuda, veri tabanı güvenlik kuralları, belge ve kimlik dosyaları ayrı ve gizli depolama, şifrelerin düz metin saklanmaması, günlük yedek.
- **Erişilebilirlik:** ekran okuyucu etiketleri, yazı boyutu büyütme, yeterli renk karşıtlığı, dokunma alanları, sağdan sola yazılan dil (Arapça) için ayna yerleşim.
- **Arka planda konum (SOS):** Google Play "Konum izinleri" beyan formu ve özelliği gösteren kısa video; uygulama içinde izin öncesi açıklama ("yalnızca SOS süresince"); Android ön plan hizmeti bildirimi. Apple incelemesinde "Her zaman" konum ve arka plan konum gerekçesi açıklanır. SOS bildirimleri için iOS "zamana duyarlı" bildirim; "kritik uyarı" (sessizde de çalma) Apple'dan ayrıca izin ister, istenirse başvurulur.
- **Bildirim:** bildirim izni uygun zamanda ve nedeniyle istenir, kategori bazında kapatma, ticari elektronik ileti izni ayrı, sessiz saatler.
- **Mevzuat (Türkiye):** KVKK aydınlatma metni, açık rıza metinleri, VERBİS kayıt yükümlülüğünün olup olmadığının kontrolü, İYS (ticari elektronik ileti), mesafeli satış ve ön bilgilendirme (ücretli üyelikler), fatura düzeni, kullanım şartları ve topluluk kuralları. Yayın öncesi avukat ve mali müşavir kontrolü.

### 15.2 Ödemeler ve abonelikler (Eren'in fikri: ödeme altyapısı, kullanıcının ödemelerini ve abonelik tarih/bitiş bilgisini görmesi)

- **Karar (Eren): ödeme sistemi ilk sürüme dahil edilmez, iyice düşünülüp sonra eklenecek.** İlk sürümde işletme özellikleri ücretsizdir (kurucu işletme dönemi). Üyelik kademeleri, doğrulama ücreti ve "Üyelik ve Ödemeler" ekranı ödeme sistemi eklenince açılır. Veri yapısı kademe, başlangıç ve bitiş tarihi alanlarını baştan taşır, böylece sonradan eklemek uygulamayı baştan yazmayı gerektirmez (Claude Code'da). İlk sürümde doğrulama elle ve sınırlı yapılır, ücret alınmaz.

- **Kim öder:** Normal kullanıcılar ücretsizdir ve ödeme yapmaz. Ücret ödeyenler işletmelerdir (doğrulama, üyelik kademeleri, öne çıkma, VIP ilan, kampanya). Belediye protokolü, anket ve sponsorluk ise kurumsal faturayla uygulama dışında yapılır.
- **"Üyelik ve Ödemeler" ekranı (işletme hesabında, ödeme sistemiyle birlikte sonraya ertelendi):** mevcut kademe, başlangıç ve bitiş tarihi, yenilenme durumu, ödeme geçmişi, fatura ve makbuzlar, iptal/yönetim bağlantısı, süre bitmeden hatırlatma bildirimi. Normal kullanıcıda bu bölüm görünmez.
- **Mağaza kuralları (araştırma sonucu):** Apple, uygulama içinde işlev açan ücretli dijital içerik, hizmet ve aboneliklerin yalnızca uygulama içi satın alma (IAP) ile satılmasını ister. Uygulama içi bağlantıyla dış ödemeye yönlendirme genelde ret sebebidir, bu esneklik yalnızca ABD mağazasında tanınmış görünüyor. Komisyon: uygulama içi satın almada %15 (Küçük İşletme Programı veya aboneliğin ikinci yılı) ya da %30. Google Play için de benzer "Google Play Faturalandırma" kuralları var (kontrol edilecek).
- **Sonuç ve öneri (ödeme sistemi eklenirken yeniden değerlendirilecek):**
  1. İşletme üyelik kademeleri ve doğrulama ücreti uygulama içinde işlev açtığı için iOS ve Android'de mağazanın kendi satın alma sistemiyle satılacak şekilde tasarlanır. Fiyatlar mağaza komisyonu hesaba katılarak belirlenir.
  2. Web üzerinden satılacaksa (yerel ödeme kuruluşu ile kart/havale) iOS uygulamasında bu ödemeye yönlendirme yapılmaz. Apple'ın "başka platformda satın alınan abonelik" kuralı, aynı ürünün uygulama içinde de IAP ile satılmasını şart koşar.
  3. Abonelik durumu **sunucuda tek yerde** tutulur (mağaza satın almaları doğrulanarak, web ödemeleri ödeme kuruluşundan), uygulama yalnızca durumu gösterir.
  4. İnsan emeği gerektiren doğrulama hizmeti (belge inceleme, görüntülü görüşme) için uygulama dışı bir istisna olup olmadığı araştırılacak. Garanti değil, mağazalar ayrıca uygulama özelinde karar verebilir.
  5. Ödeme kuruluşu (yerel seçenekler karşılaştırılacak) kart verisini tutar, uygulamamız kart bilgisi saklamaz. Fatura ve e-arşiv düzeni mali müşavirle kurulur.
30. `profil.html`: yaş, meslek, cinsiyet ve mahalle gibi alanlar herkese açık profil görünümünden kaldırılacak, hesap gizliliği anahtarı ve engelle/sessize al seçenekleri eklenecek.
31. Alt gezinme ve ana sayfa kısayollarından Reels kaldırılacak. Keşfet gönderi ekranında video yükleme (60 sn) ve yarışma video yükleme (90 sn) eklenecek.
32. Tüm tasarımlarda marka yazımı "CityJoy" olarak birleştirilecek (şu an CityJOY, CityJoy ve TRAVELJOY karışık görünüyor, TravelJoy Seyahat modülünün alt adı olarak kalacak).
33. `acil-ihtiyaclar.html`: acil numara etiketleri düzeltilecek: 183 Sosyal Destek (su arızası değil), 185 Su Arıza eklenecek, 186 Elektrik, 187 Doğalgaz (tasarımda 186 ve 187 yer değiştirmiş). Uygulamada doğru liste kullanılıyor (bölüm 5.4).
34. `sos-aile.html`: SOS türü seçimi (Acil, Yardım, Eve Dön, İlaç) kaldırılacak (Eren: mantıklı değil). Tek SOS düğmesi kalır; gönderdikten sonra durum "Güvendeyim" / "Yardım gerek" düğmeleriyle bildirilir.

## 16. Yönetim şeması için çizim maddeleri (Eren çizecek, Claude'un hazırladığı liste)

**A. Kutular (roller)**
1. **Merkez yönetim (Admin, Eren):** tüm uygulama. Altında ekipler: doğrulama, moderasyon, içerik ve veri havuzu, finans/fatura, destek, teknik. Dışarıdan: avukat, mali müşavir.
2. **İl yöneticisi (81 il):** admin atar. Kendi ili. Onay seviyesi A/B/C il yöneticisi başına ayarlanır.
3. **Gönüllü moderatör:** il yöneticisi atar, atandığı bölge.
4. **Belediye hesapları:** büyükşehir belediyesi (il geneli), ilçe belediyeleri, il merkez belediyesi. Her birinde başkan hesabı, yetkili personel (hazırlayan, onaylayan, izleyen), muhtarlık bağlama.
5. **Muhtarlık (mahalle):** doğrulanmış muhtar hesabı ve yardımcı personel.
6. **Kurumlar:** valilik/kaymakamlık, il kültür ve turizm müdürlüğü, müzeler, STK ve dernekler, eğitim kurumları. Etkinlik düzenleme yetkisi verilen kurum ve kişiler.
7. **Şehir kulüpleri:** spor kulübü hesapları.
8. **Haber yayıncıları:** yerel haber siteleri (RSS başvurusu).
9. **İşletmeler:** doğrulanmış ve doğrulanmamış işletme hesapları.
10. **Kullanıcılar:** kişisel hesaplar (13-17 yaş kısıtlı mod, 18+).
11. **Dış taraflar (şemada kenarda):** Apple/Google mağazaları, bulut hizmeti (Firebase), veri sağlayıcılar (eczane API, hava durumu), ödeme kuruluşu (sonra).

**B. Her kutuda gösterilecek bilgiler:** kim açar/atar, kapsam (bölge × modül), kullandığı yer (panel veya uygulama), başlıca işleri, onay seviyesi (A/B/C), kime rapor verir.

**C. Oklar (akışlar)**
- Admin → il yöneticisi: atama, geri alma, yetki seviyesi, haftalık özet rapor.
- İl yöneticisi → belediye, kurum, muhtar, kulüp, yayıncı hesapları: açma, doğrulama, yetki verme.
- Belediye → muhtar bağlama, başkan duyuru ve keşif rotası, etkinlik.
- İşletme → il yöneticisi doğrulaması (ücret sonra).
- Kullanıcı → şikâyet → gönüllü moderatör → il yöneticisi → admin.
- Kurum yarışma ve anket talebi → admin onayı ve yayın.
- Bildirim: acil duyuru doğrudan, kampanya bildirimi onay kuyruğundan geçer.
- Etkinlik yetkisi: yalnızca admin verir (il yöneticisi talep açabilir).

**D. Şemada boş bırakılıp karara bağlanacak yerler (?)**
1. Doğrulanmış hesap kimlere verilir, süreci kim yürütür.
2. Muhtar hesapları nasıl açılır (ilçe belediyesi mi il yöneticisi mi doğrular).
3. ~~Yetkiyi kim verir ve geri alır.~~ Karar: yalnızca admin.
4. ~~Bir ilde birden çok belediye varsa çakışma kuralı.~~ Karar: herkes kendi alanında.
5. ~~Kampanya bildirim onay kuyruğuna kim bakar.~~ Karar: önce il yöneticisi, sonra admin.
6. Haber yayıncısı ve kulüp başvurularını kim onaylar.
7. İl yöneticisinin geliri (pay) ve ayrı il yöneticisi uygulaması.
8. İlçe temsilcisi gibi il yöneticisi altında ek bir kademe olacak mı.

**E. Çizim önerisi:** Üç katman. Üstte **Merkez** (admin ve ekipleri), ortada **İl** (il yöneticisi, gönüllü moderatörler), altta **Yerel** (belediye, muhtar, kurum, kulüp, yayıncı, işletme), en altta kullanıcılar. Dış taraflar yanda. Onay seviyelerini (A/B/C) kenar rengiyle göster.

## 17. Ön yüz (frontend) ve tasarım iyileştirme kuralı (Eren onayladı)

- **Görsel kimlik korunur:** Eren'in tasarımlarındaki renkler, yazı tipleri ve yerleşim temel alınır. Görünümü belirgin biçimde değiştiren bir iyileştirme önce Eren'e gösterilir, onaylanmadan uygulanmaz.
- **Sormadan yapılan iyileştirmeler (standart kalite işleri):** tüm ekranlarda tutarlı bileşenler (düğme, kart, form), yükleniyor/boş/hata durumları, yavaş ve çevrimdışı internette anlaşılır davranış, erişilebilirlik (kontrast, yazı büyütme, ekran okuyucu), Arapça için sağdan sola yerleşim, farklı ekran boyutları, açık ve koyu mod.
- **Karar (Eren): görsel yön.** Üç örnek yön gösterildi (A: gece ve altın, B: aydınlık ve güven, C: karma). **Koyu modda A, açık modda C** kullanılır. Uygulama varsayılan olarak telefonun ayarına uyar, kullanıcı Hesabım > Görünüm'den sabitleyebilir. Tek yazı tipi ailesi (Plus Jakarta Sans + Inter), tek renk simgeler, efekt az, okunaklı yazı boyutları. Ayrıntı: `docs/stil-rehberi.md`.
- **İlk adım:** Eren'in tasarım dosyalarından bir **stil rehberi** çıkarılır (renk, yazı tipi, bileşenler), böylece 80'in üzerinde ekran tutarlı kalır.
- **Gerçek uygulama yeniden yazılır:** Tasarımlar bugün HTML ve Tailwind örnekleri. Mağaza uygulaması mobil çatıyla baştan kodlanır, tasarıma sadık kalınarak. Bölüm 13'teki değişiklik listesi aynı sırada uygulanır.
- **Sınır:** Profesyonel logo, ikon seti, uygulama mağazası görselleri ve özel illüstrasyon gibi marka tasarımı işleri için bir tasarımcıyla çalışmak gerekebilir. Beğeni ve his Eren'in kararıdır, önemli ekranlarda seçenekler gösterilir.

## 18. Claude Code'a geçiş hazırlık listesi (Eren için)

1. **Hesaplar (şirket adına):** GitHub, Firebase (Google hesabıyla), Expo, Apple Developer, Google Play Console. Alan adı alındı. Şifre ve anahtarlar bu sohbette paylaşılmaz.
2. **Claude Code kurulumu:** Eren'in araştırmasına göre. Takılırsa Windows mu Mac mı olduğu söylenir, adım adım gidilir.
3. **Proje klasörü:** `PROJE.md`, `CLAUDE.md` ve tüm tasarım HTML dosyaları aynı klasöre konur.
4. **Yönetim şeması** (Eren çiziyor): bölüm 16'daki "?" yerleri onunla kapatılır.
5. **Kapalı deneme grubu:** Farklı telefon ve illerden 10-20 kişi (yayından önce).
