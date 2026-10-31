import {
  collection,
  collectionGroup,
  deleteField,
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
  type QueryConstraint,
} from 'firebase/firestore';

import type { AnnouncementRegion, Publisher } from '../announcements/announcements';
import { EVENT_LIMITS, type CityEvent, type EventInput } from '../events/events';
import type { Action, RegionScope } from '../permissions/types';
import type { SaveMode } from './announcements';
import { addAudit, iso } from './grants';
import { publishUsage } from '../limits/limits';
import { countUsage } from './limits';

const COLLECTION = 'events';
const JOINED_LIMIT = 60;

/** Profilde gösterilen katılım: etkinlik ya da kullanıcı aktivitesi. */
export interface JoinedItem {
  kind: 'etkinlik' | 'aktivite';
  id: string;
  title: string;
  startsAt: string;
  cancelled: boolean;
}

function fromDoc(id: string, d: DocumentData): CityEvent {
  return {
    id,
    title: d.title,
    description: d.description,
    category: d.category,
    startsAt: iso(d.startsAt) ?? '',
    endsAt: iso(d.endsAt) ?? '',
    venueName: d.venueName,
    ...(d.address ? { address: d.address } : {}),
    region: d.region,
    free: d.free === true,
    ...(d.priceNote ? { priceNote: d.priceNote } : {}),
    ...(d.ticketUrl ? { ticketUrl: d.ticketUrl } : {}),
    ...(typeof d.capacity === 'number' ? { capacity: d.capacity } : {}),
    author: d.author,
    status: d.status,
    preparedBy: d.preparedBy,
    preparedByName: d.preparedByName ?? '',
    createdAt: iso(d.createdAt) ?? '',
    updatedAt: iso(d.updatedAt) ?? new Date().toISOString(),
    ...(d.publishedAt ? { publishedAt: iso(d.publishedAt) } : {}),
    ...(d.reviewedBy ? { reviewedBy: d.reviewedBy } : {}),
    ...(d.reviewNote ? { reviewNote: d.reviewNote } : {}),
    attendeeCount: d.attendeeCount ?? 0,
  };
}

const attendeeRef = (db: Firestore, eventId: string, uid: string) => doc(db, COLLECTION, eventId, 'attendees', uid);

/** Uygulama: ildeki yaklaşan etkinlikler (tek sorgu), "Katılıyorum" ve hesap silmede katılımların silinmesi. */
export function createFirestoreEventRepository(db: Firestore) {
  return {
    async listUpcoming(provinceCode: string): Promise<CityEvent[]> {
      const q = query(
        collection(db, COLLECTION),
        where('status', 'in', ['yayinda', 'iptal']),
        where('region.provinceCode', '==', provinceCode),
        where('endsAt', '>=', Timestamp.now()),
        orderBy('endsAt', 'asc'),
        limit(100),
      );
      return (await getDocs(q)).docs.map((d) => fromDoc(d.id, d.data()));
    },

    async get(id: string): Promise<CityEvent | null> {
      const snap = await getDoc(doc(db, COLLECTION, id));
      return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },

    /** Kişi bu etkinliğe katılıyor mu; adını organizatörle paylaşmış mı? */
    async myAttendance(eventId: string, uid: string): Promise<{ shareName: boolean } | null> {
      const snap = await getDoc(attendeeRef(db, eventId, uid));
      return snap.exists() ? { shareName: snap.get('shareName') === true } : null;
    },

    /** Katılım ve sayaç aynı toplu yazımda (kurallar sayacın tam bir arttığını ve kontenjanı denetler). */
    async join(eventId: string, uid: string, share: { name: string } | null): Promise<void> {
      const batch = writeBatch(db);
      batch.set(attendeeRef(db, eventId, uid), { uid, shareName: !!share, ...(share ? { displayName: share.name.slice(0, 60) } : {}), createdAt: serverTimestamp() });
      batch.update(doc(db, COLLECTION, eventId), { attendeeCount: increment(1) });
      await batch.commit();
    },

    async leave(eventId: string, uid: string): Promise<void> {
      const batch = writeBatch(db);
      batch.delete(attendeeRef(db, eventId, uid));
      batch.update(doc(db, COLLECTION, eventId), { attendeeCount: increment(-1) });
      await batch.commit();
    },

    /**
     * Profil > Katıldıklarım: kişinin katıldığı etkinlik ve aktiviteler (yeniden eskiye). Kaldırılan ya da artık
     * okunamayanlar listede yok. Katılım kaydı yalnızca kişinin kendisine açık.
     */
    async listJoined(uid: string): Promise<JoinedItem[]> {
      const snap = await getDocs(query(collectionGroup(db, 'attendees'), where('uid', '==', uid), limit(JOINED_LIMIT)));
      const items = await Promise.allSettled(
        snap.docs.map(async (a): Promise<JoinedItem | null> => {
          const ref = a.ref.parent.parent!;
          const kind = ref.parent.id === 'activities' ? 'aktivite' : 'etkinlik';
          const d = await getDoc(ref);
          if (!d.exists()) return null;
          const status = String(d.get('status') ?? '');
          if (status !== 'yayinda' && status !== 'aktif' && status !== 'iptal') return null;
          return { kind, id: d.id, title: String(d.get('title') ?? ''), startsAt: iso(d.get('startsAt')) ?? '', cancelled: status === 'iptal' };
        }),
      );
      return items
        .flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
        .sort((x, y) => y.startsAt.localeCompare(x.startsAt));
    },

    /** Hesap silinirken kişinin bütün katılımları silinir (KVKK). */
    async leaveAll(uid: string): Promise<void> {
      const snap = await getDocs(query(collectionGroup(db, 'attendees'), where('uid', '==', uid)));
      for (const a of snap.docs) {
        const batch = writeBatch(db);
        batch.delete(a.ref);
        batch.update(a.ref.parent.parent!, { attendeeCount: increment(-1) });
        await batch.commit();
      }
    },
  };
}

const regionScope = (r: AnnouncementRegion): RegionScope =>
  r.neighbourhoodId && r.districtId
    ? { level: 'mahalle', provinceCode: r.provinceCode, districtId: r.districtId, neighbourhoodId: r.neighbourhoodId }
    : r.districtId
      ? { level: 'ilce', provinceCode: r.provinceCode, districtId: r.districtId }
      : { level: 'il', provinceCode: r.provinceCode };

/**
 * Panel: etkinlik hazırlama, onaya gönderme, onay / ret, yayından kaldırma ve iptal; katılım sayısı ve adını
 * paylaşan katılanlar. Akış ve yetkiler duyurularla aynı (bölüm: etkinlikler). Her işlem işlem kaydına yazılır.
 */
export function createEventPanel(db: Firestore, actor: { uid: string; name: string }) {
  const audit = (batch: ReturnType<typeof writeBatch>, e: Pick<CityEvent, 'id' | 'author' | 'region' | 'title'>, action: Action, summary: string) =>
    addAudit(db, batch, {
      actorUid: actor.uid,
      module: 'etkinlikler',
      action,
      targetId: e.id,
      scope: regionScope(e.region),
      ...(e.author.type === 'kurum' ? { orgId: e.author.orgId } : {}),
      summary: `${summary}: ${e.title.slice(0, 60)}`,
    });
  const list = async (...constraints: QueryConstraint[]) =>
    (await getDocs(query(collection(db, COLLECTION), ...constraints, limit(200)))).docs
      .map((d) => fromDoc(d.id, d.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const review = async (e: CityEvent, data: Record<string, unknown>, action: Action, summary: string) => {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTION, e.id), { ...data, reviewedBy: actor.uid, updatedAt: serverTimestamp() });
    audit(batch, e, action, summary);
    await batch.commit();
  };

  return {
    listFor: (p: Publisher) =>
      p.author.type === 'kurum'
        ? list(where('author.type', '==', 'kurum'), where('author.orgId', '==', p.author.orgId))
        : list(where('preparedBy', '==', actor.uid)),

    listPending: (by: { orgId: string } | { provinceCode: string } | 'admin') =>
      by === 'admin'
        ? list(where('status', '==', 'onay-bekliyor'))
        : 'orgId' in by
          ? list(where('author.type', '==', 'kurum'), where('author.orgId', '==', by.orgId), where('status', '==', 'onay-bekliyor'))
          : list(where('author.type', '==', 'kisi'), where('region.provinceCode', '==', by.provinceCode), where('status', '==', 'onay-bekliyor')),

    async save(p: Publisher, input: EventInput, mode: SaveMode, existing?: CityEvent): Promise<string> {
      const ref = existing ? doc(db, COLLECTION, existing.id) : doc(collection(db, COLLECTION));
      const status = mode === 'taslak' ? 'taslak' : mode === 'onaya' ? 'onay-bekliyor' : 'yayinda';
      const r = input.region;
      const optional = {
        address: input.address?.trim() ? input.address.trim().slice(0, EVENT_LIMITS.address) : undefined,
        priceNote: !input.free && input.priceNote?.trim() ? input.priceNote.trim().slice(0, EVENT_LIMITS.priceNote) : undefined,
        ticketUrl: input.ticketUrl?.trim() || undefined,
        capacity: input.capacity,
      };
      const data = {
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        startsAt: Timestamp.fromDate(new Date(input.startsAt)),
        endsAt: Timestamp.fromDate(new Date(input.endsAt)),
        venueName: input.venueName.trim(),
        region: { provinceCode: r.provinceCode, ...(r.districtId ? { districtId: r.districtId } : {}), ...(r.districtId && r.neighbourhoodId ? { neighbourhoodId: r.neighbourhoodId } : {}) },
        free: input.free,
        ...Object.fromEntries(Object.entries(optional).filter(([, v]) => v !== undefined)),
        author: p.author,
        status,
        preparedBy: actor.uid,
        preparedByName: actor.name.slice(0, 80),
        updatedAt: serverTimestamp(),
        ...(status === 'yayinda' ? { publishedAt: serverTimestamp() } : {}),
      };
      const batch = writeBatch(db);
      // Doğrudan yayın günlük sınıra sayılır; dolduysa LimitReachedError (panel "Onaya gönder" önerir).
      const usage = status === 'yayinda' ? publishUsage(p.author, { module: 'etkinlik' }) : null;
      for (const kind of usage?.kinds ?? []) await countUsage(db, batch, usage!.subject, kind, actor.uid);
      if (existing) {
        // Boşaltılan isteğe bağlı alanlar ve önceki ret bilgisi silinir; oluşturma tarihi ve katılım sayısı korunur.
        const removed = Object.fromEntries(Object.entries(optional).filter(([, v]) => v === undefined).map(([k]) => [k, deleteField()]));
        batch.update(ref, { ...data, ...removed, reviewNote: deleteField(), reviewedBy: deleteField() });
      } else batch.set(ref, { ...data, attendeeCount: 0, createdAt: serverTimestamp() });
      if (mode !== 'taslak') {
        audit(batch, { id: ref.id, author: p.author, region: data.region, title: data.title }, 'ekle', mode === 'yayinla' ? 'Etkinlik yayınlandı (onaysız)' : 'Etkinlik onaya gönderildi');
      }
      await batch.commit();
      return ref.id;
    },

    approve: (e: CityEvent) => review(e, { status: 'yayinda', publishedAt: serverTimestamp() }, 'onayla', 'Etkinlik onaylandı'),
    reject: (e: CityEvent, note: string) => review(e, { status: 'reddedildi', reviewNote: note.trim().slice(0, 300) }, 'onayla', 'Etkinlik reddedildi'),
    /** Yayından kaldırma (uygulamada görünmez) ya da iptal ("İptal edildi" etiketiyle bitişine kadar görünür). */
    unpublish: (e: CityEvent, asReviewer: boolean) => review(e, { status: 'kaldirildi' }, asReviewer ? 'onayla' : 'sil', 'Etkinlik yayından kaldırıldı'),
    cancel: (e: CityEvent, asReviewer: boolean) => review(e, { status: 'iptal' }, asReviewer ? 'onayla' : 'ekle', 'Etkinlik iptal edildi'),

    /** Adını paylaşmayı kabul eden katılanlar (organizatör yalnızca bunları görür). */
    async listNamedAttendees(eventId: string): Promise<string[]> {
      const snap = await getDocs(query(collection(db, COLLECTION, eventId, 'attendees'), where('shareName', '==', true), orderBy('createdAt', 'asc'), limit(1000)));
      return snap.docs.map((d) => d.get('displayName') as string).filter(Boolean);
    },
  };
}
