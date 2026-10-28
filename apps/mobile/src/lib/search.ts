import { useCallback, useEffect, useState } from 'react';
import {
  filterBySearch,
  pushRecentSearch,
  SEARCH_LIMITS,
  searchKeyCandidates,
  type Business,
  type CityGuideItem,
  type CityGuideSectionId,
  type LanguageCode,
  type Post,
  type PublicProfile,
  type SearchSuggestions,
} from '@cityjoy/shared';
import { createSearchSuggestions } from '@cityjoy/shared/firebase';

import { isFirebaseConfigured } from './firebase-config';
import { firestore } from './firebase';
import { businessRepository, cityGuide, postRepository, socialRepository } from './services';
import { deviceStorage } from './storage';

// ---- Son aramalar (telefonda, kişi silebilir) ----

const RECENT_KEY = 'search:recent:v1';
let recent: string[] | null = null;
const recentListeners = new Set<() => void>();

function setRecent(list: string[]) {
  recent = list;
  deviceStorage.set(RECENT_KEY, JSON.stringify(list));
  recentListeners.forEach((f) => f());
}

export function useRecentSearches() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    recentListeners.add(l);
    if (recent === null) {
      deviceStorage.get(RECENT_KEY).then((raw) => {
        try {
          const list: unknown = raw ? JSON.parse(raw) : [];
          recent = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, SEARCH_LIMITS.recent) : [];
        } catch {
          recent = [];
        }
        recentListeners.forEach((f) => f());
      });
    }
    return () => {
      recentListeners.delete(l);
    };
  }, []);
  return {
    list: recent ?? [],
    add: useCallback((q: string) => setRecent(pushRecentSearch(recent ?? [], q)), []),
    remove: useCallback((q: string) => setRecent((recent ?? []).filter((x) => x !== q)), []),
    clear: useCallback(() => setRecent([]), []),
  };
}

// ---- Önerilen aramalar (panelden, oturum başına bir kez okunur) ----

let suggestions: Promise<SearchSuggestions> | null = null;

/** Paneldeki dil listesi; boşsa null (ekran varsayılan öneriyi gösterir). */
export function useSearchSuggestions(language: LanguageCode): string[] | null {
  const [terms, setTerms] = useState<SearchSuggestions | null>(null);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    suggestions ??= createSearchSuggestions(firestore).get().catch(() => {
      suggestions = null;
      return {};
    });
    let alive = true;
    suggestions.then((s) => alive && setTerms(s));
    return () => {
      alive = false;
    };
  }, []);
  const list = terms?.[language];
  return list?.length ? list : null;
}

// ---- Veritabanında arama (kişiler, işletmeler, gönderiler) ----

/**
 * Sorgunun en uzun kelimesi anahtar olarak sorulur; sonuç yoksa yazım hatası olabileceği için kısaltılmışı denenir
 * ("berbr" > "berb"). Gelenler sorgudaki tüm kelimelere göre telefonda süzülür. Aynı arama 5 dakika tekrar okunmaz.
 */
const cache = new Map<string, { at: number; list: unknown[] }>();
const TTL = 5 * 60 * 1000;

async function lookup<T>(cacheKey: string, query: string, min: number, fetch: (key: string) => Promise<T[]>, text: (x: T) => string): Promise<T[]> {
  const hit = cache.get(`${cacheKey}|${query}`);
  if (hit && Date.now() - hit.at < TTL) return hit.list as T[];
  let out: T[] = [];
  for (const key of searchKeyCandidates(query, min)) {
    const raw = await fetch(key);
    out = filterBySearch(raw, query, text);
    if (out.length) break;
  }
  cache.set(`${cacheKey}|${query}`, { at: Date.now(), list: out });
  return out;
}

export const searchPeople = (query: string) =>
  lookup<PublicProfile>('kisi', query, SEARCH_LIMITS.minName, (k) => socialRepository.searchPeople(k), (p) => p.displayName);

export const searchBusinesses = (query: string, provinceCode: string) =>
  lookup<Business>(`isletme|${provinceCode}`, query, SEARCH_LIMITS.minName, (k) => businessRepository.searchByName(provinceCode, k), (b) => b.name);

export const searchPosts = (query: string, at: { provinceCode?: string; neighbourhoodId?: string }) =>
  lookup<Post>(`gonderi|${at.provinceCode}|${at.neighbourhoodId}`, query, SEARCH_LIMITS.minPost, (k) => postRepository.search(k, at), (p) => p.text);

/** Aramadan sonra yeni gönderi ya da profil değişikliği görünsün diye (paylaşınca, adı değişince). */
export function forgetSearches() {
  cache.clear();
}

// ---- Yerler: Benim Şehrim bölümleri (telefonda saklı, değişmediyse yeniden indirilmez) ----

/** "Nasıl yapılır?" bir yer değil, rehberdir; Yerler aramasına girmez. */
const NOT_PLACES: readonly CityGuideSectionId[] = ['nasil-yapilir'];

/** İlin yer kayıtları; yalnızca istenince (Yerler ya da Tümü sekmesinde arama varken) yüklenir. Döner: null = yükleniyor. */
export function useCityPlaces(provinceCode: string | undefined, enabled: boolean): CityGuideItem[] | null {
  const [items, setItems] = useState<{ province: string; list: CityGuideItem[] } | null>(null);
  const ready = items && items.province === provinceCode;
  useEffect(() => {
    if (!enabled || !provinceCode || ready) return;
    let alive = true;
    (async () => {
      const meta = await cityGuide.refreshMeta(provinceCode).catch(() => cityGuide.cachedMeta(provinceCode));
      const sections = Object.keys(meta?.sections ?? {}).filter((s) => !NOT_PLACES.includes(s as CityGuideSectionId)) as CityGuideSectionId[];
      const lists = await Promise.all(
        sections.map((s) => (meta ? cityGuide.items(provinceCode, s, meta) : Promise.reject()).catch(() => cityGuide.cachedItems(provinceCode, s))),
      );
      if (alive) setItems({ province: provinceCode, list: lists.flat() });
    })();
    return () => {
      alive = false;
    };
  }, [provinceCode, enabled, ready]);
  if (!provinceCode) return [];
  return ready ? items.list : null;
}
