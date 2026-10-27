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
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';

import { grantDocId, normalizeModules, type AccessRequest, type GrantRecord } from '../permissions/grants';
import type { Action, AuditLogEntry, Module, RegionScope, Role } from '../permissions/types';

const GRANTS = 'grants';
const REQUESTS = 'accessRequests';
const AUDIT = 'auditLog';

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : undefined);

function fromDoc(id: string, d: DocumentData): GrantRecord {
  return {
    id,
    uid: d.uid,
    role: d.role,
    scope: d.scope,
    modules: d.modules ?? {},
    grantedBy: d.grantedBy,
    grantedAt: iso(d.grantedAt) ?? '',
    displayName: d.displayName ?? '',
    ...(d.email ? { email: d.email } : {}),
    ...(d.note ? { note: d.note } : {}),
    ...(d.expiresAt ? { expiresAt: iso(d.expiresAt) } : {}),
    ...(d.revokedAt ? { revokedAt: iso(d.revokedAt) ?? new Date().toISOString() } : {}),
    ...(d.revokedBy ? { revokedBy: d.revokedBy } : {}),
  };
}

/** Panel oturumu: kişinin kendine verilmiş yetkileri (geri alınanlar ve süresi dolanlar da gelir, süzme çağıranda). */
export async function loadOwnGrants(db: Firestore, uid: string): Promise<GrantRecord[]> {
  const snap = await getDocs(query(collection(db, GRANTS), where('uid', '==', uid)));
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

/** Yetkisi olmayan kişi panelden yetki talebi gönderir (kişi başına bir talep, günde bir kez yenilenir). */
export async function submitAccessRequest(
  db: Firestore,
  me: { uid: string; displayName: string; email: string },
  note: string,
): Promise<void> {
  await setDoc(doc(db, REQUESTS, me.uid), {
    uid: me.uid,
    displayName: me.displayName.trim().slice(0, 80),
    email: me.email,
    note: note.trim().slice(0, 300),
    status: 'yeni',
    createdAt: serverTimestamp(),
  });
}

export async function getOwnAccessRequest(db: Firestore, uid: string): Promise<AccessRequest | null> {
  const snap = await getDoc(doc(db, REQUESTS, uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { uid, displayName: d.displayName, email: d.email, note: d.note, status: d.status, createdAt: iso(d.createdAt) ?? '' };
}

/** Hesap silinirken kişinin yetki talebi de silinir (KVKK). Verilmiş yetkiler yönetim kaydı olarak kalır. */
export async function deleteOwnAccessRequest(db: Firestore, uid: string): Promise<void> {
  await deleteDoc(doc(db, REQUESTS, uid)).catch(() => {});
}

export interface GrantInput {
  uid: string;
  displayName: string;
  email?: string;
  note?: string;
  role: Exclude<Role, 'admin'>;
  scope: RegionScope;
  modules: Partial<Record<Module, Action[]>>;
  expiresAt?: Date;
}

const scopeSummary = (s: RegionScope) =>
  s.level === 'ulke' ? 'ülke' : s.level === 'il' ? `il ${s.provinceCode}` : s.level === 'ilce' ? `ilçe ${s.districtId}` : `mahalle ${s.neighbourhoodId}`;

/**
 * Yetki yönetimi (yalnızca admin; PROJE.md 6, 6.4 madde 2). Her verme, değiştirme ve geri alma aynı toplu
 * yazımda işlem kaydına da eklenir; kayıt yazılamazsa yetki de değişmez.
 */
export function createGrantAdmin(db: Firestore, actorUid: string) {
  const audit = (batch: WriteBatch, action: Action, targetId: string, summary: string, scope?: RegionScope) => {
    const module: Module = 'yetkiler';
    const region =
      scope && scope.level !== 'ulke'
        ? {
            provinceCode: scope.provinceCode,
            ...(scope.level !== 'il' ? { districtId: scope.districtId } : {}),
            ...(scope.level === 'mahalle' ? { neighbourhoodId: scope.neighbourhoodId } : {}),
          }
        : undefined;
    batch.set(doc(collection(db, AUDIT)), {
      actorUid,
      module,
      action,
      targetId,
      ...(region ? { region } : {}),
      at: serverTimestamp(),
      summary,
    });
  };

  return {
    async listAll(): Promise<GrantRecord[]> {
      const snap = await getDocs(query(collection(db, GRANTS), orderBy('updatedAt', 'desc'), limit(500)));
      return snap.docs.map((d) => fromDoc(d.id, d.data()));
    },

    /** Yeni yetki ya da var olanı değiştirme. Aynı kişiye aynı bölgede ikinci yetki açılmaz, var olan güncellenir. */
    async save(input: GrantInput, isNew: boolean): Promise<string> {
      const id = grantDocId(input.uid, input.scope);
      const modules = normalizeModules(input.modules);
      const batch = writeBatch(db);
      batch.set(doc(db, GRANTS, id), {
        uid: input.uid,
        displayName: input.displayName.trim().slice(0, 80),
        ...(input.email ? { email: input.email.trim().slice(0, 120) } : {}),
        ...(input.note?.trim() ? { note: input.note.trim().slice(0, 300) } : {}),
        role: input.role,
        scope: input.scope,
        modules,
        ...(input.expiresAt ? { expiresAt: Timestamp.fromDate(input.expiresAt) } : {}),
        grantedBy: actorUid,
        grantedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Kayda kişisel veri yazılmaz: ad ve e-posta yerine kimlik.
      audit(
        batch,
        isNew ? 'ekle' : 'duzenle',
        id,
        `${isNew ? 'Yetki verildi' : 'Yetki değiştirildi'}: ${input.role}, ${scopeSummary(input.scope)}, ${Object.keys(modules).length} bölüm` +
          (input.expiresAt ? `, bitiş ${input.expiresAt.toISOString().slice(0, 10)}` : ''),
        input.scope,
      );
      // Bu kişinin bekleyen talebi varsa kapatılır.
      if (isNew) {
        const req = await getDoc(doc(db, REQUESTS, input.uid)).catch(() => null);
        if (req?.exists() && req.data().status === 'yeni') {
          batch.update(req.ref, { status: 'yetki-verildi', reviewedBy: actorUid, reviewedAt: serverTimestamp() });
        }
      }
      await batch.commit();
      return id;
    },

    async revoke(g: GrantRecord): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, GRANTS, g.id), {
        revokedAt: serverTimestamp(),
        revokedBy: actorUid,
        updatedAt: serverTimestamp(),
      });
      audit(batch, 'sil', g.id, `Yetki geri alındı: ${g.role}, ${scopeSummary(g.scope)}`, g.scope);
      await batch.commit();
    },

    async listRequests(): Promise<AccessRequest[]> {
      const snap = await getDocs(query(collection(db, REQUESTS), where('status', '==', 'yeni'), limit(200)));
      return snap.docs
        .map((d) => {
          const x = d.data();
          return { uid: d.id, displayName: x.displayName, email: x.email, note: x.note, status: x.status, createdAt: iso(x.createdAt) ?? '' };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async rejectRequest(r: AccessRequest): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, REQUESTS, r.uid), { status: 'reddedildi', reviewedBy: actorUid, reviewedAt: serverTimestamp() });
      audit(batch, 'sil', r.uid, 'Yetki talebi reddedildi');
      await batch.commit();
    },
  };
}

/** İşlem kayıtları: admin hepsini, diğer yöneticiler yalnızca kendi işlemlerini görür. */
export async function listAuditLog(db: Firestore, opts: { actorUid?: string; max?: number } = {}): Promise<AuditLogEntry[]> {
  const constraints = [orderBy('at', 'desc'), limit(opts.max ?? 200)];
  const q = opts.actorUid
    ? query(collection(db, AUDIT), where('actorUid', '==', opts.actorUid), ...constraints)
    : query(collection(db, AUDIT), ...constraints);
  return (await getDocs(q)).docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      actorUid: x.actorUid,
      module: x.module,
      action: x.action,
      ...(x.targetId ? { targetId: x.targetId } : {}),
      ...(x.region ? { region: x.region } : {}),
      at: iso(x.at) ?? '',
      summary: x.summary ?? '',
    };
  });
}
