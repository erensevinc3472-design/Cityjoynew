import {
  collection,
  doc,
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
  type WriteBatch,
} from 'firebase/firestore';

import { grantDocId, normalizeEmail, normalizeModules, ROLE_CAPS, type GrantRecord, type PersonRole } from '../permissions/grants';
import type { Action, AuditLogEntry, Module, RegionRef, RegionScope } from '../permissions/types';

const GRANTS = 'grants';
const AUDIT = 'auditLog';

export const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : undefined);

export function regionOf(scope: RegionScope): RegionRef | undefined {
  if (scope.level === 'ulke') return undefined;
  return {
    provinceCode: scope.provinceCode,
    ...(scope.level !== 'il' ? { districtId: scope.districtId } : {}),
    ...(scope.level === 'mahalle' ? { neighbourhoodId: scope.neighbourhoodId } : {}),
  };
}

/** İşlem kaydı satırı; kişisel veri yazılmaz (ad ve e-posta yerine kimlik). */
export function addAudit(
  db: Firestore,
  batch: WriteBatch,
  entry: { actorUid: string; module: Module; action: Action; targetId: string; summary: string; scope?: RegionScope; orgId?: string },
) {
  const region = entry.scope ? regionOf(entry.scope) : undefined;
  batch.set(doc(collection(db, AUDIT)), {
    actorUid: entry.actorUid,
    module: entry.module,
    action: entry.action,
    targetId: entry.targetId,
    ...(region ? { region } : {}),
    ...(entry.orgId ? { orgId: entry.orgId } : {}),
    at: serverTimestamp(),
    summary: entry.summary,
  });
}

function fromDoc(id: string, d: DocumentData): GrantRecord {
  return {
    id,
    email: d.email,
    role: d.role,
    scope: d.scope,
    modules: d.modules ?? {},
    grantedBy: d.grantedBy,
    grantedAt: iso(d.grantedAt) ?? '',
    displayName: d.displayName ?? '',
    ...(d.note ? { note: d.note } : {}),
    ...(d.expiresAt ? { expiresAt: iso(d.expiresAt) } : {}),
    ...(d.revokedAt ? { revokedAt: iso(d.revokedAt) ?? new Date().toISOString() } : {}),
    ...(d.revokedBy ? { revokedBy: d.revokedBy } : {}),
  };
}

/** Panel oturumu: kişinin e-postasına verilmiş yetkiler (geçersizleri süzmek çağıranda). */
export async function loadOwnGrants(db: Firestore, email: string): Promise<GrantRecord[]> {
  const snap = await getDocs(query(collection(db, GRANTS), where('email', '==', normalizeEmail(email))));
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export interface GrantInput {
  email: string;
  displayName: string;
  note?: string;
  role: PersonRole;
  scope: RegionScope;
  modules: Partial<Record<Module, Action[]>>;
  expiresAt?: Date;
}

const scopeSummary = (s: RegionScope) =>
  s.level === 'ulke' ? 'ülke' : s.level === 'il' ? `il ${s.provinceCode}` : s.level === 'ilce' ? `ilçe ${s.districtId}` : `mahalle ${s.neighbourhoodId}`;

/**
 * Kişi yetkileri (PROJE.md 6.7): admin il yöneticisi, muhtar ve moderatör; il yöneticisi kendi ilinde muhtar ve
 * moderatör verir. Her verme, değiştirme ve geri alma aynı toplu yazımda işlem kaydına da eklenir.
 */
export function createGrantAdmin(db: Firestore, actorUid: string) {
  return {
    /** Admin: tüm yetkiler. */
    async listAll(): Promise<GrantRecord[]> {
      const snap = await getDocs(query(collection(db, GRANTS), orderBy('updatedAt', 'desc'), limit(500)));
      return snap.docs.map((d) => fromDoc(d.id, d.data()));
    },

    /** İl yöneticisi: kendi ilindeki yetkiler (kurallar başka ili okutmaz). */
    async listForProvince(provinceCode: string): Promise<GrantRecord[]> {
      const snap = await getDocs(query(collection(db, GRANTS), where('scope.provinceCode', '==', provinceCode), limit(500)));
      return snap.docs.map((d) => fromDoc(d.id, d.data())).sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
    },

    /** Yeni yetki ya da var olanı değiştirme (aynı kişiye aynı bölgede ikinci yetki açılmaz). */
    async save(input: GrantInput, isNew: boolean): Promise<string> {
      const id = grantDocId(input.email, input.scope);
      const modules = normalizeModules(input.modules, ROLE_CAPS[input.role]);
      const batch = writeBatch(db);
      batch.set(doc(db, GRANTS, id), {
        email: normalizeEmail(input.email),
        displayName: input.displayName.trim().slice(0, 80),
        ...(input.note?.trim() ? { note: input.note.trim().slice(0, 300) } : {}),
        role: input.role,
        scope: input.scope,
        modules,
        ...(input.expiresAt ? { expiresAt: Timestamp.fromDate(input.expiresAt) } : {}),
        grantedBy: actorUid,
        grantedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      addAudit(db, batch, {
        actorUid,
        module: 'yetkiler',
        action: isNew ? 'ekle' : 'duzenle',
        targetId: id,
        scope: input.scope,
        summary:
          `${isNew ? 'Yetki verildi' : 'Yetki değiştirildi'}: ${input.role}, ${scopeSummary(input.scope)}, ${Object.keys(modules).length} bölüm` +
          (input.expiresAt ? `, bitiş ${input.expiresAt.toISOString().slice(0, 10)}` : ''),
      });
      await batch.commit();
      return id;
    },

    async revoke(g: GrantRecord): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, GRANTS, g.id), { revokedAt: serverTimestamp(), revokedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'yetkiler', action: 'sil', targetId: g.id, scope: g.scope, summary: `Yetki geri alındı: ${g.role}, ${scopeSummary(g.scope)}` });
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
