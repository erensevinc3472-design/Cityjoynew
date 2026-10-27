import { describe, expect, it } from 'vitest';

import provinces from '../../data/locations/provinces.json';
import districts from '../../data/locations/districts.json';
import { CITY_GUIDE_SECTIONS, cityChoiceLabel, cityFieldLabel, mergeCityItems, parseCitySheet } from '../index';
import schema from '../../data/city-guide-schema.json';

const ctx = { provinces, districts, today: new Date('2026-10-27T12:00:00Z') };
const header = (id: string) => CITY_GUIDE_SECTIONS.find((s) => s.id === id)!.columns.map((c) => c.key);
const row = (id: string, v: Record<string, unknown>) => header(id).map((k) => v[k] ?? '');

describe('şehir rehberi şeması', () => {
  it('her bölümün, sütunun ve seçeneğin beş dilde adı var', () => {
    expect(CITY_GUIDE_SECTIONS).toHaveLength(10);
    for (const s of CITY_GUIDE_SECTIONS) {
      expect(Object.keys(s.names).sort()).toEqual(['ar', 'de', 'en', 'ru', 'tr']);
      for (const c of s.columns) {
        for (const lang of ['tr', 'en', 'de', 'ar', 'ru'] as const) expect(cityFieldLabel(c.key, lang)).not.toBe(c.key);
        for (const ch of c.choices ?? []) expect((schema.choices as Record<string, unknown>)[ch]).toBeTruthy();
      }
    }
    expect(cityChoiceLabel('hastane-devlet', 'en')).toBe('Public hospital');
  });
});

describe('Excel satırlarını okuma', () => {
  const museum = {
    tur: 'kent', ad: 'Bursa Kent Müzesi', il: 'BURSA', ilce: 'osmangazi', telefon: '+90 224 220 26 26',
    ucret_durumu: 'Ücretli', tam_ucret_tl: '20', muzekart_gecerli: 'evet', enlem: '40,1833', boylam: 29.0611,
    kaynak: 'https://www.bursa.bel.tr/kent-muzesi', kaynak_tarihi: '27.10.2026',
  };

  it('geçerli satırı öğeye çevirir: il/ilçe eşleşir, sayılar, telefon ve konum düzelir', () => {
    const { items, errors } = parseCitySheet('muzeler', [header('muzeler'), row('muzeler', museum)], ctx);
    expect(errors).toEqual([]);
    expect(items[0]).toMatchObject({
      id: 'muzeler--16-osmangazi--bursa-kent-muzesi',
      provinceCode: '16', districtId: '16-osmangazi', name: 'Bursa Kent Müzesi', category: 'kent',
      location: { lat: 40.1833, lng: 29.0611 }, source: 'https://www.bursa.bel.tr/kent-muzesi', sourceDate: '2026-10-27', verified: false,
    });
    expect(items[0]!.values).toMatchObject({ telefon: '02242202626', tam_ucret_tl: 20, muzekart_gecerli: true });
    expect(items[0]!.values.il).toBeUndefined();
  });

  it('örnek satırı atlar; hatalı satırı nedeniyle listeler', () => {
    const rows = [
      header('muzeler'),
      row('muzeler', { ...museum, not: 'ÖRNEK SATIR: silin' }),
      row('muzeler', { ...museum, tur: 'uzay', ilce: 'Kadıköy', kaynak: 'https://...', kaynak_tarihi: '01.01.2030', enlem: '50' }),
      row('muzeler', { ...museum, ad: '' }),
      row('muzeler', museum),
      row('muzeler', museum),
    ];
    const { items, errors, skipped } = parseCitySheet('muzeler', rows, ctx);
    expect(skipped).toBe(1);
    expect(items).toHaveLength(1);
    expect(errors.map((e) => e.row)).toEqual([3, 4, 6]);
    expect(errors[0]!.message).toMatch(/"tur": "uzay" listede yok/);
    expect(errors[0]!.message).toMatch(/bu ilde yok/);
    expect(errors[0]!.message).toMatch(/kaynak/);
    expect(errors[0]!.message).toMatch(/ileri bir tarih/);
    expect(errors[2]!.message).toMatch(/iki kez/);
  });

  it('sütun eksikse sekmenin tamamı reddedilir', () => {
    const { items, errors } = parseCitySheet('muzeler', [['ad', 'il'], ['X', 'Bursa']], ctx);
    expect(items).toEqual([]);
    expect(errors[0]).toMatchObject({ row: 0 });
  });

  it('il boş "Nasıl yapılır" ülke geneli olur; adımlar ayrılır', () => {
    const { items, errors } = parseCitySheet(
      'nasil-yapilir',
      [header('nasil-yapilir'), row('nasil-yapilir', { kategori: 'resmi-islem', baslik: 'Pasaport nasıl alınır?', kisa_metin: 'Randevu alın.', adimlar: 'Randevu | Harç | Başvuru', kaynak: 'https://www.nvi.gov.tr', kaynak_tarihi: '2026-10-20' })],
      ctx,
    );
    expect(errors).toEqual([]);
    expect(items[0]).toMatchObject({ provinceCode: 'tr', values: { adimlar: ['Randevu', 'Harç', 'Başvuru'] } });
  });

  it('yeniden yüklemede birleşir: aynı yer güncellenir, değişmeyenin doğrulaması korunur', () => {
    const first = parseCitySheet('muzeler', [header('muzeler'), row('muzeler', museum)], ctx).items;
    const verified = first.map((i) => ({ ...i, verified: true, verifiedAt: '2026-10-27' }));
    const same = mergeCityItems(verified, first);
    expect([same.added, same.updated, same.unchanged]).toEqual([0, 0, 1]);
    expect(same.items[0]!.verified).toBe(true);
    const changed = parseCitySheet('muzeler', [header('muzeler'), row('muzeler', { ...museum, tam_ucret_tl: 30 }), row('muzeler', { ...museum, ad: 'Tofaş Müzesi' })], ctx).items;
    const m = mergeCityItems(verified, changed);
    expect([m.added, m.updated, m.unchanged]).toEqual([1, 1, 0]);
    expect(m.items.find((i) => i.name === 'Bursa Kent Müzesi')!.verified).toBe(false);
  });
});

describe('öğeyi satıra çevirme', () => {
  it('düzenleme için satıra çevrilip yeniden okununca aynı öğe çıkar', async () => {
    const { cityItemToRow } = await import('../index');
    const rowValues = {
      tip: 'katli', ad: 'Kent Otoparkı', isletici: 'Belediye', il: 'Bursa', ilce: 'Nilüfer', kapasite: '400', ilk_saat_tl: '30',
      odeme_yontemleri: 'Nakit, Kredi Kartı', engelli_ucretsiz: 'Evet', enlem: '40.2', boylam: '28.95',
      kaynak: 'https://www.bursa.bel.tr/otopark', kaynak_tarihi: '27.10.2026',
    };
    const first = parseCitySheet('otoparklar', [header('otoparklar'), row('otoparklar', rowValues)], ctx).items[0]!;
    const back = cityItemToRow(first, ctx);
    const again = parseCitySheet('otoparklar', [header('otoparklar'), row('otoparklar', back)], ctx).items[0]!;
    expect(again).toEqual(first);
  });
});
