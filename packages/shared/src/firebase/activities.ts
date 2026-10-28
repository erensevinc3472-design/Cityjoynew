import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { ACTIVITY_LIMITS, type Activity, type ActivityInput, type ActivityReportReason } from '../activities/activities';
import { addAudit, iso } from './grants';

const COLLECTION = 'activities';
const REPORTS = 'activityReports';

function fromDoc(id: string, d: DocumentData): Activity {
  return {
    id,
    title: d.title,
    description: d.description,
    category: d.category,
    startsAt: iso(d.startsAt) ?? '',
    endsAt: iso(d.endsAt) ?? '',
    region: d.region,
    capacity: d.capacity,
    status: d.status,
    organizerUid: d.organizerUid,
    organizerName: d.organizerName ?? '',
    attendeeCount: d.attendeeCount ?? 0,
    reportCount: d.reportCount ?? 0,
    cleared: d.cleared === true,
    createdAt: iso(d.createdAt) ?? '',
  };
}

const activityRef = (db: Firestore, id: string) => doc(db, COLLECTION, id);
const detailsRef = (db: Firestore, id: string) => doc(db, COLLECTION, id, 'private', 'details');
// Katılımlar etkinliklerle aynı adla ("attendees") tutulur: hesap silmede tek sorguyla ikisi de bulunur.
const attendeeRef = (db: Firestore, id: string, uid: string) => doc(db, COLLECTION, id, 'attendees', uid);

/**
 * Uygulama: ildeki yaklaşan aktiviteler (tek sorgu), açma, katılma, iptal, şikâyet. Tam buluşma yeri ayrı bir
 * belgede durur; kurallar onu yalnızca düzenleyene ve katılanlara okutur.
 */
export function createFirestoreActivityRepository(db: Firestore) {
  return {
    async listUpcoming(provinceCode: string): Promise<Activity[]> {
      const q = query(
        collection(db, COLLECTION),
        where('status', 'in', ['aktif', 'iptal']),
        where('region.provinceCode', '==', provinceCode),
        where('startsAt', '>=', Timestamp.now()),
        orderBy('startsAt', 'asc'),
        limit(100),
      );
      return (await getDocs(q)).docs.map((d) => fromDoc(d.id, d.data()));
    },

    async listMine(uid: string): Promise<Activity[]> {
      const snap = await getDocs(query(collection(db, COLLECTION), where('organizerUid', '==', uid), limit(100)));
      return snap.docs.map((d) => fromDoc(d.id, d.data())).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    },

    async get(id: string): Promise<Activity | null> {
      const snap = await getDoc(activityRef(db, id));
      return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },

    /** Tam buluşma yeri; düzenleyen ya da katılan değilse null (kurallar okutmaz). */
    async address(id: string): Promise<string | null> {
      try {
        const snap = await getDoc(detailsRef(db, id));
        return snap.exists() ? (snap.get('address') as string) : null;
      } catch {
        return null;
      }
    },

    /** Aktivite ve tam adres aynı toplu yazımda. Döner: yeni kimlik. */
    async create(uid: string, organizerName: string, input: ActivityInput): Promise<string> {
      const ref = doc(collection(db, COLLECTION));
      const r = input.region;
      const batch = writeBatch(db);
      batch.set(ref, {
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        startsAt: Timestamp.fromDate(new Date(input.startsAt)),
        endsAt: Timestamp.fromDate(new Date(input.endsAt)),
        region: { provinceCode: r.provinceCode, districtId: r.districtId, neighbourhoodId: r.neighbourhoodId },
        capacity: input.capacity,
        status: 'aktif',
        organizerUid: uid,
        organizerName: organizerName.slice(0, 40),
        attendeeCount: 0,
        reportCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(detailsRef(db, ref.id), { address: input.address.trim().slice(0, ACTIVITY_LIMITS.address[1]) });
      await batch.commit();
      return ref.id;
    },

    async cancel(id: string): Promise<void> {
      const batch = writeBatch(db);
      batch.update(activityRef(db, id), { status: 'iptal', updatedAt: serverTimestamp() });
      await batch.commit();
    },

    async myAttendance(id: string, uid: string): Promise<{ shareName: boolean } | null> {
      const snap = await getDoc(attendeeRef(db, id, uid));
      return snap.exists() ? { shareName: snap.get('shareName') === true } : null;
    },

    /** Katılım ve sayaç aynı toplu yazımda (kurallar sayacın tam bir arttığını, yaşı ve kontenjanı denetler). */
    async join(id: string, uid: string, share: { name: string } | null): Promise<void> {
      const batch = writeBatch(db);
      batch.set(attendeeRef(db, id, uid), { uid, shareName: !!share, ...(share ? { displayName: share.name.slice(0, 60) } : {}), createdAt: serverTimestamp() });
      batch.update(activityRef(db, id), { attendeeCount: increment(1) });
      await batch.commit();
    },

    async leave(id: string, uid: string): Promise<void> {
      const batch = writeBatch(db);
      batch.delete(attendeeRef(db, id, uid));
      batch.update(activityRef(db, id), { attendeeCount: increment(-1) });
      await batch.commit();
    },

    /** Düzenleyen: adını paylaşan katılanlar. */
    async namedAttendees(id: string): Promise<string[]> {
      const snap = await getDocs(query(collection(db, COLLECTION, id, 'attendees'), where('shareName', '==', true), limit(100)));
      return snap.docs.map((d) => d.get('displayName') as string).filter(Boolean);
    },

    /** Kişi başına aktivite başına bir şikâyet; sayaç aynı yazımda tam bir artar. */
    async report(a: Pick<Activity, 'id' | 'region'>, uid: string, reason: ActivityReportReason): Promise<void> {
      const batch = writeBatch(db);
      batch.set(doc(db, REPORTS, `${a.id}_${uid}`), {
        activityId: a.id,
        reporterUid: uid,
        reason,
        provinceCode: a.region.provinceCode,
        status: 'yeni',
        createdAt: serverTimestamp(),
      });
      batch.update(activityRef(db, a.id), { reportCount: increment(1) });
      await batch.commit();
    },

    async hasReported(id: string, uid: string): Promise<boolean> {
      return getDoc(doc(db, REPORTS, `${id}_${uid}`)).then((s) => s.exists(), () => false);
    },

    /**
     * Hesap silmede (KVKK): kişinin açtığı aktiviteler kaldırılır, adı ve tam adres silinir. Belge silinmez; katılanların
     * kayıtları ona bağlı ve onlar da kendi hesaplarını silebilmeli.
     */
    async deleteAllOf(uid: string): Promise<void> {
      const snap = await getDocs(query(collection(db, COLLECTION), where('organizerUid', '==', uid), limit(500)));
      for (const d of snap.docs) {
        const batch = writeBatch(db);
        batch.update(d.ref, { status: 'kaldirildi', organizerName: '', updatedAt: serverTimestamp() });
        batch.delete(detailsRef(db, d.id));
        await batch.commit();
      }
    },
  };
}

export interface ActivityReport {
  id: string;
  activityId: string;
  reporterUid: string;
  reason: ActivityReportReason;
  provinceCode: string;
  status: 'yeni' | 'incelendi';
  createdAt: string;
  activity: Activity | null;
}

/**
 * Panel > Moderasyon: şikâyet edilen aktiviteler. Admin hepsini, il yöneticisi ve gönüllü moderatör kendi ilini görür.
 * "Kaldır" aktiviteyi listeden çıkarır; "Yerinde kalsın" şikâyet sayısıyla düşmesini engeller. Her işlem kayda geçer.
 */
export function createActivityModeration(db: Firestore, actorUid: string) {
  const decide = async (r: ActivityReport, patch: Record<string, unknown>, summary: string) => {
    const batch = writeBatch(db);
    if (r.activity) batch.update(activityRef(db, r.activityId), { ...patch, moderatedBy: actorUid, updatedAt: serverTimestamp() });
    batch.update(doc(db, REPORTS, r.id), { status: 'incelendi' });
    const reg = r.activity?.region;
    addAudit(db, batch, {
      actorUid,
      module: 'moderasyon',
      action: 'duzenle',
      targetId: r.activityId,
      scope: reg ? { level: 'ilce', provinceCode: reg.provinceCode, districtId: reg.districtId } : { level: 'il', provinceCode: r.provinceCode },
      summary: `${summary}: ${r.activity?.title.slice(0, 60) ?? r.activityId}`,
    });
    await batch.commit();
  };

  return {
    async listReports(scope: 'admin' | { provinceCode: string }): Promise<ActivityReport[]> {
      const q =
        scope === 'admin'
          ? query(collection(db, REPORTS), orderBy('createdAt', 'desc'), limit(100))
          : query(collection(db, REPORTS), where('provinceCode', '==', scope.provinceCode), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const act = await getDoc(activityRef(db, data.activityId)).catch(() => null);
          return {
            id: d.id,
            activityId: data.activityId,
            reporterUid: data.reporterUid,
            reason: data.reason,
            provinceCode: data.provinceCode,
            status: data.status,
            createdAt: iso(data.createdAt) ?? '',
            activity: act?.exists() ? fromDoc(act.id, act.data()) : null,
          };
        }),
      );
    },

    remove: (r: ActivityReport) => decide(r, { status: 'kaldirildi' }, 'Aktivite kaldırıldı (şikâyet)'),
    keep: (r: ActivityReport) => decide(r, { cleared: true }, 'Şikâyet incelendi, aktivite yerinde kaldı'),
  };
}
