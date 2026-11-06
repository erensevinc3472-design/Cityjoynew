import { describe, expect, it } from 'vitest';

import { validateAnnouncement } from '../announcements/announcements';
import { placeholdersIn, STARTER_TEMPLATES, validateTemplate } from './templates';

describe('hazır şablonlar ve planlı yayın', () => {
  it('doldurulmamış boşlukları bulur', () => {
    expect(placeholdersIn('[mahalle] su kesintisi, [tarih] günü [tarih]')).toEqual(['[mahalle]', '[tarih]']);
    expect(placeholdersIn('Yarın 10.00-14.00 arası')).toEqual([]);
    for (const tpl of STARTER_TEMPLATES) {
      expect(validateTemplate(tpl), tpl.id).toEqual([]);
      expect(placeholdersIn(tpl.body).length, tpl.id).toBeGreaterThan(0);
    }
  });

  it('planlı yayın: ileri zaman, en çok 60 gün, acilde yok, bitişten önce', () => {
    const now = new Date('2026-11-05T09:00:00Z');
    const base = { kind: 'duyuru', title: 'Su kesintisi', body: 'Yarın su kesintisi olacak.', region: { provinceCode: '16' } } as const;
    const scope = { level: 'il', provinceCode: '16' } as const;
    const at = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();
    expect(validateAnnouncement({ ...base, scheduledAt: at(2) }, scope, now)).toEqual([]);
    expect(validateAnnouncement({ ...base, scheduledAt: at(-1) }, scope, now)).toEqual(['scheduledAt']);
    expect(validateAnnouncement({ ...base, scheduledAt: at(61) }, scope, now)).toEqual(['scheduledAt']);
    expect(validateAnnouncement({ ...base, scheduledAt: at(3), endsAt: at(2) }, scope, now)).toEqual(['scheduledAt']);
    expect(validateAnnouncement({ ...base, kind: 'acil', endsAt: at(1), scheduledAt: at(0.5) }, scope, now)).toEqual(['scheduledAt']);
  });
});
