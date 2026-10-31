import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { PHOTO_UPLOAD } from '@cityjoy/shared';
import type { PreparedPhoto } from '@cityjoy/shared/firebase';

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
