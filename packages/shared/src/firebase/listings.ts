import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';

import {
  LISTING_LIMITS,
  type Listing,
  type ListingCategory,
  type ListingInput,
  type ListingKind,
  type ListingReportReason,
} from '../listings/listings';
import { quotaAfter } from '../messages/messages';
import { SEARCH_LIMITS, searchKeys } from '../search/search';
import { addAudit, iso } from './grants';
import { countUsage } from './limits';

const COLLECTION = 'listings';
const REPORTS = 'listingReports';
const QUOTA = 'listingQuota';

function fromDoc(id: string, d: DocumentData): Listing {
  return {
    id,
    kind: d.kind,
    category: d.category,
    condition: d.condition,
    title: d.title ?? '',
    description: d.description ?? '',
    price: typeof d.price === 'number' ? d.price : null,
    rentUnit: d.rentUnit ?? null,
    swapFor: d.swapFor ?? '',
    region: d.region,
    ownerUid: d.ownerUid,
    ownerName: d.ownerName ?? '',
    status: d.status,
    photos: d.photos ?? [],
    reportCount: d.reportCount ?? 0,
    cleared: d.cleared === true,
    // Sunucu zamanı henüz yazılmadıysa (yerel önbellek) şimdiki zaman sayılır.
    listedAt: iso(d.listedAt) ?? new Date().toISOString(),
    createdAt: iso(d.createdAt) ?? new Date().toISOString(),
  };
}

const content = (l: ListingInput) => ({
  kind: l.kind,
  category: l.category,
  condition: l.condition,
  title: l.title.trim(),
  description: l.description.trim(),
  price: l.price,
  rentUnit: l.rentUnit,
  swapFor: l.kind === 'takas' ? l.swapFor.trim() : '',
  searchKeys: searchKeys(`${l.title} ${l.description}`, LISTING_LIMITS.searchKeys, SEARCH_LIMITS.minPost),
});

/** Çarşı listesi süzgeci: il (zorunlu), istenirse ilçe, tür ve kategori; arama anahtarı. */
export interface ListingFilter {
  provinceCode: string;
  districtId?: string;
  kind?: ListingKind;
  category?: ListingCategory;
  /** Arama anahtarı (searchKey ile üretilmiş). */
  key?: string;
}

export interface ListingPage {
  listings: Listing[];
  /** Sonraki sayfa için; null ise listenin sonu. */
  cursor: string | null;
}

/**
 * Uygulama: Çarşı ilanları. İlan veren kendi kayıtlı mahallesiyle verir; ilk yazımda günlük ilan sayacı da değişir
 * (kurallar sınırı denetler). Satıldı, yenile, düzenle, kaldır yalnızca sahibine; şikâyet kişi başına bir.
 */
export function createFirestoreListingRepository(db: Firestore) {
  const ref = (id: string) => doc(db, COLLECTION, id);
  const favRef = (uid: string, id: string) => doc(db, 'users', uid, 'favoriteListings', id);

  return {
    /** Yayında, son 30 günde verilmiş (ya da yenilenmiş) ilanlar, yeniden eskiye. */
    async list(f: ListingFilter, cursor: string | null = null): Promise<ListingPage> {
      const since = Timestamp.fromDate(new Date(Date.now() - LISTING_LIMITS.days * 86_400_000));
      const c: QueryConstraint[] = [where('status', '==', 'yayinda'), where('region.provinceCode', '==', f.provinceCode)];
      if (f.districtId) c.push(where('region.districtId', '==', f.districtId));
      if (f.category) c.push(where('category', '==', f.category));
      if (f.kind) c.push(where('kind', '==', f.kind));
      if (f.key) c.push(where('searchKeys', 'array-contains', f.key));
      c.push(where('listedAt', '>', since), orderBy('listedAt', 'desc'));
      if (cursor) c.push(startAfter(Timestamp.fromDate(new Date(cursor))));
      c.push(limit(LISTING_LIMITS.pageSize));
      const listings = (await getDocs(query(collection(db, COLLECTION), ...c))).docs.map((d) => fromDoc(d.id, d.data()));
      return { listings, cursor: listings.length === LISTING_LIMITS.pageSize ? listings[listings.length - 1].listedAt : null };
    },

    async get(id: string): Promise<Listing | null> {
      const snap = await getDoc(ref(id));
      return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },

    /** İlanlarım: kaldırılanlar dışında hepsi (satılan, süresi dolan da), yeniden eskiye. */
    async listMine(uid: string): Promise<Listing[]> {
      const snap = await getDocs(query(collection(db, COLLECTION), where('ownerUid', '==', uid), limit(200)));
      return snap.docs
        .map((d) => fromDoc(d.id, d.data()))
        .filter((l) => l.status !== 'kaldirildi')
        .sort((a, b) => b.listedAt.localeCompare(a.listedAt));
    },

    /** Döner: yeni kimlik. Günlük sayaç aynı yazımda artar; sınır dolmuşsa kurallar reddeder. */
    async create(uid: string, ownerName: string, input: ListingInput): Promise<string> {
      const r = ref(doc(collection(db, COLLECTION)).id);
      const quota = await getDoc(doc(db, QUOTA, uid));
      const next = quotaAfter(quota.exists() ? { windowStart: iso(quota.get('windowStart')) ?? new Date(0).toISOString(), count: quota.get('count') ?? 0 } : null, new Date());
      const batch = writeBatch(db);
      batch.set(doc(db, QUOTA, uid), next.reset ? { windowStart: serverTimestamp(), count: 1 } : { windowStart: quota.get('windowStart'), count: next.count });
      batch.set(r, {
        ...content(input),
        region: { provinceCode: input.region.provinceCode, districtId: input.region.districtId, neighbourhoodId: input.region.neighbourhoodId },
        ownerUid: uid,
        ownerName: ownerName.slice(0, 40),
        status: 'yayinda',
        photos: [],
        reportCount: 0,
        listedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return r.id;
    },

    /** Sahibi düzenler (bölge değişmez). */
    async update(id: string, input: ListingInput): Promise<void> {
      const batch = writeBatch(db);
      batch.update(ref(id), { ...content(input), updatedAt: serverTimestamp() });
      await batch.commit();
    },

    /** Satıldı / yeniden yayında. */
    async setSold(id: string, sold: boolean): Promise<void> {
      const batch = writeBatch(db);
      batch.update(ref(id), { status: sold ? 'satildi' : 'yayinda', updatedAt: serverTimestamp() });
      await batch.commit();
    },

    /** Son günlerde ya da süresi dolunca: ilan 30 gün daha yayında kalır ve listede üste çıkar. */
    async renew(id: string): Promise<void> {
      const batch = writeBatch(db);
      batch.update(ref(id), { listedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await batch.commit();
    },

    /** Sahibi kaldırır: yazılar ve ad boşaltılır (şikâyet kaydı varsa moderatör "kaldırıldı" görür). */
    async remove(id: string): Promise<void> {
      const batch = writeBatch(db);
      batch.update(ref(id), { status: 'kaldirildi', title: '', description: '', swapFor: '', ownerName: '', searchKeys: deleteField(), updatedAt: serverTimestamp() });
      await batch.commit();
    },

    /** Kişi başına ilan başına bir şikâyet; sayaç aynı yazımda tam bir artar. */
    async report(l: Pick<Listing, 'id' | 'region'>, uid: string, reason: ListingReportReason): Promise<void> {
      const batch = writeBatch(db);
      await countUsage(db, batch, { type: 'u', id: uid }, 'sikayet', uid);
      batch.set(doc(db, REPORTS, `${l.id}_${uid}`), {
        listingId: l.id,
        reporterUid: uid,
        reason,
        provinceCode: l.region.provinceCode,
        status: 'yeni',
        createdAt: serverTimestamp(),
      });
      batch.update(ref(l.id), { reportCount: increment(1) });
      await batch.commit();
    },

    async hasReported(id: string, uid: string): Promise<boolean> {
      return getDoc(doc(db, REPORTS, `${id}_${uid}`)).then((s) => s.exists(), () => false);
    },

    /** Favoriler kişiye özeldir (users/{uid}/favoriteListings). */
    async favoriteIds(uid: string): Promise<Set<string>> {
      const snap = await getDocs(query(collection(db, 'users', uid, 'favoriteListings'), orderBy('createdAt', 'desc'), limit(200)));
      return new Set(snap.docs.map((d) => d.id));
    },

    async setFavorite(uid: string, id: string, on: boolean): Promise<void> {
      const batch = writeBatch(db);
      if (on) batch.set(favRef(uid, id), { createdAt: serverTimestamp() });
      else batch.delete(favRef(uid, id));
      await batch.commit();
    },

    /** Favorilerim (yeniden eskiye, en çok 50). Kaldırılan ilan listede yer almaz. */
    async listFavorites(uid: string): Promise<Listing[]> {
      const snap = await getDocs(query(collection(db, 'users', uid, 'favoriteListings'), orderBy('createdAt', 'desc'), limit(50)));
      const all = await Promise.all(snap.docs.map((d) => getDoc(ref(d.id)).then((x) => (x.exists() ? fromDoc(x.id, x.data()) : null), () => null)));
      return all.filter((l): l is Listing => !!l && l.status !== 'kaldirildi');
    },

    /** Hesap silmede (KVKK): ilanlar boşaltılarak kaldırılır, favoriler silinir. */
    async deleteAllOf(uid: string): Promise<void> {
      const favs = await getDocs(query(collection(db, 'users', uid, 'favoriteListings'), limit(500)));
      for (const f of favs.docs) {
        const batch = writeBatch(db);
        batch.delete(f.ref);
        await batch.commit();
      }
      const mine = await getDocs(query(collection(db, COLLECTION), where('ownerUid', '==', uid), limit(500)));
      for (const d of mine.docs) {
        if (d.get('status') === 'kaldirildi' && !d.get('title')) continue;
        const batch = writeBatch(db);
        batch.update(d.ref, { status: 'kaldirildi', title: '', description: '', swapFor: '', ownerName: '', searchKeys: deleteField(), updatedAt: serverTimestamp() });
        await batch.commit();
      }
    },
  };
}

export interface ListingReport {
  id: string;
  listingId: string;
  reporterUid: string;
  reason: ListingReportReason;
  provinceCode: string;
  status: 'yeni' | 'incelendi';
  createdAt: string;
  listing: Listing | null;
}

/**
 * Panel > Moderasyon: şikâyet edilen Çarşı ilanları. Admin hepsini, il yöneticisi ve gönüllü moderatör kendi ilini
 * görür. "Kaldır" ilanı yayından çıkarır; "Yerinde kalsın" şikâyet sayısıyla düşmesini engeller. Her işlem kayda geçer.
 */
export function createListingModeration(db: Firestore, actorUid: string) {
  const decide = async (r: ListingReport, patch: Record<string, unknown>, summary: string) => {
    const batch = writeBatch(db);
    if (r.listing) batch.update(doc(db, COLLECTION, r.listingId), { ...patch, moderatedBy: actorUid, updatedAt: serverTimestamp() });
    batch.update(doc(db, REPORTS, r.id), { status: 'incelendi' });
    const reg = r.listing?.region;
    addAudit(db, batch, {
      actorUid,
      module: 'moderasyon',
      action: 'duzenle',
      targetId: r.listingId,
      scope: reg ? { level: 'ilce', provinceCode: reg.provinceCode, districtId: reg.districtId } : { level: 'il', provinceCode: r.provinceCode },
      summary: `${summary}: ${r.listing?.title.slice(0, 60) || r.listingId}`,
    });
    await batch.commit();
  };

  return {
    async listReports(scope: 'admin' | { provinceCode: string }): Promise<ListingReport[]> {
      const q =
        scope === 'admin'
          ? query(collection(db, REPORTS), orderBy('createdAt', 'desc'), limit(100))
          : query(collection(db, REPORTS), where('provinceCode', '==', scope.provinceCode), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const l = await getDoc(doc(db, COLLECTION, data.listingId)).catch(() => null);
          return {
            id: d.id,
            listingId: data.listingId,
            reporterUid: data.reporterUid,
            reason: data.reason,
            provinceCode: data.provinceCode,
            status: data.status,
            createdAt: iso(data.createdAt) ?? '',
            listing: l?.exists() ? fromDoc(l.id, l.data()) : null,
          };
        }),
      );
    },

    remove: (r: ListingReport) => decide(r, { status: 'kaldirildi' }, 'İlan kaldırıldı (şikâyet)'),
    keep: (r: ListingReport) => decide(r, { cleared: true }, 'Şikâyet incelendi, ilan yerinde kaldı'),
  };
}
