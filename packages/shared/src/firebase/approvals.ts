import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import {
  APPROVAL_NOTE_LIMIT,
  approvalDocId,
  isHighRisk,
  PENDING_STATUSES,
  trustedApproverDocId,
  validRejectReason,
  type Approval,
  type ApprovalStep,
  type TrustedApprover,
} from '../approvals/approvals';
import type { Business } from '../business/business';
import { normalizeEmail } from '../permissions/grants';
import type { Module, RegionScope } from '../permissions/types';
import { addAudit, iso } from './grants';

const APPROVALS = 'approvals';
const TRUSTED = 'trustedApprovers';

const KIND_LABEL: Record<string, string> = { 'isletme-dogrulama': 'İşletme doğrulaması' };

function fromDoc(id: string, d: DocumentData): Approval {
  const step = (s: DocumentData | undefined): ApprovalStep | undefined => (s ? { uid: s.uid, email: s.email, name: s.name, at: iso(s.at) ?? '' } : undefined);
  return {
    id,
    kind: d.kind,
    module: d.module,
    targetId: d.targetId,
    title: d.title,
    region: d.region,
    status: d.status,
    requestedBy: d.requestedBy,
    requestedAt: iso(d.requestedAt) ?? '',
    ...(d.note ? { note: d.note } : {}),
    ...(d.firstApproval ? { firstApproval: step(d.firstApproval) } : {}),
    ...(d.decision ? { decision: { uid: d.decision.uid, at: iso(d.decision.at) ?? '', stage: d.decision.stage, ...(d.decision.reason ? { reason: d.decision.reason } : {}) } } : {}),
  };
}

const businessRegion = (b: Business) => ({ provinceCode: b.location.provinceCode, districtId: b.location.districtId });
const scopeOf = (a: Pick<Approval, 'region'>): RegionScope =>
  a.region.districtId ? { level: 'ilce', provinceCode: a.region.provinceCode, districtId: a.region.districtId } : { level: 'il', provinceCode: a.region.provinceCode };
const cleanNote = (note?: string) => (note?.trim() ? { note: note.trim().slice(0, APPROVAL_NOTE_LIMIT) } : {});

/**
 * Uygulama (İşletmem): işletme sahibi doğrulama ister, isteğinin durumunu görür, geri çeker. İstek önce il
 * yöneticisine, sonra admin'e gider (PROJE.md 6.5). Reddedilen istek yeniden gönderilebilir.
 */
export function createVerificationRequests(db: Firestore) {
  const ref = (businessId: string) => doc(db, APPROVALS, approvalDocId('isletme-dogrulama', businessId));
  return {
    async get(businessId: string): Promise<Approval | null> {
      const snap = await getDoc(ref(businessId));
      return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },

    async request(uid: string, b: Business, note?: string): Promise<void> {
      await setDoc(ref(b.id), {
        kind: 'isletme-dogrulama',
        module: 'isletme-dogrulama',
        targetId: b.id,
        title: b.name,
        region: businessRegion(b),
        status: 'il-onayi-bekliyor',
        requestedBy: uid,
        requestedAt: serverTimestamp(),
        ...cleanNote(note),
        updatedAt: serverTimestamp(),
      });
    },

    cancel: (businessId: string) => deleteDoc(ref(businessId)),
  };
}

/** İşletme silinirken doğrulama isteği de silinir (toplu yazıma eklenir). */
export async function deleteVerificationRequest(db: Firestore, batch: ReturnType<typeof writeBatch>, businessId: string) {
  const ref = doc(db, APPROVALS, approvalDocId('isletme-dogrulama', businessId));
  if ((await getDoc(ref)).exists()) batch.delete(ref);
}

export interface ApprovalActor {
  uid: string;
  email: string;
  name: string;
}

export interface TrustedApproverInput {
  email: string;
  displayName: string;
  provinceCode: string;
  districtId?: string;
  modules: Module[];
}

/** Toplu yazım sınırı 500; her onay 3 yazım (istek, hedef kayıt, işlem kaydı). */
const CHUNK = 150;

/**
 * Panel: Bekleyen onaylar. İl yöneticisi 1. aşamayı (kendi ilinde) onaylar ya da reddeder; admin son kararı verir,
 * tek tek ya da toplu. Onaylanan işletme doğrulaması aynı toplu yazımda işletmeye işlenir. Her karar işlem kaydına.
 */
export function createApprovalAdmin(db: Firestore, actor: ApprovalActor) {
  const step = () => ({ uid: actor.uid, email: normalizeEmail(actor.email), name: actor.name.slice(0, 80), at: serverTimestamp() });
  const audit = (batch: ReturnType<typeof writeBatch>, a: Pick<Approval, 'id' | 'kind' | 'title' | 'region'>, summary: string) =>
    addAudit(db, batch, {
      actorUid: actor.uid,
      module: 'onaylar',
      action: 'onayla',
      targetId: a.id,
      scope: scopeOf(a),
      summary: `${summary}: ${KIND_LABEL[a.kind] ?? a.kind}, ${a.title}`,
    });
  const list = async (...filters: ReturnType<typeof where>[]) =>
    (await getDocs(query(collection(db, APPROVALS), ...filters, limit(1000)))).docs.map((d) => fromDoc(d.id, d.data()));

  return {
    /** Bekleyenler, eskiden yeniye. İl yöneticisi il vererek okur (kurallar başka ili okutmaz). */
    async listPending(provinceCode?: string): Promise<Approval[]> {
      const filters = [where('status', 'in', PENDING_STATUSES)];
      if (provinceCode) filters.unshift(where('region.provinceCode', '==', provinceCode));
      return (await list(...filters)).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
    },

    /** Son sonuçlananlar (onaylanan ve reddedilen), yeniden eskiye. */
    async listDecided(provinceCode?: string): Promise<Approval[]> {
      const constraints = [where('status', 'in', ['onaylandi', 'reddedildi']), orderBy('updatedAt', 'desc'), limit(100)];
      if (provinceCode) constraints.unshift(where('region.provinceCode', '==', provinceCode));
      return (await getDocs(query(collection(db, APPROVALS), ...constraints))).docs.map((d) => fromDoc(d.id, d.data()));
    },

    /** İl yöneticisi: istek gelmemiş bir işletmeyi kendisi doğrulamaya önerir (1. aşama onaylı olarak admin'e gider). */
    async proposeBusiness(b: Business, note?: string): Promise<void> {
      const id = approvalDocId('isletme-dogrulama', b.id);
      const batch = writeBatch(db);
      batch.set(doc(db, APPROVALS, id), {
        kind: 'isletme-dogrulama',
        module: 'isletme-dogrulama',
        targetId: b.id,
        title: b.name,
        region: businessRegion(b),
        status: 'admin-onayi-bekliyor',
        requestedBy: actor.uid,
        requestedAt: serverTimestamp(),
        ...cleanNote(note),
        firstApproval: step(),
        updatedAt: serverTimestamp(),
      });
      audit(batch, { id, kind: 'isletme-dogrulama', title: b.name, region: businessRegion(b) }, 'Onaya gönderildi (1. aşama onaylı)');
      await batch.commit();
    },

    /** 1. aşama (il yöneticisi): onaylanan iş admin'e gider. */
    async approveFirst(a: Approval): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, APPROVALS, a.id), { status: 'admin-onayi-bekliyor', firstApproval: step(), updatedAt: serverTimestamp() });
      audit(batch, a, '1. aşama onaylandı');
      await batch.commit();
    },

    /** Ret (gerekçe zorunlu). Admin her aşamada reddedebilir; il yöneticisi yalnızca 1. aşamada. */
    async reject(a: Approval, reason: string, asAdmin: boolean): Promise<void> {
      if (!validRejectReason(reason)) throw new Error('reason');
      const batch = writeBatch(db);
      batch.update(doc(db, APPROVALS, a.id), {
        status: 'reddedildi',
        decision: { uid: actor.uid, at: serverTimestamp(), stage: asAdmin ? 2 : 1, reason: reason.trim() },
        updatedAt: serverTimestamp(),
      });
      audit(batch, a, `Reddedildi (${asAdmin ? 2 : 1}. aşama)`);
      await batch.commit();
    },

    /**
     * Admin: son onay, tek ya da toplu. Yüksek riskli işler yalnızca tek tek onaylanır. Her iş ayrı ayrı işlem
     * kaydına yazılır (toplu onay da). Dönen sayı onaylanan iş sayısıdır.
     */
    async approveFinal(items: Approval[], opts: { bulk: boolean }): Promise<number> {
      const chosen = opts.bulk ? items.filter((a) => !isHighRisk(a)) : items;
      for (let i = 0; i < chosen.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const a of chosen.slice(i, i + CHUNK)) {
          batch.update(doc(db, APPROVALS, a.id), { status: 'onaylandi', decision: { uid: actor.uid, at: serverTimestamp(), stage: 2 }, updatedAt: serverTimestamp() });
          if (a.kind === 'isletme-dogrulama') {
            batch.update(doc(db, 'businesses', a.targetId), { verification: { status: 'dogrulandi', verifiedAt: serverTimestamp() } });
          }
          audit(batch, a, opts.bulk ? 'Onaylandı (toplu)' : 'Onaylandı');
        }
        await batch.commit();
      }
      return chosen.length;
    },

    // ---- Güvenilir yöneticiler (yalnızca admin) ----

    async listTrusted(): Promise<TrustedApprover[]> {
      const snap = await getDocs(query(collection(db, TRUSTED), limit(500)));
      return snap.docs
        .map((d) => {
          const x = d.data();
          return {
            id: d.id,
            email: x.email,
            displayName: x.displayName,
            provinceCode: x.provinceCode,
            ...(x.districtId ? { districtId: x.districtId } : {}),
            modules: x.modules ?? [],
            addedBy: x.addedBy,
            addedAt: iso(x.addedAt) ?? '',
            ...(x.removedAt ? { removedAt: iso(x.removedAt) ?? new Date().toISOString() } : {}),
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
    },

    /** Ekleme ya da değiştirme (listeden çıkarılmış biri yeniden eklenebilir). */
    async saveTrusted(input: TrustedApproverInput): Promise<string> {
      const id = trustedApproverDocId(input.email, input.provinceCode, input.districtId);
      const scope: RegionScope = input.districtId
        ? { level: 'ilce', provinceCode: input.provinceCode, districtId: input.districtId }
        : { level: 'il', provinceCode: input.provinceCode };
      const batch = writeBatch(db);
      batch.set(doc(db, TRUSTED, id), {
        email: normalizeEmail(input.email),
        displayName: input.displayName.trim().slice(0, 80),
        provinceCode: input.provinceCode,
        ...(input.districtId ? { districtId: input.districtId } : {}),
        modules: input.modules,
        addedBy: actor.uid,
        addedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      addAudit(db, batch, {
        actorUid: actor.uid,
        module: 'onaylar',
        action: 'duzenle',
        targetId: id,
        scope,
        summary: `Güvenilir yönetici: ${input.modules.length ? input.modules.join(', ') : 'tüm kategoriler'}`,
      });
      await batch.commit();
      return id;
    },

    async removeTrusted(t: TrustedApprover): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, TRUSTED, t.id), { removedAt: serverTimestamp(), removedBy: actor.uid, updatedAt: serverTimestamp() });
      addAudit(db, batch, {
        actorUid: actor.uid,
        module: 'onaylar',
        action: 'sil',
        targetId: t.id,
        scope: t.districtId ? { level: 'ilce', provinceCode: t.provinceCode, districtId: t.districtId } : { level: 'il', provinceCode: t.provinceCode },
        summary: 'Güvenilir yönetici listesinden çıkarıldı',
      });
      await batch.commit();
    },
  };
}
