import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';

import type { UserProfile } from '../models/user';
import {
  audienceKeysOf,
  dayKey,
  EMPTY_STATS,
  sameAudienceKeys,
  type AudienceKeys,
  type OfficialStats,
} from '../organizations/audience';

const FOLLOWS = 'officialFollows';
const STATS = 'officialStats';
const followDoc = (db: Firestore, uid: string, profileId: string) => doc(db, FOLLOWS, `${uid}__${profileId}`);
const statsDoc = (db: Firestore, profileId: string) => doc(db, STATS, profileId);

const keysFrom = (d: DocumentData): AudienceKeys => ({
  provinceCode: d.provinceCode ?? null,
  districtId: d.districtId ?? null,
  neighbourhoodId: d.neighbourhoodId ?? null,
  ageBand: d.ageBand,
});

type Change = { o: AudienceKeys | null; n: AudienceKeys | null };

/** Sayaç belgesine tek bir takip değişikliği (kurallar her sayacın tam bir değiştiğini denetler). */
function writeStats(db: Firestore, batch: WriteBatch, profileId: string, { o, n }: Change, day: string) {
  const step: Record<string, Record<string, ReturnType<typeof increment>>> = { p: {}, d: {}, n: {}, a: {} };
  const fields = [['p', 'provinceCode'], ['d', 'districtId'], ['n', 'neighbourhoodId'], ['a', 'ageBand']] as const;
  for (const [map, key] of fields) {
    const before = o?.[key] ?? null;
    const after = n?.[key] ?? null;
    if (before === after) continue;
    if (before) step[map][before] = increment(-1);
    if (after) step[map][after] = increment(1);
  }
  const data: Record<string, unknown> = Object.fromEntries(Object.entries(step).filter(([, v]) => Object.keys(v).length));
  if (!o && n) data.f = { [day]: increment(1) };
  if (o && !n) data.u = { [day]: increment(1) };
  if (!o !== !n) data.total = increment(n ? 1 : -1);
  if (o && !n) data.unfollows = increment(1);
  data.updatedAt = serverTimestamp();
  batch.set(statsDoc(db, profileId), data, { merge: true });
}

/**
 * Gün anahtarı sunucu saatine göre denetlenir; telefonun saati gece yarısına yakın kaymışsa komşu günle bir kez daha denenir.
 */
async function commitWithDay(build: (day: string) => WriteBatch) {
  const now = Date.now();
  try {
    await build(dayKey(new Date(now))).commit();
  } catch (e) {
    const hour = new Date(now).getUTCHours();
    if (hour !== 0 && hour !== 23) throw e;
    await build(dayKey(new Date(now + (hour === 23 ? 1 : -1) * 3600000 * 2))).commit();
  }
}

/**
 * Uygulama: resmî profil (belediye, kurum, muhtarlık, başkan) takibi. Takip kaydı kişinin kayıtlı konumunu ve yaş
 * aralığını taşır (kimlik panele gitmez); sayaçlar aynı toplu yazımda değişir.
 */
export function createFirestoreOfficialFollowRepository(db: Firestore) {
  const follows = async (uid: string) =>
    (await getDocs(query(collection(db, FOLLOWS), where('uid', '==', uid), limit(200)))).docs.map((d) => ({
      profileId: d.get('profileId') as string,
      keys: keysFrom(d.data()),
    }));

  return {
    async isFollowing(profileId: string, uid: string): Promise<boolean> {
      return (await getDoc(followDoc(db, uid, profileId))).exists();
    },

    async follow(profileId: string, user: Pick<UserProfile, 'uid' | 'location' | 'birthYear'>) {
      const n = audienceKeysOf(user);
      await commitWithDay((day) => {
        const batch = writeBatch(db);
        batch.set(followDoc(db, user.uid, profileId), { uid: user.uid, profileId, ...n, createdAt: serverTimestamp() });
        writeStats(db, batch, profileId, { o: null, n }, day);
        return batch;
      });
    },

    async unfollow(profileId: string, uid: string) {
      const snap = await getDoc(followDoc(db, uid, profileId));
      if (!snap.exists()) return;
      const o = keysFrom(snap.data());
      await commitWithDay((day) => {
        const batch = writeBatch(db);
        batch.delete(followDoc(db, uid, profileId));
        writeStats(db, batch, profileId, { o, n: null }, day);
        return batch;
      });
    },

    /**
     * Mahalle değişince (ya da yaş aralığı geçince) takiplerin sayıları eski yerden yeniye taşınır. Uygulama açılışta
     * ve konum değişince çağırır; zaten güncel olan takip için yazım yapılmaz.
     */
    async reconcile(user: Pick<UserProfile, 'uid' | 'location' | 'birthYear'>) {
      const n = audienceKeysOf(user);
      for (const f of await follows(user.uid)) {
        if (sameAudienceKeys(f.keys, n)) continue;
        const batch = writeBatch(db);
        batch.update(followDoc(db, user.uid, f.profileId), { ...n });
        writeStats(db, batch, f.profileId, { o: f.keys, n }, dayKey());
        await batch.commit();
      }
    },

    /** Hesap silinirken bütün takipler bırakılır (sayılar düşer, KVKK). */
    async leaveAllOf(uid: string) {
      for (const f of await follows(uid)) await this.unfollow(f.profileId, uid);
    },
  };
}

export type OfficialFollowRepository = ReturnType<typeof createFirestoreOfficialFollowRepository>;

/** Panel: resmî profilin kitle sayaçları. Henüz takipçi yoksa boş sayaç; yetki yoksa hata fırlatır. */
export async function getOfficialStats(db: Firestore, profileId: string): Promise<OfficialStats> {
  const snap = await getDoc(statsDoc(db, profileId));
  if (!snap.exists()) return EMPTY_STATS;
  const d = snap.data();
  const map = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, number>) : {});
  return { total: d.total ?? 0, unfollows: d.unfollows ?? 0, p: map(d.p), d: map(d.d), n: map(d.n), a: map(d.a), f: map(d.f), u: map(d.u) };
}
