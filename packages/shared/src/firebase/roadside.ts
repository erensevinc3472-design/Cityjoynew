import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';

import { packByCell, unpackPlace, type PackedPlace, type RoadsidePlace } from '../business/roadside';
import { addAudit, iso } from './grants';

const COLLECTION = 'roadsidePacks';
/** Bir toplu yazımda en çok bu kadar paket (istek boyutu sınırı 10 MB). */
const PACKS_PER_BATCH = 20;

/** Uygulama: Yoldayım'ın OSM yol üstü paketleri (herkese açık). Olmayan hücre boş geçer. */
export function createRoadsidePackRepository(db: Firestore) {
  return {
    async getCells(cells: string[]): Promise<RoadsidePlace[]> {
      const docs = await Promise.all([...new Set(cells)].map((c) => getDoc(doc(db, COLLECTION, c)).catch(() => null)));
      return docs.flatMap((d) => (d?.exists() ? ((d.data().items ?? []) as PackedPlace[]).map(unpackPlace) : []));
    },
  };
}

export interface RoadsidePackSummary {
  cell: string;
  count: number;
  updatedAt?: string;
}

/**
 * Panel (yalnızca admin): OSM'den hazırlanan Türkiye dosyası hücre paketlerine bölünüp yüklenir. Dosyada artık
 * olmayan hücreler silinir. İşlem kayda geçer.
 */
export function createRoadsidePackAdmin(db: Firestore, actorUid: string) {
  const summary = async (): Promise<RoadsidePackSummary[]> =>
    (await getDocs(collection(db, COLLECTION))).docs
      .map((d) => ({ cell: d.id, count: (d.data().count as number) ?? 0, updatedAt: iso(d.data().updatedAt) }))
      .sort((a, b) => a.cell.localeCompare(b.cell));

  return {
    summary,
    async replaceAll(list: PackedPlace[]): Promise<{ cells: number; places: number }> {
      const cells = packByCell(list);
      const old = await summary();
      const writes: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
      for (const [cell, items] of cells) {
        writes.push((b) =>
          b.set(doc(db, COLLECTION, cell), { cell, items, count: items.length, source: 'osm', updatedAt: serverTimestamp(), updatedBy: actorUid }),
        );
      }
      for (const o of old) if (!cells.has(o.cell)) writes.push((b) => b.delete(doc(db, COLLECTION, o.cell)));
      for (let i = 0; i < writes.length; i += PACKS_PER_BATCH) {
        const batch = writeBatch(db);
        writes.slice(i, i + PACKS_PER_BATCH).forEach((w) => w(batch));
        if (i + PACKS_PER_BATCH >= writes.length) {
          addAudit(db, batch, { actorUid, module: 'sehir-rehberi', action: 'duzenle', targetId: COLLECTION, summary: `Yol üstü (OSM): ${list.length} yer, ${cells.size} hücre` });
        }
        await batch.commit();
      }
      return { cells: cells.size, places: list.length };
    },
  };
}
