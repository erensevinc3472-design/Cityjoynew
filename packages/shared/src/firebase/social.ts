import {
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { cleanPhoto, photoFrom, type Photo } from '../media/photo';
import { blockId, followId, PROFILE_LIMITS, type FollowStatus, type ProfileReportReason, type PublicProfile } from '../posts/social';
import { SEARCH_LIMITS, searchKeys } from '../search/search';
import { addAudit, iso } from './grants';
import { countUsage } from './limits';

const PROFILES = 'publicProfiles';
const FOLLOWS = 'follows';
const BLOCKS = 'blocks';
const REPORTS = 'profileReports';

const nameKeys = (name: string) => searchKeys(name, SEARCH_LIMITS.profileKeys);

function profileFromDoc(uid: string, d: DocumentData): PublicProfile {
  const photo = photoFrom(d.photo);
  return {
    uid,
    displayName: d.displayName ?? '',
    bio: d.bio ?? '',
    isPrivate: d.isPrivate === true,
    bioRemoved: d.bioRemoved === true,
    ...(photo ? { photo } : {}),
    photoRemoved: d.photoRemoved === true,
  };
}

/**
 * Uygulama: Keşfet profili (herkese açık künye), takip, takip istekleri ve engelleme. Takip ve engel belgelerinin
 * kimliği "kişi_kişi" biçimindedir; böylece kurallar ilişkiyi tek okumayla denetler.
 */
export function createFirestoreSocialRepository(db: Firestore) {
  const profileRef = (uid: string) => doc(db, PROFILES, uid);
  const followRef = (a: string, b: string) => doc(db, FOLLOWS, followId(a, b));
  const blockRef = (a: string, b: string) => doc(db, BLOCKS, blockId(a, b));

  return {
    async getProfile(uid: string): Promise<PublicProfile | null> {
      const snap = await getDoc(profileRef(uid));
      return snap.exists() ? profileFromDoc(uid, snap.data()) : null;
    },

    /** Keşfet'e ilk girişte herkese açık profil açılır (gizlilik, kayıttaki tercihle başlar; 13-17 yaş gizli). */
    async ensureProfile(uid: string, displayName: string, isPrivate: boolean): Promise<PublicProfile> {
      const snap = await getDoc(profileRef(uid));
      if (snap.exists()) {
        // Ara'dan önce açılmış profillere arama anahtarı bir kez eklenir.
        if (!snap.get('searchKeys')) {
          await updateDoc(profileRef(uid), { searchKeys: nameKeys(snap.get('displayName') ?? ''), updatedAt: serverTimestamp() }).catch(() => {});
        }
        return profileFromDoc(uid, snap.data());
      }
      const name = displayName.slice(0, 40);
      const batch = writeBatch(db);
      batch.set(profileRef(uid), { displayName: name, bio: '', isPrivate, searchKeys: nameKeys(name), updatedAt: serverTimestamp() });
      await batch.commit();
      return { uid, displayName: name, bio: '', isPrivate, bioRemoved: false, photoRemoved: false };
    },

    async updateProfile(uid: string, patch: { displayName: string; bio: string; isPrivate: boolean }): Promise<void> {
      const batch = writeBatch(db);
      batch.update(profileRef(uid), {
        displayName: patch.displayName.slice(0, 40),
        bio: patch.bio.trim().slice(0, PROFILE_LIMITS.bio),
        isPrivate: patch.isPrivate,
        searchKeys: nameKeys(patch.displayName.slice(0, 40)),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    },

    /** Profil fotoğrafını koyar ya da kaldırır (null). Eski dosyayı sunucu siler. */
    async setPhoto(uid: string, photo: Photo | null): Promise<void> {
      await updateDoc(profileRef(uid), { photo: photo ? cleanPhoto(photo) : deleteField(), updatedAt: serverTimestamp() });
    },

    /**
     * Ara > Kişiler: yalnızca adla bulunur (tanıtım aranmaz; gizli hesaplar da yalnızca adıyla görünür, PROJE.md 5.10).
     * Engellenenleri ekran süzer.
     */
    async searchPeople(key: string): Promise<PublicProfile[]> {
      const snap = await getDocs(query(collection(db, PROFILES), where('searchKeys', 'array-contains', key), limit(PROFILE_LIMITS.searchResults)));
      return snap.docs.map((d) => profileFromDoc(d.id, d.data()));
    },

    /** Benim o kişiyle takip durumum: takip ediyorum, istek gönderdim ya da yok. */
    async followState(me: string, other: string): Promise<FollowStatus | null> {
      const snap = await getDoc(followRef(me, other)).catch(() => null);
      return snap?.exists() ? (snap.get('status') as FollowStatus) : null;
    },

    /** Gizli hesapta istek, açık hesapta doğrudan takip (kurallar hesabın gizliliğine göre denetler). */
    async follow(me: string, other: string, isPrivate: boolean): Promise<FollowStatus> {
      const status: FollowStatus = isPrivate ? 'istek' : 'aktif';
      const batch = writeBatch(db);
      await countUsage(db, batch, { type: 'u', id: me }, 'takip', me);
      batch.set(followRef(me, other), { followerUid: me, followeeUid: other, status, createdAt: serverTimestamp() });
      await batch.commit();
      return status;
    },

    async unfollow(me: string, other: string): Promise<void> {
      const batch = writeBatch(db);
      batch.delete(followRef(me, other));
      await batch.commit();
    },

    /**
     * Bildirim merkezi: beni son takip etmeye başlayanlar (en çok 20, en yeni üstte). Ad için profil de okunur; bu
     * yüzden yalnızca bildirim ekranı açılınca çağrılır.
     */
    async recentFollowers(me: string): Promise<{ uid: string; displayName: string; at: string }[]> {
      const snap = await getDocs(query(collection(db, FOLLOWS), where('followeeUid', '==', me), where('status', '==', 'aktif'), orderBy('createdAt', 'desc'), limit(20)));
      return Promise.all(
        snap.docs.map(async (d) => {
          const uid = d.get('followerUid') as string;
          const p = await getDoc(profileRef(uid)).catch(() => null);
          return { uid, displayName: (p?.exists() && p.get('displayName')) || '?', at: iso(d.get('createdAt')) ?? new Date().toISOString() };
        }),
      );
    },

    /** Bana gelen takip istekleri (gizli hesap). */
    async requests(me: string): Promise<{ uid: string; displayName: string }[]> {
      const snap = await getDocs(query(collection(db, FOLLOWS), where('followeeUid', '==', me), where('status', '==', 'istek'), limit(100)));
      return Promise.all(
        snap.docs.map(async (d) => {
          const uid = d.get('followerUid') as string;
          const p = await getDoc(profileRef(uid)).catch(() => null);
          return { uid, displayName: (p?.exists() && p.get('displayName')) || '?' };
        }),
      );
    },

    async accept(me: string, follower: string): Promise<void> {
      const batch = writeBatch(db);
      batch.update(followRef(follower, me), { status: 'aktif' });
      await batch.commit();
    },

    /** İsteği reddet ya da takipçiyi çıkar. */
    async removeFollower(me: string, follower: string): Promise<void> {
      const batch = writeBatch(db);
      batch.delete(followRef(follower, me));
      await batch.commit();
    },

    /** Takipçi ve takip edilen sayıları (sayım sorgusu; belge okumaz, maliyeti düşük). */
    async counts(uid: string): Promise<{ followers: number; following: number }> {
      const [a, b] = await Promise.all([
        getCountFromServer(query(collection(db, FOLLOWS), where('followeeUid', '==', uid), where('status', '==', 'aktif'))),
        getCountFromServer(query(collection(db, FOLLOWS), where('followerUid', '==', uid), where('status', '==', 'aktif'))),
      ]);
      return { followers: a.data().count, following: b.data().count };
    },

    /** Takip ettiklerim (Takip akışı için, en çok 30). */
    async followingUids(me: string): Promise<string[]> {
      const snap = await getDocs(
        query(collection(db, FOLLOWS), where('followerUid', '==', me), where('status', '==', 'aktif'), limit(PROFILE_LIMITS.feedAuthors)),
      );
      return snap.docs.map((d) => d.get('followeeUid') as string);
    },

    /** Engelle: iki yöndeki takip de biter. */
    async block(me: string, other: string): Promise<void> {
      const batch = writeBatch(db);
      batch.set(blockRef(me, other), { blockerUid: me, blockedUid: other, createdAt: serverTimestamp() });
      batch.delete(followRef(me, other));
      batch.delete(followRef(other, me));
      await batch.commit();
    },

    async unblock(me: string, other: string): Promise<void> {
      const batch = writeBatch(db);
      batch.delete(blockRef(me, other));
      await batch.commit();
    },

    /** Engellediklerim (akışta gizlemek için; oturum başına tek sorgu). */
    async myBlocks(me: string): Promise<Set<string>> {
      const snap = await getDocs(query(collection(db, BLOCKS), where('blockerUid', '==', me), limit(500)));
      return new Set(snap.docs.map((d) => d.get('blockedUid') as string));
    },

    /** O kişi beni engelledi mi (takip düğmesini kapatmak için). */
    async isBlockedBy(me: string, other: string): Promise<boolean> {
      return getDoc(blockRef(other, me)).then((s) => s.exists(), () => false);
    },

    /** Kişi başına profil başına bir şikâyet; tanıtımın o anki kopyası saklanır. */
    async reportProfile(target: PublicProfile, me: string, reason: ProfileReportReason): Promise<void> {
      const batch = writeBatch(db);
      await countUsage(db, batch, { type: 'u', id: me }, 'sikayet', me);
      batch.set(doc(db, REPORTS, `${target.uid}_${me}`), {
        targetUid: target.uid,
        reporterUid: me,
        reason,
        displayName: target.displayName,
        bio: target.bio,
        status: 'yeni',
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    },

    async hasReportedProfile(target: string, me: string): Promise<boolean> {
      return getDoc(doc(db, REPORTS, `${target}_${me}`)).then((s) => s.exists(), () => false);
    },

    /** Hesap silmede (KVKK): takipler, engeller ve herkese açık profil silinir. */
    async deleteAllOf(uid: string): Promise<void> {
      const groups = await Promise.all([
        getDocs(query(collection(db, FOLLOWS), where('followerUid', '==', uid), limit(500))),
        getDocs(query(collection(db, FOLLOWS), where('followeeUid', '==', uid), limit(500))),
        getDocs(query(collection(db, BLOCKS), where('blockerUid', '==', uid), limit(500))),
      ]);
      for (const d of groups.flatMap((g) => g.docs)) {
        const batch = writeBatch(db);
        batch.delete(d.ref);
        await batch.commit();
      }
      const batch = writeBatch(db);
      batch.delete(profileRef(uid));
      await batch.commit();
    },
  };
}

export interface ProfileReport {
  id: string;
  targetUid: string;
  reporterUid: string;
  reason: ProfileReportReason;
  /** Şikâyet anındaki ad ve tanıtım (fotoğraf için `current`). */
  displayName: string;
  bio: string;
  status: 'yeni' | 'incelendi';
  createdAt: string;
  current: PublicProfile | null;
}

/**
 * Panel > Moderasyon: şikâyet edilen Keşfet profilleri. Profilde bölge bilgisi tutulmadığı (mahalle gizli) için
 * yalnızca admin görür. "Tanıtımı kaldır" tanıtımı boşaltır ve kişinin yeniden yazmasını kapatır; "Fotoğrafı kaldır"
 * fotoğrafı siler ve yenisini koymasını kapatır (dosyayı sunucu siler); her işlem kayda geçer.
 */
export function createProfileModeration(db: Firestore, actorUid: string) {
  return {
    async listReports(): Promise<ProfileReport[]> {
      const snap = await getDocs(query(collection(db, REPORTS), orderBy('createdAt', 'desc'), limit(100)));
      return Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const p = await getDoc(doc(db, PROFILES, data.targetUid)).catch(() => null);
          return {
            id: d.id,
            targetUid: data.targetUid,
            reporterUid: data.reporterUid,
            reason: data.reason,
            displayName: data.displayName ?? '',
            bio: data.bio ?? '',
            status: data.status,
            createdAt: iso(data.createdAt) ?? '',
            current: p?.exists() ? profileFromDoc(p.id, p.data()) : null,
          };
        }),
      );
    },

    async removeBio(r: ProfileReport): Promise<void> {
      const batch = writeBatch(db);
      if (r.current) batch.update(doc(db, PROFILES, r.targetUid), { bio: '', bioRemoved: true, updatedAt: serverTimestamp() });
      batch.update(doc(db, REPORTS, r.id), { status: 'incelendi' });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: r.targetUid, summary: `Profil tanıtımı kaldırıldı (şikâyet): ${r.displayName}` });
      await batch.commit();
    },

    async removePhoto(r: ProfileReport): Promise<void> {
      const batch = writeBatch(db);
      if (r.current) batch.update(doc(db, PROFILES, r.targetUid), { photo: deleteField(), photoRemoved: true, updatedAt: serverTimestamp() });
      batch.update(doc(db, REPORTS, r.id), { status: 'incelendi' });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: r.targetUid, summary: `Profil fotoğrafı kaldırıldı (şikâyet): ${r.displayName}` });
      await batch.commit();
    },

    async dismiss(r: ProfileReport): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, REPORTS, r.id), { status: 'incelendi' });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: r.targetUid, summary: `Profil şikâyeti incelendi, işlem yok: ${r.displayName}` });
      await batch.commit();
    },
  };
}
