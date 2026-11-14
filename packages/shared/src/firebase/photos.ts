import { deleteObject, getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

import { assertWritable } from './metered';
import { mediaPath, PHOTO_UPLOAD, type MediaKind, type Photo } from '../media/photo';
import { POST_LIMITS, POST_VIDEO_TYPES, postPhotoPath, postPosterPath, postVideoPath, type PostPhoto, type PostVideo, type PostVideoExt } from '../posts/posts';

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
  assertWritable('storage');
  await uploadBytes(r, blob, { contentType: 'image/jpeg' });
  return { path, url: await getDownloadURL(r), width: Math.round(p.width), height: Math.round(p.height) };
}

/** Telefonda seçilen video: yerel dosya adresi, uzantı, boyutlar ve süre (saniye). */
export interface PreparedVideo {
  uri: string;
  ext: PostVideoExt;
  width: number;
  height: number;
  durationSec: number;
  /** Düzenleyicide seçilen kapak karesi (yerel JPEG). */
  coverUri?: string;
}

export class VideoTooLargeError extends Error {
  constructor() {
    super('video-too-large');
  }
}

/** Gönderi videosunu yükler (`posts/{uid}/{postId}/video.mp4|mov`); 40 MB'tan büyükse yüklemeden durur. */
export async function uploadPostVideo(storage: FirebaseStorage, uid: string, postId: string, v: PreparedVideo): Promise<PostVideo> {
  const blob = await (await fetch(v.uri)).blob();
  if (blob.size > POST_LIMITS.videoBytes) throw new VideoTooLargeError();
  const path = postVideoPath(uid, postId, v.ext);
  const r = ref(storage, path);
  assertWritable('storage');
  await uploadBytes(r, blob, { contentType: POST_VIDEO_TYPES[v.ext] });
  const out: PostVideo = { path, url: await getDownloadURL(r), width: Math.round(v.width), height: Math.round(v.height), durationSec: Math.round(v.durationSec) };
  // Kapak yüklenemezse video kapaksız paylaşılır.
  if (v.coverUri) {
    try {
      const c = await (await fetch(v.coverUri)).blob();
      const cr = ref(storage, postPosterPath(uid, postId));
      if (c.size <= 400_000) {
        await uploadBytes(cr, c, { contentType: 'image/jpeg' });
        out.poster = await getDownloadURL(cr);
      }
    } catch {
      /* kapaksız devam */
    }
  }
  return out;
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
