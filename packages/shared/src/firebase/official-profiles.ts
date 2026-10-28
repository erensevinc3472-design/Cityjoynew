import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import type { OfficialProfile, OfficialProfileInput, ProfileTarget } from '../organizations/profiles';
import type { RegionScope } from '../permissions/types';
import { addAudit, iso } from './grants';

const COLLECTION = 'officialProfiles';
const FIELDS = ['about', 'phone', 'email', 'website', 'address', 'hours'] as const;

function fromDoc(id: string, d: DocumentData): OfficialProfile {
  return {
    id,
    type: d.type,
    name: d.name ?? '',
    ...(d.region ? { region: d.region } : {}),
    ...Object.fromEntries(FIELDS.filter((k) => typeof d[k] === 'string' && d[k]).map((k) => [k, d[k]])),
    updatedAt: iso(d.updatedAt) ?? '',
  };
}

/** Uygulama: resmî profiller herkese açıktır (girişsiz de okunur). Yoksa null. */
export function createFirestoreOfficialProfileRepository(db: Firestore) {
  const get = async (id: string): Promise<OfficialProfile | null> => {
    const snap = await getDoc(doc(db, COLLECTION, id));
    return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
  };
  return {
    get,
    /** Birkaç profil (Mahalle Meydanı: muhtarlık + belediyeler); okunamayan ya da olmayan atlanır. */
    async getMany(ids: string[]): Promise<OfficialProfile[]> {
      const list = await Promise.all(ids.map((id) => get(id).catch(() => null)));
      return list.filter((p): p is OfficialProfile => !!p);
    },
  };
}

const scopeOf = (t: ProfileTarget): RegionScope | undefined =>
  !t.region
    ? undefined
    : t.region.neighbourhoodId && t.region.districtId
      ? { level: 'mahalle', provinceCode: t.region.provinceCode, districtId: t.region.districtId, neighbourhoodId: t.region.neighbourhoodId }
      : t.region.districtId
        ? { level: 'ilce', provinceCode: t.region.provinceCode, districtId: t.region.districtId }
        : { level: 'il', provinceCode: t.region.provinceCode };

/**
 * Panel: resmî profili kaydeder. Kurumda kurum yöneticisi ya da admin; muhtarlıkta muhtarın kendisi ya da admin.
 * Ad ve bölge kurumdan / yetkiden gelir (kurallar denetler). Boş bırakılan alan silinir. İşlem kaydına yazılır.
 */
export function createOfficialProfileAdmin(db: Firestore, actorUid: string) {
  return {
    get: (id: string) => createFirestoreOfficialProfileRepository(db).get(id),

    async save(target: ProfileTarget, input: OfficialProfileInput & { name?: string }): Promise<void> {
      const clean = Object.fromEntries(
        FIELDS.map((k) => [k, k === 'email' ? (input[k] ?? '').trim().toLowerCase() : (input[k] ?? '').trim()]).filter(([, v]) => v),
      );
      const batch = writeBatch(db);
      batch.set(doc(db, COLLECTION, target.id), {
        type: target.type,
        name: target.type === 'kurum' ? target.name : (input.name ?? '').trim().slice(0, 80),
        ...(target.region ? { region: target.region } : {}),
        ...clean,
        updatedBy: actorUid,
        updatedAt: serverTimestamp(),
      });
      const scope = scopeOf(target);
      addAudit(db, batch, {
        actorUid,
        module: 'kurumlar',
        action: 'duzenle',
        targetId: target.id,
        ...(scope ? { scope } : {}),
        ...(target.orgId ? { orgId: target.orgId } : {}),
        summary: `Resmî profil güncellendi: ${target.type === 'kurum' ? target.name : target.id}`,
      });
      await batch.commit();
    },
  };
}
