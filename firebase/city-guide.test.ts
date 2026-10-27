import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createCityGuideStore, defaultModulesFor, ROLE_TEMPLATES, type CityGuideItem } from '@cityjoy/shared';
import { createCityGuideAdmin, createFirestoreCityGuideRepository, createGrantAdmin, listAuditLog } from '@cityjoy/shared/firebase';
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
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
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' });
  });
});

const fs = (uid?: string) =>
  (uid ? env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }) : env.unauthenticatedContext()).firestore() as unknown as Firestore;

const museum = (name: string, provinceCode = '16'): CityGuideItem => ({
  id: `muzeler--${provinceCode}-osmangazi--${name.toLowerCase().replace(/ /g, '-')}`,
  section: 'muzeler',
  provinceCode,
  districtId: `${provinceCode}-osmangazi`,
  name,
  category: 'kent',
  values: { ad: name, tur: 'kent', ucret_durumu: 'Ücretli' },
  source: 'https://www.bursa.bel.tr',
  sourceDate: '2026-10-27',
  verified: false,
});

function memoryCache() {
  const m = new Map<string, string>();
  let reads = 0;
  return { get: async (k: string) => (reads++, m.get(k) ?? null), set: async (k: string, v: string) => void m.set(k, v), reads: () => reads };
}

describe('şehir rehberi', () => {
  it('admin Excel öğelerini yükler; herkes (girişsiz de) okur; uygulama yalnızca değişince indirir', async () => {
    const admin = createCityGuideAdmin(fs('eren'), 'eren');
    const r = await admin.importItems('16', 'muzeler', [museum('Kent Müzesi'), museum('Tofaş Müzesi')]);
    expect([r.added, r.updated]).toEqual([2, 0]);

    let packReads = 0;
    const base = createFirestoreCityGuideRepository(fs());
    const repo = { meta: base.meta, items: async (...a: Parameters<typeof base.items>) => (packReads++, base.items(...a)) };
    const store = createCityGuideStore(repo, memoryCache());
    const meta = await store.refreshMeta('16');
    expect(meta.sections.muzeler?.count).toBe(2);
    expect((await store.items('16', 'muzeler', meta)).map((i) => i.name)).toEqual(['Kent Müzesi', 'Tofaş Müzesi']);
    await store.items('16', 'muzeler', meta);
    expect(packReads).toBe(1);

    // Doğrulama ve kaldırma; özet sürümü değişir, uygulama yeniden indirir.
    const [kent] = await admin.list('16', 'muzeler');
    await admin.setVerified(kent!, true);
    await admin.remove((await admin.list('16', 'muzeler'))[1]!);
    const meta2 = await store.refreshMeta('16');
    const list = await store.items('16', 'muzeler', meta2);
    expect(packReads).toBe(2);
    expect(list.map((i) => [i.name, i.verified])).toEqual([['Kent Müzesi', true]]);
    const log = await listAuditLog(fs('eren'));
    expect(log.map((e) => e.action).sort()).toEqual(['ekle', 'onayla', 'sil']);
  });

  it('400 öğeden büyük bölüm parçalanır ve küçülünce fazla parça silinir', async () => {
    const admin = createCityGuideAdmin(fs('eren'), 'eren');
    const many = Array.from({ length: 450 }, (_, i) => museum(`Müze ${String(i).padStart(3, '0')}`));
    await admin.importItems('16', 'muzeler', many);
    expect((await admin.meta('16'))?.sections.muzeler).toMatchObject({ count: 450, parts: 2 });
    expect(await admin.list('16', 'muzeler')).toHaveLength(450);
    for (let i = 0; i < 60; i++) await admin.remove({ ...many[i]! });
    expect((await admin.meta('16'))?.sections.muzeler).toMatchObject({ count: 390, parts: 1 });
    await assertSucceeds(getDoc(doc(fs(), 'cityGuidePacks/16__muzeler__0')));
    expect((await getDoc(doc(fs(), 'cityGuidePacks/16__muzeler__1'))).exists()).toBe(false);
  }, 60_000);

  it('il yöneticisi yalnızca kendi ilinde yazar; kullanıcı ve başka il yazamaz; ülke geneli yalnızca admin', async () => {
    await createGrantAdmin(fs('eren'), 'eren').save(
      { email: 'ahmet@ornek.com', displayName: 'Ahmet', role: 'il-yoneticisi', scope: { level: 'il', provinceCode: '16' }, modules: defaultModulesFor('il-yoneticisi', ROLE_TEMPLATES) },
      true,
    );
    const ahmet = createCityGuideAdmin(fs('ahmet'), 'ahmet');
    await ahmet.importItems('16', 'muzeler', [museum('Kent Müzesi')]);
    await expect(ahmet.importItems('34', 'muzeler', [museum('Pera Müzesi', '34')])).rejects.toThrow();
    await expect(ahmet.importItems('tr', 'nasil-yapilir', [])).rejects.toThrow();
    await expect(createCityGuideAdmin(fs('ali'), 'ali').importItems('16', 'muzeler', [museum('Sahte')])).rejects.toThrow();
    // Bilinmeyen bölüm ya da 400'den büyük paket kabul edilmez.
    await assertFails(setDoc(doc(fs('eren'), 'cityGuidePacks/16__uzay__0'), { provinceCode: '16', section: 'uzay', part: 0, items: [], updatedAt: serverTimestamp(), updatedBy: 'eren' }));
    await assertFails(setDoc(doc(fs('eren'), 'cityGuidePacks/16__muzeler__0'), { provinceCode: '16', section: 'muzeler', part: 0, items: Array(401).fill({}), updatedAt: serverTimestamp(), updatedBy: 'eren' }));
    await createCityGuideAdmin(fs('eren'), 'eren').importItems('tr', 'nasil-yapilir', []);
  });
});
