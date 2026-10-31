import { PHOTO_UPLOAD } from '@cityjoy/shared';
import type { PreparedPhoto } from '@cityjoy/shared/firebase';

/**
 * Seçilen resmi tarayıcıda küçültür: en uzun kenar 1600 piksel, JPEG. Tuvale çizilip yeniden kodlandığı için konum ve
 * cihaz bilgisi (EXIF) atılır; telefon fotoğrafının yönü korunur.
 */
export async function prepareImage(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('not-image');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, PHOTO_UPLOAD.maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-canvas');
  // Saydam PNG logoların arkası beyaz olsun (JPEG saydamlık tutmaz).
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_UPLOAD.quality));
  if (!blob) throw new Error('encode');
  return { blob, width, height };
}
