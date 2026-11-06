import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { contentViewId } from '@cityjoy/shared';
import { createContentStatsReader, createContentStatsRecorder } from '@cityjoy/shared/firebase';
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
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

const fs = (uid: string, email = `${uid}@ornek.com`) =>
  env.authenticatedContext(uid, { email, email_verified: true }).firestore() as unknown as Firestore;

const orgId = 'bld-16-osmangazi';
const kurum = { type: 'kurum', orgId, name: 'Osmangazi Belediyesi' } as const;
const muhtar = { type: 'kisi', role: 'muhtar', grantKey: 'mahalle-16-osmangazi-alipasa' } as const;
const now = Timestamp.now();
const owner = { type: 'kurum', orgId } as const;

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    await setDoc(doc(db, 'organizations', orgId), {
      name: kurum.name, kind: 'ilce-belediyesi', scope: { level: 'ilce', provinceCode: '16', districtId: '16-osmangazi' },
      modules: ['gonderiler', 'etkinlikler', 'istatistik'], officialEmail: 'kalem@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: now, updatedAt: now,
    });
    for (const [uid, isOrgAdmin, assignments] of [['kalem', true, {}], ['analiz', false, { istatistik: ['goruntule'] }], ['basin', false, { gonderiler: ['goruntule', 'ekle'] }]] as const) {
      await setDoc(doc(db, 'orgMembers', `${orgId}__${uid}@ornek.com`), {
        orgId, email: `${uid}@ornek.com`, displayName: uid, isOrgAdmin, assignments, addedBy: 'eren', updatedAt: now,
      });
    }
    const base = { title: 'Su kesintisi', body: 'Yarın 10-14 arası', region: { provinceCode: '16', districtId: '16-osmangazi' }, preparedBy: 'basin', createdAt: now, updatedAt: now };
    await setDoc(doc(db, 'announcements', 'd1'), { ...base, kind: 'duyuru', author: kurum, status: 'yayinda', publishedAt: now });
    await setDoc(doc(db, 'announcements', 'taslak'), { ...base, kind: 'duyuru', author: kurum, status: 'taslak' });
    await setDoc(doc(db, 'announcements', 'm1'), { ...base, kind: 'duyuru', author: muhtar, status: 'yayinda', publishedAt: now });
    await setDoc(doc(db, 'events', 'e1'), { ...base, author: kurum, status: 'yayinda', publishedAt: now, attendeeCount: 4 });
  });
});

const item = (id: string, author: typeof kurum | typeof muhtar = kurum) => ({ id, author });

describe('içerik istatistiği', () => {
  it('okunma kişi başına bir kez sayılır, paylaşım bir kez işaretlenir; panel sayıları görür', async () => {
    await createContentStatsRecorder(fs('ayse')).view('a', item('d1'), 'ayse');
    await createContentStatsRecorder(fs('mehmet')).view('a', item('d1'), 'mehmet');
    // Aynı kişi yeni bir oturumda tekrar dener: kayıt zaten var, sayı artmaz.
    await assertFails(setDoc(doc(fs('ayse'), 'contentViews', contentViewId('d1', 'ayse')), { item: 'd1', k: 'a', owner: orgId, at: serverTimestamp(), sh: false }));
    await createContentStatsRecorder(fs('ayse')).share('d1', 'ayse');
    await createContentStatsRecorder(fs('ayse')).view('e', item('e1'), 'ayse');

    const reader = createContentStatsReader(fs('analiz'));
    expect(await reader.counts(owner, 'd1')).toEqual({ reads: 2, shares: 1 });
    expect(await reader.counts(owner, 'e1')).toEqual({ reads: 1, shares: 0 });
    const rows = await reader.listContent(owner, new Date(Date.now() - 86400000));
    expect(rows.map((r) => r.id).sort()).toEqual(['d1', 'e1']);
    expect(rows.find((r) => r.id === 'e1')?.attendees).toBe(4);
    expect(await reader.readsBetween(owner, new Date(Date.now() - 86400000), new Date(Date.now() + 60000))).toBe(3);
  });

  it('sayıları yalnızca kurum yöneticisi, istatistik görevlisi ve admin görür', async () => {
    await createContentStatsRecorder(fs('ayse')).view('a', item('d1'), 'ayse');
    expect((await createContentStatsReader(fs('kalem')).counts(owner, 'd1')).reads).toBe(1);
    expect((await createContentStatsReader(fs('eren')).counts(owner, 'd1')).reads).toBe(1);
    expect((await createContentStatsReader(fs('basin')).counts(owner, 'd1')).reads).toBeNull();
    expect((await createContentStatsReader(fs('ayse')).counts(owner, 'd1')).reads).toBeNull();
  });

  it('başkası adına, yanlış hesaba, taslağa ya da sahte paylaşım yazılamaz', async () => {
    const db = fs('ayse');
    const good = { item: 'd1', k: 'a', owner: orgId, at: serverTimestamp(), sh: false };
    // Başka kişinin karmasıyla.
    await assertFails(setDoc(doc(db, 'contentViews', contentViewId('d1', 'mehmet')), good));
    // Yanlış hesap, paylaşılmış başlama, ek alan, yayında olmayan içerik.
    await assertFails(setDoc(doc(db, 'contentViews', contentViewId('d1', 'ayse')), { ...good, owner: 'bld-16-nilufer' }));
    await assertFails(setDoc(doc(db, 'contentViews', contentViewId('d1', 'ayse')), { ...good, sh: true }));
    await assertFails(setDoc(doc(db, 'contentViews', contentViewId('d1', 'ayse')), { ...good, uid: 'ayse' }));
    await assertFails(setDoc(doc(db, 'contentViews', contentViewId('taslak', 'ayse')), { ...good, item: 'taslak' }));
    // Muhtar duyurusu muhtarlığın hesabına sayılır.
    await assertSucceeds(setDoc(doc(db, 'contentViews', contentViewId('m1', 'ayse')), { ...good, item: 'm1', owner: muhtar.grantKey }));
    await assertSucceeds(setDoc(doc(db, 'contentViews', contentViewId('d1', 'ayse')), good));
    // Başkasının kaydını paylaşıldı yapamaz; kendi kaydında yalnızca paylaşım değişir.
    await assertFails(updateDoc(doc(fs('mehmet'), 'contentViews', contentViewId('d1', 'ayse')), { sh: true }));
    await assertFails(updateDoc(doc(db, 'contentViews', contentViewId('d1', 'ayse')), { sh: true, owner: 'x' }));
    await assertSucceeds(updateDoc(doc(db, 'contentViews', contentViewId('d1', 'ayse')), { sh: true }));
    // Giriş yapmamış kişi yazamaz.
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'contentViews', 'd1_X'), good));
  });
});
