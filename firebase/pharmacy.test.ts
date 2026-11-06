import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createPharmacyAdmin, createPharmacyRepository } from '@cityjoy/shared/firebase';
import { doc, getDoc, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-cityjoy', firestore: { rules: readFileSync(path.join(here, 'firestore.rules'), 'utf8') } });
});
afterAll(() => env.cleanup());
const fs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }).firestore() as unknown as Firestore;
const now = Timestamp.now();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    await setDoc(doc(db, 'grants', 'ahmet@ornek.com__il-16'), { email: 'ahmet@ornek.com', role: 'il-yoneticisi', scope: { level: 'il', provinceCode: '16' }, modules: { 'acil-numaralar': ['goruntule', 'duzenle'] }, grantedBy: 'eren', grantedAt: now });
    await setDoc(doc(db, 'dutyPharmacies', '16'), { date: '2026-11-06', fetchedAt: now, source: 'nosyapi', items: [{ name: 'Şifa', district: 'Osmangazi', address: 'Cad. 1' }], hidden: [] });
    await setDoc(doc(db, 'dataSourceStatus', 'pharmacy'), { provinces: {}, source: 'nosyapi', updatedAt: now });
  });
});

describe('nöbetçi eczane kuralları', () => {
  it('herkes okur; admin ve o ilin il yöneticisi yalnızca gizlemeyi değiştirir; durum sayfası yalnızca admin', async () => {
    expect((await createPharmacyRepository(env.unauthenticatedContext().firestore() as unknown as Firestore).get('16'))?.items).toHaveLength(1);
    await assertSucceeds(createPharmacyAdmin(fs('ahmet'), 'ahmet').setHidden('16', ['osmangazi|şifa'], 'gizlendi Şifa'));
    await assertSucceeds(createPharmacyAdmin(fs('eren'), 'eren').setHidden('16', [], 'gösterildi Şifa'));
    await assertFails(createPharmacyAdmin(fs('ayse'), 'ayse').setHidden('16', ['x'], 'x'));
    await assertFails(updateDoc(doc(fs('eren'), 'dutyPharmacies', '16'), { items: [] }));
    await assertSucceeds(createPharmacyAdmin(fs('ahmet'), 'ahmet').setHours('16', { start: '18:30', end: '09:00' }));
    await assertFails(createPharmacyAdmin(fs('ahmet'), 'ahmet').setHours('16', { start: '25:00', end: '09:00' }));
    await assertFails(createPharmacyAdmin(fs('ayse'), 'ayse').setHours('16', { start: '18:30', end: '09:00' }));
    expect((await createPharmacyAdmin(fs('eren'), 'eren').get('16'))?.hours).toEqual({ start: '18:30', end: '09:00' });
    await assertFails(getDoc(doc(fs('ahmet'), 'dataSourceStatus', 'pharmacy')));
    expect(await createPharmacyAdmin(fs('eren'), 'eren').status()).toMatchObject({ source: 'nosyapi' });
  });
});
