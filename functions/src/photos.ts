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

/** Kayıttaki görsel alanı; `owners` verilirse yalnızca bu kişilerin klasöründeki dosyalar silinir. */
export interface MediaField {
  key: string;
  owners?: (d: DocumentData) => unknown[];
}

/** Etkinlik kapağı, kurum logosu, işletme logosu ve vitrini (`media/{yükleyen}/{tür}/...`). */
export const MEDIA_FIELDS = {
  events: [{ key: 'cover', owners: (d) => [d.preparedBy] }],
  officialProfiles: [{ key: 'logo' }],
  businesses: [{ key: 'logo' }, { key: 'gallery', owners: (d) => [d.ownerUid, ...(Array.isArray(d.managerUids) ? d.managerUids : [])] }],
} satisfies Record<string, MediaField[]>;

const pathsOf = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v ? [v] : []).map((p) => (p as { path?: unknown })?.path).filter((p): p is string => typeof p === 'string' && p.startsWith('media/'));

/**
 * Kayıttan çıkan (değiştirilen, kaldırılan ya da kayıt silinince) görsellerin dosyalarını siler. Kurallar yeni bağlanan
 * görselin bağlayanın kendi dosyası olmasını ister; vitrinde ayrıca yalnızca sahibin ve yetkililerin dosyası silinir.
 */
export async function handleMediaChange(fields: MediaField[], before: DocumentData | undefined, after: DocumentData | undefined, deleteFiles: DeleteFiles): Promise<string[]> {
  if (!before) return [];
  const gone: string[] = [];
  for (const f of fields) {
    const kept = new Set(pathsOf(after?.[f.key]));
    const owners = f.owners?.(before).filter((u): u is string => typeof u === 'string');
    for (const p of pathsOf(before[f.key])) {
      if (kept.has(p) || (owners && !owners.includes(p.split('/')[1]))) continue;
      gone.push(p);
    }
  }
  await Promise.all(gone.map((p) => deleteFiles(p)));
  return gone;
}
