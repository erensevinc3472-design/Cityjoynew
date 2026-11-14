import { describe, expect, it } from 'vitest';

import { refreshWeather } from '../src/weather';

const met = (temp: number) => ({
  properties: {
    timeseries: [
      { time: '2026-11-13T09:00:00Z', data: { instant: { details: { air_temperature: temp } }, next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } } } },
    ],
  },
});

describe('hava durumu çekimi', () => {
  it('81 ilin dosyasını yazar; hatalı il ötekileri durdurmaz ve listelenir', async () => {
    const written = new Map<string, number>();
    const run = await refreshWeather({
      now: new Date('2026-11-13T09:10:00Z'),
      fetchJson: async (url) => {
        if (url.includes('lat=39.9334')) throw new Error('met 503'); // Ankara
        if (url.includes('lat=40.1885')) return {}; // Bursa: boş cevap
        return met(12);
      },
      write: async (path, file) => {
        written.set(path, file.now.temp);
      },
    });
    expect(run.ok).toBe(79);
    expect(run.failed).toEqual(['06', '16']);
    expect(written.get('public/weather/34.json')).toBe(12);
    expect(written.has('public/weather/06.json')).toBe(false);
  });
});
