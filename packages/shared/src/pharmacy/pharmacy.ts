/**
 * Nöbetçi eczane (PROJE.md 5.1, 5.4, 9.1; öneri docs/oneri-nobetci-eczane.md, Eren onayladı 5 Kasım 2026). Veri her
 * sabah bir kez hazır servisten (ilk tercih NosyAPI) il başına çekilip `dutyPharmacies/{il}` belgesine yazılır;
 * kullanıcı yalnızca bu belgeyi okur (maliyet ilkesi). Servis değişirse yalnızca bağdaştırıcı değişir.
 */

export interface DutyPharmacy {
  name: string;
  /** İlçe adı (servisten geldiği gibi). */
  district: string;
  address: string;
  phone?: string;
  lat?: number;
  lng?: number;
}

export interface DutyPharmacyDay {
  /** Nöbet günü, Türkiye tarihi "YYYY-AA-GG". */
  date: string;
  fetchedAt: string;
  source: string;
  items: DutyPharmacy[];
  /** Admin / il yöneticisinin o gün için gizlediği eczaneler (`pharmacyKey`). */
  hidden?: string[];
  /** İlin nöbet saatleri (panelden; yoksa `DEFAULT_DUTY_HOURS`). Günlük çekimde korunur. */
  hours?: DutyHours;
}

/** Nöbet başlangıcı ve ertesi sabah bitişi, Türkiye saatiyle "SS:DD". */
export interface DutyHours {
  start: string;
  end: string;
}

/** Çoğu ilde nöbet akşam eczaneler kapanınca başlar, ertesi sabah açılınca biter; il yöneticisi panelden düzeltir. */
export const DEFAULT_DUTY_HOURS: DutyHours = { start: '19:00', end: '08:30' };

export const isDutyTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/**
 * Listenin nöbet aralığı: liste gününün başlangıç saatinden ertesi günün bitiş saatine. `phase`: başlamadı / sürüyor /
 * bitti. `startDay` ve `endDay` bugüne göre (-1 dün, 0 bugün, 1 yarın); `hoursLeft` bitişe kalan tam saat (yukarı).
 */
export function dutyWindow(day: Pick<DutyPharmacyDay, 'date' | 'hours'>, now = new Date()) {
  const h = day.hours && isDutyTime(day.hours.start) && isDutyTime(day.hours.end) ? day.hours : DEFAULT_DUTY_HOURS;
  const at = (date: string, hm: string, plusDays = 0) => new Date(Date.parse(`${date}T${hm}:00+03:00`) + plusDays * 86400000);
  const start = at(day.date, h.start);
  const end = at(day.date, h.end, 1);
  const rel = (d: Date) => Math.round((Date.parse(turkeyDate(d)) - Date.parse(turkeyDate(now))) / 86400000);
  const t = now.getTime();
  return {
    hours: h,
    phase: t < start.getTime() ? ('soon' as const) : t < end.getTime() ? ('on' as const) : ('over' as const),
    startDay: rel(start),
    endDay: rel(end),
    hoursLeft: Math.max(0, Math.ceil((end.getTime() - t) / 3600000)),
  };
}

/** Türkiye tarihi (UTC+3) "YYYY-AA-GG". */
export function turkeyDate(now = new Date()): string {
  return new Date(now.getTime() + 3 * 3600000).toISOString().slice(0, 10);
}

/** Eczanenin gün içinde değişmeyen anahtarı (gizleme için). */
export const pharmacyKey = (p: Pick<DutyPharmacy, 'name' | 'district'>) =>
  `${p.district}|${p.name}`.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

/** Liste bugüne mi ait? Nöbet sabah değişir; 08.30'dan önce dünkü liste de geçerlidir. */
export function isPharmacyListCurrent(day: Pick<DutyPharmacyDay, 'date'>, now = new Date()): boolean {
  const today = turkeyDate(now);
  if (day.date === today) return true;
  const hour = (now.getUTCHours() + 3) % 24;
  return hour < 9 && day.date === turkeyDate(new Date(now.getTime() - 86400000));
}

const norm = (s: string) => s.toLocaleLowerCase('tr').trim();

/** Görünen liste: gizlenenler çıkar, kişinin ilçesi önce, sonra ilçe ve ad sırasıyla. */
export function pharmaciesFor(day: DutyPharmacyDay, myDistrict?: string): DutyPharmacy[] {
  const hidden = new Set(day.hidden ?? []);
  const mine = myDistrict ? norm(myDistrict) : '';
  return day.items
    .filter((p) => !hidden.has(pharmacyKey(p)))
    .sort((a, b) => Number(norm(b.district) === mine) - Number(norm(a.district) === mine) || a.district.localeCompare(b.district, 'tr') || a.name.localeCompare(b.name, 'tr'));
}

/** Servis bağdaştırıcısı: bir ilin nöbetçi eczaneleri. */
export interface PharmacyProvider {
  id: string;
  fetchProvince(province: { code: string; name: string }): Promise<DutyPharmacy[]>;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n !== 0 ? n : undefined;
};

/**
 * Servisten gelen bir kaydı ortak biçime çevirir. Alan adları servise göre değişir; bilinen adlar sırayla denenir
 * (NosyAPI'nin yanıt biçimi anahtar gelince doğrulanacak). Adı ya da adresi olmayan kayıt atılır.
 */
export function normalizePharmacy(raw: Record<string, unknown>): DutyPharmacy | null {
  const pick = (...keys: string[]) => keys.map((k) => str(raw[k])).find(Boolean) ?? '';
  const name = pick('pharmacyName', 'name', 'eczaneAdi', 'EczaneAdi');
  const address = pick('address', 'adres', 'Adres');
  if (!name || !address) return null;
  const phone = pick('phone', 'telefon', 'Telefon', 'phone1');
  const lat = num(raw.latitude ?? raw.lat ?? raw.enlem);
  const lng = num(raw.longitude ?? raw.lng ?? raw.boylam);
  return {
    name: name.slice(0, 120),
    district: pick('district', 'ilce', 'county', 'Ilce').slice(0, 60),
    address: address.slice(0, 300),
    ...(phone ? { phone: phone.slice(0, 30) } : {}),
    ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
  };
}

/** Sahte servis (emülatör ve testler): her ilçe için iki eczane. */
export function fakePharmacyProvider(districts: (provinceCode: string) => { name: string }[]): PharmacyProvider {
  return {
    id: 'sahte',
    async fetchProvince({ code }) {
      return districts(code).slice(0, 6).flatMap((d, i) => [
        { name: `${d.name} Şifa Eczanesi`, district: d.name, address: `${d.name} Cumhuriyet Cd. No:${i + 1}`, phone: '0224 000 00 0' + i },
        { name: `${d.name} Merkez Eczanesi`, district: d.name, address: `${d.name} Atatürk Cd. No:${i + 10}` },
      ]);
    },
  };
}
