import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createFirestoreProfileRepository, createFirestoreSocialRepository } from '@cityjoy/shared/firebase';
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
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

const fs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }).firestore() as unknown as Firestore;
const profiles = (uid: string) => createFirestoreProfileRepository(fs(uid));
const ataevler = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
const fethiye = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-fethiye' };
const consent = { granted: true, at: '2026-10-01T00:00:00.000Z', textVersion: 'taslak-2026-10' };

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const uid of ['ayse', 'ali']) {
      await setDoc(doc(db, 'users', uid), {
        uid, displayName: uid, language: 'tr', birthYear: 1990, isPrivate: false, phoneVerified: false, emailVerified: false,
        consents: { terms: consent, privacyNotice: consent }, location: ataevler,
        // Mahalle 40 gün önce seçildi: değiştirilebilir.
        locationChangedAt: Timestamp.fromDate(new Date(Date.now() - 40 * 86400000)), createdAt: Timestamp.now(),
      });
    }
  });
  await createFirestoreSocialRepository(fs('ayse')).ensureProfile('ayse', 'Ayşe K.', false);
});

describe('konum rozeti', () => {
  it('doğrulama ve rozet birlikte yazılır; tek başına sahte rozet olmaz; başkasına yazılamaz', async () => {
    const ayse = (await profiles('ayse').get('ayse'))!;
    await assertSucceeds(profiles('ayse').setLocationCheck('ayse', { level: 'mahalle', neighbourhoodId: ataevler.neighbourhoodId }));
    expect((await profiles('ayse').get('ayse'))?.locationCheck?.level).toBe('mahalle');
    expect((await createFirestoreSocialRepository(fs('ali')).getProfile('ayse'))?.locationVerified).toBe('mahalle');
    // Yalnızca profile rozet yazılamaz; doğrulamadan farklı düzey olmaz; başka mahalle için doğrulama olmaz.
    await assertFails(updateDoc(doc(fs('ali'), 'publicProfiles', 'ayse'), { locationVerified: 'mahalle', updatedAt: serverTimestamp() }));
    await profiles('ayse').setLocationCheck('ayse', null);
    await assertFails(updateDoc(doc(fs('ayse'), 'publicProfiles', 'ayse'), { locationVerified: 'mahalle', updatedAt: serverTimestamp() }));
    const db = fs('ayse');
    const b = writeBatch(db);
    b.update(doc(db, 'users', 'ayse'), { locationCheck: { neighbourhoodId: ataevler.neighbourhoodId, level: 'ilce', at: serverTimestamp() }, updatedAt: serverTimestamp() });
    b.update(doc(db, 'publicProfiles', 'ayse'), { locationVerified: 'mahalle', updatedAt: serverTimestamp() });
    await assertFails(b.commit());
    await assertFails(profiles('ayse').setLocationCheck('ayse', { level: 'mahalle', neighbourhoodId: fethiye.neighbourhoodId }));
    await assertFails(profiles('ali').setLocationCheck('ayse', { level: 'mahalle', neighbourhoodId: ataevler.neighbourhoodId }));
    expect(ayse.locationCheck).toBeUndefined();
  });

  it('mahalle değişince rozet de düşer; rozeti bırakarak mahalle değiştirilemez', async () => {
    await profiles('ayse').setLocationCheck('ayse', { level: 'ilce', neighbourhoodId: ataevler.neighbourhoodId });
    // Doğrudan yalnızca konumu değiştirmek reddedilir (doğrulama eski mahalleye ait kalırdı).
    await assertFails(updateDoc(doc(fs('ayse'), 'users', 'ayse'), { location: fethiye, locationChangedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    const current = (await profiles('ayse').get('ayse'))!;
    await assertSucceeds(profiles('ayse').update('ayse', { location: fethiye }, current));
    expect((await profiles('ayse').get('ayse'))?.locationCheck).toBeUndefined();
    expect((await createFirestoreSocialRepository(fs('ali')).getProfile('ayse'))?.locationVerified).toBeUndefined();
  });

  it('herkese açık profili olmayan kişi de doğrular (rozet profil açılınca yeniden alınır)', async () => {
    await assertSucceeds(profiles('ali').setLocationCheck('ali', { level: 'ilce', neighbourhoodId: ataevler.neighbourhoodId }));
  });
});
