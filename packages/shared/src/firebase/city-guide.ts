import { doc, getDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';

import {
  mergeCityItems,
  NATIONAL,
  type CityGuideItem,
  type CityGuideMeta,
  type CityGuideRepository,
} from '../city-guide/items';
import type { CityGuideSectionId } from '../city-guide/schema';
import type { Action } from '../permissions/types';
import { addAudit } from './grants';

const META = 'cityGuide';
const PACKS = 'cityGuidePacks';
/** Bir paket belgesindeki en fazla öğe (belge boyutu sınırının altında kalmak için). */
export const CITY_PACK_SIZE = 400;

const packId = (p: string, s: string, part: number) => `${p}__${s}__${part}`;

async function readMeta(db: Firestore, provinceCode: string): Promise<CityGuideMeta | null> {
  const snap = await getDoc(doc(db, META, provinceCode));
  return snap.exists() ? { sections: snap.data().sections ?? {} } : null;
}

async function readItems(db: Firestore, provinceCode: string, section: CityGuideSectionId, parts: number): Promise<CityGuideItem[]> {
  const snaps = await Promise.all(Array.from({ length: parts }, (_, i) => getDoc(doc(db, PACKS, packId(provinceCode, section, i)))));
  return snaps.flatMap((s) => (s.exists() ? (s.data().items as CityGuideItem[]) : []));
}

/** Uygulama: herkes okur (girişsiz de). Önbellek createCityGuideStore'da. */
export function createFirestoreCityGuideRepository(db: Firestore): CityGuideRepository {
  return {
    meta: (provinceCode) => readMeta(db, provinceCode),
    items: (provinceCode, section, parts) => readItems(db, provinceCode, section, parts),
  };
}

/**
 * Panel: Benim Şehrim sabit bilgilerinin yönetimi (admin ve il yöneticisi). Bir bölüm her kayıtta paket olarak
 * yeniden yazılır, özetteki sürüm değişir; uygulama yalnızca değişen bölümü indirir. Her işlem kayda geçer.
 */
export function createCityGuideAdmin(db: Firestore, actorUid: string) {
  const load = async (provinceCode: string, section: CityGuideSectionId) => {
    const meta = await readMeta(db, provinceCode);
    const parts = meta?.sections[section]?.parts ?? 0;
    return { items: parts ? await readItems(db, provinceCode, section, parts) : [], oldParts: parts };
  };

  const save = async (
    provinceCode: string,
    section: CityGuideSectionId,
    items: CityGuideItem[],
    oldParts: number,
    action: Action,
    targetId: string,
    summary: string,
  ) => {
    const batch = writeBatch(db);
    const parts = Math.ceil(items.length / CITY_PACK_SIZE);
    for (let i = 0; i < parts; i++) {
      batch.set(doc(db, PACKS, packId(provinceCode, section, i)), {
        provinceCode,
        section,
        part: i,
        items: items.slice(i * CITY_PACK_SIZE, (i + 1) * CITY_PACK_SIZE),
        updatedAt: serverTimestamp(),
        updatedBy: actorUid,
      });
    }
    for (let i = parts; i < oldParts; i++) batch.delete(doc(db, PACKS, packId(provinceCode, section, i)));
    batch.set(
      doc(db, META, provinceCode),
      { sections: { [section]: { version: String(Date.now()), count: items.length, parts } }, updatedAt: serverTimestamp(), updatedBy: actorUid },
      { merge: true },
    );
    addAudit(db, batch, {
      actorUid,
      module: 'sehir-rehberi',
      action,
      targetId,
      summary,
      ...(provinceCode !== NATIONAL ? { scope: { level: 'il' as const, provinceCode } } : {}),
    });
    await batch.commit();
  };

  const change = async (
    provinceCode: string,
    section: CityGuideSectionId,
    fn: (items: CityGuideItem[]) => CityGuideItem[],
    action: Action,
    targetId: string,
    summary: string,
  ) => {
    const { items, oldParts } = await load(provinceCode, section);
    await save(provinceCode, section, fn(items), oldParts, action, targetId, summary);
  };

  const today = () => new Date().toISOString().slice(0, 10);

  return {
    meta: (provinceCode: string) => readMeta(db, provinceCode),
    async list(provinceCode: string, section: CityGuideSectionId): Promise<CityGuideItem[]> {
      return (await load(provinceCode, section)).items;
    },

    /** Excel'den gelenleri var olanlarla birleştirir (aynı yer güncellenir, yeni eklenir, eskiler kalır). */
    async importItems(provinceCode: string, section: CityGuideSectionId, incoming: CityGuideItem[]) {
      const { items, oldParts } = await load(provinceCode, section);
      const merged = mergeCityItems(items, incoming);
      await save(
        provinceCode,
        section,
        merged.items,
        oldParts,
        'ekle',
        `${provinceCode}-${section}`,
        `Excel'den yüklendi (${section}): ${merged.added} yeni, ${merged.updated} güncellendi, ${merged.unchanged} aynı`,
      );
      return merged;
    },

    /** Doğrulandı işareti: bilgileri gerçek kaynaktan teyit eden yönetici koyar. */
    setVerified: (item: CityGuideItem, verified: boolean) =>
      change(
        item.provinceCode,
        item.section,
        (list) => list.map((i) => (i.id === item.id ? { ...i, verified, ...(verified ? { verifiedAt: today() } : { verifiedAt: undefined }) } : i)).map(dropUndefined),
        'onayla',
        item.id,
        verified ? `Doğrulandı: ${item.name}` : `Doğrulama kaldırıldı: ${item.name}`,
      ),

    /** Tek bir öğeyi düzeltme (içerik değişince doğrulama düşer). */
    update: (item: CityGuideItem) =>
      change(
        item.provinceCode,
        item.section,
        (list) => list.map((i) => (i.id === item.id ? dropUndefined({ ...item, verified: false, verifiedAt: undefined }) : i)),
        'duzenle',
        item.id,
        `Düzenlendi: ${item.name}`,
      ),

    remove: (item: CityGuideItem) =>
      change(item.provinceCode, item.section, (list) => list.filter((i) => i.id !== item.id), 'sil', item.id, `Kaldırıldı: ${item.name}`),
  };
}

/** Firestore tanımsız alan kabul etmez. */
function dropUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
