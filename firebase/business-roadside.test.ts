import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { geoPoint, type BusinessInput } from '@cityjoy/shared';
import { createFirestoreBusinessRepository } from '@cityjoy/shared/firebase';
import { deleteField, doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cityjoy',
    firestore: { rules: readFileSync(path.join(here, 'firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const fs = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const biz = (uid: string) => createFirestoreBusinessRepository(fs(uid));

const tesis: BusinessInput = {
  type: 'yol-ustu', name: 'Kestel Dinlenme Tesisi', categoryIds: ['yol-dinlenme-tesisi'],
  location: { provinceCode: '16', districtId: '16-kestel' }, phone: '02241112233', whatsapp: false, is24h: true, priceList: [],
  roadside: ['tuvalet', 'akaryakit', 'mescit'], geo: geoPoint(40.1985, 29.2142),
};

describe('yol üstü tesis', () => {
  it('olanaklar ve konumla kaydedilir, okunur, güncellenir', async () => {
    const id = await biz('ali').create('ali', tesis);
    const b = (await biz('x').get(id))!;
    expect(b.roadside).toEqual(['tuvalet', 'akaryakit', 'mescit']);
    expect(b.geo).toEqual(geoPoint(40.1985, 29.2142));

    // Başka türdeki işletme yol üstü işaretini kaldırınca konum da silinir.
    await biz('ali').update(id, { ...tesis, type: 'yeme-icme', categoryIds: ['yemek-restoran'], roadside: [], geo: undefined });
    const after = (await biz('x').get(id))!;
    expect(after.roadside).toBeUndefined();
    expect(after.geo).toBeUndefined();
  });

  it('olanaksız, konumsuz, Türkiye dışı ya da bilinmeyen olanaklı kayıt reddedilir', async () => {
    const id = await biz('ali').create('ali', tesis);
    const ref = doc(fs('ali'), 'businesses', id);
    const up = (data: Record<string, unknown>) => updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
    await assertFails(up({ geo: deleteField() }));
    await assertFails(up({ roadside: deleteField() }));
    await assertFails(up({ roadside: [] }));
    await assertFails(up({ roadside: ['tuvalet', 'kumarhane'] }));
    await assertFails(up({ geo: { lat: 0, lng: 0, geohash: 's00000000' } }));
    await assertFails(up({ geo: { ...geoPoint(40.2, 29.2), extra: 1 } }));
    await assertSucceeds(up({ roadside: ['tuvalet'], geo: geoPoint(40.25, 29.3) }));
    // Başkası değiştiremez.
    await assertFails(updateDoc(doc(fs('veli'), 'businesses', id), { roadside: ['tuvalet', 'lpg'], updatedAt: serverTimestamp() }));
  });

  it('yol üstü olmayan işletmede konum tutulmaz', async () => {
    const id = await biz('ayse').create('ayse', { ...tesis, type: 'hizmet', categoryIds: ['tesisatci'], roadside: undefined, geo: undefined, phone: '05321112233' });
    await assertFails(updateDoc(doc(fs('ayse'), 'businesses', id), { geo: geoPoint(40.2, 29.2), updatedAt: serverTimestamp() }));
  });
});
