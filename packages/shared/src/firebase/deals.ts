import {
  collection,
  deleteField,
  doc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';

import type { Business } from '../business/business';
import { sortDeals, type Deal, type DealInput, type DealReportReason, type DealStatus } from '../deals/deals';
import { addAudit } from './grants';

const COLLECTION = 'deals';
const REPORTS = 'dealReports';

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === 'string' ? v : '');

const fromDoc = (id: string, d: DocumentData): Deal => ({
  ...(d as Deal),
  id,
  stats: { views: d.stats?.views ?? 0, codeViews: d.stats?.codeViews ?? 0, calls: d.stats?.calls ?? 0 },
  reportCount: d.reportCount ?? 0,
  changedAt: iso(d.changedAt) || undefined,
  createdAt: iso(d.createdAt),
  updatedAt: iso(d.updatedAt),
});

/** Boş isteğe bağlı alanlar yazılmaz; kod yalnızca "kod" kullanımında. */
const clean = (d: DealInput) => ({
  businessId: d.businessId,
  category: d.category,
  kind: d.kind,
  value: d.value.trim(),
  title: d.title.trim(),
  ...(d.when?.trim() ? { when: d.when.trim() } : {}),
  ...(d.terms?.trim() ? { terms: d.terms.trim() } : {}),
  usage: d.usage,
  ...(d.usage === 'kod' && d.code?.trim() ? { code: d.code.trim().toUpperCase() } : {}),
  endsOn: d.endsOn,
});

/** Uygulama: ilin açık fırsatları, işletmenin fırsatları ve işletme sahibinin yönetimi. */
export function createFirestoreDealRepository(db: Firestore) {
  const ref = (id: string) => doc(db, COLLECTION, id);
  return {
    /** İlin açık fırsatları (en çok 200; süre ve kategori telefonda süzülür, tek eşitlik sorgusu dizin istemez). */
    async listActive(provinceCode: string): Promise<Deal[]> {
      const s = await getDocs(query(collection(db, COLLECTION), where('provinceCode', '==', provinceCode), where('status', '==', 'aktif'), limit(200)));
      return sortDeals(s.docs.map((d) => fromDoc(d.id, d.data())));
    },
    /** İşletme sayfasındaki fırsat kutusu. */
    async listForBusiness(businessId: string): Promise<Deal[]> {
      const s = await getDocs(query(collection(db, COLLECTION), where('businessId', '==', businessId), where('status', '==', 'aktif'), limit(10)));
      return sortDeals(s.docs.map((d) => fromDoc(d.id, d.data())));
    },
    /** Fırsatlarım: işletmenin tüm fırsatları (durdurulan ve bitenler dahil). */
    async listMine(businessId: string, ownerUid: string): Promise<Deal[]> {
      const s = await getDocs(query(collection(db, COLLECTION), where('businessId', '==', businessId), where('ownerUid', '==', ownerUid), limit(100)));
      return s.docs.map((d) => fromDoc(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    /** Yeni fırsat ya da düzenleme. Yayındaki fırsatın değeri / şartı değişirse "güncellendi" işareti konur. */
    async save(id: string | null, input: DealInput, biz: Business, before?: Deal): Promise<string> {
      const r = id ? ref(id) : doc(collection(db, COLLECTION));
      const data = clean(input);
      const batch = writeBatch(db);
      if (!id) {
        batch.set(r, {
          ...data,
          businessName: biz.name,
          provinceCode: biz.location.provinceCode,
          districtId: biz.location.districtId,
          ownerUid: biz.ownerUid,
          status: 'aktif',
          stats: { views: 0, codeViews: 0, calls: 0 },
          reportCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const changed = !!before && (before.value !== data.value || (before.terms ?? '') !== (data.terms ?? '') || (before.when ?? '') !== (data.when ?? '') || before.title !== data.title);
        batch.update(r, {
          ...data,
          when: data.when ?? deleteField(),
          terms: data.terms ?? deleteField(),
          code: data.code ?? deleteField(),
          businessName: biz.name,
          ...(changed ? { changedAt: serverTimestamp() } : {}),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      return r.id;
    },
    /** Durdur / yeniden aç / bitir (işletme sahibi). */
    async setStatus(id: string, status: Exclude<DealStatus, 'gizlendi'>) {
      const batch = writeBatch(db);
      batch.update(ref(id), { status, updatedAt: serverTimestamp() });
      await batch.commit();
    },
    /** Görüntülenme, kod açılma, arama sayacı (oturum başına bir kez telefonda sınırlanır). */
    async count(id: string, field: 'views' | 'codeViews' | 'calls') {
      const batch = writeBatch(db);
      batch.update(ref(id), { [`stats.${field}`]: increment(1) });
      await batch.commit().catch(() => {});
    },
    /** Şikâyet: kişi başına bir kez; sayaç aynı yazımda artar, panelde il yöneticisi görür. */
    async report(deal: Deal, uid: string, reason: DealReportReason) {
      const batch = writeBatch(db);
      batch.set(doc(db, REPORTS, `${deal.id}_${uid}`), { dealId: deal.id, uid, reason, provinceCode: deal.provinceCode, createdAt: serverTimestamp() });
      batch.update(ref(deal.id), { reportCount: increment(1) });
      await batch.commit();
    },
  };
}

/** İşletme silinirken fırsatları da silinir. */
export async function deleteDealsOf(db: Firestore, batch: WriteBatch, businessId: string, ownerUid: string) {
  const s = await getDocs(query(collection(db, COLLECTION), where('businessId', '==', businessId), where('ownerUid', '==', ownerUid)));
  s.docs.forEach((d) => batch.delete(d.ref));
}

/** Panel > Fırsatlar: il yöneticisi kendi ilinin fırsatlarını görür, gizler ya da geri açar (işlem kaydıyla). */
export function createDealModeration(db: Firestore, actorUid: string) {
  return {
    async list(provinceCode: string): Promise<Deal[]> {
      const s = await getDocs(query(collection(db, COLLECTION), where('provinceCode', '==', provinceCode), limit(300)));
      return s.docs.map((d) => fromDoc(d.id, d.data())).sort((a, b) => b.reportCount - a.reportCount || b.createdAt.localeCompare(a.createdAt));
    },
    async setHidden(d: Deal, hidden: boolean, reason: string) {
      const batch = writeBatch(db);
      batch.update(doc(db, COLLECTION, d.id), { status: hidden ? 'gizlendi' : 'durduruldu', moderatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, {
        actorUid,
        module: 'moderasyon',
        action: 'duzenle',
        targetId: d.id,
        summary: `Fırsat ${hidden ? 'gizlendi' : 'geri açıldı (işletme yeniden başlatır)'}: ${d.businessName} · ${d.value} ${d.title}${reason ? ` (${reason})` : ''}`,
        scope: { level: 'il', provinceCode: d.provinceCode },
      });
      await batch.commit();
    },
    /** Sponsorlu öne çıkma (yalnızca Pro işletme; admin). */
    async setSponsored(d: Deal, sponsored: boolean) {
      const batch = writeBatch(db);
      batch.update(doc(db, COLLECTION, d.id), { sponsored, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: d.id, summary: `Fırsat sponsorlu ${sponsored ? 'yapıldı' : 'kaldırıldı'}: ${d.businessName}`, scope: { level: 'il', provinceCode: d.provinceCode } });
      await batch.commit();
    },
  };
}
