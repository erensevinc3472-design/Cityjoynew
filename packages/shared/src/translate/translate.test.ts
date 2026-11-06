import { describe, expect, it } from 'vitest';

import { canOfferTranslation, guessLanguage, TRANSLATE_MAX_CHARS, translationInput } from './translate';

describe('çeviri düğmesi', () => {
  it('dili kabaca tahmin eder', () => {
    expect(guessLanguage('Bugün parkta konser var, herkes gelsin!')).toBe('tr');
    expect(guessLanguage('Yarın sabah pazar kurulacak')).toBe('tr');
    expect(guessLanguage('The concert is in the park today')).toBe('en');
    expect(guessLanguage('Heute ist das Konzert im Park und es ist schön')).toBe('de');
    expect(guessLanguage('الحفل في الحديقة اليوم')).toBe('ar');
    expect(guessLanguage('Сегодня концерт в парке')).toBe('ru');
    expect(guessLanguage('Konser 20:00')).toBeNull();
    expect(guessLanguage('👍👍')).toBeNull();
  });

  it('okuyanın dilindeki metinde düğme çıkmaz, emin değilse çıkar', () => {
    expect(canOfferTranslation('Bugün parkta konser var', 'tr')).toBe(false);
    expect(canOfferTranslation('Bugün parkta konser var', 'de')).toBe(true);
    expect(canOfferTranslation('Сегодня концерт в парке', 'ru')).toBe(false);
    expect(canOfferTranslation('Konser 20:00', 'tr')).toBe(true);
    expect(canOfferTranslation('Selam', 'tr')).toBe(false);
    expect(canOfferTranslation('Tamam, teşekkürler', 'tr')).toBe(false);
    expect(canOfferTranslation('Thanks', 'en')).toBe(false);
    expect(canOfferTranslation('Selam', 'en')).toBe(true);
    expect(canOfferTranslation('  ', 'tr')).toBe(false);
    expect(canOfferTranslation('123 😀', 'en')).toBe(false);
    expect(canOfferTranslation(undefined, 'en')).toBe(false);
  });

  it('sunucuya giden metin kırpılır ve sınırda kesilir', () => {
    expect(translationInput('  merhaba  ')).toBe('merhaba');
    expect(translationInput('a'.repeat(TRANSLATE_MAX_CHARS + 50))).toHaveLength(TRANSLATE_MAX_CHARS);
  });
});
