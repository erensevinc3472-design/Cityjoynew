import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createFirestoreBusinessRepository } from '@cityjoy/shared/firebase';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cityjoy',
    firestore: { rules: readFileSync(path.join(here, 'firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());

describe('Benim Şehrim > Cafe ve Restoran', () => {
  it('ildeki yayındaki yeme-içme işletmeleri listelenir; gizli olan ve başka tür gelmez', async () => {
    await env.clearFirestore();
    const now = Timestamp.now();
    const base = {
      ownerUid: 'sahip', name: 'X', location: { provinceCode: '16', districtId: '16-osmangazi' }, phone: '02240000000', whatsapp: false, is24h: false,
      priceList: [], verification: { status: 'dogrulanmadi' }, membership: { tier: 'ucretsiz' }, rating: { sum: 0, count: 0 }, createdAt: now, updatedAt: now,
    };
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'businesses/kebapci'), { ...base, type: 'yeme-icme', name: 'Kebapçı', categoryIds: ['yemek-kebap'], status: 'yayinda' });
      await setDoc(doc(db, 'businesses/kafe-gizli'), { ...base, type: 'yeme-icme', name: 'Kafe', categoryIds: ['yemek-kafe'], status: 'gizli' });
      await setDoc(doc(db, 'businesses/cilingir'), { ...base, type: 'hizmet', name: 'Çilingir', categoryIds: ['cilingir'], status: 'yayinda' });
      await setDoc(doc(db, 'businesses/izmir'), { ...base, type: 'yeme-icme', name: 'İzmir', categoryIds: ['yemek-balik'], status: 'yayinda', location: { provinceCode: '35', districtId: '35-konak' } });
    });
    const repo = createFirestoreBusinessRepository(env.authenticatedContext('ali').firestore() as unknown as Firestore);
    expect((await repo.listByType('16', 'yeme-icme')).map((b) => b.id)).toEqual(['kebapci']);
  }, 30000);
});
