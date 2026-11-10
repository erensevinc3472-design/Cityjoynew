// Bursa panel dosyalarındaki eksikleri doldurur (10 Kasım 2026, Eren "tamamlayabileceklerine başla" dedi):
// 1) Harita konumu: OSM'de aynı adla geçen yer (kesin) ya da Nominatim'de adresin sokağı doğru ilçe ve mahallede
//    bulunduysa (sokak düzeyi, notla). Bulunamayan boş kalır, uydurulmaz.
// 2) Çalışma saati: yalnızca kuralı kesin olan türler (7/24 acil birimler, devlet hastanesi, aile sağlığı merkezi).
// 3) Müzeler: Kültür ve Turizm Bakanlığı müze sitesindeki saat, kapalı gün, ücret ve geçici kapanma bilgisi.
// Girdi (scratchpad'de üretilir): eksik-konum.json, konum-osm.json, konum-nominatim.json.
// Çalıştırma: npx vite-node scripts/bursa-tamamla.ts -- <veri klasörü> <panel dosyalarının klasörü>
import { readFileSync } from 'node:fs';
import readXlsxFile from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';

const [dataDir, xlsxDir] = process.argv.slice(-2) as [string, string];
const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const ODBL = 'OSM/ODbL';

type Miss = { f: string; sheet: string; i: number };
const miss = JSON.parse(readFileSync(`${dataDir}/eksik-konum.json`, 'utf8')) as Miss[];
const byName = JSON.parse(readFileSync(`${dataDir}/konum-osm.json`, 'utf8')) as Record<string, { lat: number; lon: number; src: string }>;
/** [satır sırası, enlem, boylam, düzey (y: yer adı, k: bina, s: sokak, -: yok), osm kimliği] */
const geo = JSON.parse(readFileSync(`${dataDir}/konum-nominatim.json`, 'utf8')) as Record<string, [number, number, number, string, string?]>;
const osmUrl = (id: string) => `osm.org/${({ n: 'node', w: 'way', r: 'relation' } as Record<string, string>)[id[0]!]}/${id.slice(1)}`;

const located = new Map<string, { lat: string; lon: string; note: string }>();
miss.forEach((m, k) => {
  const key = `${m.f}|${m.sheet}|${m.i}`;
  const a = byName[key];
  if (a) return located.set(key, { lat: a.lat.toFixed(6), lon: a.lon.toFixed(6), note: `Konum ${ODBL}: ${a.src.replace('https://www.openstreetmap.org/', 'osm.org/')}` });
  const g = geo[k];
  if (!g || !g[1] || !g[4]) return;
  const street = g[3] === 's';
  located.set(key, {
    lat: g[1].toFixed(6),
    lon: g[2].toFixed(6),
    note: street ? `Konum sokak düzeyi, kapı teyit edilmeli (${ODBL}: ${osmUrl(g[4])})` : `Konum ${ODBL}: ${osmUrl(g[4])}`,
  });
});

/** Kuralı kesin olan çalışma saatleri. */
const HOURS: Record<string, [string, string, string?]> = {
  emniyet: ['7/24', '7/24'],
  jandarma: ['7/24', '7/24'],
  itfaiye: ['7/24', '7/24'],
  'hastane-devlet': ['Poliklinik 08:00-17:00, acil servis 7/24', 'Acil servis 7/24', 'Olağan poliklinik saati, teyit edilmeli'],
  'aile-sagligi-merkezi': ['08:00-17:00', 'Kapalı', 'Yönetmelikteki olağan saat, teyit edilmeli'],
};

/** Bakanlık müze sitesi (muze.gov.tr), 10 Kasım 2026'da okundu. */
const MUSEUMS: Record<string, { id: string; saat: string; kapali?: string; ucret: 'Ücretsiz' | 'Ücretli'; kart?: string; tel?: string; durum?: string }> = {
  'Bursa Arkeoloji Müzesi': { id: 'BAR01', saat: '08:00-17:00 (gişe 16:30)', ucret: 'Ücretsiz', tel: '02242344918', durum: 'Geçici süreyle ziyarete kapalı' },
  'Bursa Atatürk Evi Müzesi': { id: 'BAE01', saat: '08:00-17:00 (gişe 16:30)', kapali: 'Pazartesi', ucret: 'Ücretsiz', tel: '02242347716' },
  '17. Yüzyıl Osmanlı Evi Müzesi': { id: 'BOS01', saat: '08:00-17:00 (gişe 16:30)', ucret: 'Ücretsiz', tel: '02242220868', durum: 'Şu an kapalı' },
  'Yenişehir Şemaki Evi Müzesi': { id: 'BYS01', saat: '08:00-17:00 (gişe 16:30)', ucret: 'Ücretsiz', tel: '02247730083', durum: 'Teşhir-tanzim çalışması nedeniyle kapalı' },
  'İznik Müzesi': { id: 'BIZ01', saat: '08:00-17:00 (gişe 16:30)', kapali: 'Pazartesi', ucret: 'Ücretli', kart: 'evet', tel: '02247571027' },
  'Mudanya Mütareke Evi Müzesi': { id: 'MUD02', saat: '08:00-17:00 (gişe 16:30)', kapali: 'Pazartesi', ucret: 'Ücretli', kart: 'evet', tel: '02245441068' },
};

/** Not en çok 200 harf (panel kuralı): sığmazsa bağlantısız kısa hâli eklenir, o da sığmazsa eklenmez. */
const addNote = (r: Record<string, string>, n: string) => {
  for (const x of [n, n.replace(/ ?\(?OSM\/ODbL: [^)\s]*\)?/, ' (OSM)')]) {
    const v = r.not ? `${r.not} • ${x}` : x;
    if (v.length <= 200) return void (r.not = v);
  }
};
const files = ['CityJoy-Bursa-aile-sagligi-panel.xlsx', 'CityJoy-Bursa-hastane-muze-otopark-panel.xlsx', 'CityJoy-Bursa-kurumlar-ek-panel.xlsx', 'CityJoy-Bursa-kurumlar-panel.xlsx'];
const stats = { konum: 0, sokak: 0, saat: 0, muze: 0 };
for (const f of files) {
  const sheets = (await readXlsxFile(`${xlsxDir}/${f}`)) as unknown as { sheet: string; data: unknown[][] }[];
  const outSheets = sheets.map(({ sheet, data }) => {
    const keys = (data[0] ?? []) as string[];
    const rows = data.slice(1).map((r) => Object.fromEntries(keys.map((k, j) => [k, r[j] == null ? '' : String(r[j])])) as Record<string, string>);
    rows.forEach((r, i) => {
      const loc = located.get(`${f}|${sheet}|${i}`);
      if (loc && keys.includes('enlem') && !r.enlem) {
        r.enlem = loc.lat;
        r.boylam = loc.lon;
        addNote(r, loc.note);
        stats.konum++;
        if (loc.note.includes('sokak')) stats.sokak++;
      }
      const h = HOURS[r.kategori ?? ''];
      if (h && keys.includes('calisma_hafta_ici') && !r.calisma_hafta_ici) {
        r.calisma_hafta_ici = h[0];
        if (!r.calisma_hafta_sonu) r.calisma_hafta_sonu = h[1];
        if (h[2]) addNote(r, h[2]);
        stats.saat++;
      }
      const m = sheet === 'Müzeler' ? MUSEUMS[r.ad ?? ''] : undefined;
      if (m) {
        r.acilis_saatleri = m.saat;
        if (m.kapali) r.kapali_gunler = m.kapali;
        r.ucret_durumu = m.ucret;
        if (m.kart) r.muzekart_gecerli = m.kart;
        if (m.tel && !r.telefon) r.telefon = m.tel;
        r.kaynak = `https://muze.gov.tr/muze-detay?SectionId=${m.id}&DistId=MRK`;
        r.kaynak_tarihi = today;
        if (m.durum) addNote(r, `${m.durum} (muze.gov.tr, ${today})`);
        stats.muze++;
      }
    });
    return { sheet, data: [keys, ...rows.map((r) => keys.map((k) => r[k] ?? ''))].map((r) => r.map((value) => ({ value, type: String }))), stickyRowsCount: 1 };
  });
  await writeExcelFile(outSheets as any).toFile(`${xlsxDir}/${f}`);
}
console.log(stats);
