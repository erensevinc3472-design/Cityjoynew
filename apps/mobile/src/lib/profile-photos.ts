import { useEffect, useState } from 'react';
import type { LocationBadge, Photo } from '@cityjoy/shared';

import { businessRepository, socialRepository } from './services';

/**
 * Kişilerin herkese açık profili (güncel ad ve fotoğraf) oturum boyunca bir kez okunur: gönderi, mesaj, arama
 * listelerinde aynı kişi tekrar okunmaz. Böylece ad değişikliği eski gönderilerde de görünür (gönderide yazılı ad
 * yalnızca profil okunamazsa kullanılır).
 */
type Author = { photo?: Photo; displayName?: string; locationVerified?: LocationBadge; badges?: string[] };
const cache = new Map<string, Promise<Author>>();
const listeners = new Set<() => void>();

function load(uid: string): Promise<Author> {
  if (!cache.has(uid)) {
    cache.set(
      uid,
      socialRepository.getProfile(uid).then(
        (p) => (p ? { photo: p.photo, displayName: p.displayName, locationVerified: p.locationVerified, badges: p.badges } : {}),
        () => ({}),
      ),
    );
  }
  return cache.get(uid)!;
}

/** Kendi fotoğrafını ya da adını değiştirince listelerdeki eski bilgi hemen yenilenir. */
export function rememberProfile(uid: string, patch: Author) {
  const prev = cache.get(uid) ?? Promise.resolve({} as Author);
  cache.set(
    uid,
    prev.then((p) => ({ ...p, ...patch })),
  );
  listeners.forEach((l) => l());
}

export const rememberProfilePhoto = (uid: string, photo: Photo | undefined) => rememberProfile(uid, { photo });

function useVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const l = () => setVersion((v) => v + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return version;
}

/** Kişinin güncel herkese açık bilgisi; okunamazsa boş (ekran gönderideki adı ve baş harfi gösterir). */
export function useAuthor(uid: string | undefined): Author {
  const [author, setAuthor] = useState<Author>({});
  const version = useVersion();
  useEffect(() => {
    let live = true;
    setAuthor({});
    if (uid) load(uid).then((a) => live && setAuthor(a));
    return () => {
      live = false;
    };
  }, [uid, version]);
  return author;
}

/** Kişinin profil fotoğrafı; yoksa (ya da okunamazsa) undefined, ekran baş harfi gösterir. */
export function useProfilePhoto(uid: string | undefined): Photo | undefined {
  return useAuthor(uid).photo;
}

// İşletmelerin güncel adı ve doğrulama durumu da oturumda bir kez okunur (işletme adına paylaşımlarda rozet).
type BizInfo = { name?: string; verified: boolean };
const bizCache = new Map<string, Promise<BizInfo>>();

/** İşletme adına paylaşımın güncel adı ve "doğrulanmış" rozeti. */
export function useBusinessInfo(id: string | undefined): BizInfo {
  const [info, setInfo] = useState<BizInfo>({ verified: false });
  useEffect(() => {
    let live = true;
    setInfo({ verified: false });
    if (!id) return;
    if (!bizCache.has(id)) {
      bizCache.set(
        id,
        businessRepository.get(id).then(
          (b) => (b ? { name: b.name, verified: b.verification.status === 'dogrulandi' } : { verified: false }),
          () => ({ verified: false }),
        ),
      );
    }
    bizCache.get(id)!.then((x) => live && setInfo(x));
    return () => {
      live = false;
    };
  }, [id]);
  return info;
}
