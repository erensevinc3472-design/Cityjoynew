import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { sha256Hex } from '@cityjoy/shared';
import { createAdminPushFeed, createAdminPushOpens, createAdminPushPanel } from '@cityjoy/shared/firebase';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-cityjoy', firestore: { rules: readFileSync(path.join(here, 'firestore.rules'), 'utf8') } });
});
afterAll(() => env.cleanup());
const fs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }).firestore() as unknown as Firestore;

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' }));
});

const input = {
  kind: 'reklam', title: 'Hafta sonu indirimi', body: 'Tüm kahvelerde %20 indirim.', region: { provinceCode: '16' },
  link: { type: 'isletme', id: 'b1' }, business: { id: 'b1', name: 'Kahve Durağı' }, sendAt: new Date().toISOString(),
} as const;

describe('admin bildirimleri', () => {
  it('yalnızca admin hazırlar ve iptal eder; ücret yalnızca admin görür', async () => {
    const id = await createAdminPushPanel(fs('eren'), 'eren').create(input, { amount: 1500, invoiceNo: 'A-1' });
    // İşletmenin paylaşımını açan reklam.
    await assertSucceeds(createAdminPushPanel(fs('eren'), 'eren').create({ ...input, link: { type: 'gonderi', id: 'post1' } }));
    await expect(createAdminPushPanel(fs('ayse'), 'ayse').create(input)).rejects.toThrow();
    expect((await createAdminPushPanel(fs('eren'), 'eren').billing(id))?.amount).toBe(1500);
    await assertFails(getDoc(doc(fs('ayse'), 'adminPushBilling', id)));
    // Planlı olanı kullanıcı okuyamaz; admin iptal eder, gönderildi diye işaretleyemez (sunucunun işi).
    await assertFails(getDoc(doc(fs('ayse'), 'adminPushes', id)));
    await assertFails(updateDoc(doc(fs('eren'), 'adminPushes', id), { status: 'gonderildi', updatedAt: serverTimestamp() }));
    const [p] = await createAdminPushPanel(fs('eren'), 'eren').list();
    await assertSucceeds(createAdminPushPanel(fs('eren'), 'eren').cancel(p!));
  });

  it('gönderileni giriş yapan okur (bildirim kutusu); açılma kişi başına bir kez, yalnızca admin sayar', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'adminPushes', 'p1'), { ...input, scope: '16', status: 'gonderildi', sentAt: serverTimestamp(), createdBy: 'eren' });
    });
    expect((await createAdminPushFeed(fs('ayse')).listSent('16')).map((x) => x.id)).toEqual(['p1']);
    await createAdminPushOpens(fs('ayse')).record('p1', 'ayse');
    await assertFails(setDoc(doc(fs('ayse'), 'adminPushOpens', `p1_${sha256Hex('mehmet' + 'p1')}`), { push: 'p1', at: serverTimestamp() }));
    await assertFails(setDoc(doc(fs('ayse'), 'adminPushOpens', `p1_${sha256Hex('ayse' + 'p1')}`), { push: 'p1', at: serverTimestamp() }));
    expect(await createAdminPushPanel(fs('eren'), 'eren').opens('p1')).toBe(1);
    expect(await createAdminPushPanel(fs('ayse'), 'ayse').opens('p1')).toBeNull();
  });
});
