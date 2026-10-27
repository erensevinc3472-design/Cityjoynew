// İl, ilçe ve mahalle verisini PTT posta kodu listesinden (turkey-neighbourhoods paketi
// aracılığıyla, MIT lisansı) okuyup uygulamanın kullandığı biçime dönüştürür.
// Çalıştırma: npm run locations:build (depo kökünden)

import { createRequire } from 'node:module';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../data/locations');

const pkgDir = path.resolve(path.dirname(require.resolve('turkey-neighbourhoods')), '..');
const readJson = async (rel) => JSON.parse(await readFile(path.join(pkgDir, rel), 'utf8'));

const TR_ASCII = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

export function slugify(text) {
  return text
    .toLocaleLowerCase('tr')
    .normalize('NFC')
    .replace(/[çğıöşüâîû]|i̇/g, (ch) => TR_ASCII[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function capitalizeWords(text) {
  return text.replace(/(^|[\s(-])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('tr'));
}

// "Yeşiltepe Mah (koçaklı Köyü)" -> "Yeşiltepe Mahallesi (Koçaklı Köyü)"
export function normalizeName(raw) {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return capitalizeWords(collapsed).replace(/\bMah\b\.?/g, 'Mahallesi');
}

export function detectKind(raw) {
  const main = raw.split('(')[0];
  if (/\bMah\b/.test(main)) return 'mahalle';
  if (/\bKöy(ü)?\b/.test(main)) return 'koy';
  return 'diger';
}

async function main() {
  const pkgJson = await readJson('package.json');
  const records = await readJson('src/data/neighbourhoods.json');
  const cityList = await readJson('src/data/cityList.json');

  const provinces = cityList
    .map((c) => ({ code: c.code, name: c.name, slug: slugify(c.name) }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const districts = new Map(); // id -> district
  const byProvince = new Map(); // province code -> { districtId: neighbourhood[] }
  const seenIds = new Set();

  for (const [code, , districtName, rawName, postalCode] of records) {
    const districtId = `${code}-${slugify(districtName)}`;
    if (!districts.has(districtId)) {
      districts.set(districtId, { id: districtId, provinceCode: code, name: districtName });
    }

    let id = `${districtId}-${slugify(rawName.replace(/\bMah\b/g, ''))}`;
    for (let n = 2; seenIds.has(id); n++) id = `${districtId}-${slugify(rawName)}-${n}`;
    seenIds.add(id);

    const group = byProvince.get(code) ?? {};
    (group[districtId] ??= []).push({
      id,
      name: normalizeName(rawName),
      kind: detectKind(rawName),
      postalCode,
    });
    byProvince.set(code, group);
  }

  const collator = new Intl.Collator('tr');
  const districtList = [...districts.values()].sort(
    (a, b) => a.provinceCode.localeCompare(b.provinceCode) || collator.compare(a.name, b.name),
  );

  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, 'neighbourhoods'), { recursive: true });

  await writeFile(path.join(outDir, 'provinces.json'), JSON.stringify(provinces));
  await writeFile(path.join(outDir, 'districts.json'), JSON.stringify(districtList));

  let neighbourhoodCount = 0;
  for (const [code, group] of byProvince) {
    for (const list of Object.values(group)) {
      list.sort((a, b) => collator.compare(a.name, b.name));
      neighbourhoodCount += list.length;
    }
    await writeFile(path.join(outDir, 'neighbourhoods', `${code}.json`), JSON.stringify(group));
  }

  const meta = {
    source: 'PTT posta kodu listesi (postakodu.ptt.gov.tr)',
    via: `turkey-neighbourhoods@${pkgJson.version} (MIT)`,
    generatedAt: new Date().toISOString(),
    counts: { provinces: provinces.length, districts: districtList.length, neighbourhoods: neighbourhoodCount },
  };
  await writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  console.log(meta.counts);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
