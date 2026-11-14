import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { reachPlan, type PostInput } from '@cityjoy/shared';
import { createBadgeAdmin, createFirestorePostRepository, createFirestoreSocialRepository } from '@cityjoy/shared/firebase';
import { doc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Resmî CityJoy hesabı (Eren, 14 Kasım 2026). Ayrı proje adı: paneldeki emülatör verisine dokunmaz.
const here = path.dirname(fileURLToPath(import.meta.url));
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cityjoy-resmi',
    firestore: { rules: readFileSync(path.join(here, 'firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());

const fs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }).firestore() as unknown as Firestore;
const ataevler = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
const moda = { provinceCode: '34', districtId: '34-kadikoy', neighbourhoodId: '34-kadikoy-moda' };

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    for (const uid of ['cityjoy', 'ayse']) await setDoc(doc(db, 'users', uid), { uid, displayName: uid, birthYear: 1990, location: ataevler });
  });
  for (const uid of ['cityjoy', 'ayse']) await createFirestoreSocialRepository(fs(uid)).ensureProfile(uid, uid, false);
});

const post = (reach: PostInput['reach'], place: Parameters<typeof reachPlan>[1], patch: Partial<PostInput> = {}): PostInput => {
  const plan = reachPlan(reach!, place, ataevler)!;
  return { text: 'Merhaba Türkiye', category: 'duyuru', targets: plan.targets, region: plan.region, reach, ...patch };
};

describe('Resmî CityJoy hesabı', () => {
  it('işareti yalnızca admin koyar; resmî hesap her yere ve Haberler’e paylaşır, sıradan kişi paylaşamaz', async () => {
    // Kimse kendine resmî işaret koyamaz.
    await assertFails(updateDoc(doc(fs('ayse'), 'publicProfiles', 'ayse'), { official: true, updatedAt: serverTimestamp() }));
    // Sıradan kişi başka ile ve "reach" ile paylaşamaz.
    const ayse = createFirestorePostRepository(fs('ayse'));
    await assertFails(ayse.create('ayse', 'Ayşe', post('il', { provinceCode: '34' })));
    await assertFails(ayse.create('ayse', 'Ayşe', post('turkiye', {})));

    await createBadgeAdmin(fs('eren'), 'eren').setOfficial({ uid: 'cityjoy', displayName: 'CityJoy' }, true);
    const profile = await createFirestoreSocialRepository(fs('ayse')).getProfile('cityjoy');
    expect(profile?.official).toBe(true);
    expect((await createBadgeAdmin(fs('eren'), 'eren').officials()).map((p) => p.uid)).toEqual(['cityjoy']);
    // Resmî hesap profilini yine düzenler.
    await assertSucceeds(updateDoc(doc(fs('cityjoy'), 'publicProfiles', 'cityjoy'), { bio: 'Resmî hesap', updatedAt: serverTimestamp() }));

    const cj = createFirestorePostRepository(fs('cityjoy'));
    await assertSucceeds(cj.create('cityjoy', 'CityJoy', post('turkiye', {})));
    await assertSucceeds(cj.create('cityjoy', 'CityJoy', post('il', { provinceCode: '34' })));
    await assertSucceeds(cj.create('cityjoy', 'CityJoy', post('ilce', { provinceCode: '34', districtId: '34-kadikoy' })));
    await assertSucceeds(cj.create('cityjoy', 'CityJoy', post('mahalle', moda)));
    await assertSucceeds(cj.create('cityjoy', 'CityJoy', post('il', { provinceCode: '06' }, { category: 'haber', news: true })));
    const news = await createFirestorePostRepository(fs('ayse')).news('06');
    expect(news.map((p) => p.reach)).toEqual(['il']);

    // Geri alınınca başka yere paylaşamaz.
    await createBadgeAdmin(fs('eren'), 'eren').setOfficial({ uid: 'cityjoy', displayName: 'CityJoy' }, false);
    await assertFails(cj.create('cityjoy', 'CityJoy', post('il', { provinceCode: '34' })));
  }, 30000);

  it('reachPlan hedefleri doğru kurar', () => {
    expect(reachPlan('turkiye', {}, ataevler)).toEqual({ targets: ['genel', 'takip'], region: ataevler });
    expect(reachPlan('il', { provinceCode: '34' }, ataevler)?.region).toEqual({ provinceCode: '34', districtId: '34-tum', neighbourhoodId: '34-tum-tum' });
    expect(reachPlan('ilce', { provinceCode: '34' }, ataevler)).toBeNull();
    expect(reachPlan('mahalle', moda, ataevler)?.targets).toEqual(['mahallem', 'takip']);
  });
});
