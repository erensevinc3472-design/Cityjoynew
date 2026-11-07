/**
 * İşletme adına yayındaki gönderi sayısı (Karar Eren, 7 Kasım 2026: Ücretsiz doğrulanmış işletme toplam en çok 9 gönderi,
 * Pro'da sınır yok). Sayıyı istemci yazamaz; her gönderi değişiminde sunucu yeniden sayar ve `businesses/{id}.postCount`
 * alanına yazar. Kurallar yeni işletme gönderisinde bu sayıyı sınırla karşılaştırır.
 */
import type { DocumentData, Firestore } from 'firebase-admin/firestore';

const businessOf = (d: DocumentData | undefined): string | undefined => {
  const id = d?.business?.id;
  return typeof id === 'string' && id ? id : undefined;
};

/** Gönderi oluşturulunca, durumu değişince ya da silinince ilgili işletmenin sayısını günceller. */
export async function handleBusinessPostWrite(db: Firestore, before: DocumentData | undefined, after: DocumentData | undefined): Promise<void> {
  const ids = new Set<string>();
  const b = businessOf(before);
  const a = businessOf(after);
  // Durum ya da işletme değişmediyse (beğeni, yorum sayacı) yeniden sayma.
  if (before && after && b === a && before.status === after.status) return;
  if (b) ids.add(b);
  if (a) ids.add(a);
  for (const id of ids) {
    const ref = db.doc(`businesses/${id}`);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const agg = await db.collection('posts').where('business.id', '==', id).where('status', '==', 'aktif').count().get();
    const postCount = agg.data().count;
    if (snap.get('postCount') !== postCount) await ref.update({ postCount });
  }
}
