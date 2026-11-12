import { useEffect, useState } from 'react';
import { FEED_SORTS, type FeedSort } from '@cityjoy/shared';

import { deviceStorage } from './storage';

/** Keşfet sıralama seçimi ("Senin için" / "En yeni"): telefonda saklanır, bütün sekmelerde aynıdır. */
const KEY = 'feed-sort:v1';
let current: FeedSort = 'senin-icin';
let loaded = false;
const listeners = new Set<(s: FeedSort) => void>();

function load() {
  if (loaded) return;
  loaded = true;
  deviceStorage.get(KEY).then((v) => {
    if (v && (FEED_SORTS as readonly string[]).includes(v) && v !== current) {
      current = v as FeedSort;
      listeners.forEach((l) => l(current));
    }
  });
}

export function setFeedSort(s: FeedSort) {
  current = s;
  listeners.forEach((l) => l(s));
  deviceStorage.set(KEY, s);
}

export function useFeedSort(): FeedSort {
  const [s, setS] = useState(current);
  useEffect(() => {
    load();
    listeners.add(setS);
    setS(current);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
