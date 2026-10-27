import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { FamilyError, activeEmergencyNumbers, buildCategoryTree, rankBusinesses, createServiceCategoryStore, LEGAL_TEXT_VERSION } from '@cityjoy/shared';
import {
  createBusinessAdmin,
  createFirestoreFamilyRepository,
  createFirestoreSosRepository,
  createSosSettingsAdmin,
  createFirestoreReviewRepository,
  createReviewModeration,
  DuplicateBusinessError,
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
    const v = await veli.create('veli', { ...input('Veli Tesisat', '16-osmangazi'), phone: '02241112233' });
    await veli.create('veli', { ...input('İstanbul Tesisat', '34-kadikoy'), phone: '02161112233', location: { provinceCode: '34', districtId: '34-kadikoy' } });

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
    // Aynı telefonla ikinci işletme açılamaz.
    await expect(ali.create('ali', input('Kopya Tesisat'))).rejects.toBeInstanceOf(DuplicateBusinessError);

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

describe('değerlendirmeler', () => {
  it('ara > değerlendir > düzenle; sahibi cevaplar; şikâyet; admin gizler; hesap silinince yorumlar silinir ve puan düşer', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' });
    });
    const fs = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
    const id = await createFirestoreBusinessRepository(fs('ali')).create('ali', {
      type: 'hizmet', name: 'Ali Tesisat', categoryIds: ['tesisatci'], location: { provinceCode: '16', districtId: '16-nilufer' },
      phone: '05321234567', whatsapp: true, is24h: false, priceList: [],
    });
    const ayse = createFirestoreReviewRepository(fs('ayse'));
    const veli = createFirestoreReviewRepository(fs('veli'));
    const rating = async () => (await createFirestoreBusinessRepository(fs('x')).get(id))!.rating;

    expect(await ayse.getMine(id, 'ayse')).toBeNull();
    expect(await ayse.hasContacted(id, 'ayse')).toBe(false);
    await expect(ayse.save(id, 'ayse', { stars: 5, text: 'Çok hızlı geldi, sorunu çözdü.' }, 'Ayşe K.')).rejects.toThrow();
    await ayse.recordContact(id, 'ayse');
    await ayse.recordContact(id, 'ayse');
    await ayse.save(id, 'ayse', { stars: 5, text: 'Çok hızlı geldi, sorunu çözdü.' }, 'Ayşe K.');
    await veli.recordContact(id, 'veli');
    await veli.save(id, 'veli', { stars: 2, text: 'Geç geldi ama işi yaptı.' }, 'Veli D.');
    expect(await rating()).toEqual({ sum: 7, count: 2 });
    await veli.save(id, 'veli', { stars: 3, text: 'Geç geldi ama işi düzgün yaptı.' }, 'Veli D.');
    expect(await rating()).toEqual({ sum: 8, count: 2 });

    await createFirestoreReviewRepository(fs('ali')).reply(id, 'veli', 'Gecikme için özür dileriz.');
    const list = await createFirestoreReviewRepository(fs('misafir')).list(id);
    expect(list.map((r) => r.authorName).sort()).toEqual(['Ayşe K.', 'Veli D.']);
    expect(list.find((r) => r.uid === 'veli')!.reply!.text).toBe('Gecikme için özür dileriz.');

    await ayse.report(id, 'veli', 'ayse', 'hakaret');
    const mod = createReviewModeration(fs('eren'), 'eren');
    const [report] = await mod.listReports();
    expect(report).toMatchObject({ businessName: 'Ali Tesisat', reason: 'hakaret', review: { stars: 3 } });
    await mod.setHidden(report, true);
    expect(await rating()).toEqual({ sum: 5, count: 1 });
    expect((await createFirestoreReviewRepository(fs('misafir')).list(id)).map((r) => r.uid)).toEqual(['ayse']);

    // Hesap silme: Ayşe'nin yorumu silinir, puan düşer; gizlenen yorumu olan Veli de silebilir.
    await ayse.deleteAllBy('ayse');
    expect(await rating()).toEqual({ sum: 0, count: 0 });
    await veli.deleteAllBy('veli');
    expect(await veli.getMine(id, 'veli')).toBeNull();

    // İşletme silinince yorumları da silinir.
    await ayse.recordContact(id, 'ayse');
    await ayse.save(id, 'ayse', { stars: 4, text: 'İkinci kez çağırdım, yine iyiydi.' }, 'Ayşe K.');
    await createFirestoreBusinessRepository(fs('ali')).delete(id);
    expect(await ayse.getMine(id, 'ayse')).toBeNull();
  });
});

describe('SOS - Aileme haber ver', () => {
  it('davet > kabul > SOS > teslim/görüldü > güvendeyim; ayrılma; hesap silme; panel ayarları', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' });
    });
    const fs = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
    const fam = (uid: string) => createFirestoreFamilyRepository(fs(uid));
    const sos = (uid: string) => createFirestoreSosRepository(fs(uid));

    const inv = await fam('ali').createInvite('ali', 'Ali Usta');
    await expect(fam('ali').acceptInvite(inv.code, 'ali', 'Ali Usta')).rejects.toEqual(new FamilyError('self'));
    await expect(fam('ayse').acceptInvite('ZZZZ-ZZZZ', 'ayse', 'Ayşe')).rejects.toEqual(new FamilyError('invalid'));
    expect(await fam('ayse').acceptInvite(inv.code.toLowerCase(), 'ayse', 'Ayşe Kaya')).toMatchObject({ uid: 'ali', name: 'Ali Usta' });
    await expect(fam('veli').acceptInvite(inv.code, 'veli', 'Veli')).rejects.toEqual(new FamilyError('used'));
    const inv2 = await fam('ali').createInvite('ali', 'Ali Usta');
    await fam('veli').acceptInvite(inv2.code, 'veli', 'Veli Demir');
    expect((await fam('ali').listMembers('ali')).map((m) => m.name)).toEqual(['Ayşe Kaya', 'Veli Demir']);
    expect((await fam('ayse').listMembers('ayse')).map((m) => m.name)).toEqual(['Ali Usta']);

    expect(await sos('ali').config()).toEqual({ liveMinutes: 30, countdownSeconds: 5 });
    await createSosSettingsAdmin(fs('eren'), 'eren').save({ liveMinutes: 45, countdownSeconds: 4 });
    expect(await sos('ali').config()).toEqual({ liveMinutes: 45, countdownSeconds: 4 });

    const incoming: string[][] = [];
    const stop = sos('ayse').watchIncoming('ayse', (l) => incoming.push(l.map((a) => a.fromName)));
    const id = await sos('ali').send({ fromUid: 'ali', fromName: 'Ali Usta', recipients: ['ayse', 'veli'], test: false, location: { lat: 40.19, lng: 29.06, accuracy: 10 }, liveMinutes: 45 });
    await expect(sos('ali').send({ fromUid: 'ali', fromName: 'Ali', recipients: ['yabanci'], test: false, liveMinutes: 30 })).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 800));
    stop();
    expect(incoming.at(-1)).toEqual(['Ali Usta']);

    await sos('ayse').markDelivered(id, 'ayse');
    await sos('ayse').markSeen(id, 'ayse');
    await sos('ali').updateLocation(id, { lat: 40.2, lng: 29.07 });
    await sos('ali').setStatus(id, 'guvende');
    const [sent] = await sos('ali').listSent('ali');
    expect(sent).toMatchObject({ status: 'guvende', location: { lat: 40.2, lng: 29.07 } });
    expect(Object.keys(sent.deliveredTo)).toEqual(['ayse']);
    expect(Object.keys(sent.seenBy)).toEqual(['ayse']);

    // Ayrılma iki taraftan da kaldırır; ayrılan kişiye artık SOS gönderilemez.
    await fam('veli').remove('veli', 'ali');
    expect((await fam('ali').listMembers('ali')).map((m) => m.uid)).toEqual(['ayse']);
    await expect(sos('ali').send({ fromUid: 'ali', fromName: 'Ali', recipients: ['veli'], test: true, liveMinutes: 30 })).rejects.toThrow();

    await fam('ali').deleteAllOf('ali');
    expect(await fam('ayse').listMembers('ayse')).toEqual([]);
    expect(await sos('ali').listSent('ali')).toEqual([]);
  });
});
