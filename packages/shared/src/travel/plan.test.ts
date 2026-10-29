import { describe, expect, it } from 'vitest';

import { geoPoint } from '../business/business';
import { placeOfBusiness, type RoadsidePlace } from '../business/roadside';
import { estimateTrip, PROVINCE_CENTERS, pointsAlongRoute, roadKm, stopsAlongRoute, validateTravelPrices, type TravelPrices } from './plan';

const prices: TravelPrices = { fuel: { benzin: 50, elektrik: 10 }, busPerKm: { min: 1.2, max: 1.8 }, month: '2026-10' };

describe('Planla tahminleri', () => {
  it('81 ilin merkezi var', () => {
    expect(Object.keys(PROVINCE_CENTERS)).toHaveLength(81);
  });

  it('İstanbul - Bursa karayolu yaklaşık 120 km (kuş uçuşu 92 x 1,3)', () => {
    expect(roadKm('34', '16')).toBe(120);
    expect(roadKm('16', '16')).toBe(0);
  });

  it('araba: süre, mola ve yakıt aralığı; fiyat yoksa ücret yok', () => {
    const e = estimateTrip('34', '06', 'araba', prices);
    expect(e.km).toBeGreaterThan(400);
    expect(e.minutes).toBeGreaterThan((e.km / 90) * 60);
    expect(e.cost!.min).toBeLessThan(e.cost!.max);
    expect(estimateTrip('34', '06', 'araba', null).cost).toBeUndefined();
    expect(estimateTrip('34', '06', 'araba', prices, 'dizel').cost).toBeUndefined();
  });

  it('otobüs km aralığıyla; uçak yalnızca iki ilde havalimanı ve 150 km üstünde', () => {
    expect(estimateTrip('34', '16', 'otobus', prices).cost).toEqual({ min: 140, max: 220 });
    expect(estimateTrip('34', '35', 'ucak', prices).available).toBe(true);
    expect(estimateTrip('34', '16', 'ucak', prices).available).toBe(false);
    expect(estimateTrip('34', '15', 'ucak', prices).available).toBe(false);
  });

  it('fiyat denetimi', () => {
    expect(validateTravelPrices(prices)).toEqual([]);
    expect(validateTravelPrices({ fuel: { benzin: 0 }, busPerKm: { min: 2, max: 1 }, month: '2026-13' })).toEqual(['fuel', 'busPerKm', 'month']);
  });
});

describe('güzergâh çevresindeki mola yerleri', () => {
  const ist = PROVINCE_CENTERS['34'];
  const ank = PROVINCE_CENTERS['06'];
  const place = (id: string, lat: number, lng: number, kind: RoadsidePlace['kind'], roadside: RoadsidePlace['roadside']): RoadsidePlace => ({ id, name: id, source: 'osm', geo: { lat, lng }, kind, roadside });
  // Çizginin üstünde, yakınında ve uzağında yerler.
  const mid = { lat: (ist.lat + ank.lat) / 2, lng: (ist.lng + ank.lng) / 2 };
  const places = [
    place('ortada-tesis', mid.lat, mid.lng, 'yol-dinlenme-tesisi', ['tuvalet', 'mescit']),
    place('ortada-istasyon', mid.lat + 0.01, mid.lng, 'yol-akaryakit', ['akaryakit']),
    place('cok-uzak', mid.lat + 1, mid.lng, 'yol-dinlenme-tesisi', ['tuvalet']),
    place('baslangicta', ist.lat, ist.lng, 'yol-akaryakit', ['akaryakit']),
  ];

  it('çizgiye yakın olanı alır, dilimde dinlenme tesisini seçer, uzak ve başlangıçtakini atar', () => {
    const stops = stopsAlongRoute(places, ist, ank);
    expect(stops.map((s) => s.place.id)).toEqual(['ortada-tesis']);
    expect(stops[0].atKm).toBeGreaterThan(200);
  });

  it('işletme kaydı da durak olabilir; örnek noktalar uçları içerir', () => {
    const shop = placeOfBusiness({
      id: 'b', name: 'Tesis', type: 'yol-ustu', categoryIds: ['yol-dinlenme-tesisi'], location: { provinceCode: '14', districtId: '14-merkez' },
      phone: '1', whatsapp: false, is24h: true, priceList: [], roadside: ['tuvalet'], geo: geoPoint(mid.lat, mid.lng + 0.5),
      ownerUid: 'u', status: 'yayinda', verification: { status: 'dogrulanmadi' }, membership: { tier: 'ucretsiz' }, rating: { sum: 0, count: 0 },
      followerCount: 0, managers: [], createdAt: '', updatedAt: '',
    })!;
    expect(stopsAlongRoute([shop], ist, ank, { maxOffKm: 30 })).toHaveLength(1);
    const pts = pointsAlongRoute(ist, ank);
    expect(pts[0]).toEqual(ist);
    expect(pts[pts.length - 1]).toEqual(ank);
  });
});
