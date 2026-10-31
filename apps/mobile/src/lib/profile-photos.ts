import { useEffect, useState } from 'react';
import type { Photo } from '@cityjoy/shared';

import { socialRepository } from './services';

// Kişilerin profil fotoğrafı oturum boyunca bir kez okunur (gönderi, mesaj, arama listelerinde aynı kişi tekrar okunmaz).
const cache = new Map<string, Promise<Photo | undefined>>();
const listeners = new Set<() => void>();

function load(uid: string): Promise<Photo | undefined> {
  if (!cache.has(uid)) {
    cache.set(
      uid,
      socialRepository.getProfile(uid).then(
        (p) => p?.photo,
        () => undefined,
      ),
    );
  }
  return cache.get(uid)!;
}

/** Kendi fotoğrafını değiştirince listelerdeki eski görsel hemen yenilenir. */
export function rememberProfilePhoto(uid: string, photo: Photo | undefined) {
  cache.set(uid, Promise.resolve(photo));
  listeners.forEach((l) => l());
}

/** Kişinin profil fotoğrafı; yoksa (ya da okunamazsa) undefined, ekran baş harfi gösterir. */
export function useProfilePhoto(uid: string | undefined): Photo | undefined {
  const [photo, setPhoto] = useState<Photo>();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const l = () => setVersion((v) => v + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  useEffect(() => {
    let live = true;
    setPhoto(undefined);
    if (uid) load(uid).then((p) => live && setPhoto(p));
    return () => {
      live = false;
    };
  }, [uid, version]);
  return photo;
}
