import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';

import type { AnnouncementAuthor } from '../announcements/announcements';
import { contentOwnerOf, contentViewId, type ContentKind, type ContentPerformance } from '../organizations/content-stats';
import { iso } from './grants';

const VIEWS = 'contentViews';

/**
 * Uygulama: içerik ayrıntısı açılınca bir kez "okundu", paylaşılınca bir kez "paylaşıldı" yazılır (PROJE.md 6.1).
 * Okuma yok; aynı kişinin ikinci denemesini kurallar reddeder, hata sessizce yutulur. Telefon aynı içeriği bir oturumda
 * tekrar denemez (bellekte tutulur).
 */
export function createContentStatsRecorder(db: Firestore) {
  const seen = new Set<string>();
  const shared = new Set<string>();
  return {
    async view(k: 'a' | 'e', item: { id: string; author: AnnouncementAuthor }, uid: string): Promise<void> {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      await setDoc(doc(db, VIEWS, contentViewId(item.id, uid)), {
        item: item.id, k, owner: contentOwnerOf(item.author), at: serverTimestamp(), sh: false,
      }).catch(() => {});
    },
    async share(itemId: string, uid: string): Promise<void> {
      if (shared.has(itemId)) return;
      shared.add(itemId);
      await updateDoc(doc(db, VIEWS, contentViewId(itemId, uid)), { sh: true }).catch(() => {});
    },
  };
}

/** Panelde içerik listesi için hesap: kurum ya da kişi yetkisi (muhtarlık). */
export type ContentOwner = { type: 'kurum'; orgId: string } | { type: 'kisi'; grantKey: string };

/**
 * Panel: hesabın dönemde yayınladığı içerikler ve her birinin tekil okuyan / paylaşan sayısı. Belge indirilmez,
 * yalnızca sayım yapılır (içerik başına 2 sayım). Sayımları kurallar yalnızca "Kitle istatistikleri" yetkisi olana açar.
 */
export function createContentStatsReader(db: Firestore) {
  const count = async (constraints: QueryConstraint[]): Promise<number | null> => {
    try {
      return (await getCountFromServer(query(collection(db, VIEWS), ...constraints))).data().count;
    } catch {
      return null;
    }
  };
  const ownerKey = (o: ContentOwner) => (o.type === 'kurum' ? o.orgId : o.grantKey);
  const authorWhere = (o: ContentOwner) =>
    o.type === 'kurum' ? where('author.orgId', '==', o.orgId) : where('author.grantKey', '==', o.grantKey);

  return {
    /** Dönemde yayınlanan duyuru, haber, acil duyuru ve etkinlikler (en yeni önce, en çok 200). */
    async listContent(o: ContentOwner, from: Date): Promise<Omit<ContentPerformance, 'reads' | 'shares'>[]> {
      const since = where('publishedAt', '>=', Timestamp.fromDate(from));
      const [ann, ev] = await Promise.all([
        getDocs(query(collection(db, 'announcements'), authorWhere(o), where('status', '==', 'yayinda'), since, limit(200))),
        getDocs(query(collection(db, 'events'), authorWhere(o), where('status', 'in', ['yayinda', 'iptal']), since, limit(200))),
      ]);
      const kindOf = (d: DocumentData): ContentKind => (d.kind === 'acil' ? 'acil' : d.kind === 'haber' ? 'haber' : 'duyuru');
      const rows = [
        ...ann.docs.map((s) => ({ id: s.id, kind: kindOf(s.data()), title: s.data().title as string, publishedAt: iso(s.data().publishedAt) ?? '' })),
        ...ev.docs.map((s) => ({
          id: s.id, kind: 'etkinlik' as const, title: s.data().title as string, publishedAt: iso(s.data().publishedAt) ?? '',
          attendees: (s.data().attendeeCount as number) ?? 0,
        })),
      ];
      return rows.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 200);
    },
    /** Bir içeriğin tekil okuyan ve paylaşan sayısı (yetki yoksa null). */
    async counts(o: ContentOwner, itemId: string): Promise<{ reads: number | null; shares: number | null }> {
      const base = [where('owner', '==', ownerKey(o)), where('item', '==', itemId)];
      const [reads, shares] = await Promise.all([count(base), count([...base, where('sh', '==', true)])]);
      return { reads, shares };
    },
    /** Hesabın bütün içeriklerinin aralıktaki ilk okunmaları (grafik için). */
    readsBetween(o: ContentOwner, from: Date, to: Date) {
      return count([where('owner', '==', ownerKey(o)), where('at', '>=', Timestamp.fromDate(from)), where('at', '<', Timestamp.fromDate(to))]);
    },
  };
}
