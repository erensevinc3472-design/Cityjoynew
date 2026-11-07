import sharp from 'sharp';
import { THUMB, thumbPath } from '@cityjoy/shared';

/** Küçük kopyası çıkarılacak dosyalar: gönderi fotoğrafları ve diğer görseller (JPEG). Küçük kopyanın kendisi atlanır. */
export function needsThumb(name: string | undefined, contentType: string | undefined): boolean {
  return !!name && contentType === 'image/jpeg' && /^(posts|media)\//.test(name) && name.endsWith('.jpg');
}

/** En uzun kenarı 640 piksele indirir (küçükse büyütmez), JPEG olarak, konum/cihaz bilgisi olmadan. */
export function makeThumb(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: THUMB.maxEdge, height: THUMB.maxEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: THUMB.quality, mozjpeg: true })
    .toBuffer();
}

/** Depo işlemleri; testte sahtesi verilir. */
export interface ThumbStore {
  read(name: string): Promise<Buffer>;
  write(name: string, data: Buffer, token: string | undefined): Promise<void>;
}

/**
 * Yeni yüklenen fotoğrafın küçük kopyasını `thumbs/{yol}` yoluna yazar. Asıl dosyanın erişim anahtarı aynen verilir;
 * uygulama küçük kopyanın adresini asıl adresten hesaplar (`thumbUrl`). Asıl dosya silinince küçük kopyası da silinir
 * (silme işlevleri `thumbs/` önekini de temizler).
 */
export async function handleThumb(name: string | undefined, contentType: string | undefined, token: string | undefined, store: ThumbStore): Promise<string | null> {
  if (!needsThumb(name, contentType)) return null;
  const out = thumbPath(name!);
  await store.write(out, await makeThumb(await store.read(name!)), token?.split(',')[0]);
  return out;
}
