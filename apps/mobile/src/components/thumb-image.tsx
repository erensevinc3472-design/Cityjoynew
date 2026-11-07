import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { thumbUrl, type Photo } from '@cityjoy/shared';

/**
 * Listelerde ve küçük alanlarda fotoğraf: sunucunun hazırladığı küçük kopyayı (640 piksel) gösterir; bu, büyük asıl
 * dosyayı indirmekten çok daha hızlı ve ucuzdur. Küçük kopya henüz yoksa (yeni yüklendi ya da eski fotoğraf) asıl
 * dosyaya döner. Tam ekran ve albüm görünümü asıl dosyayı kullanmaya devam eder.
 */
export function ThumbImage({ photo, ...rest }: Omit<ImageProps, 'source'> & { photo: Pick<Photo, 'path' | 'url'> }) {
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const thumb = thumbUrl(photo);
  const uri = failedFor === photo.url || thumb === photo.url ? photo.url : thumb;
  return (
    <Image
      recyclingKey={photo.path}
      {...rest}
      source={{ uri }}
      onError={(e) => {
        if (uri !== photo.url) setFailedFor(photo.url);
        rest.onError?.(e);
      }}
    />
  );
}
