import { describe, expect, it } from 'vitest';

import {
  activeEmergencyNumbers,
  createEmergencyNumberStore,
  DEFAULT_EMERGENCY_NUMBERS,
  EMERGENCY_ICONS,
  isValidPhoneNumber,
  localized,
  telUrl,
  type EmergencyNumber,
} from './numbers';

const memoryCache = () => {
  const m = new Map<string, string>();
  return { get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v) };
};

describe('acil numaralar', () => {
  it('başlangıç listesi doğru numaraları, beş dili ve geçerli simgeleri içerir', () => {
    const byNumber = Object.fromEntries(DEFAULT_EMERGENCY_NUMBERS.map((n) => [n.number, n.names.tr]));
    expect(byNumber['112']).toMatch(/Ambulans/);
    // Tasarımdaki karışıklık düzeltildi: 183 sosyal destek, 185 su, 186 elektrik, 187 doğalgaz.
    expect(byNumber['183']).toMatch(/Sosyal destek/);
    expect(byNumber['185']).toMatch(/Su/);
    expect(byNumber['186']).toMatch(/Elektrik/);
    expect(byNumber['187']).toMatch(/Doğalgaz/);
    for (const n of DEFAULT_EMERGENCY_NUMBERS) {
      expect(Object.keys(n.names).sort()).toEqual(['ar', 'de', 'en', 'ru', 'tr']);
      expect(EMERGENCY_ICONS).toContain(n.icon);
      expect(isValidPhoneNumber(n.number)).toBe(true);
    }
  });

  it('numara doğrulama ve arama bağlantısı', () => {
    expect(isValidPhoneNumber('112')).toBe(true);
    expect(isValidPhoneNumber('11')).toBe(false);
    expect(isValidPhoneNumber('11a')).toBe(false);
    expect(telUrl('0 (224) 444-12 34')).toBe('tel:02244441234');
  });

  it('çeviri yoksa Türkçe gösterilir', () => {
    expect(localized({ tr: 'Polis', en: 'Police' }, 'en')).toBe('Police');
    expect(localized({ tr: 'Polis' }, 'ar')).toBe('Polis');
    expect(localized(undefined, 'tr')).toBeUndefined();
  });

  it('pasifler çıkar, sıraya dizilir; veritabanı boşsa başlangıç listesi', () => {
    const n = (id: string, order: number, active = true): EmergencyNumber => ({ id, number: id, names: { tr: id }, icon: 'call', order, active });
    expect(activeEmergencyNumbers([n('187', 2), n('112', 1), n('155', 3, false)]).map((x) => x.id)).toEqual(['112', '187']);
    expect(activeEmergencyNumbers([])).toBe(DEFAULT_EMERGENCY_NUMBERS);
  });

  it('sunucuya ulaşılamazsa saklı liste kalır', async () => {
    const cache = memoryCache();
    const list = [{ id: '112', number: '112', names: { tr: 'Acil' }, icon: 'emergency', order: 1, active: true }] as EmergencyNumber[];
    let online = true;
    const store = createEmergencyNumberStore({ listAll: async () => (online ? list : Promise.reject(new Error('offline'))) }, cache);
    expect(await store.cached()).toBe(DEFAULT_EMERGENCY_NUMBERS);
    await store.refresh();
    online = false;
    await expect(store.refresh()).rejects.toThrow();
    expect((await store.cached()).map((x) => x.names.tr)).toEqual(['Acil']);
  });
});
