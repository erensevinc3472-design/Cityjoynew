import { audienceKeysOf, type UserProfile } from '@cityjoy/shared';

import { officialFollowRepository } from './services';
import { deviceStorage } from './storage';

const keyOf = (uid: string) => `cityjoy:official-follow-keys:${uid}`;

/**
 * Mahalle değişince (ya da yaş aralığı geçince) resmî takiplerin sayıları yeni yere taşınır. Yalnızca konum ya da yaş
 * aralığı son taşımadan beri değiştiyse takip listesi okunur (maliyet ilkesi).
 */
export async function reconcileOfficialFollows(p: UserProfile) {
  const keys = JSON.stringify(audienceKeysOf(p));
  if ((await deviceStorage.get(keyOf(p.uid))) === keys) return;
  try {
    await officialFollowRepository.reconcile(p);
    await deviceStorage.set(keyOf(p.uid), keys);
  } catch {
    // Bağlantı yoksa bir sonraki açılışta yeniden denenir.
  }
}
