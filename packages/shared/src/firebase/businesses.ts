import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';

import {
  cleanBusinessInput,
  type Business,
  type BusinessInput,
  type BusinessRepository,
  type VerificationStatus,
} from '../business/business';
import type { MembershipTier } from '../models/membership';
import type { Action, Module } from '../permissions/types';

const COLLECTION = 'businesses';

const iso = (v: unknown): string | undefined => (v instanceof Timestamp ? v.toDate().toISOString() : undefined);

function fromDoc(id: string, d: DocumentData): Business {
  return {
    ...(d as Business),
    id,
    verification: { status: d.verification?.status ?? 'dogrulanmadi', ...(iso(d.verification?.verifiedAt) ? { verifiedAt: iso(d.verification.verifiedAt) } : {}) },
    membership: { tier: d.membership?.tier ?? 'ucretsiz', ...(iso(d.membership?.endsAt) ? { endsAt: iso(d.membership.endsAt) } : {}) },
    featuredUntil: iso(d.featuredUntil),
    rating: d.rating ?? { avg: 0, count: 0 },
    createdAt: iso(d.createdAt) ?? '',
    // Sunucu zaman damgası henüz yazılmadıysa (yerel önbellek) şimdiki zaman sayılır.
    updatedAt: iso(d.updatedAt) ?? new Date().toISOString(),
  };
}

/** Uygulama: hizmet listeleri ve İşletmem. Yetki kuralları firestore.rules içinde. */
export function createFirestoreBusinessRepository(db: Firestore): BusinessRepository {
  const list = async (...constraints: QueryConstraint[]) =>
    (await getDocs(query(collection(db, COLLECTION), ...constraints))).docs.map((d) => fromDoc(d.id, d.data()));

  return {
    listByCategory: (provinceCode, categoryId) =>
      list(where('status', '==', 'yayinda'), where('location.provinceCode', '==', provinceCode), where('categoryIds', 'array-contains', categoryId), limit(100)),

    async get(id) {
      const snap = await getDoc(doc(db, COLLECTION, id));
      return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },

    listMine: (uid) => list(where('ownerUid', '==', uid)),

    async create(uid, input) {
      const ref = await addDoc(collection(db, COLLECTION), {
        ...cleanBusinessInput(input),
        ownerUid: uid,
        status: 'yayinda',
        verification: { status: 'dogrulanmadi' },
        membership: { tier: 'ucretsiz' },
        rating: { avg: 0, count: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },

    async update(id, input) {
      const clean = cleanBusinessInput(input);
      // Boşaltılan isteğe bağlı alanlar silinir.
      const removed = Object.fromEntries((['address', 'hoursNote', 'description'] as const).filter((k) => !(k in clean)).map((k) => [k, deleteField()]));
      await updateDoc(doc(db, COLLECTION, id), { ...clean, location: clean.location, ...removed, updatedAt: serverTimestamp() });
    },

    async setHidden(id, hidden) {
      await updateDoc(doc(db, COLLECTION, id), { status: hidden ? 'gizli' : 'yayinda', updatedAt: serverTimestamp() });
    },

    async delete(id) {
      await deleteDoc(doc(db, COLLECTION, id));
    },

    async deleteAllOf(uid) {
      const snap = await getDocs(query(collection(db, COLLECTION), where('ownerUid', '==', uid)));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    },
  };
}

/**
 * Panel: işletme listesi, doğrulama, kaldırma, üyelik kademesi ve öne çıkma (admin). Ödeme sistemi
 * gelene kadar kademe ve öne çıkma elle verilir. Her işlem işlem kaydına yazılır.
 */
export function createBusinessAdmin(db: Firestore, actorUid: string) {
  const change = async (b: Business, data: Record<string, unknown>, action: Action, summary: string) => {
    const module: Module = 'isletme-dogrulama';
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTION, b.id), data);
    batch.set(doc(collection(db, 'auditLog')), {
      actorUid,
      module,
      action,
      targetId: b.id,
      region: { provinceCode: b.location.provinceCode, districtId: b.location.districtId },
      at: serverTimestamp(),
      summary: `${summary}: ${b.name}`,
    });
    await batch.commit();
  };

  return {
    async list(filter: { provinceCode?: string } = {}): Promise<Business[]> {
      const constraints: QueryConstraint[] = [orderBy('updatedAt', 'desc'), limit(200)];
      if (filter.provinceCode) constraints.unshift(where('location.provinceCode', '==', filter.provinceCode));
      return (await getDocs(query(collection(db, COLLECTION), ...constraints))).docs.map((d) => fromDoc(d.id, d.data()));
    },

    setVerification: (b: Business, status: VerificationStatus) =>
      change(
        b,
        { verification: status === 'dogrulandi' ? { status, verifiedAt: serverTimestamp() } : { status } },
        'onayla',
        { dogrulandi: 'Doğrulandı', inceleniyor: 'İncelemeye alındı', dogrulanmadi: 'Doğrulama kaldırıldı' }[status],
      ),

    setRemoved: (b: Business, removed: boolean) =>
      change(b, { status: removed ? 'kaldirildi' : 'yayinda' }, removed ? 'sil' : 'duzenle', removed ? 'Yayından kaldırıldı' : 'Yeniden yayına alındı'),

    setTier: (b: Business, tier: MembershipTier, endsAt?: Date) =>
      change(b, { membership: endsAt && tier !== 'ucretsiz' ? { tier, endsAt: Timestamp.fromDate(endsAt) } : { tier } }, 'duzenle', `Üyelik kademesi: ${tier}`),

    setFeatured: (b: Business, until: Date | null) =>
      change(b, { featuredUntil: until ? Timestamp.fromDate(until) : deleteField() }, 'duzenle', until ? `Öne çıkarıldı (${until.toISOString().slice(0, 10)} tarihine kadar)` : 'Öne çıkarma kaldırıldı'),
  };
}
