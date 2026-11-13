import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createBroadcastPanel, getBroadcast } from '@cityjoy/shared/firebase';
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Bölgeye toplu bildirim kayıtları: yalnızca sunucu yazar; gönderileni giriş yapan okur, bekleyeni hazırlayan ve admin.
const here = path.dirname(fileURLToPath(import.meta.url));
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cityjoy-toplu',
    firestore: { rules: readFileSync(path.join(here, 'firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());

const fs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }).firestore() as unknown as Firestore;
const base = {
  publisherKey: 'bld-16-nilufer', author: { type: 'kurum', orgId: 'bld-16-nilufer', name: 'Nilüfer Belediyesi' }, sourceName: 'Nilüfer Belediyesi',
  kind: 'duyuru', title: 'Su kesintisi', body: 'Yarın su kesilecek.', region: { provinceCode: '16', districtId: '16-nilufer' },
  preparedBy: 'personel', createdAt: Timestamp.now(),
};

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    await setDoc(doc(db, 'broadcasts/g1'), { ...base, status: 'gonderildi', sentAt: Timestamp.now(), sentCount: 2 });
    await setDoc(doc(db, 'broadcasts/b1'), { ...base, publisherKey: 'il-16', region: { provinceCode: '16' }, status: 'onay-bekliyor' });
  });
});

describe('toplu bildirim kayıtları', () => {
  it('gönderileni giriş yapan herkes okur; girişsiz okuyamaz', async () => {
    expect((await getBroadcast(fs('ayse'), 'g1'))?.sentCount).toBe(2);
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore() as unknown as Firestore, 'broadcasts/g1')));
  });

  it('onay bekleyeni yalnızca hazırlayan ve admin okur; listeler kurallardan geçer', async () => {
    await assertFails(getDoc(doc(fs('ayse'), 'broadcasts/b1')));
    await assertSucceeds(getDoc(doc(fs('personel'), 'broadcasts/b1')));
    const noFn = {} as Functions;
    expect((await createBroadcastPanel(fs('personel'), noFn).listMine('personel')).map((b) => b.id).sort()).toEqual(['b1', 'g1']);
    expect((await createBroadcastPanel(fs('baska'), noFn).listSent('bld-16-nilufer')).map((b) => b.id)).toEqual(['g1']);
    expect((await createBroadcastPanel(fs('eren'), noFn).listPending()).map((b) => b.id)).toEqual(['b1']);
    await assertFails(createBroadcastPanel(fs('ayse'), noFn).listPending());
  });

  it('kimse doğrudan yazamaz (admin dahil)', async () => {
    await assertFails(setDoc(doc(fs('personel'), 'broadcasts/x'), { ...base, status: 'gonderildi' }));
    await assertFails(setDoc(doc(fs('eren'), 'broadcasts/g1'), { ...base, status: 'gonderildi', sentCount: 999 }));
  });
});
