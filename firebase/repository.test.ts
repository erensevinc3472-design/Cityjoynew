import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { activeEmergencyNumbers, buildCategoryTree, rankBusinesses, createServiceCategoryStore, LEGAL_TEXT_VERSION } from '@cityjoy/shared';
import {
  createBusinessAdmin,
  createEmergencyNumberAdmin,
  createFirestoreBusinessRepository,
  createFirestoreServiceCategoryRepository,
  createServiceCategoryAdmin,
  submitServiceSuggestion,
  createFirestoreEmergencyNumberRepository,
  createFirestoreOccupationRepository,
  createFirestoreProfileRepository,
  createOccupationAdmin,
  isAdminAccount,
} from '@cityjoy/shared/firebase';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
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
beforeEach(() => env.clearFirestore());

const consent = { granted: true, at: new Date().toISOString(), textVersion: LEGAL_TEXT_VERSION };

describe('profil deposu kurallarla uyumlu', () => {
  it('oluşturur, okur, günceller, mahalleyi kurala göre değiştirir ve siler', async () => {
    const db = env.authenticatedContext('ayse').firestore() as unknown as Firestore;
    const repo = createFirestoreProfileRepository(db);

    await repo.create({ uid: 'ayse', displayName: 'Ayşe', language: 'tr', birthYear: 1990, consents: { terms: consent, privacyNotice: consent } });
    let p = (await repo.get('ayse'))!;
    expect(p.isPrivate).toBe(false);
    expect(p.createdAt).toMatch(/^\d{4}-/);

    await repo.update('ayse', { gender: 'kadin', occupationId: 'ogretmen', targeting: consent }, p);
    const loc = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
    await repo.update('ayse', { location: loc }, p);
    p = (await repo.get('ayse'))!;
    expect(p.location).toEqual(loc);
    expect(p.locationChangedAt).toBeTruthy();
    expect(p.consents.targeting?.granted).toBe(true);

    // Ay dolmadan ikinci mahalle değişikliği reddedilir; il/ilçe aynı kalıp başka alan güncellemesi serbest.
    await expect(repo.update('ayse', { location: { ...loc, neighbourhoodId: '16-nilufer-besevler' } }, p)).rejects.toThrow();
    await repo.update('ayse', { language: 'en' }, p);

    await repo.delete('ayse');
    expect(await repo.get('ayse')).toBeNull();
  });

  it('15 yaşındaki kullanıcının hesabı gizli açılır', async () => {
    const db = env.authenticatedContext('genc').firestore() as unknown as Firestore;
    const repo = createFirestoreProfileRepository(db);
    await repo.create({ uid: 'genc', displayName: 'Genç', language: 'tr', birthYear: new Date().getFullYear() - 15, consents: { terms: consent, privacyNotice: consent } });
    expect((await repo.get('genc'))!.isPrivate).toBe(true);
  });

  it('meslek listesi boşsa varsayılan liste döner', async () => {
    const db = env.unauthenticatedContext().firestore() as unknown as Firestore;
    const list = await createFirestoreOccupationRepository(db).listActive();
    expect(list.length).toBeGreaterThan(20);
    expect(list.map((o) => o.id)).toContain('belirtmek-istemiyorum');
  });
});

describe('meslek yönetimi (admin)', () => {
  it('admin listeyi yükler, ekler, pasifleştirir; her işlem kayda geçer; admin olmayan yapamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' });
    });
    const adminDb = env.authenticatedContext('eren').firestore() as unknown as Firestore;
    const userDb = env.authenticatedContext('ali').firestore() as unknown as Firestore;
    expect(await isAdminAccount(adminDb, 'eren')).toBe(true);
    expect(await isAdminAccount(userDb, 'ali')).toBe(false);

    const admin = createOccupationAdmin(adminDb, 'eren');
    const added = await admin.seedDefaults(new Set());
    expect(added).toBeGreaterThan(20);
    expect(await admin.seedDefaults(new Set((await admin.listAll()).map((o) => o.id)))).toBe(0);

    await admin.save({ id: 'avukat', names: { tr: 'Avukat', en: 'Lawyer' }, order: 100, active: true }, true);
    const emekli = (await admin.listAll()).find((o) => o.id === 'emekli')!;
    await admin.setActive(emekli, false);

    const active = await createFirestoreOccupationRepository(userDb).listActive();
    expect(active.map((o) => o.id)).toContain('avukat');
    expect(active.map((o) => o.id)).not.toContain('emekli');

    await expect(createOccupationAdmin(userDb, 'ali').save({ id: 'x', names: { tr: 'X' }, order: 1, active: true }, true)).rejects.toThrow();

    const log = await getDocs(collection(adminDb, 'auditLog'));
    expect(log.docs.map((d) => d.data().summary)).toEqual(
      expect.arrayContaining(['Eklendi: Avukat', 'Pasifleştirildi: Emekli', expect.stringMatching(/^Başlangıç meslek listesi yüklendi/)]),
    );
  });
});

describe('acil numara yönetimi (admin)', () => {
  it('admin yükler, ekler, pasifleştirir; girişsiz kullanıcı okur; işlemler kayda geçer', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' });
    });
    const adminDb = env.authenticatedContext('eren').firestore() as unknown as Firestore;
    const guestDb = env.unauthenticatedContext().firestore() as unknown as Firestore;
    const guest = createFirestoreEmergencyNumberRepository(guestDb);
    expect(await guest.listAll()).toEqual([]);

    const admin = createEmergencyNumberAdmin(adminDb, 'eren');
    expect(await admin.seedDefaults(new Set())).toBe(8);
    await admin.save({ id: '177', number: '177', names: { tr: ' Orman yangını ', en: '' }, icon: 'forest', order: 9, active: true }, true);
    const n155 = (await admin.listAll()).find((n) => n.id === '155')!;
    await admin.setActive(n155, false);

    const active = activeEmergencyNumbers(await guest.listAll());
    expect(active.map((n) => n.number)).toEqual(['112', '110', '156', '183', '185', '186', '187', '177']);
    expect(active.at(-1)!.names).toEqual({ tr: 'Orman yangını' });

    const userDb = env.authenticatedContext('ali').firestore() as unknown as Firestore;
    await expect(createEmergencyNumberAdmin(userDb, 'ali').setActive(n155, true)).rejects.toThrow();

    const log = await getDocs(collection(adminDb, 'auditLog'));
    expect(log.docs.map((d) => d.data().summary)).toEqual(
      expect.arrayContaining(['Eklendi: 177 Orman yangını', 'Pasifleştirildi: 155 Polis', expect.stringMatching(/^Başlangıç acil numara listesi/)]),
    );
  });
});

describe('hizmet kategorileri (admin) ve öneriler', () => {
  it('admin yükler ve değiştirir; uygulama yalnızca sürüm değişince indirir; öneriler panelde incelenir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' });
    });
    const adminDb = env.authenticatedContext('eren').firestore() as unknown as Firestore;
    const guestDb = env.unauthenticatedContext().firestore() as unknown as Firestore;
    const mem = new Map<string, string>();
    const cache = { get: async (k: string) => mem.get(k) ?? null, set: async (k: string, v: string) => void mem.set(k, v) };
    const store = createServiceCategoryStore(createFirestoreServiceCategoryRepository(guestDb), cache);
    expect(await store.refresh()).toEqual([]);

    const admin = createServiceCategoryAdmin(adminDb, 'eren');
    expect(await admin.seedDefaults(new Set())).toBe(102);
    const cilingir = (await admin.listAll()).find((c) => c.id === 'cilingir')!;
    expect(cilingir).toMatchObject({ parentId: 'ev-tesisat', urgent: true });
    await admin.setActive(cilingir, false);
    await admin.save({ id: 'kilim-tamiri', parentId: 'ev-tesisat', names: { tr: 'Kilim tamiri' }, icon: 'build', order: 20, active: true }, true);

    const tree = buildCategoryTree(await store.refresh());
    const ev = tree.find((n) => n.category.id === 'ev-tesisat')!;
    expect(ev.children.map((c) => c.id)).not.toContain('cilingir');
    expect(ev.children.at(-1)!.id).toBe('kilim-tamiri');

    const userDb = env.authenticatedContext('ali').firestore() as unknown as Firestore;
    await submitServiceSuggestion(userDb, 'ali', '  Saat tamiri  ', '16');
    await expect(createServiceCategoryAdmin(userDb, 'ali').listSuggestions()).rejects.toThrow();
    const [suggestion] = await admin.listSuggestions();
    expect(suggestion).toMatchObject({ uid: 'ali', text: 'Saat tamiri', provinceCode: '16', status: 'yeni' });
    await admin.markReviewed(suggestion);
    expect((await admin.listSuggestions())[0].status).toBe('incelendi');

    const log = await getDocs(collection(adminDb, 'auditLog'));
    expect(log.docs.map((d) => d.data().summary)).toEqual(
      expect.arrayContaining(['Pasifleştirildi: Çilingir', 'Eklendi: Kilim tamiri', 'Hizmet önerisi incelendi']),
    );
  });
});

describe('işletmeler', () => {
  it('sahibi ekler, hizmet listesinde görünür; admin doğrular ve öne çıkarır; hesap silinince işletmeler silinir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' });
    });
    const aliDb = env.authenticatedContext('ali').firestore() as unknown as Firestore;
    const veliDb = env.authenticatedContext('veli').firestore() as unknown as Firestore;
    const guest = createFirestoreBusinessRepository(env.unauthenticatedContext().firestore() as unknown as Firestore);
    const ali = createFirestoreBusinessRepository(aliDb);
    const veli = createFirestoreBusinessRepository(veliDb);
    const input = (name: string, districtId = '16-nilufer') => ({
      type: 'hizmet' as const, name, categoryIds: ['tesisatci', 'elektrikci'], location: { provinceCode: '16', districtId },
      phone: '0532 123 45 67', whatsapp: true, is24h: true, description: '  ', priceList: [{ name: 'Keşif', price: 'Ücretsiz' }],
    });
    const a = await ali.create('ali', input('Ali Tesisat'));
    const v = await veli.create('veli', input('Veli Tesisat', '16-osmangazi'));
    await veli.create('veli', { ...input('İstanbul Tesisat', '34-kadikoy'), location: { provinceCode: '34', districtId: '34-kadikoy' } });

    const list = await guest.listByCategory('16', 'tesisatci');
    expect(list.map((b) => b.name).sort()).toEqual(['Ali Tesisat', 'Veli Tesisat']);
    expect(list.find((b) => b.id === a)).toMatchObject({ phone: '05321234567', verification: { status: 'dogrulanmadi' }, membership: { tier: 'ucretsiz' } });
    expect('description' in list[0]).toBe(false);

    const admin = createBusinessAdmin(env.authenticatedContext('eren').firestore() as unknown as Firestore, 'eren');
    const veliBiz = (await admin.list({ provinceCode: '16' })).find((b) => b.id === v)!;
    await admin.setVerification(veliBiz, 'dogrulandi');
    await admin.setFeatured(veliBiz, new Date(Date.now() + 86400000));
    await admin.setTier(veliBiz, 'pro', new Date(Date.now() + 30 * 86400000));
    const ranked = rankBusinesses(await guest.listByCategory('16', 'tesisatci'), { districtId: '16-nilufer' });
    expect(ranked.featured.map((b) => b.id)).toEqual([v]);
    expect(ranked.featured[0].verification.status).toBe('dogrulandi');
    expect(ranked.featured[0].membership.tier).toBe('pro');

    await ali.update(a, { ...input('Ali Usta'), description: 'Tesisat işleri' });
    await ali.setHidden(a, true);
    expect((await guest.listByCategory('16', 'tesisatci')).map((b) => b.id)).toEqual([v]);
    expect((await ali.listMine('ali'))[0]).toMatchObject({ name: 'Ali Usta', status: 'gizli', description: 'Tesisat işleri' });

    await veli.deleteAllOf('veli');
    expect(await veli.listMine('veli')).toEqual([]);
    const log = await getDocs(collection(env.authenticatedContext('eren').firestore(), 'auditLog'));
    expect(log.docs.map((d) => d.data().summary)).toEqual(expect.arrayContaining(['Doğrulandı: Veli Tesisat', 'Üyelik kademesi: pro: Veli Tesisat']));
  });
});
