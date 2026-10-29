import { doc, getDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';

import { FUEL_TYPES, type TravelPrices } from '../travel/plan';
import { addAudit, iso } from './grants';

const ref = (db: Firestore) => doc(db, 'config', 'travelPrices');

/**
 * Planla'nın tahmini ücretleri (akaryakıt, otobüs km ücreti): admin panelden ayda bir girer (kayda geçer), uygulama
 * okur. Belge yoksa ücret tahmini gösterilmez.
 */
export function createTravelPrices(db: Firestore) {
  return {
    async get(): Promise<(TravelPrices & { updatedAt?: string }) | null> {
      const snap = await getDoc(ref(db));
      if (!snap.exists()) return null;
      const d = snap.data();
      const fuel = Object.fromEntries(FUEL_TYPES.filter((k) => typeof d.fuel?.[k] === 'number').map((k) => [k, d.fuel[k] as number]));
      return {
        fuel,
        ...(d.busPerKm ? { busPerKm: { min: d.busPerKm.min, max: d.busPerKm.max } } : {}),
        month: d.month ?? '',
        updatedAt: iso(d.updatedAt),
      };
    },

    async save(actorUid: string, p: TravelPrices): Promise<void> {
      const fuel = Object.fromEntries(FUEL_TYPES.filter((k) => p.fuel[k] !== undefined).map((k) => [k, p.fuel[k]]));
      const batch = writeBatch(db);
      batch.set(ref(db), { fuel, ...(p.busPerKm ? { busPerKm: p.busPerKm } : {}), month: p.month, updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'seyahat', action: 'duzenle', targetId: 'travelPrices', summary: `Yolculuk fiyatları (${p.month})` });
      await batch.commit();
    },
  };
}
