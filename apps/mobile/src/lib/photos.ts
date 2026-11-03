import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { PHOTO_UPLOAD, POST_LIMITS } from '@cityjoy/shared';
import type { PreparedPhoto, PreparedVideo } from '@cityjoy/shared/firebase';

export class PhotoPermissionError extends Error {
  constructor() {
    super('photo-permission');
  }
}

/**
 * Galeriden fotoğraf seçtirir (en çok `room` tane) ve her birini küçültür: en uzun kenar 1600 piksel, JPEG. Yeniden
 * kodlama sırasında konum ve cihaz bilgisi (EXIF) atılır. Vazgeçilirse boş liste döner.
 */
export async function pickPhotos(room: number, opts: { square?: boolean; maxEdge?: number } = {}): Promise<PreparedPhoto[]> {
  if (room <= 0) return [];
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') throw new PhotoPermissionError();
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: room > 1 && !opts.square,
    // Kare kırpma yalnızca tek seçimde çalışır (profil fotoğrafı).
    ...(opts.square ? { allowsEditing: true, aspect: [1, 1] as [number, number] } : {}),
    selectionLimit: Math.min(room, 10),
    quality: 1,
    exif: false,
  });
  if (res.canceled) return [];
  const out: PreparedPhoto[] = [];
  for (const a of res.assets.slice(0, room)) out.push(await shrink(a.uri, a.width, a.height, opts.maxEdge ?? PHOTO_UPLOAD.maxEdge));
  return out;
}

async function shrink(uri: string, width: number, height: number, maxEdge: number): Promise<PreparedPhoto> {
  const edge = Math.max(width, height);
  const ctx = ImageManipulator.manipulate(uri);
  if (edge > maxEdge) ctx.resize(width >= height ? { width: maxEdge } : { height: maxEdge });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: PHOTO_UPLOAD.quality, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export class VideoTooLongError extends Error {
  constructor() {
    super('video-too-long');
  }
}

export class VideoFileTooLargeError extends Error {
  constructor() {
    super('video-too-large');
  }
}

/** Web'de seçicinin bildirmediği süre, dosyanın üst bilgisinden okunur. */
function webDuration(uri: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    v.onerror = () => reject(new Error('video-metadata'));
    v.src = uri;
  });
}

/**
 * Galeriden tek video seçtirir (gönderi videosu, PROJE.md 5.5 madde 2): en çok 60 saniye ve 40 MB. iPhone'da seçici
 * videoyu orta kaliteye sıkıştırır ve 60 saniyeyle sınırlar. Vazgeçilirse null döner.
 */
export async function pickVideo(): Promise<PreparedVideo | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') throw new PhotoPermissionError();
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsMultipleSelection: false,
    videoMaxDuration: POST_LIMITS.videoSeconds,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  // Telefonda süre milisaniye gelir; web'de seçicinin bildirdiği değere güvenilmez, dosyanın kendi bilgisi okunur.
  let seconds = Platform.OS !== 'web' && typeof a.duration === 'number' && a.duration > 0 ? a.duration / 1000 : 0;
  let { width, height } = a;
  if (Platform.OS === 'web') {
    const meta = await webDuration(a.uri);
    seconds = meta.duration;
    width = meta.width || width;
    height = meta.height || height;
  }
  if (!seconds || seconds > POST_LIMITS.videoSeconds + 0.5) throw new VideoTooLongError();
  if (a.fileSize && a.fileSize > POST_LIMITS.videoBytes) throw new VideoFileTooLargeError();
  const mov = a.mimeType === 'video/quicktime' || /\.mov$/i.test(a.fileName ?? a.uri);
  return { uri: a.uri, ext: mov ? 'mov' : 'mp4', width: width || 720, height: height || 1280, durationSec: Math.max(1, Math.min(POST_LIMITS.videoSeconds, Math.round(seconds))) };
}
