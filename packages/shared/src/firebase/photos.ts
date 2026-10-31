import { deleteObject, getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

import { mediaPath, PHOTO_UPLOAD, type MediaKind, type Photo } from '../media/photo';
import { postPhotoPath, type PostPhoto } from '../posts/posts';

/** Küçültülmüş JPEG: telefonda yerel dosya adresi (`uri`), panelde tarayıcıdaki veri (`blob`). */
export interface PreparedPhoto {
  uri?: string;
  blob?: Blob;
  width: number;
  height: number;
}

export class PhotoTooLargeError extends Error {
  constructor() {
    super('photo-too-large');
  }
}

/** Kurallar yalnızca JPEG'i ve sınırın altındaki dosyayı kabul eder; yüklenen dosyanın yerine başkası yazılamaz. */
async function put(storage: FirebaseStorage, path: string, p: PreparedPhoto): Promise<Photo> {
  const blob = p.blob ?? (await (await fetch(p.uri!)).blob());
  if (blob.size > PHOTO_UPLOAD.maxBytes) throw new PhotoTooLargeError();
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: 'image/jpeg' });
  return { path, url: await getDownloadURL(r), width: Math.round(p.width), height: Math.round(p.height) };
}

/** Gönderi fotoğraflarını sırayla yükler (`posts/{uid}/{postId}/{sıra}.jpg`). */
export async function uploadPostPhotos(storage: FirebaseStorage, uid: string, postId: string, photos: readonly PreparedPhoto[]): Promise<PostPhoto[]> {
  const out: PostPhoto[] = [];
  for (const [i, p] of photos.entries()) out.push(await put(storage, postPhotoPath(uid, postId, i), p));
  return out;
}

const randomId = () => Array.from({ length: 20 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');

/** Etkinlik kapağı, kurum logosu, işletme logosu ya da vitrin fotoğrafı (`media/{uid}/{tür}/{rastgele}.jpg`). */
export function uploadMedia(storage: FirebaseStorage, uid: string, kind: MediaKind, photo: PreparedPhoto): Promise<Photo> {
  return put(storage, mediaPath(uid, kind, randomId()), photo);
}

/** Kayıt yazılamazsa yüklenmiş dosyaları geri siler (elde kalmasın). Hata verirse yutulur. */
export async function deletePhotos(storage: FirebaseStorage, photos: readonly Photo[]): Promise<void> {
  await Promise.all(photos.map((p) => deleteObject(ref(storage, p.path)).catch(() => {})));
}
