import { collection, doc, getDoc, getDocs, limit, orderBy, query, writeBatch, type DocumentData, type Firestore } from 'firebase/firestore';

import type { DutyPharmacy, DutyPharmacyDay } from '../pharmacy/pharmacy';
import { addAudit, iso } from './grants';

function dayFrom(d: DocumentData): DutyPharmacyDay {
  return {
    date: d.date,
    fetchedAt: iso(d.fetchedAt) ?? '',
    source: d.source ?? '',
    items: Array.isArray(d.items) ? (d.items as DutyPharmacy[]) : [],
    hidden: Array.isArray(d.hidden) ? d.hidden : [],
  };
}

/** Uygulama: ilin nöbetçi eczane belgesi (tek okuma). */
export function createPharmacyRepository(db: Firestore) {
  return {
    async get(provinceCode: string): Promise<DutyPharmacyDay | null> {
      const snap = await getDoc(doc(db, 'dutyPharmacies', provinceCode));
      return snap.exists() ? dayFrom(snap.data()) : null;
    },
  };
}

export interface PharmacySourceStatus {
  source: string;
  provinces: Record<string, { date: string | null; count: number; at: string; error?: string }>;
}
export interface DataSourceRun {
  id: string;
  at: string;
  source: string;
  ok: number;
  failed: number;
  by: string;
  errors: { code: string; error: string }[];
}

/**
 * Panel > Veri kaynakları: il başına son çekim (admin), çalışma geçmişi; il yöneticisi ve admin bir eczaneyi o gün için
 * gizler (servis yanlış bilgi verdiyse). Gizleme işlem kaydına girer.
 */
export function createPharmacyAdmin(db: Firestore, actorUid: string) {
  return {
    async status(): Promise<PharmacySourceStatus | null> {
      const snap = await getDoc(doc(db, 'dataSourceStatus', 'pharmacy'));
      if (!snap.exists()) return null;
      const d = snap.data();
      const provinces: PharmacySourceStatus['provinces'] = {};
      for (const [k, v] of Object.entries((d.provinces ?? {}) as Record<string, DocumentData>)) {
        provinces[k] = { date: v.date ?? null, count: v.count ?? 0, at: iso(v.at) ?? '', ...(v.error ? { error: v.error } : {}) };
      }
      return { source: d.source ?? '', provinces };
    },
    async runs(): Promise<DataSourceRun[]> {
      const snap = await getDocs(query(collection(db, 'dataSourceRuns'), orderBy('at', 'desc'), limit(10)));
      return snap.docs.map((s) => ({ id: s.id, at: iso(s.data().at) ?? '', source: s.data().source, ok: s.data().ok, failed: s.data().failed, by: s.data().by, errors: s.data().errors ?? [] }));
    },
    get: async (provinceCode: string) => createPharmacyRepository(db).get(provinceCode),
    async setHidden(provinceCode: string, hidden: string[], summary: string): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, 'dutyPharmacies', provinceCode), { hidden: hidden.slice(0, 200) });
      addAudit(db, batch, { actorUid, module: 'acil-numaralar', action: 'duzenle', targetId: `dutyPharmacies/${provinceCode}`, scope: { level: 'il', provinceCode }, summary: `Nöbetçi eczane: ${summary}`.slice(0, 120) });
      await batch.commit();
    },
  };
}
