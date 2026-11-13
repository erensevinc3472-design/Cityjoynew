import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type DocumentData, type Firestore } from './metered';
import { httpsCallable, type Functions } from 'firebase/functions';

import type { AnnouncementRegion } from '../announcements/announcements';
import type { Broadcast, BroadcastInput } from '../notifications/broadcast';
import { iso } from './grants';

/** Bölgeye toplu bildirim (PROJE.md 7). Panel yazmaz: sayım, gönderme ve onay sunucu işlevlerinde. */
export function broadcastFromDoc(id: string, d: DocumentData): Broadcast {
  return {
    id,
    publisherKey: String(d.publisherKey ?? ''),
    author: d.author ?? { type: 'cityjoy' },
    sourceName: String(d.sourceName ?? ''),
    kind: d.kind === 'acil' ? 'acil' : 'duyuru',
    title: String(d.title ?? ''),
    body: String(d.body ?? ''),
    region: d.region ?? { provinceCode: '' },
    status: d.status,
    preparedBy: String(d.preparedBy ?? ''),
    createdAt: iso(d.createdAt) ?? '',
    ...(iso(d.sentAt) ? { sentAt: iso(d.sentAt) } : {}),
    ...(typeof d.sentCount === 'number' ? { sentCount: d.sentCount } : {}),
    ...(d.reviewedBy ? { reviewedBy: String(d.reviewedBy) } : {}),
    ...(d.reviewNote ? { reviewNote: String(d.reviewNote) } : {}),
  };
}

export function createBroadcastPanel(db: Firestore, functions: Functions) {
  const list = async (...q: Parameters<typeof query> extends [unknown, ...infer R] ? R : never) =>
    (await getDocs(query(collection(db, 'broadcasts'), ...q))).docs.map((d) => broadcastFromDoc(d.id, d.data()));
  return {
    /** Yaklaşık ulaşılacak kişi; null = 50'den az. */
    async estimate(publisherKey: string, region: AnnouncementRegion): Promise<{ reach: number | null; needsApproval: boolean }> {
      return (await httpsCallable<unknown, { reach: number | null; needsApproval: boolean }>(functions, 'broadcastEstimate')({ publisherKey, region })).data;
    },
    async send(input: BroadcastInput): Promise<{ id: string; status: 'gonderildi' | 'onay-bekliyor' }> {
      return (await httpsCallable<BroadcastInput, { id: string; status: 'gonderildi' | 'onay-bekliyor' }>(functions, 'broadcastSend')(input)).data;
    },
    async review(id: string, approve: boolean, note?: string): Promise<void> {
      await httpsCallable(functions, 'broadcastReview')({ id, approve, ...(note ? { note } : {}) });
    },
    /** Kişinin hazırladıkları (onay bekleyen ve reddedilenler dahil). */
    listMine: (uid: string) => list(where('preparedBy', '==', uid), orderBy('createdAt', 'desc'), limit(30)),
    /** Bir hesaptan gönderilmiş olanlar (aynı kurumun öteki personelininkiler de). */
    listSent: (publisherKey: string) => list(where('publisherKey', '==', publisherKey), where('status', '==', 'gonderildi'), orderBy('createdAt', 'desc'), limit(30)),
    /** Admin: onay bekleyen il geneli bildirimler. */
    listPending: () => list(where('status', '==', 'onay-bekliyor'), orderBy('createdAt', 'desc'), limit(50)),
    /** Admin: son gönderilenler (bütün hesaplar). */
    listRecent: () => list(where('status', '==', 'gonderildi'), orderBy('createdAt', 'desc'), limit(30)),
  };
}

/** Uygulama: bildirime dokununca tam metin. */
export async function getBroadcast(db: Firestore, id: string): Promise<Broadcast | null> {
  const snap = await getDoc(doc(db, 'broadcasts', id));
  return snap.exists() ? broadcastFromDoc(snap.id, snap.data()) : null;
}
