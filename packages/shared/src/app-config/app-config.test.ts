import { describe, expect, it } from 'vitest';

import {
  activeBanner,
  changedParts,
  closedSectionOf,
  compareVersions,
  DEFAULT_APP_CONFIG,
  needsReaccept,
  normalizeAppConfig,
  riskyChanges,
  updateNeed,
  type AppConfig,
} from './app-config';

const text = { tr: 'Bakım', en: '', de: '', ar: '', ru: '' };
const cfg = (patch: Partial<AppConfig>): AppConfig => ({ ...DEFAULT_APP_CONFIG, ...patch });

describe('uygulama ayarları', () => {
  it('sürüm karşılaştırma ve güncelleme ihtiyacı', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    const c = cfg({ minVersion: { ios: '1.0.3', android: '1.0.0' }, suggestVersion: { ios: '1.1.0', android: '1.0.0' } });
    expect(updateNeed(c, 'ios', '1.0.2')).toBe('zorunlu');
    expect(updateNeed(c, 'ios', '1.0.5')).toBe('oneri');
    expect(updateNeed(c, 'ios', '1.1.0')).toBeNull();
    expect(updateNeed(c, 'android', '1.0.0')).toBeNull();
  });

  it('bant: süre, il ve "sadece bana" denetlenir', () => {
    const now = new Date('2026-11-16T01:30:00Z');
    const c = cfg({ banner: { kind: 'duyuru', text, startAt: '2026-11-16T01:00:00Z', endAt: '2026-11-16T02:00:00Z', provinces: ['16'], onlyUid: null } });
    expect(activeBanner(c, { now, provinceCode: '16' })).not.toBeNull();
    expect(activeBanner(c, { now, provinceCode: '34' })).toBeNull();
    expect(activeBanner(c, { now: new Date('2026-11-16T02:00:00Z'), provinceCode: '16' })).toBeNull();
    const mine = cfg({ banner: { ...c.banner!, provinces: [], onlyUid: 'adminUid1' } });
    expect(activeBanner(mine, { now, uid: 'adminUid1' })).not.toBeNull();
    expect(activeBanner(mine, { now, uid: 'baskasi99' })).toBeNull();
  });

  it('temizleme: geçersiz alanlar varsayılana döner, Türkçesiz bant yok sayılır', () => {
    const c = normalizeAppConfig({
      minVersion: { ios: 'abc', android: '2.0' },
      closed: ['travel', 'urgent', 'x'],
      contact: { supportEmail: 'yanlis', web: 'http://a.com', instagram: 'https://instagram.com/cityjoy' },
      banner: { kind: 'bakim', text: { tr: '' } },
    });
    expect(c.minVersion).toEqual({ ios: '0.0.0', android: '2.0' });
    expect(c.closed).toEqual(['travel']);
    expect(c.contact.supportEmail).toBe('');
    expect(c.contact.web).toBe('');
    expect(c.contact.instagram).toBe('https://instagram.com/cityjoy');
    expect(c.banner).toBeNull();
  });

  it('kapalı bölüm yolu, yeniden onay, riskli değişiklik ve değişen bölümler', () => {
    const c = cfg({ closed: ['carsi'] });
    expect(closedSectionOf(c, '/carsi/123')).toBe('carsi');
    expect(closedSectionOf(c, '/carsiya')).toBeNull();
    const l = cfg({ legal: { version: 'v2', reaccept: true } });
    expect(needsReaccept(l, 'v1')).toBe(true);
    expect(needsReaccept(l, 'v2')).toBe(false);
    const after = cfg({ closed: ['carsi'], minVersion: { ios: '1.0.1', android: '0.0.0' }, banner: { kind: 'bakim', text, startAt: null, endAt: null, provinces: [], onlyUid: null } });
    expect(riskyChanges(DEFAULT_APP_CONFIG, after)).toEqual(['bakim', 'zorunlu', 'bolum']);
    expect(changedParts(DEFAULT_APP_CONFIG, after)).toEqual(['banner', 'update', 'closed']);
  });
});
