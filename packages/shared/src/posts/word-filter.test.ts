import { describe, expect, it } from 'vitest';

import { cleanBannedWords, findBannedWord, normalizeForFilter } from '../index';

describe('yasaklı kelime süzgeci', () => {
  const words = ['salak', 'aptal', 'ab', 'kara para'];

  it('Türkçe küçük harf, aksan, rakamla yazım ve harf tekrarı düzeltilir', () => {
    expect(normalizeForFilter('SALAAAK')).toBe('salak');
    expect(normalizeForFilter('S4l4k')).toBe('salak');
    expect(normalizeForFilter('IĞDIR')).toBe('igdir');
  });

  it('sözcük eşleşmesi, ekli hâl (4+ harf) ve çok sözcüklü ifade yakalanır', () => {
    expect(findBannedWord('Sen tam bir s4laaak', words)).toBe('salak');
    expect(findBannedWord('Aptallar burada', words)).toBe('aptal');
    expect(findBannedWord('Kara  para aklama', words)).toBe('kara para');
    expect(findBannedWord('AB ülkeleri', words)).toBe('ab');
  });

  it('sıradan sözler takılmaz', () => {
    expect(findBannedWord('Abla çok güzel olmuş', words)).toBeNull();
    expect(findBannedWord('Karaköy pazarı', words)).toBeNull();
    expect(findBannedWord('Merhaba komşular', [])).toBeNull();
  });

  it('panel listesi temizlenir', () => {
    expect(cleanBannedWords([' Salak ', 'salak', 'x', '', 'aptal'])).toEqual(['salak', 'aptal']);
  });
});
