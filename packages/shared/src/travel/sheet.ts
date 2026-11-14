import { normalizeName } from '../organizations/municipalities';
import type { District, Province } from '../locations/types';
import {
  NEARBY_KINDS,
  TR_REGIONS,
  TRAVEL_CATEGORIES,
  TRAVEL_LIMITS,
  TRAVEL_MODES,
  parseGeo,
  validateTravelPlace,
  validHours,
  validateTravelText,
  type NearbyKind,
  type TravelCategory,
  type TravelCityContent,
  type TravelFact,
  type TravelMode,
  type TravelPlaceInput,
  type TravelRegionContent,
} from './travel';

/**
 * Seyahat > Keşfet ve Öğren içeriğinin Excel'den toplu yüklenmesi (Panel > Seyahat > Excel'den yükle).
 * Üç sekme: Bölgeler, Şehirler, Gezilecek Yerler. İlk satır sütun adları. Yüklenen her kayıt taslak olarak girer
 * (var olanın yayın durumu korunur); aynı yer yeniden yüklenince kimliği değişmez (il + ad).
 * Liste hücrelerinde öğeler " | " ile ayrılır.
 */
export const TRAVEL_SHEETS = {
  bolge: { sheet: 'Bölgeler', columns: ['bolge', 'slogan', 'tanitim', 'video'] },
  sehir: { sheet: 'Şehirler', columns: ['il', 'slogan', 'tanitim', 'kategoriler', 'one_cikanlar', 'bilgiler', 'video'] },
  yer: {
    sheet: 'Gezilecek Yerler',
    columns: [
      'il', 'ilce', 'ad', 'tur', 'kategori', 'ozet', 'hakkinda', 'tarihce', 'mimari', 'ziyaret_saatleri', 'giris_ucreti',
      'onerilen_sure', 'adres', 'nasil_gidilir', 'yakindakiler', 'ipuclari', 'erisilebilirlik', 'telefon', 'web', 'video',
      'mutlaka_gor', 'kaynak', 'sira', 'yas_bilgisi', 'yanina_al', 'kurallar', 'konum', 'kalis_dk', 'acilis', 'kapanis',
      'kapali_gunler', 'namaz',
    ],
  },
} as const;

/** Sütunların kısa açıklaması (şablonun "Okuyun" sekmesi ve ChatGPT tarifi). */
export const TRAVEL_SHEET_HELP: Record<string, string> = {
  bolge: `Bölge kodu: ${TR_REGIONS.map((r) => r.id).join(', ')}`,
  slogan: `Kısa etiket, en çok ${TRAVEL_LIMITS.tagline} harf ("Tarih, deniz ve şehir")`,
  tanitim: `2-4 cümlelik tanıtım, en çok ${TRAVEL_LIMITS.description} harf`,
  video: 'İsteğe bağlı, https:// ile başlayan video bağlantısı',
  il: 'İl adı (Bursa, İstanbul...)',
  kategoriler: `Şehirde öne çıkanlar, " | " ile: ${TRAVEL_CATEGORIES.join(', ')}`,
  one_cikanlar: `Kartta görünen en çok ${TRAVEL_LIMITS.highlights} yer adı, " | " ile`,
  bilgiler: `En çok ${TRAVEL_LIMITS.facts} bilgi, " | " ile; her biri "Etiket: Değer (Kaynak, Yıl)" ("En yüksek nokta: Uludağ, 2.543 m (Harita Genel Müdürlüğü, 2024)")`,
  ilce: 'İlçe adı (isteğe bağlı)',
  ad: `Yerin adı, en çok ${TRAVEL_LIMITS.name} harf`,
  tur: `Kısa tür, en çok ${TRAVEL_LIMITS.kind} harf ("Tarihî yapı", "Müze", "Doğa parkı")`,
  kategori: `Tek kategori: ${TRAVEL_CATEGORIES.join(', ')}`,
  ozet: `Kartta görünen 1-2 cümle, ${TRAVEL_LIMITS.summary} harfe kadar`,
  hakkinda: `Yer hakkında, ${TRAVEL_LIMITS.longText} harfe kadar`,
  tarihce: 'İsteğe bağlı',
  mimari: 'İsteğe bağlı',
  ziyaret_saatleri: 'Yalnızca resmî kaynakta yazıyorsa',
  giris_ucreti: 'Yalnızca resmî kaynakta yazıyorsa',
  onerilen_sure: '"1 saat" gibi',
  adres: 'Açık adres',
  nasil_gidilir: `Adımlar " | " ile; her biri "tür: metin", tür: ${TRAVEL_MODES.join(', ')}`,
  yakindakiler: `" | " ile; her biri "tür: metin", tür: ${NEARBY_KINDS.join(', ')}`,
  ipuclari: `En çok ${TRAVEL_LIMITS.listItems} ipucu, " | " ile`,
  erisilebilirlik: 'İsteğe bağlı',
  telefon: 'Yalnızca kurumun resmî numarası',
  web: 'Resmî site, https://',
  mutlaka_gor: 'Evet / Hayır',
  kaynak: 'Bilginin alındığı resmî kaynak (kurum adı ya da adres)',
  sira: 'Şehir sayfasındaki sıra (1, 2, 3...)',
  yas_bilgisi: 'İsteğe bağlı: yaş sınırı, çocuklar ve bebek arabası için kısa not',
  yanina_al: `İsteğe bağlı: giderken yanına alınacaklar, en çok ${TRAVEL_LIMITS.listItems}, " | " ile`,
  kurallar: `İsteğe bağlı: uyulması gereken kurallar, en çok ${TRAVEL_LIMITS.listItems}, " | " ile`,
  konum: 'İsteğe bağlı (Gezimi planla, Yakınımda): Google Haritalar koordinatı, "40.1826, 29.0619" gibi',
  kalis_dk: 'İsteğe bağlı: önerilen kalış, dakika (45)',
  acilis: 'İsteğe bağlı: açılış saati "09:00"; her zaman açıksa "Her zaman"',
  kapanis: 'İsteğe bağlı: kapanış saati "18:00"',
  kapali_gunler: 'İsteğe bağlı: kapalı günler, " | " ile (Pazartesi | Salı)',
  namaz: 'İsteğe bağlı: namaz vakitlerinde ziyaret kısıtlıysa Evet',
};

export interface TravelSheetError {
  sheet: string;
  row: number;
  message: string;
}

export interface TravelImport {
  regions: Omit<TravelRegionContent, 'status' | 'updatedAt' | 'cover'>[];
  cities: Omit<TravelCityContent, 'status' | 'updatedAt' | 'cover'>[];
  places: { id: string; data: Omit<TravelPlaceInput, 'status' | 'cover'> }[];
  errors: TravelSheetError[];
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const list = (v: unknown) => str(v).split('|').map((x) => x.trim()).filter(Boolean);
const keyOf = (s: string) => normalizeName(s);
/** Sonradan eklenen sütunlar: eski dosyalarda olmayabilir. */
const OPTIONAL_COLUMNS: readonly string[] = ['yas_bilgisi', 'yanina_al', 'kurallar', 'konum', 'kalis_dk', 'acilis', 'kapanis', 'kapali_gunler', 'namaz'];

const DAY_KEYS = ['pazar', 'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi'];

/** Excel saat hücresi (0,375 gibi gün kesri) ya da "9:00" → "09:00". */
function clock(s: string): string {
  const pad = (n: number | string) => String(n).padStart(2, '0');
  if (/^0?\.\d+$/.test(s)) {
    const m = Math.round(Number(s) * 24 * 60);
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }
  const m = s.match(/^(\d{1,2})[.:](\d{2})$/);
  return m ? `${pad(m[1]!)}:${m[2]}` : s;
}

/** Konum, kalış ve açılış saatleri sütunları (hepsi isteğe bağlı). Hata varsa açıklama döner. */
function planColumns(v: (k: string) => string): Pick<TravelPlaceInput, 'location' | 'hours' | 'durationMinutes'> | string {
  const out: Pick<TravelPlaceInput, 'location' | 'hours' | 'durationMinutes'> = {};
  if (v('konum')) {
    const g = parseGeo(v('konum'));
    if (!g) return 'Konum "40.1826, 29.0619" biçiminde olmalı';
    out.location = g;
  }
  if (v('kalis_dk')) {
    const n = Number(v('kalis_dk'));
    if (!Number.isInteger(n) || n < 10 || n > 720) return 'Kalış 10-720 dakika arasında tam sayı olmalı';
    out.durationMinutes = n;
  }
  const open = clock(v('acilis'));
  const days = list(v('kapali_gunler')).map((d) => DAY_KEYS.indexOf(keyOf(d)));
  if (days.some((d) => d < 0)) return 'Kapalı günler gün adı olmalı (Pazartesi | Salı)';
  const prayer = keyOf(v('namaz')) === 'evet';
  if (open || v('kapanis') || days.length || prayer) {
    const allDay = keyOf(open) === 'her zaman';
    const hours = allDay ? { allDay, closedDays: days, prayer } : { allDay, open, close: clock(v('kapanis')), closedDays: days, prayer };
    if (!validHours(hours)) return 'Açılış ve kapanış "09:00" biçiminde olmalı, açılış kapanıştan önce';
    out.hours = hours;
  }
  return out;
}

/** "il + ad"dan kalıcı kimlik: aynı yer yeniden yüklenince güncellenir. */
export function travelPlaceId(cityId: string, name: string): string {
  return `${cityId}-${keyOf(name).replace(/ /g, '-').slice(0, 80)}`;
}

/** "Etiket: Değer (Kaynak, Yıl)". */
export function parseTravelFact(s: string): TravelFact | null {
  const i = s.indexOf(':');
  if (i < 1) return null;
  const label = s.slice(0, i).trim();
  let value = s.slice(i + 1).trim();
  let source: string | undefined;
  let asOf: string | undefined;
  const m = value.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (m) {
    const parts = m[2]!.split(',').map((x) => x.trim());
    const year = parts.length > 1 && /^\d{4}$/.test(parts[parts.length - 1]!) ? parts.pop() : /^\d{4}$/.test(parts[0]!) ? parts.shift() : undefined;
    value = m[1]!;
    asOf = year;
    source = parts.join(', ') || undefined;
  }
  return label && value ? { label, value, ...(source ? { source } : {}), ...(asOf ? { asOf } : {}) } : null;
}

function pairs<K extends string>(cell: unknown, keys: readonly K[]): { k: K; text: string }[] | null {
  const out: { k: K; text: string }[] = [];
  for (const item of list(cell)) {
    const i = item.indexOf(':');
    const k = item.slice(0, i).trim() as K;
    if (i < 1 || !keys.includes(k)) return null;
    out.push({ k, text: item.slice(i + 1).trim() });
  }
  return out;
}

/** Sekmelerin hepsini okur. Bilinmeyen sekmeler ("Okuyun") atlanır. */
export function parseTravelWorkbook(
  sheets: { sheet: string; data: unknown[][] }[],
  ctx: { provinces: readonly Province[]; districts: readonly District[] },
): TravelImport {
  const res: TravelImport = { regions: [], cities: [], places: [], errors: [] };
  const province = (name: string) => ctx.provinces.find((p) => keyOf(p.name) === keyOf(name));
  const district = (code: string, name: string) => ctx.districts.find((d) => d.provinceCode === code && keyOf(d.name) === keyOf(name));
  const regionOf = (code: string) => TR_REGIONS.find((r) => r.provinceCodes.includes(code))?.id;

  for (const { sheet, data } of sheets) {
    const def = Object.values(TRAVEL_SHEETS).find((d) => d.sheet === sheet);
    if (!def || !data.length) continue;
    const head = (data[0] ?? []).map((h) => str(h));
    const missing = def.columns.filter((c) => !head.includes(c) && !OPTIONAL_COLUMNS.includes(c));
    if (missing.length) {
      res.errors.push({ sheet, row: 1, message: `Eksik sütun: ${missing.join(', ')}` });
      continue;
    }
    const seen = new Set<string>();
    data.slice(1).forEach((raw, idx) => {
      const row = idx + 2;
      const v = (k: string) => (head.includes(k) ? str(raw[head.indexOf(k)]) : '');
      if (!raw.some((c) => str(c))) return;
      const err = (message: string) => res.errors.push({ sheet, row, message });

      if (def === TRAVEL_SHEETS.bolge) {
        const id = v('bolge');
        if (!TR_REGIONS.some((r) => r.id === id)) return err(`Bilinmeyen bölge kodu: "${id}"`);
        const r = { id, tagline: v('slogan'), description: v('tanitim'), ...(v('video') ? { videoUrl: v('video') } : {}) };
        const e = validateTravelText(r);
        if (e.length || !r.tagline || r.description.length < 10) return err(`Slogan/tanıtım/video hatalı (${e.join(', ') || 'boş'})`);
        if (seen.has(id)) return err(`Aynı bölge iki kez: ${id}`);
        seen.add(id);
        res.regions.push(r);
      } else if (def === TRAVEL_SHEETS.sehir) {
        const p = province(v('il'));
        if (!p) return err(`Bilinmeyen il: "${v('il')}"`);
        const categories = list(v('kategoriler')) as TravelCategory[];
        const bad = categories.filter((c) => !(TRAVEL_CATEGORIES as readonly string[]).includes(c));
        if (bad.length) return err(`Bilinmeyen kategori: ${bad.join(', ')}`);
        const highlights = list(v('one_cikanlar'));
        if (highlights.length > TRAVEL_LIMITS.highlights) return err(`Öne çıkanlar en çok ${TRAVEL_LIMITS.highlights}`);
        const factsRaw = list(v('bilgiler'));
        const facts = factsRaw.map(parseTravelFact);
        if (facts.some((f) => !f)) return err('Bilgiler "Etiket: Değer (Kaynak, Yıl)" biçiminde olmalı');
        if (facts.length > TRAVEL_LIMITS.facts) return err(`Bilgiler en çok ${TRAVEL_LIMITS.facts}`);
        const c = {
          id: p.code,
          regionId: regionOf(p.code)!,
          tagline: v('slogan'),
          description: v('tanitim'),
          categories,
          highlights,
          facts: facts as TravelFact[],
          ...(v('video') ? { videoUrl: v('video') } : {}),
        };
        const e = validateTravelText(c);
        if (e.length || !c.tagline || c.description.length < 10) return err(`Slogan/tanıtım/video hatalı (${e.join(', ') || 'boş'})`);
        if (seen.has(c.id)) return err(`Aynı il iki kez: ${p.name}`);
        seen.add(c.id);
        res.cities.push(c);
      } else {
        const p = province(v('il'));
        if (!p) return err(`Bilinmeyen il: "${v('il')}"`);
        const d = v('ilce') ? district(p.code, v('ilce')) : undefined;
        if (v('ilce') && !d) return err(`Bilinmeyen ilçe: "${v('ilce')}" (${p.name})`);
        const category = v('kategori') as TravelCategory;
        if (!(TRAVEL_CATEGORIES as readonly string[]).includes(category)) return err(`Bilinmeyen kategori: "${category}"`);
        const howToGet = pairs(v('nasil_gidilir'), TRAVEL_MODES as readonly TravelMode[]);
        if (!howToGet) return err(`Nasıl gidilir "tür: metin" olmalı (tür: ${TRAVEL_MODES.join(', ')})`);
        const nearby = pairs(v('yakindakiler'), NEARBY_KINDS as readonly NearbyKind[]);
        if (!nearby) return err(`Yakındakiler "tür: metin" olmalı (tür: ${NEARBY_KINDS.join(', ')})`);
        const must = keyOf(v('mutlaka_gor'));
        if (must && must !== 'evet' && must !== 'hayir') return err('Mutlaka gör: Evet ya da Hayır');
        const order = v('sira') ? Number(v('sira')) : idx + 1;
        if (!Number.isFinite(order)) return err('Sıra sayı olmalı');
        const opt = (k: string, key: string) => (v(k) ? { [key]: v(k) } : {});
        const plan = planColumns(v);
        if (typeof plan === 'string') return err(plan);
        const tel = v('telefon').replace(/\D/g, '');
        if (v('telefon') && (tel.length < 7 || /^0?5\d{9}$/.test(tel))) return err('Telefon yalnızca kurumun sabit/çağrı merkezi numarası');
        const data: Omit<TravelPlaceInput, 'status' | 'cover'> = {
          cityId: p.code,
          ...(d ? { districtId: d.id } : {}),
          name: v('ad'),
          kind: v('tur'),
          category,
          summary: v('ozet'),
          about: v('hakkinda'),
          ...opt('tarihce', 'history'),
          ...opt('mimari', 'architecture'),
          ...opt('ziyaret_saatleri', 'visitingHours'),
          ...opt('giris_ucreti', 'entranceFee'),
          ...opt('onerilen_sure', 'suggestedDuration'),
          ...opt('adres', 'address'),
          howToGet: howToGet.map((x) => ({ mode: x.k, text: x.text })),
          nearby: nearby.map((x) => ({ kind: x.k, text: x.text })),
          tips: list(v('ipuclari')),
          ...opt('erisilebilirlik', 'accessibility'),
          ...(tel ? { phone: tel } : {}),
          ...opt('web', 'website'),
          ...opt('video', 'videoUrl'),
          mustSee: must === 'evet',
          ...opt('kaynak', 'source'),
          ...opt('yas_bilgisi', 'ageInfo'),
          ...(list(v('yanina_al')).length ? { bring: list(v('yanina_al')) } : {}),
          ...(list(v('kurallar')).length ? { rules: list(v('kurallar')) } : {}),
          ...plan,
          order,
        };
        const e = validateTravelPlace({ ...data, status: 'taslak' });
        if (e.length) return err(`Hatalı alan: ${e.join(', ')}`);
        if (!data.source) return err('Kaynak boş olamaz');
        const id = travelPlaceId(p.code, data.name);
        if (seen.has(id)) return err(`Aynı yer iki kez: ${data.name} (${p.name})`);
        seen.add(id);
        res.places.push({ id, data });
      }
    });
  }
  return res;
}
