// ═══════════════════════════════════════════════════
// CityJoy — Şehir İçerik Sistemi (sehir-init.js)
// Bu dosya şehre göre tüm sayfa içeriklerini günceller
// ═══════════════════════════════════════════════════

const SEHIR_ICERIK = {

  // ─── Şehre özel veriler ───────────────────────
  DATA: {
    istanbul: {
      ad: 'İstanbul', ilce: 'Kadıköy', bolge: 'Marmara',
      nufus: '15.8M', slogan: 'Dünyanın Merkezi',
      hastaneler: ['Marmara Üniversitesi Hastanesi','Kadıköy Acıbadem','Çam ve Sakura Şehir Hastanesi','Kartal Eğitim Araştırma'],
      eczaneler: ['Merkez Eczanesi - Kadıköy','Moda Eczanesi','Bağdat Cad. Eczanesi','Nöbetçi: Hayat Eczanesi'],
      itfaiye: '110 - İstanbul İtfaiyesi',
      polis: '155 - Kadıköy Emniyet',
      ambulans: '112 - AKOM İstanbul',
      populerYerler: ['Galata Kulesi','Topkapı Sarayı','Kapalı Çarşı','Boğaz Köprüsü','Princes Adaları'],
      hava: { durum: 'Parçalı Bulutlu', sicaklik: '14', ikon: '⛅' },
    },
    ankara: {
      ad: 'Ankara', ilce: 'Çankaya', bolge: 'İç Anadolu',
      nufus: '5.6M', slogan: 'Başkentin Kalbi',
      hastaneler: ['Hacettepe Üniversitesi Hastanesi','Ankara Şehir Hastanesi','Gazi Üniversitesi Hastanesi','Numune Hastanesi'],
      eczaneler: ['Kızılay Eczanesi','Çankaya Merkez Eczane','Tunalı Eczanesi','Nöbetçi: Başkent Eczanesi'],
      itfaiye: '110 - Ankara İtfaiyesi',
      polis: '155 - Çankaya Emniyet',
      ambulans: '112 - Ankara UMKE',
      populerYerler: ['Anıtkabir','Kocatepe Camii','Anadolu Medeniyetleri Müzesi','Atakule','Hamamönü'],
      hava: { durum: 'Açık', sicaklik: '8', ikon: '☀️' },
    },
    bursa: {
      ad: 'Bursa', ilce: 'Osmangazi', bolge: 'Marmara',
      nufus: '3.2M', slogan: 'Yeşil Bursa',
      hastaneler: ['Bursa Uludağ Üniversitesi Hastanesi','Bursa Şehir Hastanesi','Çekirge Devlet Hastanesi','Nilüfer Devlet Hastanesi'],
      eczaneler: ['Heykel Eczanesi','Osmangazi Merkez Eczane','Nilüfer Eczanesi','Nöbetçi: Çekirge Eczanesi'],
      itfaiye: '110 - Bursa Büyükşehir İtfaiyesi',
      polis: '155 - Osmangazi Emniyet',
      ambulans: '112 - Bursa 112 ASH',
      populerYerler: ['Uludağ','Ulu Camii','Kapalı Çarşı','Koza Hanı','Cumalıkızık'],
      hava: { durum: 'Sisli', sicaklik: '11', ikon: '🌫️' },
    },
    izmir: {
      ad: 'İzmir', ilce: 'Konak', bolge: 'Ege',
      nufus: '4.4M', slogan: 'İnci Denizin',
      hastaneler: ['Ege Üniversitesi Hastanesi','Dokuz Eylül Üniversitesi Hastanesi','İzmir Şehir Hastanesi','Tepecik EAH'],
      eczaneler: ['Konak Eczanesi','Alsancak Eczanesi','Karşıyaka Merkez','Nöbetçi: Kemer Eczanesi'],
      itfaiye: '110 - İzmir Büyükşehir İtfaiyesi',
      polis: '155 - Konak Emniyet',
      ambulans: '112 - İzmir UMKE',
      populerYerler: ['Saat Kulesi','Kemeraltı Çarşısı','Kordon','Kadifekale','Efes Antik Kenti'],
      hava: { durum: 'Güneşli', sicaklik: '18', ikon: '☀️' },
    },
    antalya: {
      ad: 'Antalya', ilce: 'Muratpaşa', bolge: 'Akdeniz',
      nufus: '2.6M', slogan: 'Turizmim Başkenti',
      hastaneler: ['Antalya Eğitim Araştırma Hastanesi','Akdeniz Üniversitesi Hastanesi','Antalya Şehir Hastanesi','Alanya EAH'],
      eczaneler: ['Kaleiçi Eczanesi','Muratpaşa Merkez','Lara Eczanesi','Nöbetçi: Güneş Eczanesi'],
      itfaiye: '110 - Antalya İtfaiyesi',
      polis: '155 - Muratpaşa Emniyet',
      ambulans: '112 - Antalya 112',
      populerYerler: ['Kaleiçi','Düden Şelalesi','Antalya Müzesi','Konyaaltı Plajı','Aspendos'],
      hava: { durum: 'Güneşli', sicaklik: '22', ikon: '☀️' },
    },
  },

  // ─── Varsayılan (şehir bulunamazsa) ──────────
  VARSAYILAN: 'bursa',

  // ─── Mevcut şehri al ─────────────────────────
  getSehir() {
    const id = localStorage.getItem('cj_sehir_id') || this.VARSAYILAN;
    return this.DATA[id] || this.DATA[this.VARSAYILAN];
  },

  // ─── Tüm sayfayı güncelle ────────────────────
  sayfayiGuncelle() {
    const s = this.getSehir();

    // 1. Tüm [data-cj-sehir] elemanları
    document.querySelectorAll('[data-cj-sehir]').forEach(el => el.textContent = s.ad);
    document.querySelectorAll('[data-cj-ilce]').forEach(el => el.textContent = s.ilce);
    document.querySelectorAll('[data-cj-bolge]').forEach(el => el.textContent = s.bolge);
    document.querySelectorAll('[data-cj-nufus]').forEach(el => el.textContent = s.nufus);
    document.querySelectorAll('[data-cj-slogan]').forEach(el => el.textContent = s.slogan);

    // 2. Hava durumu
    document.querySelectorAll('[data-cj-hava-durum]').forEach(el => el.textContent = s.hava.durum);
    document.querySelectorAll('[data-cj-hava-sicaklik]').forEach(el => el.textContent = s.hava.sicaklik + '°C');
    document.querySelectorAll('[data-cj-hava-ikon]').forEach(el => el.textContent = s.hava.ikon);

    // 3. Acil servisler
    document.querySelectorAll('[data-cj-hastane]').forEach((el, i) => {
      el.textContent = s.hastaneler[i] || s.hastaneler[0];
    });
    document.querySelectorAll('[data-cj-eczane]').forEach((el, i) => {
      el.textContent = s.eczaneler[i] || s.eczaneler[0];
    });
    document.querySelectorAll('[data-cj-itfaiye]').forEach(el => el.textContent = s.itfaiye);
    document.querySelectorAll('[data-cj-polis]').forEach(el => el.textContent = s.polis);
    document.querySelectorAll('[data-cj-ambulans]').forEach(el => el.textContent = s.ambulans);

    // 4. Sayfa başlığı
    if (document.title.includes('CityJoy')) {
      document.title = document.title.replace('CityJoy', `CityJoy ${s.ad}`);
    }

    // 5. Şehir göstergesi (header'da)
    this._gostergeGuncelle(s);

    // 6. Sayfaya özel güncellemeler
    this._sayfayaOzelGuncelle(s);
  },

  // ─── Header göstergesi ───────────────────────
  _gostergeGuncelle(s) {
    const gosterge = document.getElementById('cj-sehir-gosterge');
    if (!gosterge) return;
    gosterge.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
    gosterge.innerHTML = `
      <span style="font-size:12px">📍</span>
      <span style="font-size:12px;color:#E0B07A;font-weight:500">${s.ad}</span>
      <span style="font-size:10px;color:#6E8C8E">▾</span>
    `;
    gosterge.onclick = () => {
      if (window.CJ_KONUM) {
        CJ_KONUM._manuelSecimGoster((yeniSehir) => {
          SEHIR_ICERIK.sayfayiGuncelle();
        }, true);
      }
    };
  },

  // ─── Sayfaya özel güncellemeler ──────────────
  _sayfayaOzelGuncelle(s) {
    const sayfa = window.location.pathname.split('/').pop();

    // benim-sehrim.html
    if (sayfa.includes('benim-sehrim')) {
      this._benimSehrimGuncelle(s);
    }
    // sosyal-harmoni.html
    if (sayfa.includes('sosyal-harmoni')) {
      this._sosyalHarmoniGuncelle(s);
    }
    // acil-ihtiyaclar.html ve alt sayfaları
    if (sayfa.includes('acil')) {
      this._acilGuncelle(s);
    }
    // hastaneler.html
    if (sayfa.includes('hastaneler')) {
      this._hastanelerGuncelle(s);
    }
    // nobetci-eczane.html
    if (sayfa.includes('eczane')) {
      this._eczaneGuncelle(s);
    }
    // kesfet sayfaları
    if (sayfa.includes('kesfet')) {
      this._kesfetGuncelle(s);
    }
    // ara.html
    if (sayfa.includes('ara')) {
      this._araGuncelle(s);
    }
    // forum sayfaları
    if (sayfa.includes('forum')) {
      this._forumGuncelle(s);
    }
    // haberler sayfaları
    if (sayfa.includes('haber')) {
      this._haberlerGuncelle(s);
    }
    // etkinlikler sayfaları
    if (sayfa.includes('etkinlik') || sayfa.includes('aktivite')) {
      this._etkinliklerGuncelle(s);
    }
  },

  // ─── Benim Şehrim ─────────────────────────────
  _benimSehrimGuncelle(s) {
    // Şehir adını içeren tüm statik metinleri güncelle
    document.querySelectorAll('h1, h2, h3, p, span, button').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('Bursa')) {
        el.textContent = el.textContent.replace(/Bursa/g, s.ad);
      }
    });
    // Popüler yerleri güncelle
    const yerListesi = document.querySelectorAll('[data-cj-populer-yer]');
    yerListesi.forEach((el, i) => {
      el.textContent = s.populerYerler[i] || '';
    });
  },

  // ─── Sosyal Harmoni ───────────────────────────
  _sosyalHarmoniGuncelle(s) {
    document.querySelectorAll('h1, h2, h3, span, p, button').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('Bursa')) {
        el.textContent = el.textContent.replace(/Bursa/g, s.ad);
      }
    });
  },

  // ─── Acil İhtiyaçlar ──────────────────────────
  _acilGuncelle(s) {
    document.querySelectorAll('h1, h2, h3, span, p, a, button').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('Bursa')) {
        el.textContent = el.textContent.replace(/Bursa/g, s.ad);
      }
    });
  },

  // ─── Hastaneler ───────────────────────────────
  _hastanelerGuncelle(s) {
    const listeler = document.querySelectorAll('[data-hastane-listesi] .hastane-adi, .hastane-adi');
    listeler.forEach((el, i) => {
      if (s.hastaneler[i]) el.textContent = s.hastaneler[i];
    });
    document.querySelectorAll('h1, h2, h3, span, p').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('Bursa')) {
        el.textContent = el.textContent.replace(/Bursa/g, s.ad);
      }
    });
  },

  // ─── Eczane ───────────────────────────────────
  _eczaneGuncelle(s) {
    document.querySelectorAll('h1, h2, h3, span, p').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('Bursa')) {
        el.textContent = el.textContent.replace(/Bursa/g, s.ad);
      }
    });
  },

  // ─── Keşfet ───────────────────────────────────
  _kesfetGuncelle(s) {
    // Hashtag'leri güncelle
    document.querySelectorAll('.hashtag').forEach(el => {
      if (el.textContent.includes('Bursa')) {
        el.innerHTML = el.innerHTML.replace(/Bursa/g, s.ad);
      }
    });
    document.querySelectorAll('h1, h2, h3, span, p').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('Bursa')) {
        el.textContent = el.textContent.replace(/Bursa/g, s.ad);
      }
    });
  },

  // ─── Ara ──────────────────────────────────────
  _araGuncelle(s) {
    const placeholder = document.querySelector('input[placeholder*="Bursa"], input[placeholder*="şehir"]');
    if (placeholder) {
      placeholder.placeholder = placeholder.placeholder.replace('Bursa', s.ad);
    }
    document.querySelectorAll('h1, h2, h3, span, p').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('Bursa')) {
        el.textContent = el.textContent.replace(/Bursa/g, s.ad);
      }
    });
  },

  // ─── Forum ────────────────────────────────────
  _forumGuncelle(s) {
    document.querySelectorAll('h1, h2, h3, span, p, button').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('Bursa')) {
        el.textContent = el.textContent.replace(/Bursa/g, s.ad);
      }
    });
  },

  // ─── Haberler ─────────────────────────────────
  _haberlerGuncelle(s) {
    document.querySelectorAll('h1, h2, h3, span, p, .news-badge').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('Bursa')) {
        el.textContent = el.textContent.replace(/Bursa/g, s.ad);
      }
    });
  },

  // ─── Etkinlikler ──────────────────────────────
  _etkinliklerGuncelle(s) {
    document.querySelectorAll('h1, h2, h3, span, p, button').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('Bursa')) {
        el.textContent = el.textContent.replace(/Bursa/g, s.ad);
      }
    });
  },
};

// ── Otomatik başlat ──────────────────────────────
function _sehirInitBaslat() {
  // 1. Kayıtlı şehir varsa hemen uygula
  const kayitliId = localStorage.getItem('cj_sehir_id');
  if (kayitliId) {
    SEHIR_ICERIK.sayfayiGuncelle();
  }

  // 2. GPS'ten şehir gelince güncelle
  window.addEventListener('cj:sehirHazir', () => SEHIR_ICERIK.sayfayiGuncelle());

  // 3. Manuel şehir değişince güncelle
  window.addEventListener('cj:sehirDegisti', () => {
    SEHIR_ICERIK.sayfayiGuncelle();
    setTimeout(() => location.reload(), 300);
  });
}

// konum.js yüklü mü kontrol et, değilse yükle sonra başlat
if (typeof CJ_KONUM !== 'undefined') {
  // Zaten yüklü
  document.addEventListener('DOMContentLoaded', _sehirInitBaslat);
} else {
  // konum.js'i yükle, sonra başlat
  const _s = document.createElement('script');
  _s.src = (document.currentScript?.src || '').replace('sehir-init.js','') + 'konum.js';
  // Göreceli yol
  _s.src = './konum.js';
  _s.onload = () => document.addEventListener('DOMContentLoaded', _sehirInitBaslat);
  document.head.appendChild(_s);

  // DOMContentLoaded zaten geçtiyse direkt çalıştır
  if (document.readyState !== 'loading') {
    _s.onload = _sehirInitBaslat;
  }
}
