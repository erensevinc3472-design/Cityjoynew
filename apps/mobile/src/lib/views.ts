import { httpsCallable } from 'firebase/functions';
import { AppState } from 'react-native';

import { functions } from '@/lib/firebase';

/**
 * Video izlenmeleri (Eren, 13 Kasım 2026; maliyet ilkesi): en az 3 sn oynayan video burada birikir, 10 olunca ya da 30
 * saniyede bir, uygulama arka plana geçince tek çağrıyla sunucuya gider. Sunucu kişi başına günde bir sayar; uygulama
 * açıkken aynı video bir kez gönderilir. Hata olursa yeniden denenmez (sayı küçük kayabilir, maliyet artmaz).
 */
const pending = new Set<string>();
const sent = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
const BATCH = 10;
const WAIT_MS = 30_000;

async function flush() {
  if (timer) clearTimeout(timer);
  timer = undefined;
  if (!pending.size) return;
  const ids = [...pending].slice(0, 50);
  ids.forEach((id) => (pending.delete(id), sent.add(id)));
  try {
    await httpsCallable(functions, 'recordViews')({ ids });
  } catch {
    // Giriş yoksa ya da ağ yoksa sessizce geçilir.
  }
}

export function markViewed(postId: string) {
  if (sent.has(postId) || pending.has(postId)) return;
  pending.add(postId);
  if (pending.size >= BATCH) flush();
  else if (!timer) timer = setTimeout(flush, WAIT_MS);
}

AppState.addEventListener('change', (s) => {
  if (s !== 'active') flush();
});
