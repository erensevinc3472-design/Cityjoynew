import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { cleanPushTarget } from '../announcements/push-target';
import { sha256Hex } from '../organizations/content-stats';
import { adminPushScope, type AdminPush } from '../notifications/admin-push';
import { addAudit, iso } from './grants';

const PUSHES = 'adminPushes';
const BILLING = 'adminPushBilling';
const OPENS = 'adminPushOpens';

/** Reklam ücreti ve fatura (yalnızca admin görür; ödeme ilk sürümde uygulama dışında). */
export interface AdminPushBilling {
  amount?: number;
  invoiceNo?: string;
  note?: string;
}

export function adminPushFromDoc(id: string, d: DocumentData): AdminPush {
  return {
    id,
    kind: d.kind,
    title: d.title,
    body: d.body,
    region: d.region ?? {},
    scope: d.scope,
    ...(d.target ? { target: d.target } : {}),
    link: d.link ?? { type: 'yok' },
    ...(d.business ? { business: d.business } : {}),
    ...(typeof d.image === 'string' ? { image: d.image } : {}),
    status: d.status,
    sendAt: iso(d.sendAt) ?? '',
    createdBy: d.createdBy,
    createdAt: iso(d.createdAt) ?? '',
    ...(d.sentAt ? { sentAt: iso(d.sentAt) } : {}),
    ...(typeof d.recipients === 'number' ? { recipients: d.recipients } : {}),
    ...(d.skipped ? { skipped: d.skipped } : {}),
  };
}

export type AdminPushInput = Pick<AdminPush, 'kind' | 'title' | 'body' | 'region' | 'target' | 'link' | 'business' | 'sendAt' | 'image'>;

/** Panel (yalnızca admin): bildirim hazırla / planla, iptal et, listele; açılma sayısı. Her işlem kayda girer. */
export function createAdminPushPanel(db: Firestore, actorUid: string) {
  return {
    async list(): Promise<AdminPush[]> {
      const snap = await getDocs(query(collection(db, PUSHES), orderBy('createdAt', 'desc'), limit(50)));
      return snap.docs.map((d) => adminPushFromDoc(d.id, d.data()));
    },
    async create(input: AdminPushInput, billing?: AdminPushBilling): Promise<string> {
      const ref = doc(collection(db, PUSHES));
      const region = Object.fromEntries(Object.entries(input.region).filter(([, v]) => !!v));
      const target = cleanPushTarget(input.target);
      const batch = writeBatch(db);
      batch.set(ref, {
        kind: input.kind,
        title: input.title.trim(),
        body: input.body.trim(),
        region,
        scope: adminPushScope(region),
        ...(target ? { target } : {}),
        link: input.link,
        ...(input.kind === 'reklam' && input.business ? { business: input.business } : {}),
        ...(input.link.type === 'gonderi' && input.image ? { image: input.image } : {}),
        status: 'planli',
        sendAt: Timestamp.fromDate(new Date(input.sendAt)),
        createdBy: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const clean = billing && Object.fromEntries(Object.entries(billing).filter(([, v]) => v !== undefined && v !== ''));
      if (clean && Object.keys(clean).length) batch.set(doc(db, BILLING, ref.id), { ...clean, updatedAt: serverTimestamp() });
      addAudit(db, batch, {
        actorUid, module: 'bildirimler', action: 'ekle', targetId: ref.id, scope: { level: 'ulke' },
        summary: `Bildirim (${input.kind}): ${input.title.trim().slice(0, 60)}${input.business ? ` · ${input.business.name}` : ''}`,
      });
      await batch.commit();
      return ref.id;
    },
    async cancel(p: AdminPush): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, PUSHES, p.id), { status: 'iptal', updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'bildirimler', action: 'sil', targetId: p.id, scope: { level: 'ulke' }, summary: `Bildirim iptal: ${p.title.slice(0, 60)}` });
      await batch.commit();
    },
    async billing(id: string): Promise<AdminPushBilling | null> {
      const snap = await getDoc(doc(db, BILLING, id));
      return snap.exists() ? (snap.data() as AdminPushBilling) : null;
    },
    async opens(id: string): Promise<number | null> {
      try {
        return (await getCountFromServer(query(collection(db, OPENS), where('push', '==', id)))).data().count;
      } catch {
        return null;
      }
    },
  };
}

/** Uygulama: kişinin ilindeki ve ülke genelindeki gönderilmiş admin bildirimleri (son 20; süzme telefonda). */
export function createAdminPushFeed(db: Firestore) {
  return {
    async listSent(provinceCode?: string): Promise<AdminPush[]> {
      const scopes = provinceCode ? [provinceCode, 'TR'] : ['TR'];
      const snap = await getDocs(query(collection(db, PUSHES), where('status', '==', 'gonderildi'), where('scope', 'in', scopes), orderBy('sentAt', 'desc'), limit(20)));
      return snap.docs.map((d) => adminPushFromDoc(d.id, d.data()));
    },
  };
}

/** Admin bildiriminin açılması: kişi başına bir kez; belge adı karma (kişi kaydedilmez). */
export function createAdminPushOpens(db: Firestore) {
  const done = new Set<string>();
  return {
    async record(pushId: string, uid: string): Promise<void> {
      if (done.has(pushId)) return;
      done.add(pushId);
      await setDoc(doc(db, OPENS, `${pushId}_${sha256Hex(uid + pushId)}`), { push: pushId, at: serverTimestamp() }).catch(() => {});
    },
  };
}
