import { describe, expect, it } from 'vitest';

import { photoFrom, photoPaths } from './photo';

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
