import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';

/** Bir klasördeki bütün dosyaları siler (Storage). Testte sahtesi verilir. */
export type DeleteFiles = (prefix: string) => Promise<void>;

/**
 * Gönderi kaldırılınca (sahibi ya da moderatör) fotoğraf dosyaları silinir; moderatör kaldırdıysa kayıttaki fotoğraf
 * alanı da boşaltılır. Fotoğrafı olmayan ya da zaten temizlenmiş gönderide bir şey yapmaz.
 */
export async function handlePostPhotos(db: Firestore, id: string, before: DocumentData | undefined, after: DocumentData | undefined, deleteFiles: DeleteFiles): Promise<boolean> {
  if (!before || !Array.isArray(before.photos) || !before.photos.length) return false;
  const removed = !after || after.status === 'kaldirildi' || !Array.isArray(after.photos);
  if (!removed) return false;
  await deleteFiles(`posts/${before.authorUid}/${id}/`);
  if (after && 'photos' in after) await db.doc(`posts/${id}`).update({ photos: FieldValue.delete() });
  return true;
}
