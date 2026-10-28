import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type Auth,
} from 'firebase/auth';

import { normalizeEmail, ORG_MODULES } from '../permissions/grants';
import { normalizeAssignment } from '../organizations/staff';
import type { Organization, OrganizationMember } from '../organizations/types';
import type { Module } from '../permissions/types';
import { addAudit, iso } from './grants';

const ORGS = 'organizations';
const MEMBERS = 'orgMembers';

export const memberDocId = (orgId: string, email: string) => `${orgId}__${normalizeEmail(email)}`;

function orgFromDoc(id: string, d: DocumentData): Organization {
  return {
    id,
    name: d.name,
    kind: d.kind,
    scope: d.scope,
    modules: d.modules ?? [],
    officialEmail: d.officialEmail,
    status: d.status,
    ...(d.contractEndsAt ? { contractEndsAt: iso(d.contractEndsAt) } : {}),
    createdBy: d.createdBy,
    createdAt: iso(d.createdAt) ?? '',
  };
}

function memberFromDoc(d: DocumentData): OrganizationMember {
  return {
    orgId: d.orgId,
    email: d.email,
    displayName: d.displayName,
    isOrgAdmin: !!d.isOrgAdmin,
    assignments: Object.fromEntries(Object.entries(d.assignments ?? {}).map(([m, a]) => [m, normalizeAssignment(m as Module, a)]).filter(([, a]) => a.length)),
    ...(d.expiresAt ? { expiresAt: iso(d.expiresAt) } : {}),
    ...(d.removedAt ? { removedAt: iso(d.removedAt) ?? new Date().toISOString() } : {}),
  };
}

/** Panel oturumu: kişinin e-postasına bağlı kurum görevleri ve kurumları. */
export async function loadOwnMemberships(db: Firestore, email: string): Promise<{ org: Organization; member: OrganizationMember }[]> {
  const snap = await getDocs(query(collection(db, MEMBERS), where('email', '==', normalizeEmail(email))));
  const out: { org: Organization; member: OrganizationMember }[] = [];
  for (const d of snap.docs) {
    const member = memberFromDoc(d.data());
    const org = await getDoc(doc(db, ORGS, member.orgId)).catch(() => null);
    if (org?.exists()) out.push({ org: orgFromDoc(org.id, org.data()), member });
  }
  return out;
}

export interface OrganizationInput {
  id: string;
  name: string;
  kind: Organization['kind'];
  scope: Organization['scope'];
  modules: Organization['modules'];
  officialEmail: string;
  contractEndsAt?: Date;
}

/**
 * Kurum yönetimi (PROJE.md 6.6-6.7). Kurumu yalnızca admin açar; kurum yöneticisini (ilk üyeyi) admin atar.
 * Kurum yöneticisi kendi personelini ekler, görev verir ve çıkarır. Her işlem işlem kaydına yazılır.
 */
export function createOrganizationAdmin(db: Firestore, actorUid: string) {
  return {
    async listAll(): Promise<Organization[]> {
      const snap = await getDocs(query(collection(db, ORGS), limit(1000)));
      return snap.docs.map((d) => orgFromDoc(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    },

    /** İl yöneticisi: kendi ilindeki kurumlar. */
    async listForProvince(provinceCode: string): Promise<Organization[]> {
      const snap = await getDocs(query(collection(db, ORGS), where('scope.provinceCode', '==', provinceCode), limit(500)));
      return snap.docs.map((d) => orgFromDoc(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    },

    async exists(id: string): Promise<boolean> {
      return (await getDoc(doc(db, ORGS, id))).exists();
    },

    /** Kurumu ve kurum yöneticisini birlikte açar. Aynı kimlikle (aynı belediye) ikinci kurum açılamaz. */
    async create(input: OrganizationInput, orgAdmin: { email: string; displayName: string }): Promise<void> {
      const batch = writeBatch(db);
      batch.set(doc(db, ORGS, input.id), {
        name: input.name.trim(),
        kind: input.kind,
        scope: input.scope,
        modules: input.modules.filter((m) => ORG_MODULES.includes(m)),
        officialEmail: normalizeEmail(input.officialEmail),
        status: 'aktif',
        ...(input.contractEndsAt ? { contractEndsAt: Timestamp.fromDate(input.contractEndsAt) } : {}),
        createdBy: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, MEMBERS, memberDocId(input.id, orgAdmin.email)), {
        orgId: input.id,
        email: normalizeEmail(orgAdmin.email),
        displayName: orgAdmin.displayName.trim().slice(0, 80),
        isOrgAdmin: true,
        assignments: {},
        addedBy: actorUid,
        updatedAt: serverTimestamp(),
      });
      addAudit(db, batch, { actorUid, module: 'kurumlar', action: 'ekle', targetId: input.id, scope: input.scope, orgId: input.id, summary: `Kurum açıldı: ${input.name.trim()}` });
      await batch.commit();
    },

    /** Durum, bölümler ve sözleşme bitişi (admin). Pasif kurumun personeli panele giremez. */
    async update(org: Organization, patch: { status?: Organization['status']; modules?: Organization['modules']; contractEndsAt?: Date | null }) {
      const batch = writeBatch(db);
      batch.update(doc(db, ORGS, org.id), {
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.modules ? { modules: patch.modules.filter((m) => ORG_MODULES.includes(m)) } : {}),
        ...(patch.contractEndsAt !== undefined
          ? { contractEndsAt: patch.contractEndsAt ? Timestamp.fromDate(patch.contractEndsAt) : deleteField() }
          : {}),
        updatedAt: serverTimestamp(),
      });
      const what = [
        patch.status ? (patch.status === 'aktif' ? 'etkinleştirildi' : 'pasifleştirildi') : '',
        patch.modules ? `bölümler: ${patch.modules.join(', ') || '-'}` : '',
        patch.contractEndsAt !== undefined ? `sözleşme bitişi: ${patch.contractEndsAt?.toISOString().slice(0, 10) ?? 'yok'}` : '',
      ].filter(Boolean);
      addAudit(db, batch, { actorUid, module: 'kurumlar', action: 'duzenle', targetId: org.id, scope: org.scope, orgId: org.id, summary: `Kurum ${what.join('; ')}` });
      await batch.commit();
    },

    async listMembers(orgId: string): Promise<OrganizationMember[]> {
      const snap = await getDocs(query(collection(db, MEMBERS), where('orgId', '==', orgId), limit(500)));
      return snap.docs.map((d) => memberFromDoc(d.data())).sort((a, b) => Number(b.isOrgAdmin) - Number(a.isOrgAdmin) || a.displayName.localeCompare(b.displayName, 'tr'));
    },

    /**
     * Personel ekleme / görev değiştirme. Kurum yöneticisi yalnızca kurumun bölümlerinde görev verir ve yeni kurum
     * yöneticisi atayamaz (bunu admin yapar). Görev yeniden verilince "çıkarıldı" bilgisi temizlenir.
     */
    async saveMember(org: Organization, m: { email: string; displayName: string; isOrgAdmin: boolean; assignments: OrganizationMember['assignments']; expiresAt?: Date }, isNew: boolean) {
      const assignments = Object.fromEntries(
        Object.entries(m.assignments)
          .filter(([k]) => org.modules.includes(k as Module))
          .map(([k, v]) => [k, normalizeAssignment(k as Module, v)])
          .filter(([, v]) => v.length),
      );
      const batch = writeBatch(db);
      const id = memberDocId(org.id, m.email);
      batch.set(doc(db, MEMBERS, id), {
        orgId: org.id,
        email: normalizeEmail(m.email),
        displayName: m.displayName.trim().slice(0, 80),
        isOrgAdmin: m.isOrgAdmin,
        assignments,
        ...(m.expiresAt ? { expiresAt: Timestamp.fromDate(m.expiresAt) } : {}),
        addedBy: actorUid,
        updatedAt: serverTimestamp(),
      });
      addAudit(db, batch, {
        actorUid,
        module: 'kurumlar',
        action: isNew ? 'ekle' : 'duzenle',
        targetId: id,
        scope: org.scope,
        orgId: org.id,
        summary: `${isNew ? 'Personel eklendi' : 'Personel görevi değiştirildi'}: ${org.name}${m.isOrgAdmin ? ', kurum yöneticisi' : ''}, ${Object.keys(assignments).length} bölüm`,
      });
      await batch.commit();
    },

    async removeMember(org: Organization, m: OrganizationMember) {
      const batch = writeBatch(db);
      const id = memberDocId(org.id, m.email);
      batch.update(doc(db, MEMBERS, id), { removedAt: serverTimestamp(), removedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'kurumlar', action: 'sil', targetId: id, scope: org.scope, orgId: org.id, summary: `Personel çıkarıldı: ${org.name}` });
      await batch.commit();
    },
  };
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('') + 'Aa1!';
}

/**
 * Kurum hesabını resmî e-postayla açar ve "şifrenizi belirleyin" bağlantısı gönderir (PROJE.md 6.7). Geçici şifre
 * rastgele üretilir, hiçbir yerde saklanmaz ve kimse görmez. Panelin kendi oturumunu bozmamak için ayrı bir
 * Firebase uygulaması örneğinin giriş nesnesi (secondaryAuth) kullanılır.
 * Döner: "olusturuldu" ya da hesap zaten varsa "zaten-var" (o kişi kendi şifresiyle girer).
 */
export async function createAccountWithSetupLink(secondaryAuth: Auth, email: string): Promise<'olusturuldu' | 'zaten-var'> {
  const address = normalizeEmail(email);
  try {
    await createUserWithEmailAndPassword(secondaryAuth, address, randomPassword());
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/email-already-in-use') return 'zaten-var';
    throw e;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }
  await sendPasswordResetEmail(secondaryAuth, address);
  return 'olusturuldu';
}

/** Şifre belirleme bağlantısını yeniden gönderir. */
export const resendSetupLink = (auth: Auth, email: string) => sendPasswordResetEmail(auth, normalizeEmail(email));
