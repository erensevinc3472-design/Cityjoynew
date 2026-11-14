import { useEffect, useState } from 'react';
import type { UserLocation } from '@cityjoy/shared';
import { setWriteGuard, WriteBlockedError } from '@cityjoy/shared/firebase';

import { IS_PANEL_PREVIEW } from './preview-flag';
import { authService } from './services';

/**
 * Panel önizlemesi (Panel > Uygulama görünümü). Önizlemedeki uygulama panelle aynı adreste çalışır ve panelin oturumunu
 * paylaşır; bu yüzden:
 * - veritabanına ve depoya hiçbir şey yazılmaz (yazma kapısı), denenirse "önizlemede kayıt yapılmaz" uyarısı çıkar;
 * - giriş, kayıt, çıkış ve hesap silme kapalıdır (panelin oturumunu değiştirmesin, silmesin);
 * - "Şu konumdan bak" seçimi yöneticinin kendi konumunu değiştirmez, yalnızca önizlemede geçerlidir.
 */

const blockedListeners = new Set<() => void>();
function notifyBlocked() {
  blockedListeners.forEach((l) => l());
}

/** Kayıt denendiğinde çağrılır (önizleme uyarısı için). */
export function onPreviewBlocked(fn: () => void): () => void {
  blockedListeners.add(fn);
  return () => {
    blockedListeners.delete(fn);
  };
}

let location: UserLocation | null = null;
const locationListeners = new Set<(l: UserLocation | null) => void>();

export function setPreviewLocation(next: UserLocation | null) {
  location = next;
  locationListeners.forEach((l) => l(next));
}

/** Panelde seçilen "şu konumdan bak" (yoksa null: kişinin kendi konumu kullanılır). */
export function usePreviewLocation(): UserLocation | null {
  const [value, setValue] = useState(location);
  useEffect(() => {
    if (!IS_PANEL_PREVIEW) return;
    locationListeners.add(setValue);
    setValue(location);
    return () => {
      locationListeners.delete(setValue);
    };
  }, []);
  return IS_PANEL_PREVIEW ? value : null;
}

if (IS_PANEL_PREVIEW) {
  setWriteGuard(() => {
    notifyBlocked();
    return false;
  });
  const blocked = () => {
    notifyBlocked();
    return Promise.reject(new WriteBlockedError());
  };
  const a = authService as unknown as Record<string, unknown>;
  for (const k of ['signIn', 'signUp', 'signInWithGoogle', 'signOut', 'deleteAccount', 'deleteAccountAndData', 'sendPasswordReset', 'sendEmailVerification']) {
    if (typeof a[k] === 'function') a[k] = blocked;
  }
  // Açılış adresindeki ?il=&ilce= (panel ilk açılışta seçili konumu böyle verir).
  try {
    const q = new URLSearchParams(window.location.search);
    const il = q.get('il');
    if (il) location = { provinceCode: il, ...(q.get('ilce') ? { districtId: q.get('ilce')! } : {}) };
  } catch {}
}
