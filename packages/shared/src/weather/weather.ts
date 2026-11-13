/**
 * Hava durumu (PROJE.md 5.1, 9.1; Eren, 13 Kasım 2026: "bir kere çekip sunucuya koyalım, oradan çekelim" ve baştan
 * dosya olarak). Kaynak MET Norway Locationforecast (ücretsiz, ticari kullanım serbest; "Veri: MET Norway" yazılır).
 * Sunucu 3 saatte bir 81 il merkezinin tahminini bir kez çeker, her il için küçük bir dosya yazar
 * (`public/weather/{il}.json`); telefon yalnızca bu dosyayı okur ve saklar (çevrimdışında son bilgi görünür).
 * Kullanıcı sayısı arttıkça dış servise giden istek artmaz.
 */

export const WEATHER_SOURCE = 'MET Norway';
export const WEATHER_REFRESH_HOURS = 3;
/** Bu kadar saatten eski dosya "güncel değil" sayılır (çekim iki kez üst üste aksadıysa). */
export const WEATHER_STALE_HOURS = 8;

export const weatherPath = (provinceCode: string) => `public/weather/${provinceCode}.json`;

/** Uygulamadaki simge grubu (MET'in simge adlarından). */
export const WEATHER_KINDS = ['clear', 'partly', 'cloudy', 'fog', 'rain', 'showers', 'sleet', 'snow', 'thunder'] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

export interface WeatherNow {
  temp: number;
  kind: WeatherKind;
  night: boolean;
  /** m/s */
  wind: number;
  /** % */
  humidity: number;
  /** Önümüzdeki 1 saatte yağış, mm. */
  precip: number;
}

export interface WeatherHour {
  /** ISO zaman (UTC). */
  t: string;
  temp: number;
  kind: WeatherKind;
  night: boolean;
  precip: number;
}

export interface WeatherDay {
  /** Türkiye saatine göre gün, "2026-11-13". */
  date: string;
  min: number;
  max: number;
  kind: WeatherKind;
  precip: number;
}

export interface WeatherFile {
  version: 1;
  provinceCode: string;
  /** Sunucunun çektiği zaman (ISO). */
  updatedAt: string;
  source: typeof WEATHER_SOURCE;
  now: WeatherNow;
  /** Önümüzdeki 24 saat, saatlik. */
  hours: WeatherHour[];
  /** Bugünden başlayarak en çok 5 gün. */
  days: WeatherDay[];
  /** Bugünün gün doğumu / batımı (ISO, UTC), hesaplanır. */
  sunrise?: string;
  sunset?: string;
}

/** MET simge adı ("rainshowers_day", "lightssnowandthunder") -> simge grubu ve gece mi. */
export function weatherKind(symbol: string | undefined): { kind: WeatherKind; night: boolean } {
  const s = symbol ?? '';
  const night = s.endsWith('_night') || s.endsWith('_polartwilight');
  const base = s.replace(/_(day|night|polartwilight)$/, '');
  let kind: WeatherKind = 'cloudy';
  if (base.includes('thunder')) kind = 'thunder';
  else if (base.includes('sleet')) kind = 'sleet';
  else if (base.includes('snow')) kind = 'snow';
  else if (base.includes('showers')) kind = 'showers';
  else if (base.includes('rain')) kind = 'rain';
  else if (base === 'fog') kind = 'fog';
  else if (base === 'clearsky' || base === 'fair') kind = base === 'fair' ? 'partly' : 'clear';
  else if (base === 'partlycloudy') kind = 'partly';
  return { kind, night };
}

/** Kötü hava önce gelir: günün simgesi seçilirken en "ağır" olan alınır. */
const SEVERITY: Record<WeatherKind, number> = { clear: 0, partly: 1, cloudy: 2, fog: 3, showers: 4, rain: 5, sleet: 6, snow: 7, thunder: 8 };

/** Türkiye UTC+3 (yaz saati yok). */
const TR_OFFSET_MS = 3 * 3600_000;
const trDate = (iso: string) => new Date(Date.parse(iso) + TR_OFFSET_MS).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;

interface MetEntry {
  time: string;
  data?: {
    instant?: { details?: Record<string, number | undefined> };
    next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
    next_6_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
  };
}

/** MET "compact" cevabından il dosyası. Geçersiz cevapta null. */
export function parseMetForecast(json: unknown, provinceCode: string, now: Date, center?: { lat: number; lng: number }): WeatherFile | null {
  const series = (json as { properties?: { timeseries?: MetEntry[] } } | null)?.properties?.timeseries;
  if (!Array.isArray(series) || !series.length) return null;
  const nowMs = now.getTime();
  // Şu anki saat dilimi: başlangıcı geçmiş en son kayıt (yoksa ilk kayıt).
  const future = series.filter((e) => Date.parse(e.time) >= nowMs - 3600_000);
  if (!future.length) return null;
  const first = future[0]!;
  const d = first.data?.instant?.details ?? {};
  const temp = d.air_temperature;
  if (typeof temp !== 'number') return null;
  const sym = weatherKind(first.data?.next_1_hours?.summary?.symbol_code ?? first.data?.next_6_hours?.summary?.symbol_code);

  const hours: WeatherHour[] = [];
  for (const e of future) {
    if (hours.length >= 24) break;
    const t = e.data?.instant?.details?.air_temperature;
    const one = e.data?.next_1_hours;
    if (typeof t !== 'number' || !one) continue;
    const k = weatherKind(one.summary?.symbol_code);
    hours.push({ t: e.time, temp: Math.round(t), kind: k.kind, night: k.night, precip: round1(one.details?.precipitation_amount ?? 0) });
  }

  const byDay = new Map<string, { temps: number[]; kind: WeatherKind; precip: number }>();
  // Yağış iki kez sayılmasın: saatlik ya da 6 saatlik dilimin kapsadığı zamana kadar yeni dilim eklenmez.
  let coveredUntil = 0;
  for (const e of future) {
    const date = trDate(e.time);
    const t = e.data?.instant?.details?.air_temperature;
    const day = byDay.get(date) ?? { temps: [], kind: 'clear' as WeatherKind, precip: 0 };
    if (typeof t === 'number') day.temps.push(t);
    const one = e.data?.next_1_hours;
    const six = e.data?.next_6_hours;
    const symbol = one?.summary?.symbol_code ?? six?.summary?.symbol_code;
    if (symbol) {
      const k = weatherKind(symbol).kind;
      if (SEVERITY[k] > SEVERITY[day.kind]) day.kind = k;
    }
    // Yağış: saatlik veri varken saatlik toplanır, saatlik bitince 6 saatlik dilimler eklenir.
    const ms = Date.parse(e.time);
    if (one && ms >= coveredUntil) {
      day.precip += one.details?.precipitation_amount ?? 0;
      coveredUntil = ms + 3600_000;
    } else if (six && ms >= coveredUntil) {
      day.precip += six.details?.precipitation_amount ?? 0;
      coveredUntil = ms + 6 * 3600_000;
    }
    byDay.set(date, day);
  }
  const days: WeatherDay[] = [...byDay.entries()]
    .filter(([, v]) => v.temps.length)
    .slice(0, 5)
    .map(([date, v]) => ({ date, min: Math.round(Math.min(...v.temps)), max: Math.round(Math.max(...v.temps)), kind: v.kind, precip: round1(v.precip) }));

  const sun = center ? sunTimes(center.lat, center.lng, new Date(nowMs + TR_OFFSET_MS)) : null;
  return {
    version: 1,
    provinceCode,
    updatedAt: now.toISOString(),
    source: WEATHER_SOURCE,
    now: {
      temp: Math.round(temp),
      kind: sym.kind,
      night: sym.night,
      wind: round1(d.wind_speed ?? 0),
      humidity: Math.round(d.relative_humidity ?? 0),
      precip: round1(first.data?.next_1_hours?.details?.precipitation_amount ?? 0),
    },
    hours,
    days,
    ...(sun ? { sunrise: sun.sunrise, sunset: sun.sunset } : {}),
  };
}

/** Dosya güncel değil mi (çekim aksadı). */
export const isWeatherStale = (file: Pick<WeatherFile, 'updatedAt'>, now: Date) => now.getTime() - Date.parse(file.updatedAt) > WEATHER_STALE_HOURS * 3600_000;

/** Telefondan okunan dosyanın biçimi doğru mu (bozuk / eski sürüm dosya gösterilmez). */
export function isWeatherFile(v: unknown): v is WeatherFile {
  const f = v as WeatherFile | null;
  return !!f && f.version === 1 && typeof f.updatedAt === 'string' && typeof f.now?.temp === 'number' && Array.isArray(f.hours) && Array.isArray(f.days);
}

/**
 * Gün doğumu ve batımı (NOAA yaklaşık hesabı, birkaç dakika hassasiyet). Dış servis gerekmez.
 * Kutup bölgelerinde (Türkiye'de olmaz) null.
 */
export function sunTimes(lat: number, lng: number, date: Date): { sunrise: string; sunset: string } | null {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400_000);
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosH < -1 || cosH > 1) return null;
  const ha = Math.acos(cosH) / rad;
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const minutes = (m: number) => new Date(midnight + Math.round(m * 60_000)).toISOString();
  return { sunrise: minutes(720 - 4 * (lng + ha) - eqTime), sunset: minutes(720 - 4 * (lng - ha) - eqTime) };
}
