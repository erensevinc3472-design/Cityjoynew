import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import type { Adoption, AdoptionInput, AdoptionStatus } from '../adoption/adoption';
import type { RegionScope } from '../permissions/types';
import { addAudit, iso } from './grants';

const COLLECTION = 'adoptions';

function fromDoc(id: string, d: DocumentData): Adoption {
  return {
    id,
    name: d.name,
    species: d.species,
    age: d.age,
    sex: d.sex,
    ...(d.breed ? { breed: d.breed } : {}),
    vaccinated: d.vaccinated === true,
    neutered: d.neutered === true,
    about: d.about,
    urgent: d.urgent === true,
    region: d.region,
    ...(d.phone ? { phone: d.phone } : {}),
    ...(d.email ? { email: d.email } : {}),
    org: d.org,
    status: d.status,
    createdAt: iso(d.createdAt) ?? '',
    updatedAt: iso(d.updatedAt) ?? '',
  };
}

/** Uygulama: ildeki sahiplendirilmeyi bekleyen hayvanlar (tek sorgu, en çok 60). */
export function createAdoptionRepository(db: Firestore) {
  return {
    async listLive(provinceCode: string): Promise<Adoption[]> {
      const q = query(collection(db, COLLECTION), where('status', '==', 'yayinda'), where('region.provinceCode', '==', provinceCode), orderBy('createdAt', 'desc'), limit(60));
      return (await getDocs(q)).docs.map((d) => fromDoc(d.id, d.data()));
    },
    async get(id: string): Promise<Adoption | null> {
      const snap = await getDoc(doc(db, COLLECTION, id));
      return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },
  };
}

/** Panel: barınağın / derneğin ilanları; ekle, düzenle, sahiplendirildi / kaldır. Her işlem kayda girer. */
export function createAdoptionPanel(db: Firestore, actorUid: string) {
  const audit = (batch: ReturnType<typeof writeBatch>, org: { id: string; scope: RegionScope }, id: string, action: 'ekle' | 'duzenle' | 'sil', summary: string) =>
    addAudit(db, batch, { actorUid, module: 'sahiplendirme', action, targetId: id, orgId: org.id, scope: org.scope, summary });
  return {
    async listFor(orgId: string): Promise<Adoption[]> {
      const snap = await getDocs(query(collection(db, COLLECTION), where('org.id', '==', orgId), limit(200)));
      return snap.docs.map((d) => fromDoc(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async save(org: { id: string; name: string; scope: RegionScope }, input: AdoptionInput, existing?: Adoption): Promise<string> {
      const ref = existing ? doc(db, COLLECTION, existing.id) : doc(collection(db, COLLECTION));
      const r = input.region;
      const data = {
        name: input.name.trim(), species: input.species, age: input.age.trim(), sex: input.sex,
        ...(input.breed?.trim() ? { breed: input.breed.trim() } : {}),
        vaccinated: input.vaccinated, neutered: input.neutered, about: input.about.trim(), urgent: input.urgent,
        region: { provinceCode: r.provinceCode, ...(r.districtId ? { districtId: r.districtId } : {}), ...(r.neighbourhoodId ? { neighbourhoodId: r.neighbourhoodId } : {}) },
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        ...(input.email?.trim() ? { email: input.email.trim() } : {}),
        org: { id: org.id, name: org.name },
        status: existing?.status ?? 'yayinda',
        updatedBy: actorUid,
        updatedAt: serverTimestamp(),
      };
      const batch = writeBatch(db);
      batch.set(ref, existing ? { ...data, createdAt: (await getDoc(ref)).get('createdAt') } : { ...data, createdAt: serverTimestamp() });
      audit(batch, org, ref.id, existing ? 'duzenle' : 'ekle', `${existing ? 'Sahiplendirme ilanı düzenlendi' : 'Sahiplendirme ilanı'}: ${data.name}`);
      await batch.commit();
      return ref.id;
    },
    async setStatus(org: { id: string; scope: RegionScope }, a: Adoption, status: AdoptionStatus): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, COLLECTION, a.id), { status, updatedBy: actorUid, updatedAt: serverTimestamp() });
      audit(batch, org, a.id, status === 'kaldirildi' ? 'sil' : 'duzenle', `${status === 'sahiplendirildi' ? 'Sahiplendirildi' : status === 'kaldirildi' ? 'İlan kaldırıldı' : 'Yeniden yayında'}: ${a.name}`);
      await batch.commit();
    },
  };
}
