import { describe, expect, it } from 'vitest';

import { parseTravelFact, parseTravelWorkbook, travelPlaceId, TRAVEL_SHEETS } from './sheet';

const ctx = {
  provinces: [{ code: '16', name: 'Bursa' }],
  districts: [{ id: '16-osmangazi', provinceCode: '16', name: 'Osmangazi' }],
} as any;
const row = (cols: readonly string[], v: Record<string, string>) => cols.map((c) => v[c] ?? '');

describe('seyahat excel', () => {
  it('bilgi hücresini etiket, değer, kaynak ve yıla ayırır', () => {
    expect(parseTravelFact('En yüksek nokta: Uludağ, 2.543 m (Harita Genel Müdürlüğü, 2024)')).toEqual({
      label: 'En yüksek nokta',
      value: 'Uludağ, 2.543 m',
      source: 'Harita Genel Müdürlüğü',
      asOf: '2024',
    });
    expect(parseTravelFact('UNESCO: Dünya Mirası (2014)')).toEqual({ label: 'UNESCO', value: 'Dünya Mirası', asOf: '2014' });
    expect(parseTravelFact('etiketsiz')).toBeNull();
  });

  it('üç sekmeyi okur, hatalı satırı atlar', () => {
    const { bolge, sehir, yer } = TRAVEL_SHEETS;
    const r = parseTravelWorkbook(
      [
        { sheet: 'Okuyun', data: [['x']] },
        { sheet: bolge.sheet, data: [[...bolge.columns], row(bolge.columns, { bolge: 'marmara', slogan: 'Tarih ve deniz', tanitim: 'Marmara bölgesi tanıtım yazısı.' }), row(bolge.columns, { bolge: 'yok' })] },
        { sheet: sehir.sheet, data: [[...sehir.columns], row(sehir.columns, { il: 'Bursa', slogan: 'İlk başkent', tanitim: 'Bursa tanıtım yazısı burada.', kategoriler: 'tarih | doga', one_cikanlar: 'Ulu Cami | Uludağ', bilgiler: 'UNESCO: Bursa ve Cumalıkızık (UNESCO, 2014)' })] },
        {
          sheet: yer.sheet,
          data: [
            [...yer.columns],
            row(yer.columns, { il: 'Bursa', ilce: 'Osmangazi', ad: 'Ulu Cami', tur: 'Cami', kategori: 'tarih', ozet: 'Yirmi kubbeli erken Osmanlı camisi.', hakkinda: 'Yıldırım Bayezid döneminde yapıldı.', nasil_gidilir: 'yuruyus: Heykel\'den 5 dakika', mutlaka_gor: 'Evet', kaynak: 'Bursa İl Kültür ve Turizm Müdürlüğü' }),
            row(yer.columns, { il: 'Bursa', ad: 'Kaynaksız', tur: 'Park', kategori: 'doga', ozet: 'Kaynağı olmayan bir yer.', hakkinda: 'Kaynağı olmayan bir yer.' }),
            row(yer.columns, { il: 'Bursa', ad: 'Telefonlu', tur: 'Park', kategori: 'doga', ozet: 'Cep numarası yazılmış yer.', hakkinda: 'Cep numarası yazılmış yer.', telefon: '0532 111 22 33', kaynak: 'x' }),
          ],
        },
      ],
      ctx,
    );
    expect(r.regions.map((x) => x.id)).toEqual(['marmara']);
    expect(r.cities[0]).toMatchObject({ id: '16', regionId: 'marmara', categories: ['tarih', 'doga'], highlights: ['Ulu Cami', 'Uludağ'] });
    expect(r.places).toHaveLength(1);
    expect(r.places[0]!.id).toBe(travelPlaceId('16', 'Ulu Cami'));
    expect(r.places[0]!.data).toMatchObject({ districtId: '16-osmangazi', mustSee: true, howToGet: [{ mode: 'yuruyus', text: "Heykel'den 5 dakika" }] });
    expect(r.errors).toHaveLength(3);
  });

  it('pratik bilgi sütunlarını okur; olmayan eski dosyayı da kabul eder', () => {
    const { yer } = TRAVEL_SHEETS;
    const base = { il: 'Bursa', ad: 'Ulu Cami', tur: 'Cami', kategori: 'tarih', ozet: 'Yirmi kubbeli cami.', hakkinda: 'Yıldırım Bayezid döneminde yapıldı.', kaynak: 'x' };
    const yeni = parseTravelWorkbook([{ sheet: yer.sheet, data: [[...yer.columns], row(yer.columns, { ...base, yas_bilgisi: 'Yaş sınırı yok.', yanina_al: 'Başörtüsü | Çorap', kurallar: 'Ayakkabı çıkarılır' })] }], ctx);
    expect(yeni.places[0]!.data).toMatchObject({ ageInfo: 'Yaş sınırı yok.', bring: ['Başörtüsü', 'Çorap'], rules: ['Ayakkabı çıkarılır'] });
    const eskiCols = yer.columns.filter((c) => !['yas_bilgisi', 'yanina_al', 'kurallar'].includes(c));
    const eski = parseTravelWorkbook([{ sheet: yer.sheet, data: [[...eskiCols], row(eskiCols, base)] }], ctx);
    expect(eski.errors).toEqual([]);
    expect(eski.places[0]!.data).not.toHaveProperty('bring');
  });
});
