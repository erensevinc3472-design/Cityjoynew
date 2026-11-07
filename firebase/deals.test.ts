import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { latestDealEnd, todayYmd, type Business, type DealInput } from '@cityjoy/shared';
import { createDealModeration, createFirestoreDealRepository } from '@cityjoy/shared/firebase';
import { doc, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
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

const fs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }).firestore() as unknown as Firestore;

const biz = (verified: boolean, tier: 'ucretsiz' | 'pro' = 'pro') =>
  ({
    id: 'b1',
    name: 'Kahve Durağı',
    ownerUid: 'esnaf',
    status: 'yayinda',
    location: { provinceCode: '16', districtId: '16-osmangazi' },
    verification: { status: verified ? 'dogrulandi' : 'dogrulanmadi' },
    membership: { tier },
  }) as unknown as Business;

const input = (over: Partial<DealInput> = {}): DealInput => ({
  businessId: 'b1',
  category: 'food',
  kind: 'yuzde',
  value: '%20',
  title: 'Tüm kahvaltı menüsü',
  when: 'Hafta içi 09:00-12:00',
  terms: 'Masa başına bir kez.',
  usage: 'kod',
  code: 'KAHVE20',
  endsOn: todayYmd(),
  ...over,
});

async function seed(verified: boolean, tier: 'ucretsiz' | 'pro' = 'pro') {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const { id, ...data } = biz(verified, tier);
    await setDoc(doc(ctx.firestore(), 'businesses', id), data);
    const now = Timestamp.now();
    await setDoc(doc(ctx.firestore(), 'grants', 'ahmet@ornek.com__il-16'), {
      email: 'ahmet@ornek.com', displayName: 'Ahmet', role: 'il-yoneticisi', scope: { level: 'il', provinceCode: '16' },
      modules: { moderasyon: ['goruntule', 'duzenle', 'sil'] }, grantedBy: 'eren', grantedAt: now, updatedAt: now,
    });
  });
}

describe('Fırsatlar', () => {
  it('yalnızca doğrulanmış işletmenin sahibi açar; bitiş en çok 90 gün', async () => {
    await seed(false);
    await expect(createFirestoreDealRepository(fs('esnaf')).save(null, input(), biz(false))).rejects.toThrow();
    // Fırsat yalnızca Pro'da (Karar Eren, 7 Kasım): doğrulanmış Ücretsiz işletme açamaz.
    await seed(true, 'ucretsiz');
    await expect(createFirestoreDealRepository(fs('esnaf')).save(null, input(), biz(true, 'ucretsiz'))).rejects.toThrow();
    await seed(true);
    const repo = createFirestoreDealRepository(fs('esnaf'));
    await expect(createFirestoreDealRepository(fs('ali')).save(null, input(), { ...biz(true), ownerUid: 'ali' } as Business)).rejects.toThrow();
    const far = new Date(Date.now() + 100 * 86_400_000).toISOString().slice(0, 10);
    await expect(repo.save(null, input({ endsOn: far }), biz(true))).rejects.toThrow();
    const id = await repo.save(null, input({ endsOn: latestDealEnd() }), biz(true));
    const [live] = await createFirestoreDealRepository(fs('ali')).listActive('16');
    expect(live!.id).toBe(id);
    expect(live!.changedAt).toBeUndefined();

    // Şart değişince "güncellendi"; durdurulunca listeden düşer.
    await repo.save(id, input({ terms: 'Masa başına bir kez, paket hariç.' }), biz(true), live);
    const [edited] = await repo.listMine('b1', 'esnaf');
    expect(edited!.changedAt).toBeTruthy();
    await repo.setStatus(id, 'durduruldu');
    expect(await createFirestoreDealRepository(fs('ali')).listActive('16')).toEqual([]);
    await repo.setStatus(id, 'aktif');
  });

  it('sayaç bir artar; şikâyet kişi başına bir; il yöneticisi gizler, işletme açamaz', async () => {
    await seed(true);
    const repo = createFirestoreDealRepository(fs('esnaf'));
    const id = await repo.save(null, input(), biz(true));
    const ali = createFirestoreDealRepository(fs('ali'));
    await ali.count(id, 'codeViews');
    await expect(updateDoc(doc(fs('ali'), 'deals', id), { 'stats.calls': 5 })).rejects.toThrow();
    const [d] = await ali.listActive('16');
    expect(d!.stats.codeViews).toBe(1);
    await ali.report(d!, 'ali', 'yaniltici');
    await expect(ali.report(d!, 'ali', 'yaniltici')).rejects.toThrow();

    const mod = createDealModeration(fs('ahmet'), 'ahmet');
    const [seen] = await mod.list('16');
    expect(seen!.reportCount).toBe(1);
    await mod.setHidden(seen!, true, 'yanıltıcı');
    await expect(repo.setStatus(id, 'aktif')).rejects.toThrow();
    await expect(createDealModeration(fs('ali'), 'ali').setHidden(seen!, false, '')).rejects.toThrow();
  });
});
