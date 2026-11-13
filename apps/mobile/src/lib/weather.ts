import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { isWeatherFile, weatherPath, type WeatherFile, type WeatherKind } from '@cityjoy/shared';

/**
 * Hava durumu dosyası (Eren, 13 Kasım 2026): sunucu 3 saatte bir il dosyasını yazar, telefon yalnızca okur.
 * Dış kaynağa telefondan istek gitmez. Son dosya telefonda saklanır; internet yokken de son tahmin görünür.
 */
const bucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '';
const cacheKey = (code: string) => `cj.weather.${code}`;
const FRESH_MS = 30 * 60_000; // sunucudaki önbellek süresiyle aynı

export const weatherUrl = (code: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(weatherPath(code))}?alt=media`;

const memory = new Map<string, { file: WeatherFile; at: number }>();

async function readCache(code: string): Promise<WeatherFile | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(code));
    const v = raw ? JSON.parse(raw) : null;
    return isWeatherFile(v) ? v : null;
  } catch {
    return null;
  }
}

export async function loadWeather(code: string, force = false): Promise<WeatherFile> {
  const hit = memory.get(code);
  if (hit && !force && Date.now() - hit.at < FRESH_MS) return hit.file;
  const res = await fetch(weatherUrl(code));
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const v: unknown = await res.json();
  if (!isWeatherFile(v)) throw new Error('weather bad file');
  memory.set(code, { file: v, at: Date.now() });
  AsyncStorage.setItem(cacheKey(code), JSON.stringify(v)).catch(() => {});
  return v;
}

/** İlin hava dosyası: önce saklanan (anında), sonra güncel. `offline` = güncel alınamadı, eski gösteriliyor. */
export function useWeather(code: string | undefined) {
  const [file, setFile] = useState<WeatherFile | null>(code ? memory.get(code)?.file ?? null : null);
  const [state, setState] = useState<'loading' | 'ok' | 'offline' | 'error'>('loading');

  const load = useCallback(
    (force = false) => {
      if (!code) return;
      let alive = true;
      setState('loading');
      readCache(code).then((cached) => {
        if (alive && cached) setFile((f) => f ?? cached);
      });
      loadWeather(code, force)
        .then((f) => {
          if (!alive) return;
          setFile(f);
          setState('ok');
        })
        .catch(async () => {
          if (!alive) return;
          const cached = await readCache(code);
          if (cached) setFile(cached);
          setState(cached ? 'offline' : 'error');
        });
      return () => {
        alive = false;
      };
    },
    [code],
  );

  useEffect(() => load(), [load]);
  return { file, state, reload: () => load(true) };
}

/** Hava türüne göre MaterialIcons simgesi. */
export function weatherIcon(kind: WeatherKind, night: boolean): string {
  switch (kind) {
    case 'clear':
      return night ? 'nightlight' : 'wb-sunny';
    case 'partly':
      return night ? 'nights-stay' : 'wb-cloudy';
    case 'cloudy':
      return 'cloud';
    case 'fog':
      return 'foggy';
    case 'rain':
    case 'showers':
      return 'water-drop';
    case 'sleet':
    case 'snow':
      return 'ac-unit';
    case 'thunder':
      return 'thunderstorm';
  }
}
