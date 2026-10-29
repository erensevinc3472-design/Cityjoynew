/**
 * OpenStreetMap'ten Yoldayım'ın Türkiye yol üstü verisi (PROJE.md 5.2, Yol Arkadaşı): akaryakıt istasyonları, elektrikli
 * araç şarj noktaları, dinlenme tesisleri ve mola yerleri. İl il sorgulanır, sunucular sırayla denenir; her il diske
 * önbelleklenir, yarıda kalırsa kaldığı ilden devam eder. "--ulke" ile önce tüm Türkiye tek sorguyla denenir (ücretsiz
 * sunucular çoğu zaman kaldırmıyor). Olanaklar yalnızca OSM etiketlerinden çıkar, bilinmeyen eklenmez (sürprizsiz bilgi).
 *
 * Kullanım: npx vite-node scripts/osm-roadside.ts
 * Çıktı: veri-denemesi/yol-ustu-tr.json (Panel > Şehir rehberi > Yol üstü verisi ile yüklenir; masaüstüne de kopyalanır).
 * Lisans (ODbL): uygulamada "© OpenStreetMap katkıda bulunanlar" yazılır. Uygulama Overpass'e hiç gitmez (maliyet ilkesi).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';

import { packByCell, ROADSIDE_PACK_MAX, TURKEY_BOUNDS, type PackedPlace, type RoadsideFeature } from '@cityjoy/shared';

import provinces from '../packages/shared/data/locations/provinces.json';

type Tags = Record<string, string>;
interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Tags;
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
/** Ülke sorgusu yalnızca istenirse ("--ulke"): ücretsiz sunucular çoğu zaman kaldırmıyor. */
const TRY_COUNTRY = process.argv.includes('--ulke');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const COUNTRY = `[out:json][timeout:900][maxsize:1073741824];
area["ISO3166-1"="TR"]["admin_level"="2"]->.il;
(
  nwr["amenity"="fuel"](area.il);
  nwr["amenity"="charging_station"](area.il);
  nwr["highway"~"^(services|rest_area)$"](area.il);
);
out center tags;`;

const query = (code: string) => `[out:json][timeout:180];
area["ISO3166-2"="TR-${code}"]->.il;
(
  nwr["amenity"="fuel"](area.il);
  nwr["amenity"="charging_station"](area.il);
  nwr["highway"~"^(services|rest_area)$"](area.il);
);
out center tags;`;

/**
 * Uzun süren ülke sorgusu için: fetch'in 5 dakikalık yanıt bekleme sınırı yok (node:https), yalnızca 16 dakikalık
 * genel süre sınırı var.
 */
function post(url: string, body: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'CityJoy-yol-ustu/0.1 (veri hazirlama)' } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(String(res.statusCode)));
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (e) {
            reject(e as Error);
          }
        });
        res.on('error', reject);
      },
    );
    req.setTimeout(TRY_COUNTRY ? 960_000 : 300_000, () => req.destroy(new Error('süre doldu')));
    req.on('error', reject);
    req.end(body);
  });
}

async function overpass(q: string): Promise<OsmElement[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        return ((await post(url, new URLSearchParams({ data: q }).toString())) as { elements: OsmElement[] }).elements;
      } catch (e) {
        console.warn(`  ${new URL(url).host} olmadı (${(e as Error).message})`);
      }
    }
    await sleep(10_000 * (attempt + 1));
  }
  throw new Error('Overpass sunucularına ulaşılamadı');
}

const outDir = path.join(process.cwd(), 'veri-denemesi');
mkdirSync(path.join(outDir, 'onbellek-yol'), { recursive: true });

async function cached(code: string, q = query(code)): Promise<OsmElement[]> {
  const file = path.join(outDir, 'onbellek-yol', `${code}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as OsmElement[];
  await sleep(2_000);
  const list = await overpass(q);
  writeFileSync(file, JSON.stringify(list));
  return list;
}

const yes = (v?: string) => !!v && v !== 'no';

/** OSM etiketlerinden yer; tanınmayan ya da konumsuz kayıt atlanır. */
function toPlace(e: OsmElement): PackedPlace | null {
  const t = e.tags ?? {};
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  if (lat == null || lng == null) return null;
  if (lat < TURKEY_BOUNDS.lat[0] || lat > TURKEY_BOUNDS.lat[1] || lng < TURKEY_BOUNDS.lng[0] || lng > TURKEY_BOUNDS.lng[1]) return null;
  // Kullanılmayan / yapım aşamasındaki tesisler alınmaz.
  if (yes(t.disused) || yes(t.abandoned) || t['disused:amenity'] || t.construction) return null;
  const f = new Set<RoadsideFeature>();
  let k: PackedPlace['k'];
  if (t.amenity === 'fuel') {
    k = 'yol-akaryakit';
    f.add('akaryakit');
    if (yes(t['fuel:lpg'])) f.add('lpg');
  } else if (t.amenity === 'charging_station') {
    k = 'yol-sarj';
    f.add('sarj');
  } else if (t.highway === 'services' || t.highway === 'rest_area') {
    k = 'yol-dinlenme-tesisi';
  } else return null;
  if (yes(t.toilets)) f.add('tuvalet');
  if (t.shop === 'convenience' || t.shop === 'supermarket' || yes(t['fuel:shop'])) f.add('market');
  if (t.restaurant === 'yes' || t.food === 'yes') f.add('restoran');
  if (t.cafe === 'yes') f.add('kafe');
  if (t.prayer_room === 'yes' || t['amenity:place_of_worship'] === 'yes') f.add('mescit');
  const brand = (t.brand ?? t.operator ?? '').trim().slice(0, 40);
  const name = (t.name ?? t['name:tr'] ?? '').trim().slice(0, 80);
  return {
    i: `${e.type[0]}${e.id}`,
    // Adı yoksa uygulamada çeşidi yazılır ("Akaryakıt istasyonu"); marka varsa marka.
    n: name || brand,
    k,
    a: Math.round(lat * 1e5) / 1e5,
    o: Math.round(lng * 1e5) / 1e5,
    f: [...f],
    ...(brand && brand !== name ? { b: brand } : {}),
  };
}

const all = new Map<string, PackedPlace>();
let country: OsmElement[] | null = null;
if (TRY_COUNTRY) {
  try {
    process.stdout.write('Türkiye tek sorgu… ');
    country = await cached('TR', COUNTRY);
  } catch {
    console.log('olmadı, il il devam');
  }
}
for (const p of country ? [{ code: 'TR', name: 'Türkiye' }] : provinces) {
  process.stdout.write(`${p.code} ${p.name}… `);
  const list = country ?? (await cached(p.code));
  let n = 0;
  for (const e of list) {
    const place = toPlace(e);
    if (place && !all.has(place.i)) {
      all.set(place.i, place);
      n++;
    }
  }
  console.log(n);
}

const places = [...all.values()];
const cells = packByCell(places);
const biggest = Math.max(...[...cells.values()].map((c) => c.length));
const kinds = places.reduce<Record<string, number>>((m, p) => ((m[p.k] = (m[p.k] ?? 0) + 1), m), {});
console.log(`\nToplam ${places.length} yer, ${cells.size} hücre, en büyük hücre ${biggest} (sınır ${ROADSIDE_PACK_MAX})`, kinds);
if (biggest > ROADSIDE_PACK_MAX) throw new Error('Bir hücre sınırı aşıyor: ROADSIDE_PACK_MAX artırılmalı ya da hücre bölünmeli.');

const out = path.join(outDir, 'yol-ustu-tr.json');
writeFileSync(out, JSON.stringify({ source: 'OpenStreetMap (ODbL)', createdAt: new Date().toISOString().slice(0, 10), places }));
const desktop = path.join(os.homedir(), 'Desktop', 'CityJoy-yol-ustu-turkiye.json');
copyFileSync(out, desktop);
console.log(`Yazıldı: ${out}\nMasaüstü: ${desktop}`);
