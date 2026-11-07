import { describe, expect, it } from 'vitest';

import { photoFrom, photoPaths, thumbUrl } from './photo';

const path = 'media/u1/isletme-vitrin/abcDEF123456.jpg';
const url = `https://firebasestorage.googleapis.com/v0/b/cityjoynew.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media&token=t`;

describe('görsel', () => {
  it('yalnızca kendi dosya depomuzdaki, yoluyla eşleşen adres kabul edilir', () => {
    expect(photoFrom({ path, url, width: 800.4, height: 600 })).toEqual({ path, url, width: 800, height: 600 });
    expect(photoFrom({ path, url: 'https://kotu.site/x.jpg', width: 800, height: 600 })).toBeUndefined();
    expect(photoFrom({ path: 'media/u2/isletme-vitrin/abcDEF123456.jpg', url, width: 800, height: 600 })).toBeUndefined();
    expect(photoFrom({ path, url, width: 0, height: 600 })).toBeUndefined();
    expect(photoFrom('x')).toBeUndefined();
  });

  it('yolları toplar', () => {
    const p = { path, url, width: 1, height: 1 };
    expect(photoPaths(p, [p, p], undefined, null)).toEqual([path, path, path]);
  });
});

describe('küçük kopya adresi', () => {
  const url = 'https://firebasestorage.googleapis.com/v0/b/x.app/o/media%2Fu1%2Fprofil%2Fabc.jpg?alt=media&token=t1';
  it('asıl adresten thumbs/ yolunu ve aynı anahtarı üretir', () => {
    expect(thumbUrl({ path: 'media/u1/profil/abc.jpg', url })).toBe(
      'https://firebasestorage.googleapis.com/v0/b/x.app/o/thumbs%2Fmedia%2Fu1%2Fprofil%2Fabc.jpg?alt=media&token=t1',
    );
  });
  it('yol adreste yoksa asıl adresi döndürür', () => {
    expect(thumbUrl({ path: 'media/u1/profil/zzz.jpg', url })).toBe(url);
  });
});
