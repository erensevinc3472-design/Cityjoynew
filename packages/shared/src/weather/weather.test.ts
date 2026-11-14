import { describe, expect, it } from 'vitest';

import { isWeatherFile, isWeatherStale, parseMetForecast, sunTimes, weatherKind } from './weather';

const at = (iso: string, temp: number, sym1?: string, p1 = 0, sym6?: string, p6 = 0) => ({
  time: iso,
  data: {
    instant: { details: { air_temperature: temp, wind_speed: 3.4, relative_humidity: 71.2 } },
    ...(sym1 ? { next_1_hours: { summary: { symbol_code: sym1 }, details: { precipitation_amount: p1 } } } : {}),
    ...(sym6 ? { next_6_hours: { summary: { symbol_code: sym6 }, details: { precipitation_amount: p6 } } } : {}),
  },
});

describe('hava durumu', () => {
  it('MET simge adlarını gruplar', () => {
    expect(weatherKind('clearsky_night')).toEqual({ kind: 'clear', night: true });
    expect(weatherKind('fair_day')).toEqual({ kind: 'partly', night: false });
    expect(weatherKind('lightrainshowers_day').kind).toBe('showers');
    expect(weatherKind('heavysleet').kind).toBe('sleet');
    expect(weatherKind('lightssnowshowersandthunder_day').kind).toBe('thunder');
    expect(weatherKind('fog').kind).toBe('fog');
    expect(weatherKind(undefined).kind).toBe('cloudy');
  });

  it('cevaptan şimdi, saatlik ve günlük tahmin çıkarır (Türkiye saatine göre gün)', () => {
    const json = {
      properties: {
        timeseries: [
          at('2026-11-13T09:00:00Z', 14.6, 'partlycloudy_day', 0),
          at('2026-11-13T10:00:00Z', 16.2, 'rain', 1.2),
          at('2026-11-13T11:00:00Z', 17.4, 'cloudy', 0.3),
          // 21:00 UTC = Türkiye'de ertesi gün 00:00
          at('2026-11-13T21:00:00Z', 9.1, 'clearsky_night', 0),
          at('2026-11-14T06:00:00Z', 7.0, undefined, 0, 'snow', 2.5),
          at('2026-11-14T12:00:00Z', 4.0, undefined, 0, 'cloudy', 0),
        ],
      },
    };
    const f = parseMetForecast(json, '16', new Date('2026-11-13T09:20:00Z'), { lat: 40.1885, lng: 29.061 })!;
    expect(f.now).toEqual({ temp: 15, kind: 'partly', night: false, wind: 3.4, humidity: 71, precip: 0 });
    expect(f.hours.map((h) => h.temp)).toEqual([15, 16, 17, 9]);
    expect(f.days).toEqual([
      { date: '2026-11-13', min: 15, max: 17, kind: 'rain', precip: 1.5 },
      { date: '2026-11-14', min: 4, max: 9, kind: 'snow', precip: 2.5 },
    ]);
    expect(f.source).toBe('MET Norway');
    expect(isWeatherFile(JSON.parse(JSON.stringify(f)))).toBe(true);
    expect(isWeatherStale(f, new Date('2026-11-13T20:00:00Z'))).toBe(true);
    expect(isWeatherStale(f, new Date('2026-11-13T12:00:00Z'))).toBe(false);
  });

  it('geçersiz cevapta null', () => {
    expect(parseMetForecast({}, '16', new Date())).toBeNull();
    expect(parseMetForecast({ properties: { timeseries: [] } }, '16', new Date())).toBeNull();
    expect(isWeatherFile({ version: 2 })).toBe(false);
  });

  it('Bursa için gün doğumu ve batımı birkaç dakika içinde', () => {
    const s = sunTimes(40.1885, 29.061, new Date('2026-11-13T09:00:00Z'))!;
    // Bursa 13 Kasım (Türkiye sürekli UTC+3): doğum ~07:47, batım ~17:50 = 04:47 / 14:50 UTC
    const min = (iso: string) => new Date(iso).getUTCHours() * 60 + new Date(iso).getUTCMinutes();
    expect(Math.abs(min(s.sunrise) - (4 * 60 + 47))).toBeLessThan(8);
    expect(Math.abs(min(s.sunset) - (14 * 60 + 50))).toBeLessThan(8);
  });
});
