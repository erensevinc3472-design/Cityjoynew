import {
  collection,
  collectionGroup,
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

import { POST_LIMITS, POST_TARGETS, type Post, type PostInput, type PostReportReason, type PostTarget } from '../posts/posts';
import { addAudit, iso } from './grants';

const COLLECTION = 'posts';
const REPORTS = 'postReports';

// Hedefler veritabanında sabit anahtarlı bir haritadır ({mahallem, bolgesel, genel}: true/false): akış sorguları
// bununla süzülür ve güvenlik kuralları sorgunun yalnızca görülebilecek gönderileri istediğini doğrulayabilir.
const targetsToMap = (targets: PostTarget[]) => Object.fromEntries(POST_TARGETS.map((x) => [x, targets.includes(x)]));
const targetsFromMap = (m: Record<string, boolean> | undefined) => POST_TARGETS.filter((x) => m?.[x] === true);

function fromDoc(id: string, d: DocumentData): Post {
  return {
    id,
    text: d.text,
    category: d.category,
    targets: targetsFromMap(d.targets),
    region: d.region,
    status: d.status,
    authorUid: d.authorUid,
    authorName: d.authorName ?? '',
    likeCount: d.likeCount ?? 0,
    reportCount: d.reportCount ?? 0,
    cleared: d.cleared === true,
    createdAt: iso(d.createdAt) ?? '',
  };
}

const postRef = (db: Firestore, id: string) => doc(db, COLLECTION, id);
const likeRef = (db: Firestore, id: string, uid: string) => doc(db, COLLECTION, id, 'likes', uid);

/** Akış süzgeci: Mahallem kendi mahallesi, Bölgesel kendi ili (istenirse bir ilçesi), Genel herkes. */
export type FeedFilter =
  | { target: 'mahallem'; neighbourhoodId: string }
  | { target: 'bolgesel'; provinceCode: string; districtId?: string }
  | { target: 'genel' };

export interface FeedPage {
  posts: Post[];
  /** Sonraki sayfa için; null ise akışın sonu. */
  cursor: string | null;
}

/**
 * Uygulama: Keşfet akışı (sayfa sayfa, yeniden eskiye), paylaşma, silme, beğeni, şikâyet. Güvenlik kuralları
 * Mahallem gönderisini yalnızca o mahalledekine, Bölgesel'i yalnızca o ildekine okutur.
 */
export function createFirestorePostRepository(db: Firestore) {
  return {
    async feed(filter: FeedFilter, cursor: string | null = null): Promise<FeedPage> {
      const c: QueryConstraint[] = [where(`targets.${filter.target}`, '==', true), where('status', '==', 'aktif')];
      if (filter.target === 'mahallem') c.push(where('region.neighbourhoodId', '==', filter.neighbourhoodId));
      if (filter.target === 'bolgesel') {
        // İl süzgeci ilçe seçilince de kalır: kurallar ili sorgudan doğrular.
        c.push(where('region.provinceCode', '==', filter.provinceCode));
        if (filter.districtId) c.push(where('region.districtId', '==', filter.districtId));
      }
      c.push(orderBy('createdAt', 'desc'));
      if (cursor) c.push(startAfter(Timestamp.fromDate(new Date(cursor))));
      c.push(limit(POST_LIMITS.pageSize));
      const docs = (await getDocs(query(collection(db, COLLECTION), ...c))).docs;
      const posts = docs.map((d) => fromDoc(d.id, d.data()));
      return { posts, cursor: posts.length === POST_LIMITS.pageSize ? posts[posts.length - 1].createdAt : null };
    },

    async listMine(uid: string): Promise<Post[]> {
      const snap = await getDocs(query(collection(db, COLLECTION), where('authorUid', '==', uid), limit(200)));
      return snap.docs.map((d) => fromDoc(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async get(id: string): Promise<Post | null> {
      const snap = await getDoc(postRef(db, id));
      return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },

    /** Döner: yeni kimlik. Bölge, kuralların denetlediği kayıtlı konumdur. */
    async create(uid: string, authorName: string, input: PostInput): Promise<string> {
      const ref = doc(collection(db, COLLECTION));
      const r = input.region;
      const batch = writeBatch(db);
      batch.set(ref, {
        text: input.text.trim(),
        category: input.category,
        targets: targetsToMap(input.targets),
        region: { provinceCode: r.provinceCode, districtId: r.districtId, neighbourhoodId: r.neighbourhoodId },
        status: 'aktif',
        authorUid: uid,
        authorName: authorName.slice(0, 40),
        likeCount: 0,
        reportCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return ref.id;
    },

    /** Sahibi siler: yazı ve ad boşaltılır, gönderi akıştan çıkar (şikâyet kaydı varsa moderatör "silindi" görür). */
    async remove(id: string): Promise<void> {
      const batch = writeBatch(db);
      batch.update(postRef(db, id), { status: 'kaldirildi', text: '', authorName: '', updatedAt: serverTimestamp() });
      await batch.commit();
    },

    /** Kişinin beğendiği gönderiler (tek sorgu; akıştaki kalpler buna göre dolar). */
    async likedIds(uid: string): Promise<Set<string>> {
      const snap = await getDocs(query(collectionGroup(db, 'likes'), where('uid', '==', uid), limit(500)));
      return new Set(snap.docs.map((d) => d.ref.parent.parent!.id));
    },

    /** Beğeni ve sayaç aynı toplu yazımda (kurallar sayacın tam bir değiştiğini denetler). */
    async like(id: string, uid: string): Promise<void> {
      const batch = writeBatch(db);
      batch.set(likeRef(db, id, uid), { uid, createdAt: serverTimestamp() });
      batch.update(postRef(db, id), { likeCount: increment(1) });
      await batch.commit();
    },

    async unlike(id: string, uid: string): Promise<void> {
      const batch = writeBatch(db);
      batch.delete(likeRef(db, id, uid));
      batch.update(postRef(db, id), { likeCount: increment(-1) });
      await batch.commit();
    },

    /** Kişi başına gönderi başına bir şikâyet; sayaç aynı yazımda tam bir artar. */
    async report(p: Pick<Post, 'id' | 'region'>, uid: string, reason: PostReportReason): Promise<void> {
      const batch = writeBatch(db);
      batch.set(doc(db, REPORTS, `${p.id}_${uid}`), {
        postId: p.id,
        reporterUid: uid,
        reason,
        provinceCode: p.region.provinceCode,
        status: 'yeni',
        createdAt: serverTimestamp(),
      });
      batch.update(postRef(db, p.id), { reportCount: increment(1) });
      await batch.commit();
    },

    async hasReported(id: string, uid: string): Promise<boolean> {
      return getDoc(doc(db, REPORTS, `${id}_${uid}`)).then((s) => s.exists(), () => false);
    },

    /** Hesap silmede (KVKK): kişinin gönderileri boşaltılır, beğenileri geri alınır. */
    async deleteAllOf(uid: string): Promise<void> {
      const mine = await getDocs(query(collection(db, COLLECTION), where('authorUid', '==', uid), limit(500)));
      for (const d of mine.docs) {
        if (d.get('status') === 'kaldirildi' && !d.get('text')) continue;
        const batch = writeBatch(db);
        batch.update(d.ref, { status: 'kaldirildi', text: '', authorName: '', updatedAt: serverTimestamp() });
        await batch.commit();
      }
      const likes = await getDocs(query(collectionGroup(db, 'likes'), where('uid', '==', uid), limit(500)));
      for (const l of likes.docs) {
        const batch = writeBatch(db);
        batch.delete(l.ref);
        batch.update(l.ref.parent.parent!, { likeCount: increment(-1) });
        await batch.commit();
      }
    },
  };
}

export interface PostReport {
  id: string;
  postId: string;
  reporterUid: string;
  reason: PostReportReason;
  provinceCode: string;
  status: 'yeni' | 'incelendi';
  createdAt: string;
  post: Post | null;
}

/**
 * Panel > Moderasyon: şikâyet edilen Keşfet gönderileri. Admin hepsini, il yöneticisi ve gönüllü moderatör kendi ilini
 * görür. "Kaldır" gönderiyi akıştan çıkarır; "Yerinde kalsın" şikâyet sayısıyla düşmesini engeller. Her işlem kayda geçer.
 */
export function createPostModeration(db: Firestore, actorUid: string) {
  const decide = async (r: PostReport, patch: Record<string, unknown>, summary: string) => {
    const batch = writeBatch(db);
    if (r.post) batch.update(postRef(db, r.postId), { ...patch, moderatedBy: actorUid, updatedAt: serverTimestamp() });
    batch.update(doc(db, REPORTS, r.id), { status: 'incelendi' });
    const reg = r.post?.region;
    addAudit(db, batch, {
      actorUid,
      module: 'moderasyon',
      action: 'duzenle',
      targetId: r.postId,
      scope: reg ? { level: 'ilce', provinceCode: reg.provinceCode, districtId: reg.districtId } : { level: 'il', provinceCode: r.provinceCode },
      summary: `${summary}: ${r.post?.text.slice(0, 60) || r.postId}`,
    });
    await batch.commit();
  };

  return {
    async listReports(scope: 'admin' | { provinceCode: string }): Promise<PostReport[]> {
      const q =
        scope === 'admin'
          ? query(collection(db, REPORTS), orderBy('createdAt', 'desc'), limit(100))
          : query(collection(db, REPORTS), where('provinceCode', '==', scope.provinceCode), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const p = await getDoc(postRef(db, data.postId)).catch(() => null);
          return {
            id: d.id,
            postId: data.postId,
            reporterUid: data.reporterUid,
            reason: data.reason,
            provinceCode: data.provinceCode,
            status: data.status,
            createdAt: iso(data.createdAt) ?? '',
            post: p?.exists() ? fromDoc(p.id, p.data()) : null,
          };
        }),
      );
    },

    remove: (r: PostReport) => decide(r, { status: 'kaldirildi' }, 'Gönderi kaldırıldı (şikâyet)'),
    keep: (r: PostReport) => decide(r, { cleared: true }, 'Şikâyet incelendi, gönderi yerinde kaldı'),
  };
}
