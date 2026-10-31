import { deleteObject, getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

import { PHOTO_UPLOAD, postPhotoPath, type PostPhoto } from '../posts/posts';

/** Telefonda küçültülmüş JPEG (yerel dosya adresi ve boyutları). */
export interface PreparedPhoto {
  uri: string;
  width: number;
  height: number;
}

export class PhotoTooLargeError extends Error {
  constructor() {
    super('photo-too-large');
  }
}

/**
 * Gönderi fotoğraflarını sırayla yükler (`posts/{uid}/{postId}/{sıra}.jpg`). Kurallar yalnızca JPEG'i ve sınırın
 * altındaki dosyayı kabul eder; yüklenen dosyanın yerine başkası yazılamaz.
 */
export async function uploadPostPhotos(storage: FirebaseStorage, uid: string, postId: string, photos: readonly PreparedPhoto[]): Promise<PostPhoto[]> {
  const out: PostPhoto[] = [];
  for (const [i, p] of photos.entries()) {
    const blob = await (await fetch(p.uri)).blob();
    if (blob.size > PHOTO_UPLOAD.maxBytes) throw new PhotoTooLargeError();
    const path = postPhotoPath(uid, postId, i);
    const r = ref(storage, path);
    await uploadBytes(r, blob, { contentType: 'image/jpeg' });
    out.push({ path, url: await getDownloadURL(r), width: p.width, height: p.height });
  }
  return out;
}

/** Gönderi kaydedilemezse yüklenmiş dosyaları geri siler (elde kalmasın). Hata verirse yutulur. */
export async function deletePostPhotos(storage: FirebaseStorage, photos: readonly PostPhoto[]): Promise<void> {
  await Promise.all(photos.map((p) => deleteObject(ref(storage, p.path)).catch(() => {})));
}
