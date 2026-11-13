/**
 * Hava durumu çekimi (PROJE.md 9.1 maliyet ilkesi; Eren, 13 Kasım 2026). 3 saatte bir 81 il merkezinin tahmini
 * MET Norway'den bir kez çekilir, her il için küçük bir dosya (`public/weather/{il}.json`) yazılır. Telefon yalnızca
 * dosyayı okur. Son çalışmanın özeti `dataSources/weather` kaydına yazılır (Panel > Veri kaynakları).
 * MET şartları: kim olduğumuzu belirten User-Agent, saniyede 20 istekten az, 4 haneden fazla koordinat yok.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { parseMetForecast, PROVINCE_CENTERS, weatherPath, WEATHER_SOURCE, type WeatherFile } from '@cityjoy/shared';

export const MET_USER_AGENT = 'CityJoy/1.0 (+https://cityjoynew.web.app)';
const metUrl = (lat: number, lng: number) => `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;

export interface WeatherDeps {
  fetchJson: (url: string) => Promise<unknown>;
  write: (path: string, file: WeatherFile) => Promise<void>;
  now: Date;
}

export interface WeatherRun {
  ok: number;
  failed: string[];
}

/** 81 ili aynı anda en çok 4 istekle çeker; bir ilin hatası ötekileri durdurmaz. */
export async function refreshWeather(deps: WeatherDeps): Promise<WeatherRun> {
  const codes = Object.keys(PROVINCE_CENTERS).sort();
  const failed: string[] = [];
  let ok = 0;
  let next = 0;
  const worker = async () => {
    while (next < codes.length) {
      const code = codes[next++]!;
      const center = PROVINCE_CENTERS[code]!;
      try {
        const file = parseMetForecast(await deps.fetchJson(metUrl(center.lat, center.lng)), code, deps.now, center);
        if (!file) throw new Error('bos');
        await deps.write(weatherPath(code), file);
        ok++;
      } catch {
        failed.push(code);
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { ok, failed: failed.sort() };
}

/** Çalışma özeti (yalnızca admin okur): panelde "son güncelleme" ve hatalı iller. */
export async function saveWeatherStatus(db: Firestore, run: WeatherRun, now: Date): Promise<void> {
  await db.doc('dataSources/weather').set(
    {
      source: WEATHER_SOURCE,
      lastRunAt: now,
      ok: run.ok,
      failed: run.failed,
      ...(run.ok > 0 ? { lastSuccessAt: now } : {}),
      runs: FieldValue.increment(1),
    },
    { merge: true },
  );
}

/** Gerçek çekici: MET'e kimliğimizle istek. */
export async function metFetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': MET_USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`met ${res.status}`);
  return res.json();
}
