import { describe, expect, it } from 'vitest';

import { badgeIdFromName, badgeName, cleanBadgeDefinitions, DEFAULT_BADGES, profileBadges, type BadgeDefinition } from './badges';

describe('rozetler', () => {
  it('Türkçe addan kimlik üretir', () => {
    expect(badgeIdFromName('Yerel rehber')).toBe('yerel-rehber');
    expect(badgeIdFromName('  Fotoğrafçı! ')).toBe('fotografci');
    expect(badgeIdFromName('Şehir Gönüllüsü')).toBe('sehir-gonullusu');
  });

  it('listeyi temizler: adsız, geçersiz simgeli ve tekrar eden rozet atılır', () => {
    const items = [
      { id: 'gurme', icon: 'restaurant', publisher: false, name: { tr: ' Gurme ', en: '' } },
      { id: 'gurme', icon: 'restaurant', publisher: false, name: { tr: 'Tekrar' } },
      { id: 'bos', icon: 'star', publisher: false, name: { tr: '  ' } },
      { id: 'X Y', icon: 'star', publisher: false, name: { tr: 'Kötü kimlik' } },
      { id: 'simge', icon: 'yok', publisher: false, name: { tr: 'Simge yok' } },
    ] as unknown as BadgeDefinition[];
    expect(cleanBadgeDefinitions(items)).toEqual([{ id: 'gurme', icon: 'restaurant', publisher: false, name: { tr: 'Gurme' } }]);
  });

  it('dilde ad yoksa Türkçe; silinen rozet profilde görünmez; en çok 3', () => {
    const gurme = DEFAULT_BADGES.find((b) => b.id === 'gurme')!;
    expect(badgeName(gurme, 'de')).toBe('Feinschmecker');
    expect(badgeName({ ...gurme, name: { tr: 'Gurme' } }, 'ar')).toBe('Gurme');
    expect(profileBadges(['silindi', 'gurme'], DEFAULT_BADGES).map((b) => b.id)).toEqual(['gurme']);
    expect(profileBadges(DEFAULT_BADGES.map((b) => b.id), DEFAULT_BADGES)).toHaveLength(3);
  });
});
