import type { District, Province } from '../locations/types';
import type { RegionScope } from '../permissions/types';

/** 30 büyükşehir (6360 sayılı Kanun ve sonrası). Diğer 51 ilde il belediyesi merkez ilçeye hizmet verir. */
export const METROPOLITAN_PROVINCES = [
  '01', '06', '07', '09', '10', '16', '20', '21', '25', '26', '27', '31', '34', '35', '46',
  '38', '41', '42', '44', '45', '47', '33', '48', '52', '54', '55', '63', '59', '61', '65',
] as const;

export type MunicipalityKind = 'buyuksehir-belediyesi' | 'il-belediyesi' | 'ilce-belediyesi';

/** Kilitli belediye adı: yalnızca admin'in açtığı resmî kurum hesabına verilir (PROJE.md 6.7). */
export interface Municipality {
  /** "bld-16" (büyükşehir / il), "bld-16-nilufer" (ilçe). Kurum belgesinin kimliği de budur. */
  id: string;
  name: string;
  kind: MunicipalityKind;
  scope: RegionScope;
}

/**
 * Tüm belediyeler, konum listesinden üretilir: büyükşehir, il ve ilçe belediyeleri. Belde belediyeleri konum
 * listesinde olmadığı için yoktur; gerekirse admin "kurum" olarak açar.
 */
export function listMunicipalities(provinces: readonly Province[], districts: readonly District[]): Municipality[] {
  const metro = new Set<string>(METROPOLITAN_PROVINCES);
  const out: Municipality[] = [];
  for (const p of provinces) {
    const own = districts.filter((d) => d.provinceCode === p.code);
    if (metro.has(p.code)) {
      out.push({ id: `bld-${p.code}`, name: `${p.name} Büyükşehir Belediyesi`, kind: 'buyuksehir-belediyesi', scope: { level: 'il', provinceCode: p.code } });
    } else {
      const merkez = own.find((d) => d.id === `${p.code}-merkez`);
      out.push({
        id: `bld-${p.code}`,
        name: `${p.name} Belediyesi`,
        kind: 'il-belediyesi',
        scope: merkez ? { level: 'ilce', provinceCode: p.code, districtId: merkez.id } : { level: 'il', provinceCode: p.code },
      });
    }
    for (const d of own) {
      if (d.id === `${p.code}-merkez`) continue;
      out.push({ id: `bld-${d.id}`, name: `${d.name} Belediyesi`, kind: 'ilce-belediyesi', scope: { level: 'ilce', provinceCode: p.code, districtId: d.id } });
    }
  }
  return out;
}

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Karşılaştırma için sade biçim: küçük harf, Türkçe harfler Latin, yalnızca harf/rakam ve tek boşluk. */
export function normalizeName(name: string): string {
  return name
    .toLocaleLowerCase('tr')
    .replace(/i̇|[çğıöşüâîû]/g, (ch) => TR[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Resmî kurum sanılabilecek sözcükler. Kullanıcılar bunları ad olarak (işletme adı, profil adı, kullanıcı adı)
 * kullanamaz; kurum adları yalnızca admin'in açtığı hesaba verilir. Veritabanı kuralları da aynı sözcükleri denetler.
 */
export const RESERVED_WORDS = ['belediye', 'valilik', 'valiligi', 'kaymakamlik', 'kaymakamligi', 'muhtarlik', 'muhtarligi', 'cityjoy', 'traveljoy'];

export function isReservedName(name: string): boolean {
  const n = normalizeName(name);
  const compact = n.replace(/ /g, '');
  return RESERVED_WORDS.some((w) => compact.includes(w));
}
