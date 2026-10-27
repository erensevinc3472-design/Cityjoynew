import { describe, expect, it } from 'vitest';

import {
  ageGroup,
  createLocationRepository,
  filterByName,
  foldForSearch,
  isRtl,
  LANGUAGES,
  pickLanguage,
  translations,
  type KeyValueCache,
} from './index';

function keyPaths(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('diller', () => {
  it('her dil Türkçe ile aynı anahtarları taşır ve boş metin yoktur', () => {
    const base = keyPaths(translations.tr).sort();
    for (const { code } of LANGUAGES) {
      expect(keyPaths(translations[code]).sort(), code).toEqual(base);
      for (const path of base) {
        const value = path.split('.').reduce<any>((o, k) => o[k], translations[code]);
        expect(String(value).trim(), `${code}:${path}`).not.toBe('');
      }
    }
  });

  it('yalnızca Arapça sağdan soladır', () => {
    expect(LANGUAGES.filter((l) => isRtl(l.code)).map((l) => l.code)).toEqual(['ar']);
  });

  it('cihaz diline göre öneri yapar, desteklenmiyorsa Türkçe', () => {
    expect(pickLanguage(['fr-FR', 'de-AT'])).toBe('de');
    expect(pickLanguage(['ar_SA'])).toBe('ar');
    expect(pickLanguage(['ja-JP'])).toBe('tr');
    expect(pickLanguage([])).toBe('tr');
  });
});

describe('konum', () => {
  const memoryCache = (): KeyValueCache & { store: Map<string, string> } => {
    const store = new Map<string, string>();
    return { store, get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v) };
  };

  it('81 il ve 973 ilçe vardır', () => {
    const repo = createLocationRepository({ neighbourhoodsBaseUrl: '', dataVersion: 't', cache: memoryCache() });
    const provinces = repo.getProvinces();
    expect(provinces).toHaveLength(81);
    expect(provinces.reduce((n, p) => n + repo.getDistricts(p.code).length, 0)).toBe(973);
    expect(repo.getProvince('16')?.name).toBe('Bursa');
    expect(repo.getDistricts('16').map((d) => d.name)).toContain('Nilüfer');
  });

  it('mahalleleri bir kez indirir, sonra önbellekten okur', async () => {
    const cache = memoryCache();
    let calls = 0;
    const fetchJson = async (url: string) => {
      calls++;
      expect(url).toBe('https://havuz/16.json');
      return { '16-nilufer': [{ id: '16-nilufer-ataevler', name: 'Ataevler Mahallesi', kind: 'mahalle', postalCode: '16140' }] };
    };
    const opts = { neighbourhoodsBaseUrl: 'https://havuz', dataVersion: 'v1', cache, fetchJson };
    const first = await createLocationRepository(opts).getNeighbourhoods('16-nilufer');
    const second = await createLocationRepository(opts).getNeighbourhoods('16-nilufer');
    expect(first[0]?.name).toBe('Ataevler Mahallesi');
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });

  it('aramada Türkçe karakterleri yok sayar, başlayanları öne alır', () => {
    expect(foldForSearch('  İNEGÖL  ')).toBe('inegol');
    const items = [{ name: 'Yenişehir' }, { name: 'İnegöl' }, { name: 'Şehitkamil' }];
    expect(filterByName(items, 'sehi').map((i) => i.name)).toEqual(['Şehitkamil', 'Yenişehir']);
    expect(filterByName(items, 'inegol').map((i) => i.name)).toEqual(['İnegöl']);
  });
});

describe('yaş grubu', () => {
  const now = new Date('2026-10-27');
  it('13 altı çocuk, 13-17 genç, 18+ yetişkin', () => {
    expect(ageGroup(2015, now)).toBe('cocuk');
    expect(ageGroup(2012, now)).toBe('genc');
    expect(ageGroup(2008, now)).toBe('yetiskin');
  });
});
