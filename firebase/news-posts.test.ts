import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { DEFAULT_BADGES, type PostInput } from '@cityjoy/shared';
import { createBadgeAdmin, createFirestorePostRepository, createFirestoreSocialRepository } from '@cityjoy/shared/firebase';
import { doc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Yayıncı rozeti > Haberler'e paylaşma (Eren, 13 Kasım 2026). Ayrı proje adı: paneldeki emülatör verisine dokunmaz.
const here = path.dirname(fileURLToPath(import.meta.url));
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cityjoy-haber',
    firestore: { rules: readFileSync(path.join(here, 'firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());

const fs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }).firestore() as unknown as Firestore;
const ataevler = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
const moda = { provinceCode: '34', districtId: '34-kadikoy', neighbourhoodId: '34-kadikoy-moda' };
const input = (patch: Partial<PostInput> = {}): PostInput => ({ text: 'Yolda çalışma var.', category: 'haber', targets: [], region: ataevler, news: true, ...patch });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    for (const [uid, location] of [['yayinci', ataevler], ['ayse', ataevler], ['istanbul', moda]] as const) {
      await setDoc(doc(db, 'users', uid), { uid, displayName: uid, birthYear: 1990, location });
    }
  });
  for (const uid of ['yayinci', 'ayse']) await createFirestoreSocialRepository(fs(uid)).ensureProfile(uid, uid, false);
});

describe('Haberler: yayıncı paylaşımı', () => {
  it('yalnızca yayıncı rozetli kişi Haberler’e paylaşır; kimse kendine yayıncı işareti koyamaz; ildeki liste', async () => {
    // Rozetsiz kişi paylaşamaz, kendine işaret de koyamaz.
    await assertFails(createFirestorePostRepository(fs('ayse')).create('ayse', 'Ayşe K.', input()));
    await assertFails(updateDoc(doc(fs('ayse'), 'publicProfiles', 'ayse'), { publisher: true, updatedAt: serverTimestamp() }));
    // Gurme rozeti yayıncı değildir.
    await createBadgeAdmin(fs('eren'), 'eren').setProfileBadges({ uid: 'ayse', displayName: 'Ayşe' }, ['gurme'], DEFAULT_BADGES);
    await assertFails(createFirestorePostRepository(fs('ayse')).create('ayse', 'Ayşe K.', input()));
    // Yayıncı rozeti verilince paylaşır (yalnızca Haberler ya da Mahallem ile birlikte).
    await createBadgeAdmin(fs('eren'), 'eren').setProfileBadges({ uid: 'yayinci', displayName: 'Bursa Gündem' }, ['yayinci'], DEFAULT_BADGES);
    const r = createFirestorePostRepository(fs('yayinci'));
    const id = await assertSucceeds(r.create('yayinci', 'Bursa Gündem', input()));
    await assertSucceeds(r.create('yayinci', 'Bursa Gündem', input({ text: 'İkinci', targets: ['mahallem'] })));
    // Rozetli kişi profilini yine düzenler.
    await assertSucceeds(updateDoc(doc(fs('yayinci'), 'publicProfiles', 'yayinci'), { bio: 'Yerel haber', updatedAt: serverTimestamp() }));
    // Başka ildeki kişi de okur; Bursa listesinde iki haber.
    const list = await createFirestorePostRepository(fs('istanbul')).news('16');
    expect(new Set(list.map((p) => p.text))).toEqual(new Set(['İkinci', 'Yolda çalışma var.']));
    expect(list.every((p) => p.news)).toBe(true);
    expect(await createFirestorePostRepository(fs('istanbul')).news('34')).toEqual([]);
    expect(id).toBeTruthy();
    // Rozet geri alınınca yeniden paylaşamaz.
    await createBadgeAdmin(fs('eren'), 'eren').setProfileBadges({ uid: 'yayinci', displayName: 'Bursa Gündem' }, [], DEFAULT_BADGES);
    await assertFails(r.create('yayinci', 'Bursa Gündem', input({ text: 'Üçüncü' })));
  });
});
