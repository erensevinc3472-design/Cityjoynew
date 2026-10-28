import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { SEED_LOCAL, SEED_PLACES, SEED_ROUTES } from '@cityjoy/shared';
import { createFirestoreTravelRepository, createTravelAdmin } from '@cityjoy/shared/firebase';
import { collection, doc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
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
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' }));
});

const fs = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;

describe('seyahat', () => {
  it('başlangıç içeriği taslak yüklenir, uygulama yalnızca yayındakini görür; yalnızca admin yazar; işlem kaydı', async () => {
    const admin = createTravelAdmin(fs('eren'), 'eren');
    const app = createFirestoreTravelRepository(fs('ali'));
    expect(await admin.importSeed()).toBe(1 + 1 + SEED_PLACES.length + SEED_ROUTES.length + SEED_LOCAL.length);
    // İkinci yüklemede var olanlar atlanır.
    expect(await admin.importSeed()).toBe(0);

    expect(await app.listRegions()).toEqual([]);
    expect(await app.listPlaces('16')).toEqual([]);
    await expect(app.getPlace('bursa-ulu-camii')).rejects.toThrow();

    await admin.setStatus('bolge', 'marmara', 'yayinda', 'Marmara');
    await admin.setStatus('sehir', '16', 'yayinda', 'Bursa');
    await admin.setStatus('yer', 'bursa-ulu-camii', 'yayinda', 'Ulu Camii');
    expect((await app.listRegions()).map((r) => r.id)).toEqual(['marmara']);
    expect((await app.listCities('marmara')).map((c) => [c.id, c.highlights.length > 0])).toEqual([['16', true]]);
    expect((await app.listPlaces('16')).map((p) => p.name)).toEqual(['Ulu Camii']);
    expect((await app.getPlace('bursa-ulu-camii'))?.mustSee).toBe(true);

    // Admin olmayan yazamaz; geçersiz bağlantı ve kategori reddedilir.
    const ali = createTravelAdmin(fs('ali'), 'ali');
    await expect(ali.setStatus('yer', 'bursa-koza-han', 'yayinda', 'Koza Han')).rejects.toThrow();
    const base = (await admin.listAll()).places.find((p) => p.id === 'bursa-koza-han')!;
    const { id: _i, updatedAt: _u, ...input } = base;
    await expect(admin.savePlace(base.id, { ...input, website: 'http://ornek.com' })).rejects.toThrow();
    await assertFails(setDoc(doc(fs('eren'), 'travelPlaces', 'x'), { ...input, category: 'gece', updatedAt: new Date() }));
    const id = await admin.savePlace(null, { ...input, name: 'Irgandı Köprüsü', status: 'yayinda', order: 10 });
    expect((await app.listPlaces('16')).map((p) => p.id)).toContain(id);
    await admin.deletePlace({ ...base, id });
    expect((await app.listPlaces('16')).map((p) => p.id)).not.toContain(id);

    const log = await getDocs(collection(fs('eren'), 'auditLog'));
    expect(log.docs.map((d) => d.data().module)).toEqual(expect.arrayContaining(['seyahat']));
    expect(log.docs.map((d) => d.data().summary)).toEqual(expect.arrayContaining(['Yayına alındı: Ulu Camii', 'Gezilecek yer silindi: Koza Han']));
  }, 30000);
});
