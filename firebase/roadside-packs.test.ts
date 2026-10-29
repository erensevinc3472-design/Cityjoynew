import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { roadsidePackCells, type PackedPlace } from '@cityjoy/shared';
import { createRoadsidePackAdmin, createRoadsidePackRepository } from '@cityjoy/shared/firebase';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where, type Firestore } from 'firebase/firestore';
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
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' });
  });
});

const fs = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const places: PackedPlace[] = [
  { i: 'n1', n: 'Opet Kestel', k: 'yol-akaryakit', a: 40.1986, o: 29.2143, f: ['akaryakit', 'lpg'], b: 'Opet' },
  { i: 'n2', n: 'Şarj Noktası', k: 'yol-sarj', a: 40.25, o: 29.3, f: ['sarj'] },
  { i: 'w3', n: 'Ankara Dinlenme', k: 'yol-dinlenme-tesisi', a: 39.92, o: 32.85, f: [] },
];

describe('yol üstü OSM paketleri', () => {
  it('admin yükler, herkes okur; yeniden yüklemede eskiyen hücre silinir; işlem kayda geçer', async () => {
    const admin = createRoadsidePackAdmin(fs('eren'), 'eren');
    expect(await admin.replaceAll(places)).toEqual({ cells: 2, places: 3 });
    const guest = createRoadsidePackRepository(env.unauthenticatedContext().firestore() as unknown as Firestore);
    const near = await guest.getCells(roadsidePackCells(40.19, 29.2));
    expect(near.map((p) => p.id).sort()).toEqual(['osm-n1', 'osm-n2']);

    await admin.replaceAll(places.slice(0, 2));
    expect((await admin.summary()).map((s) => s.count)).toEqual([2]);
    const logs = await getDocs(query(collection(fs('eren'), 'auditLog'), where('actorUid', '==', 'eren')));
    expect(logs.size).toBe(2);
  });

  it('admin olmayan yazamaz, silemez', async () => {
    await createRoadsidePackAdmin(fs('eren'), 'eren').replaceAll(places);
    const cell = (await createRoadsidePackAdmin(fs('eren'), 'eren').summary())[0].cell;
    const data = { cell, items: [], count: 0, source: 'osm', updatedAt: serverTimestamp(), updatedBy: 'ali' };
    await assertFails(setDoc(doc(fs('ali'), 'roadsidePacks', cell), data));
    await assertFails(deleteDoc(doc(fs('ali'), 'roadsidePacks', cell)));
    // Admin de yanlış biçimde yazamaz (sayı tutmuyor, kaynak farklı).
    await assertFails(setDoc(doc(fs('eren'), 'roadsidePacks', cell), { ...data, updatedBy: 'eren', count: 5 }));
    await assertFails(setDoc(doc(fs('eren'), 'roadsidePacks', cell), { ...data, updatedBy: 'eren', source: 'el' }));
  });
});
