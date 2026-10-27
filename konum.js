// ═══════════════════════════════════════════
// CityJoy — Konum Sistemi (konum.js)
// Her sayfaya <script src="./konum.js"></script>
// ile ekle. Otomatik çalışır.
// ═══════════════════════════════════════════

const CJ_KONUM = {

  // Türkiye'nin 81 ili — koordinat sınırları (basit kutu yöntemi)
  SEHIRLER: [
    { id:'istanbul',    ad:'İstanbul',    bolge:'marmara',    lat:41.01, lng:28.97, latMin:40.80, latMax:41.60, lngMin:27.90, lngMax:29.95 },
    { id:'ankara',      ad:'Ankara',      bolge:'ic-anadolu', lat:39.92, lng:32.85, latMin:39.20, latMax:40.70, lngMin:31.40, lngMax:33.80 },
    { id:'izmir',       ad:'İzmir',       bolge:'ege',        lat:38.42, lng:27.14, latMin:37.50, latMax:39.20, lngMin:26.00, lngMax:28.20 },
    { id:'bursa',       ad:'Bursa',       bolge:'marmara',    lat:40.18, lng:29.06, latMin:39.70, latMax:40.55, lngMin:28.10, lngMax:30.10 },
    { id:'antalya',     ad:'Antalya',     bolge:'akdeniz',    lat:36.89, lng:30.69, latMin:36.00, latMax:37.60, lngMin:29.20, lngMax:32.60 },
    { id:'adana',       ad:'Adana',       bolge:'akdeniz',    lat:37.00, lng:35.32, latMin:36.60, latMax:37.80, lngMin:34.50, lngMax:36.50 },
    { id:'konya',       ad:'Konya',       bolge:'ic-anadolu', lat:37.87, lng:32.49, latMin:36.80, latMax:39.20, lngMin:31.00, lngMax:34.20 },
    { id:'gaziantep',   ad:'Gaziantep',   bolge:'guneydogu',  lat:37.06, lng:37.38, latMin:36.70, latMax:37.60, lngMin:36.60, lngMax:38.00 },
    { id:'mersin',      ad:'Mersin',      bolge:'akdeniz',    lat:36.80, lng:34.61, latMin:36.40, latMax:37.30, lngMin:33.60, lngMax:35.80 },
    { id:'diyarbakir',  ad:'Diyarbakır',  bolge:'guneydogu',  lat:37.91, lng:40.22, latMin:37.50, latMax:38.60, lngMin:39.20, lngMax:41.40 },
    { id:'kayseri',     ad:'Kayseri',     bolge:'ic-anadolu', lat:38.73, lng:35.49, latMin:38.00, latMax:39.40, lngMin:34.60, lngMax:36.60 },
    { id:'eskisehir',   ad:'Eskişehir',   bolge:'ic-anadolu', lat:39.78, lng:30.52, latMin:39.20, latMax:40.30, lngMin:29.80, lngMax:31.50 },
    { id:'samsun',      ad:'Samsun',      bolge:'karadeniz',  lat:41.29, lng:36.33, latMin:40.80, latMax:41.80, lngMin:35.20, lngMax:37.20 },
    { id:'trabzon',     ad:'Trabzon',     bolge:'karadeniz',  lat:41.00, lng:39.72, latMin:40.60, latMax:41.40, lngMin:38.80, lngMax:40.80 },
    { id:'malatya',     ad:'Malatya',     bolge:'dogu',       lat:38.35, lng:38.31, latMin:37.80, latMax:39.00, lngMin:37.40, lngMax:39.20 },
    { id:'kahramanmaras', ad:'Kahramanmaraş', bolge:'akdeniz', lat:37.57, lng:36.94, latMin:37.00, latMax:38.20, lngMin:35.80, lngMax:38.20 },
    { id:'erzurum',     ad:'Erzurum',     bolge:'dogu',       lat:39.91, lng:41.27, latMin:39.20, latMax:40.80, lngMin:40.00, lngMax:42.60 },
    { id:'van',         ad:'Van',         bolge:'dogu',       lat:38.49, lng:43.38, latMin:37.80, latMax:39.20, lngMin:42.40, lngMax:44.60 },
    { id:'denizli',     ad:'Denizli',     bolge:'ege',        lat:37.77, lng:29.09, latMin:37.20, latMax:38.40, lngMin:28.20, lngMax:30.20 },
    { id:'sakarya',     ad:'Sakarya',     bolge:'marmara',    lat:40.69, lng:30.43, latMin:40.30, latMax:41.10, lngMin:29.80, lngMax:31.20 },
    { id:'tekirdag',    ad:'Tekirdağ',    bolge:'marmara',    lat:40.98, lng:27.51, latMin:40.60, latMax:41.60, lngMin:26.60, lngMax:28.20 },
    { id:'kocaeli',     ad:'Kocaeli',     bolge:'marmara',    lat:40.85, lng:29.88, latMin:40.50, latMax:41.20, lngMin:29.40, lngMax:30.60 },
    { id:'hatay',       ad:'Hatay',       bolge:'akdeniz',    lat:36.40, lng:36.34, latMin:35.80, latMax:37.00, lngMin:35.60, lngMax:37.20 },
    { id:'manisa',      ad:'Manisa',      bolge:'ege',        lat:38.62, lng:27.43, latMin:38.00, latMax:39.40, lngMin:26.60, lngMax:29.00 },
    { id:'mugla',       ad:'Muğla',       bolge:'ege',        lat:37.21, lng:28.36, latMin:36.40, latMax:38.00, lngMin:27.20, lngMax:29.40 },
  ],

  BOLGELER: {
    'marmara':    { ad:'Marmara',          renkId:'#2C5364' },
    'ege':        { ad:'Ege',              renkId:'#1a6b5a' },
    'akdeniz':    { ad:'Akdeniz',          renkId:'#5c3317' },
    'ic-anadolu': { ad:'İç Anadolu',       renkId:'#3d2b1f' },
    'karadeniz':  { ad:'Karadeniz',        renkId:'#1a3a2a' },
    'dogu':       { ad:'Doğu Anadolu',     renkId:'#2a1a3a' },
    'guneydogu':  { ad:'Güneydoğu Anadolu',renkId:'#3a2a1a' },
  },

  // ─── Konum al ───────────────────────────────
  konumAl() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Tarayıcı konum desteklemiyor'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(err),
        { timeout: 8000, maximumAge: 300000 }
      );
    });
  },

  // ─── Koordinattan şehir bul ──────────────────
  sehirBul(lat, lng) {
    // Önce kutu eşleştirme
    for (const s of this.SEHIRLER) {
      if (lat >= s.latMin && lat <= s.latMax && lng >= s.lngMin && lng <= s.lngMax) {
        return s;
      }
    }
    // Bulamazsa en yakın şehri bul
    let enYakin = null, enYakinMesafe = Infinity;
    for (const s of this.SEHIRLER) {
      const mesafe = Math.sqrt(Math.pow(lat - s.lat, 2) + Math.pow(lng - s.lng, 2));
      if (mesafe < enYakinMesafe) { enYakinMesafe = mesafe; enYakin = s; }
    }
    return enYakin;
  },

  // ─── Sehri localStorage'a kaydet ────────────
  sehirKaydet(sehir) {
    localStorage.setItem('cj_sehir_id',   sehir.id);
    localStorage.setItem('cj_sehir_ad',   sehir.ad);
    localStorage.setItem('cj_sehir_bolge',sehir.bolge);
    localStorage.setItem('cj_sehir_lat',  sehir.lat);
    localStorage.setItem('cj_sehir_lng',  sehir.lng);
    localStorage.setItem('cj_konum_zaman', Date.now());
  },

  // ─── Kayıtlı şehri oku ──────────────────────
  sehirOku() {
    const id = localStorage.getItem('cj_sehir_id');
    if (!id) return null;
    return {
      id,
      ad:    localStorage.getItem('cj_sehir_ad'),
      bolge: localStorage.getItem('cj_sehir_bolge'),
      lat:   parseFloat(localStorage.getItem('cj_sehir_lat')),
      lng:   parseFloat(localStorage.getItem('cj_sehir_lng')),
    };
  },

  // ─── Konum güncel mi? (1 saat) ──────────────
  konumGuncelMi() {
    const zaman = localStorage.getItem('cj_konum_zaman');
    if (!zaman) return false;
    return (Date.now() - parseInt(zaman)) < 3600000;
  },

  // ─── Ana fonksiyon: sayfayı konuma göre ayarla
  async baslat(opts = {}) {
    const {
      onSehirBulundu = null,   // callback(sehir)
      onHata = null,           // callback(hata)
      manuelSecimIzin = true,  // konum reddedilince şehir seçtir
      gostergeyiGuncelle = true // UI'daki şehir adını güncelle
    } = opts;

    // 1. Kayıtlı konum güncel mi?
    if (this.konumGuncelMi()) {
      const kayitli = this.sehirOku();
      if (kayitli) {
        this._sehirUygula(kayitli, gostergeyiGuncelle);
        if (onSehirBulundu) onSehirBulundu(kayitli);
        return kayitli;
      }
    }

    // 2. GPS'ten al
    try {
      const konum = await this.konumAl();
      const sehir = this.sehirBul(konum.lat, konum.lng);
      if (sehir) {
        this.sehirKaydet(sehir);
        this._sehirUygula(sehir, gostergeyiGuncelle);
        if (onSehirBulundu) onSehirBulundu(sehir);
        return sehir;
      }
    } catch (e) {
      console.log('CityJoy Konum:', e.message);
      // Konum alınamazsa manuel seçim
      if (manuelSecimIzin) {
        this._manuelSecimGoster(onSehirBulundu, gostergeyiGuncelle);
      } else {
        // Varsayılan: Bursa
        const varsayilan = this.SEHIRLER.find(s => s.id === 'bursa');
        this.sehirKaydet(varsayilan);
        this._sehirUygula(varsayilan, gostergeyiGuncelle);
        if (onSehirBulundu) onSehirBulundu(varsayilan);
        if (onHata) onHata(e);
        return varsayilan;
      }
    }
  },

  // ─── UI güncelle ────────────────────────────
  _sehirUygula(sehir, gostergeyiGuncelle) {
    // data-cj-sehir olan elementleri güncelle
    document.querySelectorAll('[data-cj-sehir]').forEach(el => {
      el.textContent = sehir.ad;
    });
    document.querySelectorAll('[data-cj-bolge]').forEach(el => {
      el.textContent = this.BOLGELER[sehir.bolge]?.ad || sehir.bolge;
    });
    // Sayfa başlığına şehir ekle (opsiyonel)
    if (gostergeyiGuncelle) {
      const gosterge = document.getElementById('cj-sehir-gosterge');
      if (gosterge) {
        gosterge.innerHTML = `
          <span class="material-symbols-outlined" style="font-size:14px;color:#E0B07A">location_on</span>
          <span style="font-size:12px;color:#E0B07A;font-weight:500">${sehir.ad}</span>
        `;
        gosterge.style.cursor = 'pointer';
        gosterge.onclick = () => CJ_KONUM._manuelSecimGoster(null, true);
      }
    }
  },

  // ─── Manuel şehir seçim modalı ──────────────
  _manuelSecimGoster(callback, gostergeyiGuncelle) {
    // Modal zaten varsa kaldır
    document.getElementById('cj-sehir-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'cj-sehir-modal';
    modal.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(8,31,36,0.95);backdrop-filter:blur(12px);
      display:flex;align-items:center;justify-content:center;padding:20px;
    `;

    const sehirListesi = this.SEHIRLER.map(s =>
      `<button onclick="CJ_KONUM._sehirSec('${s.id}')" style="
        background:#0D3238;border:1px solid rgba(63,110,112,0.3);border-radius:10px;
        padding:10px 14px;font-size:13px;color:#C7D8DA;cursor:pointer;text-align:left;
        transition:all .2s;font-family:'Plus Jakarta Sans',sans-serif;
      " onmouseover="this.style.borderColor='rgba(224,176,122,0.4)';this.style.color='#E0B07A'"
        onmouseout="this.style.borderColor='rgba(63,110,112,0.3)';this.style.color='#C7D8DA'">
        📍 ${s.ad}
      </button>`
    ).join('');

    modal.innerHTML = `
      <div style="background:#0A2A2F;border:1px solid rgba(63,110,112,0.3);border-radius:20px;padding:28px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;">
        <div style="text-align:center;margin-bottom:20px;">
          <span style="font-size:32px;">📍</span>
          <h2 style="font-size:18px;font-weight:600;color:#C7D8DA;margin:8px 0 4px;">Şehrini Seç</h2>
          <p style="font-size:12px;color:#6E8C8E;">Konum izni verilmedi. Şehrini manuel seç.</p>
        </div>
        <div style="margin-bottom:12px;">
          <input type="text" placeholder="Şehir ara..." id="cj-sehir-ara"
            style="background:#0D3238;border:1px solid rgba(63,110,112,0.3);border-radius:10px;
            padding:10px 14px;font-size:13px;color:#C7D8DA;width:100%;outline:none;box-sizing:border-box;
            font-family:'Plus Jakarta Sans',sans-serif;"
            oninput="CJ_KONUM._sehirAra(this.value)"/>
        </div>
        <div id="cj-sehir-listesi" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${sehirListesi}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this._modalCallback = callback;
    this._modalGosterge = gostergeyiGuncelle;

    // Arama input'una odaklan
    setTimeout(() => document.getElementById('cj-sehir-ara')?.focus(), 100);
  },

  _sehirAra(q) {
    const liste = document.getElementById('cj-sehir-listesi');
    if (!liste) return;
    const filtreli = this.SEHIRLER.filter(s =>
      s.ad.toLowerCase().includes(q.toLowerCase())
    );
    liste.innerHTML = filtreli.map(s =>
      `<button onclick="CJ_KONUM._sehirSec('${s.id}')" style="
        background:#0D3238;border:1px solid rgba(63,110,112,0.3);border-radius:10px;
        padding:10px 14px;font-size:13px;color:#C7D8DA;cursor:pointer;text-align:left;
        font-family:'Plus Jakarta Sans',sans-serif;
      ">📍 ${s.ad}</button>`
    ).join('');
  },

  _sehirSec(sehirId) {
    const sehir = this.SEHIRLER.find(s => s.id === sehirId);
    if (!sehir) return;
    this.sehirKaydet(sehir);
    this._sehirUygula(sehir, this._modalGosterge);
    document.getElementById('cj-sehir-modal')?.remove();
    if (this._modalCallback) this._modalCallback(sehir);
    // Sayfayı yenile ki içerik değişsin
    window.dispatchEvent(new CustomEvent('cj:sehirDegisti', { detail: sehir }));
  },

  // ─── Yardımcı: mevcut şehri al ──────────────
  getSehir() {
    return this.sehirOku();
  },

  // ─── Yardımcı: şehri sıfırla ────────────────
  sehirSifirla() {
    localStorage.removeItem('cj_sehir_id');
    localStorage.removeItem('cj_sehir_ad');
    localStorage.removeItem('cj_sehir_bolge');
    localStorage.removeItem('cj_sehir_lat');
    localStorage.removeItem('cj_sehir_lng');
    localStorage.removeItem('cj_konum_zaman');
  }
};

// Sayfa yüklenince otomatik başlat
document.addEventListener('DOMContentLoaded', () => {
  CJ_KONUM.baslat({
    onSehirBulundu: (sehir) => {
      console.log('CityJoy: Şehir tespit edildi →', sehir.ad);
      // Sayfaya özel event fırlat
      window.dispatchEvent(new CustomEvent('cj:sehirHazir', { detail: sehir }));
    },
    onHata: (e) => {
      console.log('CityJoy: Konum hatası →', e.message);
    }
  });
});
