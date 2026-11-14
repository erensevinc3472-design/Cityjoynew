import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, where, writeBatch, type Firestore } from './metered';

import { BADGE_LIMITS, cleanBadgeDefinitions, DEFAULT_BADGES, type BadgeDefinition } from '../posts/badges';
import type { PublicProfile } from '../posts/social';
import { addAudit } from './grants';
import { profileFromDoc } from './social';

const ref = (db: Firestore) => doc(db, 'config', 'badges');

async function loadDefinitions(db: Firestore): Promise<{ items: BadgeDefinition[]; saved: boolean }> {
  const snap = await getDoc(ref(db));
  if (!snap.exists()) return { items: DEFAULT_BADGES.map((b) => ({ ...b, name: { ...b.name } })), saved: false };
  const items: unknown = snap.get('items');
  return { items: Array.isArray(items) ? cleanBadgeDefinitions(items as BadgeDefinition[]) : [], saved: true };
}

/** Uygulama: rozet listesi (oturum başına bir kez okunur). */
export function createBadgeReader(db: Firestore) {
  let cached: Promise<BadgeDefinition[]> | null = null;
  return {
    definitions(): Promise<BadgeDefinition[]> {
      cached ??= loadDefinitions(db).then(
        (r) => r.items,
        () => {
          cached = null;
          return DEFAULT_BADGES;
        },
      );
      return cached;
    },
  };
}

/**
 * Panel (yalnızca admin): rozet listesini yönetir, kişiye rozet verir ya da geri alır. Kullanıcı rozet isteyemez;
 * her değişiklik işlem kayıtlarına geçer.
 */
export function createBadgeAdmin(db: Firestore, actorUid: string) {
  return {
    load: () => loadDefinitions(db),

    async save(items: BadgeDefinition[]): Promise<BadgeDefinition[]> {
      const clean = cleanBadgeDefinitions(items);
      const batch = writeBatch(db);
      batch.set(ref(db), { items: clean, updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: 'badges', summary: `Rozet listesi güncellendi (${clean.length} rozet)` });
      await batch.commit();
      return clean;
    },

    /** Kişinin rozetlerini yazar (boş liste = hepsi geri alındı). */
    async setProfileBadges(profile: Pick<PublicProfile, 'uid' | 'displayName'>, ids: string[], defs: BadgeDefinition[]): Promise<string[]> {
      const clean = [...new Set(ids)].filter((id) => defs.some((d) => d.id === id)).slice(0, BADGE_LIMITS.perProfile);
      const names = clean.map((id) => defs.find((d) => d.id === id)!.name.tr);
      const batch = writeBatch(db);
      // Yayıncı rozeti Haberler'e paylaşma hakkı verir; kurallar bu işarete bakar (kişi kendisi yazamaz).
      const publisher = clean.some((id) => defs.find((d) => d.id === id)?.publisher === true);
      batch.update(doc(db, 'publicProfiles', profile.uid), { badges: clean, publisher, updatedAt: serverTimestamp() });
      addAudit(db, batch, {
        actorUid,
        module: 'moderasyon',
        action: 'duzenle',
        targetId: profile.uid,
        summary: clean.length ? `Rozet verildi: ${profile.displayName} (${names.join(', ')})` : `Rozetler geri alındı: ${profile.displayName}`,
      });
      await batch.commit();
      return clean;
    },

    /** Resmî CityJoy hesabı yapar ya da geri alır (Eren, 14 Kasım 2026); işlem kaydına geçer. */
    async setOfficial(profile: Pick<PublicProfile, 'uid' | 'displayName'>, on: boolean): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, 'publicProfiles', profile.uid), { official: on, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: profile.uid, summary: on ? `Resmî CityJoy hesabı yapıldı: ${profile.displayName}` : `Resmî hesap geri alındı: ${profile.displayName}` });
      await batch.commit();
    },

    /** Resmî hesaplar (en çok 10). */
    async officials(): Promise<PublicProfile[]> {
      const snap = await getDocs(query(collection(db, 'publicProfiles'), where('official', '==', true), limit(10)));
      return snap.docs.map((d) => profileFromDoc(d.id, d.data()));
    },

    /** Rozeti olan kişiler (en çok 100). */
    async holders(ids: string[]): Promise<PublicProfile[]> {
      if (!ids.length) return [];
      const snap = await getDocs(query(collection(db, 'publicProfiles'), where('badges', 'array-contains-any', ids.slice(0, 30)), limit(100)));
      return snap.docs.map((d) => profileFromDoc(d.id, d.data()));
    },
  };
}
