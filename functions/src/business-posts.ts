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
  if (before && after && b === a && before.status === after.status && (before.tierHidden === true) === (after.tierHidden === true)) return;
  if (b) ids.add(b);
  if (a) ids.add(a);
  for (const id of ids) {
    const ref = db.doc(`businesses/${id}`);
    const snap = await ref.get();
    if (!snap.exists) continue;
    // Pro bitince gizlenenler (tierHidden) sayılmaz: sınır görünen gönderiler içindir.
    const active = db.collection('posts').where('business.id', '==', id).where('status', '==', 'aktif');
    const [all, hidden] = await Promise.all([active.count().get(), active.where('tierHidden', '==', true).count().get()]);
    const postCount = all.data().count - hidden.data().count;
    if (snap.get('postCount') !== postCount) await ref.update({ postCount });
  }
}
