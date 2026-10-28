/**
 * OpenStreetMap'ten Benim Şehrim Excel'i (deneme aracı). Bir il için park, müze, otopark, pazar yeri, önemli kurum ve
 * toplanma alanlarını Overpass sorgusuyla tek seferde çeker, il/ilçe başına ayırır, Benim Şehrim şablonunun sütunlarına
 * çevirir ve panelin "Excel'den yükle" denetiminden geçirir. Çıkan dosya panelden yüklenmeden önce kontrol edilir:
 * OSM verisi "doğrulanmadı" olarak girer.
 *
 * Kullanım: npx vite-node scripts/osm-city-guide.ts -- 16
 * Lisans (ODbL): uygulamada "© OpenStreetMap katkıcıları" yazılmalı; birleşik veritabanının paylaşımı avukata sorulacak.
 * Maliyet ilkesi (PROJE.md 9.1): uygulama Overpass'e hiç gitmez; bu araç elle ya da zamanlanmış olarak çalıştırılır.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import writeExcelFile from 'write-excel-file/node';
import { citySection, parseCitySheet, type CityGuideSectionId } from '@cityjoy/shared';

import districts from '../packages/shared/data/locations/districts.json';
import provinces from '../packages/shared/data/locations/provinces.json';

type Tags = Record<string, string>;
interface OsmElement {
  type: 'node' | 'way' | 'relation' | 'area';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Tags;
}

const SECTIONS: CityGuideSectionId[] = ['onemli-kurumlar', 'muzeler', 'otoparklar', 'parklar', 'pazarlar', 'toplanma-alanlari'];
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

const provinceCode = process.argv.filter((a) => /^\d{2}$/.test(a)).pop() ?? '16';
const province = provinces.find((p) => p.code === provinceCode);
if (!province) throw new Error(`İl bulunamadı: ${provinceCode}`);

// Önce ilçe sınırları (admin_level 6), sonra her ilçe için ayrı küçük sorgu: tek büyük sorgu ücretsiz sunucularda
// zaman aşımına uğruyor. Sunucuyu yormamak için sorgular arasında kısa bekleme var.
const districtQuery = `[out:json][timeout:120];
area["ISO3166-2"="TR-${provinceCode}"]->.il;
rel(area.il)["boundary"="administrative"]["admin_level"="6"];
out tags;`;

const placesQuery = (relId: number) => `[out:json][timeout:180];
area(${3600000000 + relId})->.x;
(
  nwr["tourism"="museum"](area.x);
  nwr["leisure"="park"]["name"](area.x);
  nwr["amenity"="parking"]["access"!~"private|customers|no"](area.x);
  nwr["amenity"="marketplace"](area.x);
  nwr["amenity"~"^(townhall|hospital|police|fire_station|courthouse|post_office|library)$"]["name"](area.x);
  nwr["amenity"~"^(clinic|doctors)$"]["name"~"Aile Sağlığı",i](area.x);
  nwr["office"="government"]["name"](area.x);
  nwr["emergency"="assembly_point"](area.x);
);
out center tags;`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(q: string): Promise<OsmElement[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          body: new URLSearchParams({ data: q }),
          headers: { 'User-Agent': 'CityJoy-sehir-rehberi/0.1 (veri denemesi)' },
          signal: AbortSignal.timeout(200_000),
        });
        if (!r.ok) throw new Error(`${r.status}`);
        return ((await r.json()) as { elements: OsmElement[] }).elements;
      } catch (e) {
        console.warn(`  ${new URL(url).host} olmadı (${(e as Error).message})`);
      }
    }
    await sleep(10_000 * (attempt + 1));
  }
  throw new Error('Overpass sunucularına ulaşılamadı');
}

const outDir = path.join(process.cwd(), 'veri-denemesi');
mkdirSync(path.join(outDir, 'onbellek'), { recursive: true });

/** Sorgu sonucu diske yazılır: sunucu yarıda kalırsa araç yeniden çalıştırılınca kaldığı ilçeden devam eder. */
async function cached(name: string, q: string): Promise<OsmElement[]> {
  const file = path.join(outDir, 'onbellek', `${name}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as OsmElement[];
  await sleep(2_000);
  const list = await overpass(q);
  writeFileSync(file, JSON.stringify(list));
  return list;
}

/** İlçe adı işaretleri ("area") ve ardından o ilçenin yerleri, sırayla. */
async function fetchOsm(): Promise<OsmElement[]> {
  const ilceler = (await cached(`${provinceCode}-ilceler`, districtQuery)).filter((e) => e.type === 'relation');
  const out: OsmElement[] = [];
  for (const d of ilceler) {
    const name = d.tags?.['name:tr'] ?? d.tags?.name ?? '';
    process.stdout.write(`${name}… `);
    const places = await cached(`${provinceCode}-${d.id}`, placesQuery(d.id));
    console.log(places.length);
    out.push({ type: 'area', id: d.id, tags: { name } }, ...places);
  }
  return out;
}

const today = new Date();
const dateText = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
const has = (s: string | undefined, re: RegExp) => !!s && re.test(s);
const phoneOf = (t: Tags) => (t.phone ?? t['contact:phone'] ?? '').split(';')[0].replace(/\D/g, '').replace(/^90/, '0');
const webOf = (t: Tags) => {
  const w = (t.website ?? t['contact:website'] ?? '').split(';')[0].trim();
  return /^https?:\/\//.test(w) ? w : '';
};
const addressOf = (t: Tags) =>
  t['addr:full'] ?? [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' No:').trim();
const DAYS: Record<string, string> = { Mo: 'Pazartesi', Tu: 'Salı', We: 'Çarşamba', Th: 'Perşembe', Fr: 'Cuma', Sa: 'Cumartesi', Su: 'Pazar' };
const ORDER = Object.keys(DAYS);
/** "Tu,Fr 08:00-18:00" ya da "Mo-Sa ..." -> "Salı, Cuma". */
function daysOf(oh: string | undefined): string {
  if (!oh) return '';
  const out = new Set<string>();
  for (const m of oh.matchAll(/\b(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\b/g)) {
    const a = ORDER.indexOf(m[1]);
    const b = m[2] ? ORDER.indexOf(m[2]) : a;
    for (let i = a; i <= b; i++) out.add(DAYS[ORDER[i]]);
  }
  return [...out].join(', ');
}
const SHORT: Record<string, string> = { Mo: 'Pzt', Tu: 'Sal', We: 'Çar', Th: 'Per', Fr: 'Cum', Sa: 'Cmt', Su: 'Paz' };
/** OSM saat yazımını Türkçeye çevirir: "Tu-Su 09:00-17:30; Mo off" -> "Sal-Paz 09:00-17:30; Pzt kapalı". */
function hoursTr(oh: string | undefined): string {
  if (!oh) return '';
  if (oh.trim() === '24/7') return '7/24 açık';
  return oh
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (d) => SHORT[d])
    .replace(/\bPH\b/g, 'resmî tatil')
    .replace(/\b(off|closed)\b/gi, 'kapalı')
    .replace(/24\/7/g, '7/24');
}

/** Bir OSM kaydının hangi bölüme girdiği ve şablon satırı; uymuyorsa null (nedeniyle). */
function toRow(e: OsmElement, ilce: string): { section: CityGuideSectionId; row: Record<string, string | number> } | { skip: string } {
  const t = e.tags ?? {};
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  const name = (t['name:tr'] ?? t.name ?? '').trim();
  const base = {
    il: province!.name,
    ilce,
    adres: addressOf(t),
    enlem: lat ? Number(lat.toFixed(6)) : '',
    boylam: lon ? Number(lon.toFixed(6)) : '',
    kaynak: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    kaynak_tarihi: dateText,
    not: 'OpenStreetMap; doğrulanmadı',
  };
  const contact = { telefon: phoneOf(t), web: webOf(t) };

  if (t.tourism === 'museum') {
    if (!name) return { skip: 'adsız müze' };
    const tur =
      ({ history: 'tarih', archaeological: 'arkeoloji', art: 'sanat', industrial: 'sanayi', ethnography: 'etnografya', science: 'bilim', local: 'kent' } as Record<string, string>)[t.museum ?? ''] ??
      (has(name, /arkeoloji/i) ? 'arkeoloji' : has(name, /sanat/i) ? 'sanat' : has(name, /etnografya/i) ? 'etnografya' : has(name, /kent/i) ? 'kent' : 'diger');
    const ucret = t.fee === 'no' ? 'Ücretsiz' : t.fee === 'yes' ? 'Ücretli' : '';
    return { section: 'muzeler', row: { ...base, ...contact, tur, ad: name, ucret_durumu: ucret, acilis_saatleri: hoursTr(t.opening_hours) } };
  }
  if (t.leisure === 'park') {
    const tur = has(name, /millet bahçesi/i) ? 'millet-bahcesi' : has(name, /kent ormanı/i) ? 'kent-ormani' : has(name, /mesire/i) ? 'mesire-alani' : has(name, /botanik/i) ? 'botanik-bahcesi' : 'park';
    return { section: 'parklar', row: { ...base, tur, ad: name, acilis_saatleri: hoursTr(t.opening_hours) } };
  }
  if (t.amenity === 'parking') {
    const ad = name || (t.operator ? `${t.operator} Otoparkı` : '');
    if (!ad) return { skip: 'adsız otopark' };
    if (has(ad, /yıkama|servis|lastik|galeri/i)) return { skip: 'otopark olmayan işletme' };
    const tip = ({ 'multi-storey': 'katli', underground: 'yeralti', surface: 'acik', street_side: 'acik', lane: 'acik' } as Record<string, string>)[t.parking ?? ''] ?? (has(ad, /avm|alışveriş/i) ? 'avm' : has(ad, /katlı/i) ? 'katli' : '');
    const isletici = has(t.operator, /belediye|büyükşehir|burulaş|bbb/i) || has(ad, /belediye/i) ? 'Belediye' : t.operator ? 'Özel' : '';
    return { section: 'otoparklar', row: { ...base, ...contact, tip, ad, isletici, kapasite: /^\d+$/.test(t.capacity ?? '') ? Number(t.capacity) : '' } };
  }
  if (t.amenity === 'marketplace') {
    if (!name) return { skip: 'adsız pazar yeri' };
    const tur = has(name, /köylü/i) ? 'koylu-pazari' : has(name, /balık/i) ? 'balik-pazari' : has(name, /organik/i) ? 'organik-pazar' : has(name, /bit pazar/i) ? 'bit-pazari' : 'semt-pazari';
    return { section: 'pazarlar', row: { ...base, tur, ad: name, gunler: daysOf(t.opening_hours), saatler: hoursTr(t.opening_hours) } };
  }
  if (t.emergency === 'assembly_point') {
    if (!name) return { skip: 'adsız toplanma alanı' };
    return { section: 'toplanma-alanlari', row: { ...base, ad: name } };
  }
  // Önemli kurumlar.
  if (!name) return { skip: 'adsız kurum' };
  if (has(name, /lojman/i)) return { skip: 'lojman' };
  // Önce kurumun türü (OSM etiketi ve addaki kesin işaret), sonra addaki genel sözcükler: "Kaymakamlığı İlçe Jandarma
  // Komutanlığı" kaymakamlık değil jandarmadır.
  const a = t.amenity;
  const kategori =
    a === 'hospital' ? (has(name, /özel/i) || has(t['operator:type'], /private/) ? 'hastane-ozel' : 'hastane-devlet')
    : a === 'police' || has(name, /jandarma|emniyet|polis|karakol/i) ? (has(name, /jandarma/i) ? 'jandarma' : 'emniyet')
    : a === 'fire_station' || has(name, /itfaiye/i) ? 'itfaiye'
    : a === 'courthouse' || has(name, /adliye|adalet sarayı/i) ? 'adliye'
    : a === 'post_office' || has(name, /\bptt\b/i) ? 'ptt'
    : a === 'library' || has(name, /kütüphane/i) ? 'kutuphane'
    : has(name, /aile sağlığı/i) ? 'aile-sagligi-merkezi'
    : has(name, /nüfus/i) ? 'nufus-mudurlugu'
    : has(name, /göç idare/i) ? 'goc-idaresi'
    : has(name, /vergi dairesi/i) ? 'vergi-dairesi'
    : has(name, /sgk|sosyal güvenlik/i) ? 'sgk'
    : has(name, /noter/i) ? 'noter'
    : has(name, /halk eğitim/i) ? 'halk-egitim'
    : has(name, /valilik|valiliği/i) ? 'valilik'
    : has(name, /kaymakamlı/i) ? 'kaymakamlik'
    : has(name, /müdürlüğü/i) ? 'il-mudurlugu'
    : 'diger';
  return { section: 'onemli-kurumlar', row: { ...base, ...contact, kategori, ad: name, calisma_hafta_ici: hoursTr(t.opening_hours) } };
}

const elements = await fetchOsm();
const rows = new Map<CityGuideSectionId, Record<string, string | number>[]>(SECTIONS.map((s) => [s, []]));
const skipped = new Map<string, number>();
const seenOsm = new Set<string>();
let ilce = '';
for (const e of elements) {
  if (e.type === 'area') {
    ilce = e.tags?.['name:tr'] ?? e.tags?.name ?? '';
    continue;
  }
  // İki ilçenin sınırındaki kayıt bir kez alınır.
  const key = `${e.type}/${e.id}`;
  if (seenOsm.has(key)) continue;
  seenOsm.add(key);
  const r = toRow(e, ilce);
  if ('skip' in r) skipped.set(r.skip, (skipped.get(r.skip) ?? 0) + 1);
  else rows.get(r.section)!.push(r.row);
}

// Aynı ilçede aynı adlı kayıtlar (ör. bir parkın iki parçası) tek satıra iner: panel aynı yeri iki kez kabul etmez.
for (const [s, list] of rows) {
  const seen = new Set<string>();
  rows.set(s, list.filter((r) => {
    const k = `${r.ilce}|${String(r.ad).toLocaleLowerCase('tr')}`;
    return !seen.has(k) && !!seen.add(k);
  }));
}

// Panelin denetimi: hangi satırlar olduğu gibi yüklenir, hangileri eksik bilgi yüzünden düzeltilmeli.
const ctx = { provinces, districts, today };
const sheets: { data: (string | number)[][]; sheet: string }[] = [];
console.log(`\n${province.name}: OpenStreetMap'ten ${elements.filter((e) => e.type !== 'area').length} kayıt, ${elements.filter((e) => e.type === 'area').length} ilçe\n`);
for (const s of SECTIONS) {
  const section = citySection(s)!;
  const keys = section.columns.map((c) => c.key);
  const data = [keys, ...rows.get(s)!.map((r) => keys.map((k) => r[k] ?? ''))];
  const { items, errors } = parseCitySheet(s, data, ctx);
  const reasons = new Map<string, number>();
  for (const er of errors) for (const m of er.message.split('; ')) reasons.set(m.replace(/"[^"]*" listede yok/, 'listede yok'), (reasons.get(m) ?? 0) + 1);
  const top = [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, n]) => `${m} (${n})`).join(', ');
  console.log(`${section.sheet.padEnd(18)} ${String(rows.get(s)!.length).padStart(4)} satır · hazır ${String(items.length).padStart(4)} · düzeltilecek ${String(errors.length).padStart(4)}${top ? ` · ${top}` : ''}`);
  sheets.push({ data, sheet: section.sheet });
}
if (skipped.size) console.log(`\nAlınmayanlar: ${[...skipped].map(([k, n]) => `${k} ${n}`).join(', ')}`);

const notes = [
  ['Bu dosya OpenStreetMap verisinden otomatik üretildi (deneme).'],
  [`Tarih: ${dateText}. Kaynak: © OpenStreetMap katkıcıları, ODbL lisansı. Uygulamada kaynak yazısı gösterilmeli.`],
  ['Her satır "doğrulanmadı" olarak yüklenir. Boş zorunlu alanları (ör. müze ücret durumu, pazar günleri) tamamlayın.'],
  ['Yüklemeden önce panelde önizlemeye bakın; hatalı satırlar ve nedenleri orada listelenir.'],
];
const out = path.join(outDir, `osm-${provinceCode}-${province.name}.xlsx`);
await writeExcelFile([{ data: notes, sheet: 'Okuyun' }, ...sheets.map((s) => ({ ...s, stickyRowsCount: 1 }))]).toFile(out);
console.log(`\nDosya: ${out}`);
