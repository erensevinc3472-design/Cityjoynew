import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { DEFAULT_BADGES } from '@cityjoy/shared';
import { createBadgeAdmin, createBadgeReader, createFirestoreSocialRepository } from '@cityjoy/shared/firebase';
import { doc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cityjoy-rozet',
    firestore: { rules: readFileSync(path.join(here, 'firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());

const fs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }).firestore() as unknown as Firestore;

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' });
  });
  await createFirestoreSocialRepository(fs('ayse')).ensureProfile('ayse', 'Ayşe K.', false);
});

describe('rozetler', () => {
  it('rozeti yalnızca admin verir; kişi kendine rozet yazamaz; rozetli kişi profilini düzenleyebilir', async () => {
    const ayse = { uid: 'ayse', displayName: 'Ayşe K.' };
    await assertFails(createBadgeAdmin(fs('ali'), 'ali').setProfileBadges(ayse, ['gurme'], DEFAULT_BADGES));
    await assertFails(updateDoc(doc(fs('ayse'), 'publicProfiles', 'ayse'), { badges: ['yayinci'], updatedAt: serverTimestamp() }));
    await assertSucceeds(createBadgeAdmin(fs('eren'), 'eren').setProfileBadges(ayse, ['gurme', 'yayinci'], DEFAULT_BADGES));
    expect((await createFirestoreSocialRepository(fs('ali')).getProfile('ayse'))?.badges).toEqual(['gurme', 'yayinci']);
    // Kişi adını değiştirebilir ama rozetini değiştiremez.
    await assertSucceeds(updateDoc(doc(fs('ayse'), 'publicProfiles', 'ayse'), { bio: 'Merhaba', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(fs('ayse'), 'publicProfiles', 'ayse'), { badges: [], updatedAt: serverTimestamp() }));
    const holders = await createBadgeAdmin(fs('eren'), 'eren').holders(['gurme']);
    expect(holders.map((h) => h.uid)).toEqual(['ayse']);
    await assertSucceeds(createBadgeAdmin(fs('eren'), 'eren').setProfileBadges(ayse, [], DEFAULT_BADGES));
  });

  it('rozet listesini admin kaydeder, herkes okur; kayıt yoksa hazır liste', async () => {
    expect((await createBadgeReader(fs('ali')).definitions()).map((b) => b.id)).toEqual(DEFAULT_BADGES.map((b) => b.id));
    await assertFails(createBadgeAdmin(fs('ali'), 'ali').save(DEFAULT_BADGES));
    await assertSucceeds(createBadgeAdmin(fs('eren'), 'eren').save([...DEFAULT_BADGES, { id: 'sehir-dostu', icon: 'star', publisher: false, name: { tr: 'Şehir dostu' } }]));
    const read = await createBadgeReader(fs('ali')).definitions();
    expect(read.at(-1)?.name.tr).toBe('Şehir dostu');
  });
});
