import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
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

import {
  ANNOUNCEMENT_LIMITS,
  type Announcement,
  type AnnouncementAuthor,
  type AnnouncementInput,
  type AnnouncementRegion,
  type Publisher,
} from '../announcements/announcements';
import type { Action, RegionScope } from '../permissions/types';
import { addAudit, iso } from './grants';

const COLLECTION = 'announcements';

function fromDoc(id: string, d: DocumentData): Announcement {
  return {
    id,
    kind: d.kind,
    title: d.title,
    body: d.body,
    region: d.region,
    ...(d.endsAt ? { endsAt: iso(d.endsAt) } : {}),
    ...(d.pinned === true ? { pinned: true } : {}),
    ...(d.category ? { category: d.category } : {}),
    author: d.author,
    status: d.status,
    preparedBy: d.preparedBy,
    preparedByName: d.preparedByName ?? '',
    createdAt: iso(d.createdAt) ?? '',
    updatedAt: iso(d.updatedAt) ?? new Date().toISOString(),
    ...(d.publishedAt ? { publishedAt: iso(d.publishedAt) } : {}),
    ...(d.reviewedBy ? { reviewedBy: d.reviewedBy } : {}),
    ...(d.reviewNote ? { reviewNote: d.reviewNote } : {}),
  };
}

/** Uygulama: kullanıcının ilinde yayındaki duyurular (tek sorgu; ilçe / mahalle süzmesi telefonda). */
export function createFirestoreAnnouncementRepository(db: Firestore) {
  return {
    async listLive(provinceCode: string): Promise<Announcement[]> {
      const q = query(
        collection(db, COLLECTION),
        where('status', '==', 'yayinda'),
        where('region.provinceCode', '==', provinceCode),
        orderBy('publishedAt', 'desc'),
        limit(50),
      );
      return (await getDocs(q)).docs.map((d) => fromDoc(d.id, d.data()));
    },
    async get(id: string): Promise<Announcement | null> {
      const snap = await getDoc(doc(db, COLLECTION, id));
      return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },
  };
}

const regionScope = (r: AnnouncementRegion): RegionScope =>
  r.neighbourhoodId && r.districtId
    ? { level: 'mahalle', provinceCode: r.provinceCode, districtId: r.districtId, neighbourhoodId: r.neighbourhoodId }
    : r.districtId
      ? { level: 'ilce', provinceCode: r.provinceCode, districtId: r.districtId }
      : { level: 'il', provinceCode: r.provinceCode };

const cleanRegion = (r: AnnouncementRegion): AnnouncementRegion => ({
  provinceCode: r.provinceCode,
  ...(r.districtId ? { districtId: r.districtId } : {}),
  ...(r.districtId && r.neighbourhoodId ? { neighbourhoodId: r.neighbourhoodId } : {}),
});

export type SaveMode = 'taslak' | 'onaya' | 'yayinla';

/**
 * Panel: duyuru hazırlama, onaya gönderme, onaylama / reddetme ve yayından kaldırma. Her yönetici işlemi işlem
 * kaydına yazılır (kurum personeli kurum kimliğiyle). Asıl yetki denetimi kurallarda.
 */
export function createAnnouncementPanel(db: Firestore, actor: { uid: string; name: string }) {
  const audit = (batch: ReturnType<typeof writeBatch>, a: { id: string; author: AnnouncementAuthor; region: AnnouncementRegion; title: string }, action: Action, summary: string) =>
    addAudit(db, batch, {
      actorUid: actor.uid,
      module: 'gonderiler',
      action,
      targetId: a.id,
      scope: regionScope(a.region),
      ...(a.author.type === 'kurum' ? { orgId: a.author.orgId } : {}),
      summary: `${summary}: ${a.title.slice(0, 60)}`,
    });
  const list = async (...constraints: QueryConstraint[]) =>
    (await getDocs(query(collection(db, COLLECTION), ...constraints, limit(200)))).docs
      .map((d) => fromDoc(d.id, d.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    /** Yayınlayan hesabın duyuruları: kurumda kurumun hepsi, kişide kendi hazırladıkları. */
    listFor: (p: Publisher) =>
      p.author.type === 'kurum'
        ? list(where('author.type', '==', 'kurum'), where('author.orgId', '==', p.author.orgId))
        : list(where('preparedBy', '==', actor.uid)),

    /** Onay bekleyenler: kurumda kurumunkiler; il yöneticisinde ilindeki muhtar duyuruları; admin'de hepsi. */
    listPending: (by: { orgId: string } | { provinceCode: string } | 'admin') =>
      by === 'admin'
        ? list(where('status', '==', 'onay-bekliyor'))
        : 'orgId' in by
          ? list(where('author.type', '==', 'kurum'), where('author.orgId', '==', by.orgId), where('status', '==', 'onay-bekliyor'))
          : list(where('author.type', '==', 'kisi'), where('region.provinceCode', '==', by.provinceCode), where('status', '==', 'onay-bekliyor')),

    /** Yeni ya da var olan (taslak / reddedilen / onay bekleyen) duyuruyu kaydeder. */
    async save(p: Publisher, input: AnnouncementInput, mode: SaveMode, existing?: Announcement): Promise<string> {
      const ref = existing ? doc(db, COLLECTION, existing.id) : doc(collection(db, COLLECTION));
      const status = mode === 'taslak' ? 'taslak' : mode === 'onaya' ? 'onay-bekliyor' : 'yayinda';
      const data = {
        kind: input.kind,
        title: input.title.trim().slice(0, ANNOUNCEMENT_LIMITS.title[1]),
        body: input.body.trim().slice(0, ANNOUNCEMENT_LIMITS.body[1]),
        region: cleanRegion(input.region),
        ...(input.endsAt ? { endsAt: Timestamp.fromDate(new Date(input.endsAt)) } : {}),
        ...(input.pinned ? { pinned: true } : {}),
        ...(input.kind === 'haber' && input.category ? { category: input.category } : {}),
        author: p.author,
        status,
        preparedBy: actor.uid,
        preparedByName: actor.name.slice(0, 80),
        updatedAt: serverTimestamp(),
        ...(status === 'yayinda' ? { publishedAt: serverTimestamp() } : {}),
      };
      const batch = writeBatch(db);
      // Düzenlemede oluşturma tarihi korunur; boşaltılan bitiş, kaldırılan sabitleme ve önceki ret bilgisi silinir.
      if (existing) {
        batch.update(ref, {
          ...data,
          ...(input.endsAt ? {} : { endsAt: deleteField() }),
          ...(input.pinned ? {} : { pinned: deleteField() }),
          ...(input.kind === 'haber' ? {} : { category: deleteField() }),
          reviewNote: deleteField(),
          reviewedBy: deleteField(),
        });
      } else batch.set(ref, { ...data, createdAt: serverTimestamp() });
      if (mode !== 'taslak') {
        audit(batch, { id: ref.id, author: p.author, region: data.region, title: data.title }, 'ekle', mode === 'yayinla' ? 'Duyuru yayınlandı (onaysız)' : 'Duyuru onaya gönderildi');
      }
      await batch.commit();
      return ref.id;
    },

    async approve(a: Announcement): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, COLLECTION, a.id), { status: 'yayinda', publishedAt: serverTimestamp(), reviewedBy: actor.uid, updatedAt: serverTimestamp() });
      audit(batch, a, 'onayla', 'Duyuru onaylandı');
      await batch.commit();
    },

    async reject(a: Announcement, note: string): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, COLLECTION, a.id), { status: 'reddedildi', reviewNote: note.trim().slice(0, ANNOUNCEMENT_LIMITS.reviewNote[1]), reviewedBy: actor.uid, updatedAt: serverTimestamp() });
      audit(batch, a, 'onayla', 'Duyuru reddedildi');
      await batch.commit();
    },

    /** Yayından kaldırma: onaylayan (asReviewer) ya da "Sil" yetkisi olan hazırlayan. */
    async unpublish(a: Announcement, asReviewer: boolean): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, COLLECTION, a.id), { status: 'kaldirildi', reviewedBy: actor.uid, updatedAt: serverTimestamp() });
      audit(batch, a, asReviewer ? 'onayla' : 'sil', 'Duyuru yayından kaldırıldı');
      await batch.commit();
    },
  };
}
