import type { Photo, TourScene } from '@cityjoy/shared';
import { doc, getDoc } from 'firebase/firestore';
import { createTravelAdmin, uploadMedia } from '@cityjoy/shared/firebase';

import { firestore, storage } from './firebase';
import { prepareImage } from './image';

/**
 * Yalnızca geliştirme bilgisayarında (vite dev): emülatörde hazırlanan "İçini gez" gezilerini, panele giriş yapmış
 * admin'in yetkisiyle yayındaki projeye taşır. Resimler tarayıcıda küçültülüp admin'in klasörüne yüklenir, kayıt
 * Panel > Seyahat'in kaydetme koduyla (işlem kaydı dahil) yazılır. Yayında olan yerde yalnızca gezi değişir; olmayan
 * yer emülatördeki hâliyle eklenir. Yüklenen resimler tarayıcıda hatırlanır, yarıda kalırsa kaldığı yerden sürer.
 */
const EMU = 'http://127.0.0.1:8080/v1/projects/cityjoynew/databases/(default)/documents';

const plain = (v: any): any =>
  'stringValue' in v ? v.stringValue
  : 'integerValue' in v ? Number(v.integerValue)
  : 'doubleValue' in v ? v.doubleValue
  : 'booleanValue' in v ? v.booleanValue
  : 'nullValue' in v ? null
  : 'timestampValue' in v ? v.timestampValue
  : 'arrayValue' in v ? (v.arrayValue.values ?? []).map(plain)
  : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, plain(x)]))
  : undefined;

async function emulatorPlaces(cityId: string) {
  const out: { id: string; data: any }[] = [];
  let token = '';
  do {
    const res = await fetch(`${EMU}/travelPlaces?pageSize=300${token ? `&pageToken=${token}` : ''}`, { headers: { Authorization: 'Bearer owner' } });
    if (!res.ok) throw new Error('Emülatör açık değil (8080).');
    const r: any = await res.json();
    for (const d of r.documents ?? []) {
      const data = plain({ mapValue: d });
      if (data.cityId === cityId && data.tour?.length) out.push({ id: d.name.split('/').pop(), data });
    }
    token = r.nextPageToken ?? '';
  } while (token);
  return out.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
}

export async function importEmulatorTours(uid: string, cityId: string, progress: (text: string) => void): Promise<string> {
  const places = await emulatorPlaces(cityId);
  const admin = createTravelAdmin(firestore, uid);
  const cacheKey = `gezi-aktar:${uid}`;
  let cache: Record<string, Photo> = {};
  try {
    cache = JSON.parse(localStorage.getItem(cacheKey) ?? '{}');
  } catch {
    cache = {};
  }
  let added = 0;
  let updated = 0;
  for (const [i, p] of places.entries()) {
    const tour: TourScene[] = [];
    for (const [j, s] of (p.data.tour as TourScene[]).entries()) {
      progress(`${i + 1}/${places.length} ${p.data.name}: resim ${j + 1}/${p.data.tour.length}`);
      if (!cache[s.image.path]) {
        const res = await fetch(s.image.url);
        if (!res.ok) throw new Error(`Resim okunamadı (yerel depo 9199 açık mı?): ${s.image.path}`);
        const blob = await res.blob();
        const file = new File([blob], 'gezi.png', { type: 'image/png' });
        cache[s.image.path] = await uploadMedia(storage, uid, 'seyahat', await prepareImage(file));
        try {
          localStorage.setItem(cacheKey, JSON.stringify(cache));
        } catch {
          // Hatırlanamazsa yeniden çalıştırmada resim bir kez daha yüklenir.
        }
      }
      tour.push({ ...s, image: cache[s.image.path]! });
    }
    const snap = await getDoc(doc(firestore, 'travelPlaces', p.id));
    const live = snap.exists() ? snap.data() : null;
    const { updatedAt: _u, ...base } = (live ?? p.data) as Record<string, unknown>;
    await admin.savePlace(p.id, { ...(base as any), tour });
    if (live) updated++;
    else added++;
  }
  return `${places.length} yerin gezisi yayına aktarıldı: ${updated} var olan yere gezi eklendi, ${added} yeni yer eklendi.`;
}
