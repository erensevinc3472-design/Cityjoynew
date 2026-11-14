import { collection, deleteField, doc, getDocs, limit, query, serverTimestamp, where, writeBatch, type DocumentData, type Firestore } from './metered';

import { cleanPhoto, photoFrom } from '../media/photo';
import { SPONSOR_NATIONWIDE, SPONSOR_PLACES, type Sponsor, type SponsorInput, type SponsorPlace } from '../sponsors/sponsors';
import { addAudit, iso } from './grants';

const SPONSORS = 'sponsors';

function sponsorFrom(id: string, d: DocumentData): Sponsor {
  const logo = photoFrom(d.logo);
  return {
    id,
    name: d.name ?? '',
    line: d.line ?? '',
    ...(typeof d.url === 'string' && d.url ? { url: d.url } : {}),
    ...(logo ? { logo } : {}),
    provinceCode: d.provinceCode ?? SPONSOR_NATIONWIDE,
    places: (Array.isArray(d.places) ? d.places : []).filter((p: unknown): p is SponsorPlace => SPONSOR_PLACES.includes(p as SponsorPlace)),
    startsOn: d.startsOn ?? '',
    endsOn: d.endsOn ?? '',
    active: d.active === true,
    updatedAt: iso(d.updatedAt) ?? '',
  };
}

/** Uygulama: ilin ve Türkiye genelinin sponsorları (tek sorgu; tarih ve açıklık telefonda süzülür). */
export function createSponsorRepository(db: Firestore) {
  return {
    async listFor(provinceCode: string): Promise<Sponsor[]> {
      const s = await getDocs(query(collection(db, SPONSORS), where('provinceCode', 'in', [provinceCode, SPONSOR_NATIONWIDE]), limit(50)));
      return s.docs.map((d) => sponsorFrom(d.id, d.data()));
    },
  };
}

/** Panel > Sponsorlar (yalnızca admin). Her işlem işlem kaydına yazılır. */
export function createSponsorAdmin(db: Firestore, actorUid: string) {
  const audit = (batch: ReturnType<typeof writeBatch>, action: 'ekle' | 'duzenle' | 'sil', targetId: string, summary: string) =>
    addAudit(db, batch, { actorUid, module: 'kurumlar', action, targetId, summary });
  return {
    async listAll(): Promise<Sponsor[]> {
      const s = await getDocs(query(collection(db, SPONSORS), limit(300)));
      return s.docs.map((d) => sponsorFrom(d.id, d.data())).sort((a, b) => b.endsOn.localeCompare(a.endsOn));
    },
    async save(id: string | null, x: SponsorInput): Promise<void> {
      const ref = id ? doc(db, SPONSORS, id) : doc(collection(db, SPONSORS));
      const url = x.url?.trim();
      const data = {
        name: x.name.trim(),
        line: x.line.trim(),
        url: url ? url : id ? deleteField() : undefined,
        logo: x.logo ? cleanPhoto(x.logo) : id ? deleteField() : undefined,
        provinceCode: x.provinceCode,
        places: x.places,
        startsOn: x.startsOn,
        endsOn: x.endsOn,
        active: x.active,
        updatedBy: actorUid,
        updatedAt: serverTimestamp(),
      };
      const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
      const batch = writeBatch(db);
      if (id) batch.update(ref, clean);
      else batch.set(ref, clean);
      audit(batch, id ? 'duzenle' : 'ekle', ref.id, `Sponsor ${id ? 'düzenlendi' : 'eklendi'}: ${data.name} (${x.provinceCode}, ${x.startsOn} – ${x.endsOn}${x.active ? '' : ', kapalı'})`);
      await batch.commit();
    },
    async remove(s: Sponsor): Promise<void> {
      const batch = writeBatch(db);
      batch.delete(doc(db, SPONSORS, s.id));
      audit(batch, 'sil', s.id, `Sponsor silindi: ${s.name}`);
      await batch.commit();
    },
  };
}
