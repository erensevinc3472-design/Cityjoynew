import { describe, expect, it } from 'vitest';

import { prePublishChecks } from './checklist';
import { DEFAULT_IMPORTANT_DAYS } from './important-days';

const base = { kind: 'duyuru', title: 'Su kesintisi', body: 'Yarın 10.00-14.00 arası su kesintisi olacak.', region: { provinceCode: '16' } } as const;
const levels = (c: ReturnType<typeof prePublishChecks>) => Object.fromEntries(c.map((x) => [x.key, x.level]));

describe('yayın öncesi kontrol listesi', () => {
  it('iyi bir duyuruda yalnızca bitiş hatırlatması kalır', () => {
    const c = levels(prePublishChecks(base, { regionLabel: 'Osmangazi', now: new Date(2026, 10, 5) }));
    expect(c).toEqual({ bosluk: 'tamam', baslikUzun: 'tamam', tarihYok: 'tamam', bitisYok: 'uyari', bolge: 'tamam' });
    expect(levels(prePublishChecks({ ...base, endsAt: '2026-11-07T00:00:00Z' }, { regionLabel: 'x' })).bitisYok).toBeUndefined();
    // Türkçe harfle başlayan ay ve gün adları da tarih sayılır.
    expect(levels(prePublishChecks({ ...base, body: 'Şubat ayı boyunca çarşamba günleri açık olacak.' }, { regionLabel: 'x' })).tarihYok).toBe('tamam');
  });

  it('boşluk hata; uzun, büyük harfli, ünlemli başlık ve tarihsiz duyuru uyarı', () => {
    const c = levels(prePublishChecks(
      { ...base, title: 'ÖNEMLİ DUYURU!!! TÜM MAHALLELERDE ÇOK UZUN BİR BAŞLIK YAZILDI VE KESİLECEK', body: '[mahalle] mahallesinde çalışma var.' },
      { regionLabel: 'x' },
    ));
    expect(c).toMatchObject({ bosluk: 'hata', baslikUzun: 'uyari', buyukHarf: 'uyari', unlem: 'uyari', tarihYok: 'uyari' });
  });

  it('planlanan gün anma gününe denk gelirse hatırlatır', () => {
    const c = prePublishChecks({ ...base, scheduledAt: new Date(2026, 10, 10, 10).toISOString() }, { regionLabel: 'x', days: DEFAULT_IMPORTANT_DAYS });
    expect(c.find((x) => x.key === 'onemliGun')).toMatchObject({ level: 'uyari', vars: { day: "Atatürk'ü Anma Günü" } });
    // Uluslararası gün ton hatırlatması gerektirmez.
    expect(prePublishChecks({ ...base, scheduledAt: new Date(2026, 10, 20, 10).toISOString() }, { regionLabel: 'x', days: DEFAULT_IMPORTANT_DAYS }).some((x) => x.key === 'onemliGun')).toBe(false);
  });
});
