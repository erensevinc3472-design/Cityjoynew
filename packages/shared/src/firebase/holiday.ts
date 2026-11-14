import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, where, writeBatch, type Firestore } from './metered';

import type { Business } from '../business/business';
import type { HolidayCuration, HolidayTheme } from '../travel/holiday';
import { businessFromDoc } from './businesses';
import { addAudit } from './grants';

/**
 * Seyahat > Planla (tatil keşfi): temanın doğrulanmış konaklama tesisleri (ülke geneli tek sorgu, en çok 300) ve
 * ekibin temadaki il düzenlemesi (`holidayThemes/{tema}`). Liste ekranı açılınca bir kez okunur.
 */
export function createHolidayRepository(db: Firestore) {
  const verified = (list: Business[]) => list.filter((b) => b.verification.status === 'dogrulandi' && b.lodging);
  return {
    async listByTheme(theme: HolidayTheme): Promise<Business[]> {
      const s = await getDocs(query(collection(db, 'businesses'), where('status', '==', 'yayinda'), where('type', '==', 'konaklama'), where('lodging.themes', 'array-contains', theme), limit(300)));
      return verified(s.docs.map((d) => businessFromDoc(d.id, d.data())));
    },
    /** İldeki konaklama (tema verilirse o temadakiler). */
    async listInProvince(provinceCode: string, theme?: HolidayTheme): Promise<Business[]> {
      const s = await getDocs(
        query(
          collection(db, 'businesses'),
          where('status', '==', 'yayinda'),
          where('type', '==', 'konaklama'),
          where('location.provinceCode', '==', provinceCode),
          ...(theme ? [where('lodging.themes', 'array-contains', theme)] : []),
          limit(200),
        ),
      );
      return verified(s.docs.map((d) => businessFromDoc(d.id, d.data())));
    },
    async curation(theme: HolidayTheme): Promise<HolidayCuration> {
      const s = await getDoc(doc(db, 'holidayThemes', theme));
      return (s.exists() ? s.get('places') : null) ?? {};
    },
  };
}

/** Açık ülke kodları (Panel > Seyahat > Ülkeler); ayar yoksa null. */
export async function readOpenCountries(db: Firestore): Promise<string[] | null> {
  const s = await getDoc(doc(db, 'config', 'travelCountries'));
  return s.exists() ? ((s.get('open') as string[]) ?? []) : null;
}

/** Panel > Seyahat > Tatil fikirleri (yalnızca admin). */
export function createHolidayAdmin(db: Firestore, actorUid: string) {
  return {
    async saveCuration(theme: HolidayTheme, places: HolidayCuration): Promise<void> {
      const batch = writeBatch(db);
      batch.set(doc(db, 'holidayThemes', theme), { places, updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'seyahat', action: 'duzenle', targetId: `tatil-${theme}`, summary: `Tatil fikri düzenlendi: ${theme}` });
      await batch.commit();
    },
    async saveOpenCountries(open: string[]): Promise<void> {
      const batch = writeBatch(db);
      batch.set(doc(db, 'config', 'travelCountries'), { open, updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'seyahat', action: 'duzenle', targetId: 'ulkeler', summary: `Açık ülkeler: ${open.join(', ') || 'yalnızca Türkiye'}` });
      await batch.commit();
    },
    /** Tesisin uymayan etiketini kaldırır. */
    async removeTheme(b: Business, theme: HolidayTheme): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, 'businesses', b.id), { 'lodging.themes': (b.lodging?.themes ?? []).filter((x) => x !== theme) });
      addAudit(db, batch, { actorUid, module: 'seyahat', action: 'duzenle', targetId: b.id, summary: `${b.name}: "${theme}" etiketi kaldırıldı` });
      await batch.commit();
    },
  };
}
