import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { nextRating, type ReportReason, type Review, type ReviewRepository } from '../business/reviews';
import type { Module } from '../permissions/types';
import { countUsage } from './limits';

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : new Date().toISOString());

function fromDoc(businessId: string, uid: string, d: DocumentData): Review {
  return {
    uid,
    businessId,
    stars: d.stars,
    text: d.text,
    authorName: d.authorName,
    status: d.status,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
    ...(d.reply ? { reply: { text: d.reply.text, at: iso(d.reply.at) } } : {}),
  };
}

const businessRef = (db: Firestore, id: string) => doc(db, 'businesses', id);
const reviewRef = (db: Firestore, businessId: string, uid: string) => doc(db, 'businesses', businessId, 'reviews', uid);
const contactRef = (db: Firestore, businessId: string, uid: string) => doc(db, 'contacts', `${businessId}_${uid}`);

/**
 * Değerlendirme ile işletmenin yıldız toplamı aynı işlemde yazılır; veritabanı kuralları toplamın
 * tam olarak bu değerlendirme kadar değiştiğini denetler (kimse puanı elle şişiremez).
 */
async function changeReview(db: Firestore, businessId: string, uid: string, write: (before: DocumentData | null) => DocumentData | null) {
  await runTransaction(db, async (tx) => {
    const biz = await tx.get(businessRef(db, businessId));
    const rev = await tx.get(reviewRef(db, businessId, uid));
    const before = rev.exists() ? rev.data() : null;
    const after = write(before);
    const live = (d: DocumentData | null) => (d ? { stars: d.stars as number, live: d.status === 'yayinda' } : null);
    if (after) tx.set(reviewRef(db, businessId, uid), after);
    else tx.delete(reviewRef(db, businessId, uid));
    if (biz.exists()) {
      const rating = nextRating(biz.get('rating') ?? { sum: 0, count: 0 }, live(before), after ? { stars: after.stars, live: after.status === 'yayinda' } : null);
      if (rating.sum !== biz.get('rating.sum') || rating.count !== biz.get('rating.count')) tx.update(businessRef(db, businessId), { rating });
    }
  });
}

export function createFirestoreReviewRepository(db: Firestore): ReviewRepository {
  return {
    async list(businessId) {
      const snap = await getDocs(
        query(collection(businessRef(db, businessId), 'reviews'), where('status', '==', 'yayinda'), orderBy('createdAt', 'desc'), limit(30)),
      );
      return snap.docs.map((d) => fromDoc(businessId, d.id, d.data()));
    },

    async getMine(businessId, uid) {
      const snap = await getDoc(reviewRef(db, businessId, uid));
      return snap.exists() ? fromDoc(businessId, uid, snap.data()) : null;
    },

    async hasContacted(businessId, uid) {
      return (await getDoc(contactRef(db, businessId, uid))).exists();
    },

    async recordContact(businessId, uid) {
      const ref = contactRef(db, businessId, uid);
      if ((await getDoc(ref)).exists()) return;
      await writeBatch(db).set(ref, { uid, businessId, at: serverTimestamp() }).commit();
    },

    save: (businessId, uid, input, authorName) =>
      changeReview(db, businessId, uid, (before) =>
        before
          ? { ...before, stars: input.stars, text: input.text.trim(), updatedAt: serverTimestamp() }
          : { uid, stars: input.stars, text: input.text.trim(), authorName, status: 'yayinda', createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      ),

    delete: (businessId, uid) => changeReview(db, businessId, uid, () => null),

    async reply(businessId, reviewUid, text) {
      const batch = writeBatch(db);
      batch.update(reviewRef(db, businessId, reviewUid), { reply: { text: text.trim(), at: serverTimestamp() } });
      await batch.commit();
    },

    async report(businessId, reviewUid, reporterUid, reason: ReportReason) {
      const batch = writeBatch(db);
      await countUsage(db, batch, { type: 'u', id: reporterUid }, 'sikayet', reporterUid);
      batch.set(doc(db, 'reviewReports', `${businessId}_${reviewUid}_${reporterUid}`), {
        businessId,
        reviewUid,
        reporterUid,
        reason,
        status: 'yeni',
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    },

    async deleteAllBy(uid) {
      const reviews = await getDocs(query(collectionGroup(db, 'reviews'), where('uid', '==', uid)));
      for (const r of reviews.docs) {
        const businessId = r.ref.parent.parent!.id;
        await changeReview(db, businessId, uid, () => null);
      }
      const contacts = await getDocs(query(collection(db, 'contacts'), where('uid', '==', uid)));
      if (contacts.size) {
        const batch = writeBatch(db);
        contacts.docs.forEach((c) => batch.delete(c.ref));
        await batch.commit();
      }
    },
  };
}

export interface ReviewReport {
  id: string;
  businessId: string;
  businessName?: string;
  reviewUid: string;
  reporterUid: string;
  reason: ReportReason;
  status: 'yeni' | 'incelendi';
  createdAt: string;
  review: Review | null;
}

/** Panel > Moderasyon: değerlendirme şikâyetleri (admin). Her işlem işlem kaydına yazılır. */
export function createReviewModeration(db: Firestore, actorUid: string) {
  const module: Module = 'moderasyon';
  const audit = (targetId: string, summary: string) => ({ actorUid, module, action: 'duzenle', targetId, at: serverTimestamp(), summary });

  return {
    async listReports(): Promise<ReviewReport[]> {
      const snap = await getDocs(query(collection(db, 'reviewReports'), orderBy('createdAt', 'desc'), limit(100)));
      return Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const [rev, biz] = await Promise.all([
            getDoc(reviewRef(db, data.businessId, data.reviewUid)).catch(() => null),
            getDoc(businessRef(db, data.businessId)).catch(() => null),
          ]);
          return {
            id: d.id,
            businessId: data.businessId,
            businessName: biz?.exists() ? (biz.get('name') as string) : undefined,
            reviewUid: data.reviewUid,
            reporterUid: data.reporterUid,
            reason: data.reason,
            status: data.status,
            createdAt: iso(data.createdAt),
            review: rev?.exists() ? fromDoc(data.businessId, data.reviewUid, rev.data()) : null,
          };
        }),
      );
    },

    /** Yorumu gizler ya da geri açar; işletme puanı aynı işlemde düzeltilir. Şikâyet "incelendi" olur. */
    async setHidden(report: ReviewReport, hidden: boolean) {
      await runTransaction(db, async (tx) => {
        const biz = await tx.get(businessRef(db, report.businessId));
        const rev = await tx.get(reviewRef(db, report.businessId, report.reviewUid));
        if (!rev.exists()) throw new Error('review-missing');
        const wasLive = rev.get('status') === 'yayinda';
        tx.update(rev.ref, { status: hidden ? 'gizlendi' : 'yayinda', moderatedBy: actorUid, moderatedAt: serverTimestamp() });
        if (biz.exists() && wasLive === hidden) {
          const stars = rev.get('stars') as number;
          tx.update(biz.ref, { rating: nextRating(biz.get('rating'), { stars, live: wasLive }, { stars, live: !hidden }) });
        }
        tx.update(doc(db, 'reviewReports', report.id), { status: 'incelendi' });
        tx.set(doc(collection(db, 'auditLog')), audit(report.businessId, hidden ? 'Değerlendirme gizlendi (şikâyet)' : 'Değerlendirme yeniden yayında'));
      });
    },

    async dismiss(report: ReviewReport) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'reviewReports', report.id), { status: 'incelendi' });
      batch.set(doc(collection(db, 'auditLog')), audit(report.businessId, 'Şikâyet incelendi, değerlendirme yerinde kaldı'));
      await batch.commit();
    },
  };
}
