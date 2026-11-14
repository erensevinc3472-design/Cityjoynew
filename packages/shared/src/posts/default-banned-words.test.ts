import { describe, expect, it } from 'vitest';

import { DEFAULT_BANNED_WORDS } from './default-banned-words';
import { BANNED_WORD_LIMITS, cleanBannedWords, findBannedWord } from './word-filter';

const words = DEFAULT_BANNED_WORDS;

describe('hazır yasaklı kelime listesi', () => {
  it('panel kaydında hiçbir kelime atılmaz (uzunluk ve sayı sınırı içinde)', () => {
    expect(cleanBannedWords([...words]).length).toBe(new Set(words.map((w) => w.toLocaleLowerCase('tr'))).size);
    expect(words.length).toBeLessThanOrEqual(BANNED_WORD_LIMITS.count);
  });

  it.each([
    'siktir git',
    'amk ya',
    'orospu çocuğu',
    'S1KT1R',
    'yarrrak',
    'ananı sikeyim',
    'şerefsizin teki',
    'what the fuck',
    'du Arschloch',
    'ты сука',
    'يا شرموطة',
  ])('yakalar: %s', (text) => {
    expect(findBannedWord(text, words)).not.toBeNull();
  });

  // ı/i ve ş/s farkı yok sayıldığı için masum sözcükler yanlışlıkla engellenmemeli.
  it.each([
    'Sık sık buraya gelirim',
    'Trafik çok sıkıştı',
    'Film biraz sıkıcıydı',
    'Sıkıldım, dışarı çıkalım',
    'Limonu sıktım',
    'Maçta şike iddiası',
    'Ananın evi çok güzel',
    'Ebeniz nerede?',
    'I got a nice pic of the castle',
    'Askerî cunta dönemi müzesi',
    'Amina Hanım ile tanıştık',
    'Sikke koleksiyonu sergisi',
    'Gerçekten harika bir gün',
    'Pusetle girilebilir mi?',
    'Göttingen\'den geldim',
  ])('engellemez: %s', (text) => {
    expect(findBannedWord(text, words)).toBeNull();
  });
});
