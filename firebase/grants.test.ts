import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { defaultModulesFor, grantDocId, ROLE_TEMPLATES, type Organization } from '@cityjoy/shared';
import {
  createBusinessAdmin,
  createGrantAdmin,
  createOrganizationAdmin,
  createServiceCategoryAdmin,
  listAuditLog,
  loadOwnGrants,
  loadOwnMemberships,
} from '@cityjoy/shared/firebase';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
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
  await seed('admins/eren', { addedAt: 'konsol' });
});

/** Kişiler e-postalarıyla tanınır; yetki yalnızca doğrulanmış e-postada geçer. */
const fs = (uid: string, email = `${uid}@ornek.com`, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore() as unknown as Firestore;

async function seed(p: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), p), data);
  });
}

const bursa = { level: 'il', provinceCode: '16' } as const;
const ataevler = { level: 'mahalle', provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' } as const;
const kadikoyMahalle = { level: 'mahalle', provinceCode: '34', districtId: '34-kadikoy', neighbourhoodId: '34-kadikoy-moda' } as const;

const ilYoneticisi = {
  email: 'ahmet@ornek.com',
  displayName: 'Ahmet Yılmaz',
  role: 'il-yoneticisi' as const,
  scope: bursa,
  modules: defaultModulesFor('il-yoneticisi', ROLE_TEMPLATES),
};
const muhtar = (scope: typeof ataevler | typeof kadikoyMahalle = ataevler, email = 'muhtar@ornek.com') => ({
  email,
  displayName: 'Ayşe Muhtar',
  role: 'muhtar' as const,
  scope,
  modules: defaultModulesFor('muhtar', ROLE_TEMPLATES),
});

describe('yetki zinciri', () => {
  it('admin il yöneticisi atar; kişi e-postasıyla girince yetkisini görür, başkası göremez', async () => {
    const id = await createGrantAdmin(fs('eren', 'eren@ornek.com'), 'eren').save(ilYoneticisi, true);
    expect(id).toBe(grantDocId('ahmet@ornek.com', bursa));
    const own = await loadOwnGrants(fs('ahmet'), 'ahmet@ornek.com');
    expect(own.map((g) => g.role)).toEqual(['il-yoneticisi']);
    await assertFails(getDoc(doc(fs('veli'), 'grants', id)));
    const log = await listAuditLog(fs('eren', 'eren@ornek.com'));
    expect(log.some((e) => e.module === 'yetkiler' && e.targetId === id && e.action === 'ekle')).toBe(true);
  });

  it('il yöneticisi muhtara "onaysız yayınla" verebilir; kendinde olmayanı (il geneli bildirimi onaysız) veremez', async () => {
    await createGrantAdmin(fs('eren', 'eren@ornek.com'), 'eren').save(ilYoneticisi, true);
    const ahmet = createGrantAdmin(fs('ahmet'), 'ahmet');
    await ahmet.save({ ...muhtar(), modules: { gonderiler: ['goruntule', 'ekle', 'yayinla'] } }, true);
    expect((await loadOwnGrants(fs('muhtar'), 'muhtar@ornek.com'))[0]?.modules.gonderiler).toEqual(['goruntule', 'ekle', 'yayinla']);
    await expect(ahmet.save({ ...muhtar(), modules: { bildirimler: ['goruntule', 'ekle', 'yayinla'] } }, false)).rejects.toThrow();
    // Admin verebilir.
    await createGrantAdmin(fs('eren', 'eren@ornek.com'), 'eren').save({ ...muhtar(), modules: { bildirimler: ['goruntule', 'ekle', 'yayinla'] } }, false);
  });

  it('il yöneticisi kendi ilinde muhtar atar ve geri alır; başka ile, il yöneticisi olarak ya da fazla yetkiyle atayamaz', async () => {
    await createGrantAdmin(fs('eren', 'eren@ornek.com'), 'eren').save(ilYoneticisi, true);
    const ahmet = createGrantAdmin(fs('ahmet'), 'ahmet');
    await ahmet.save(muhtar(), true);
    expect((await loadOwnGrants(fs('muhtar'), 'muhtar@ornek.com'))[0]?.role).toBe('muhtar');
    expect((await ahmet.listForProvince('16')).map((g) => g.role).sort()).toEqual(['il-yoneticisi', 'muhtar']);
    await expect(ahmet.listForProvince('34')).rejects.toThrow();

    await expect(ahmet.save(muhtar(kadikoyMahalle, 'baska@ornek.com'), true)).rejects.toThrow();
    await expect(ahmet.save({ ...ilYoneticisi, email: 'veli@ornek.com' }, true)).rejects.toThrow();
    // Kendinde olmayan yetkiyi veremez (il yöneticisinin acil numara düzenleme yetkisi yok, muhtarın sınırı da değil).
    const ref = doc(fs('ahmet'), 'grants', grantDocId('can@ornek.com', ataevler));
    await assertFails(setDoc(ref, {
      email: 'can@ornek.com', displayName: 'Can', role: 'muhtar', scope: ataevler, modules: { 'acil-numaralar': ['goruntule', 'duzenle'] },
      grantedBy: 'ahmet', grantedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    // Kendine yetki veremez.
    await expect(ahmet.save(muhtar(ataevler, 'ahmet@ornek.com'), true)).rejects.toThrow();

    const [m] = (await ahmet.listForProvince('16')).filter((g) => g.role === 'muhtar');
    await ahmet.revoke(m!);
    const log = await listAuditLog(fs('ahmet'), { actorUid: 'ahmet' });
    expect(log.map((e) => e.action).sort()).toEqual(['ekle', 'sil']);
  });

  it('doğrulanmamış e-postada yetki geçmez; muhtar yetki veremez', async () => {
    await createGrantAdmin(fs('eren', 'eren@ornek.com'), 'eren').save(ilYoneticisi, true);
    await expect(createGrantAdmin(fs('ahmet', 'ahmet@ornek.com', false), 'ahmet').save(muhtar(), true)).rejects.toThrow();
    await createGrantAdmin(fs('ahmet'), 'ahmet').save(muhtar(), true);
    await expect(createGrantAdmin(fs('muhtar'), 'muhtar').save(muhtar(ataevler, 'yardimci@ornek.com'), true)).rejects.toThrow();
  });

  it('panelden admin rolü ya da ülke geneli liste yetkisi verilemez; rol bölge düzeyine uymalı', async () => {
    const base = { email: 'ahmet@ornek.com', displayName: 'Ahmet', role: 'il-yoneticisi', scope: bursa, grantedBy: 'eren', grantedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    const admin = fs('eren', 'eren@ornek.com');
    const ref = doc(admin, 'grants', grantDocId('ahmet@ornek.com', bursa));
    await assertFails(setDoc(doc(admin, 'grants', 'ahmet@ornek.com__ulke'), { ...base, role: 'admin', scope: { level: 'ulke' }, modules: { konumlar: ['goruntule'] } }));
    await assertFails(setDoc(ref, { ...base, modules: { 'acil-numaralar': ['goruntule', 'duzenle'] } }));
    await assertFails(setDoc(ref, { ...base, modules: { meslekler: ['goruntule'] } }));
    await assertFails(setDoc(doc(admin, 'grants', 'ahmet@ornek.com__il-34'), { ...base, modules: { konumlar: ['goruntule'] } }));
    await assertFails(setDoc(doc(admin, 'grants', grantDocId('ahmet@ornek.com', ataevler)), { ...base, scope: ataevler, modules: { konumlar: ['goruntule'] } }));
    await assertSucceeds(setDoc(ref, { ...base, modules: { konumlar: ['goruntule'] } }));
  });

  it('geri alınan ya da süresi dolan yetki sunucuda geçmez; yetki silinemez', async () => {
    const admin = createGrantAdmin(fs('eren', 'eren@ornek.com'), 'eren');
    await admin.save(ilYoneticisi, true);
    await seed('serviceSuggestions/s1', { uid: 'ali', text: 'Saat tamircisi', provinceCode: '16', status: 'yeni', createdAt: Timestamp.now() });
    await assertSucceeds(getDoc(doc(fs('ahmet'), 'serviceSuggestions/s1')));
    const [g] = await admin.listAll();
    await admin.revoke(g!);
    await assertFails(getDoc(doc(fs('ahmet'), 'serviceSuggestions/s1')));
    await admin.save({ ...ilYoneticisi, expiresAt: new Date(Date.now() - 60_000) }, false);
    await assertFails(getDoc(doc(fs('ahmet'), 'serviceSuggestions/s1')));
    await admin.save({ ...ilYoneticisi, expiresAt: new Date(Date.now() + 86_400_000) }, false);
    await assertSucceeds(getDoc(doc(fs('ahmet'), 'serviceSuggestions/s1')));
    await assertFails(deleteDoc(doc(fs('eren', 'eren@ornek.com'), 'grants', g!.id)));
  });
});

describe('il yöneticisi kendi ilinde çalışır', () => {
  beforeEach(async () => {
    await createGrantAdmin(fs('eren', 'eren@ornek.com'), 'eren').save(ilYoneticisi, true);
    await seed('serviceSuggestions/bursa', { uid: 'ali', text: 'Saat tamircisi', provinceCode: '16', status: 'yeni', createdAt: Timestamp.now() });
    await seed('serviceSuggestions/istanbul', { uid: 'ali', text: 'Kayıkçı', provinceCode: '34', status: 'yeni', createdAt: Timestamp.now() });
  });

  it('yalnızca kendi ilinin eksik hizmet önerilerini görür ve incelendi yapar', async () => {
    const mine = createServiceCategoryAdmin(fs('ahmet'), 'ahmet');
    const list = await mine.listSuggestions({ provinceCode: '16' });
    expect(list.map((s) => s.id)).toEqual(['bursa']);
    await expect(mine.listSuggestions({ provinceCode: '34' })).rejects.toThrow();
    await expect(mine.listSuggestions()).rejects.toThrow();
    await mine.markReviewed(list[0]!);
    await expect(mine.markReviewed({ id: 'istanbul', uid: 'ali', text: 'Kayıkçı', provinceCode: '34', status: 'yeni', createdAt: '' })).rejects.toThrow();
    await expect(listAuditLog(fs('ahmet'))).rejects.toThrow();
  });

  it('kendi ilindeki gizli işletmeleri görür, başka ili göremez, doğrulama yapamaz', async () => {
    const biz = (provinceCode: string, districtId: string) => ({
      type: 'hizmet', name: 'Usta', categoryIds: ['tesisatci'], location: { provinceCode, districtId }, phone: '5551112233',
      whatsapp: false, is24h: false, priceList: [], ownerUid: 'sahip', status: 'gizli',
      verification: { status: 'dogrulanmadi' }, membership: { tier: 'ucretsiz' }, rating: { sum: 0, count: 0 },
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    await seed('businesses/b1', biz('16', '16-nilufer'));
    await seed('businesses/b2', biz('34', '34-kadikoy'));
    const reader = createBusinessAdmin(fs('ahmet'), 'ahmet');
    expect((await reader.list({ provinceCode: '16' })).map((b) => b.id)).toEqual(['b1']);
    await expect(reader.list({ provinceCode: '34' })).rejects.toThrow();
    const [b1] = await reader.list({ provinceCode: '16' });
    await expect(reader.setVerification(b1!, 'dogrulandi')).rejects.toThrow();
  });
});

describe('kurumlar ve personel', () => {
  const nilufer = {
    id: 'bld-16-nilufer', name: 'Nilüfer Belediyesi', kind: 'ilce-belediyesi' as const,
    scope: { level: 'ilce' as const, provinceCode: '16', districtId: '16-nilufer' }, modules: ['gonderiler' as const, 'bildirimler' as const],
    officialEmail: 'bilgi@nilufer.bel.tr',
  };
  const kalem = { email: 'kalem@nilufer.bel.tr', displayName: 'Özel Kalem' };
  const org = (): Organization => ({ ...nilufer, status: 'aktif', createdBy: 'eren', createdAt: '' });

  it('kurumu yalnızca admin açar; aynı belediye iki kez açılamaz; belediye kimliği kilitli listeden', async () => {
    await expect(createOrganizationAdmin(fs('ahmet'), 'ahmet').create(nilufer, kalem)).rejects.toThrow();
    const admin = createOrganizationAdmin(fs('eren', 'eren@ornek.com'), 'eren');
    await admin.create(nilufer, kalem);
    await expect(admin.create(nilufer, kalem)).rejects.toThrow();
    await expect(admin.create({ ...nilufer, id: 'krm-nilufer-belediyesi' }, kalem)).rejects.toThrow();
    await admin.create({ ...nilufer, id: 'krm-bursa-spor', name: 'Bursa Spor Kulübü', kind: 'kulup', scope: { level: 'il', provinceCode: '16' } }, kalem);
  });

  it('kurum yöneticisi kendi personelini ekler, görev verir, çıkarır; kurum yöneticisi atayamaz, başka kuruma dokunamaz', async () => {
    await createOrganizationAdmin(fs('eren', 'eren@ornek.com'), 'eren').create(nilufer, kalem);
    const kalemDb = fs('kalem', 'kalem@nilufer.bel.tr');
    const mine = await loadOwnMemberships(kalemDb, 'kalem@nilufer.bel.tr');
    expect(mine.map((m) => [m.org.id, m.member.isOrgAdmin])).toEqual([['bld-16-nilufer', true]]);

    const k = createOrganizationAdmin(kalemDb, 'kalem');
    const basin = { email: 'basin@nilufer.bel.tr', displayName: 'Basın Müdürü', isOrgAdmin: false, assignments: { gonderiler: ['goruntule' as const, 'ekle' as const, 'duzenle' as const, 'yayinla' as const] } };
    await k.saveMember(org(), basin, true);
    expect((await k.listMembers('bld-16-nilufer')).map((m) => m.email)).toEqual(['kalem@nilufer.bel.tr', 'basin@nilufer.bel.tr']);
    expect((await loadOwnMemberships(fs('basin', 'basin@nilufer.bel.tr'), 'basin@nilufer.bel.tr'))[0]?.member.assignments).toEqual({ gonderiler: ['goruntule', 'ekle', 'duzenle', 'yayinla'] });

    // Kurumun bölümleri dışında görev, kurum yöneticisi atama, kendi kaydını değiştirme yok.
    const raw = doc(kalemDb, 'orgMembers', 'bld-16-nilufer__basin@nilufer.bel.tr');
    await assertFails(setDoc(raw, { orgId: 'bld-16-nilufer', email: 'basin@nilufer.bel.tr', displayName: 'B', isOrgAdmin: false, assignments: { etkinlikler: ['goruntule', 'onayla'] }, addedBy: 'kalem', updatedAt: serverTimestamp() }));
    // Eski kalıp biçimi ve bölüme uymayan eylem yazılamaz.
    await assertFails(setDoc(raw, { orgId: 'bld-16-nilufer', email: 'basin@nilufer.bel.tr', displayName: 'B', isOrgAdmin: false, assignments: { gonderiler: { role: 'onaylayan' } }, addedBy: 'kalem', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(raw, { orgId: 'bld-16-nilufer', email: 'basin@nilufer.bel.tr', displayName: 'B', isOrgAdmin: false, assignments: { gonderiler: ['goruntule', 'bildirim-gonder'] }, addedBy: 'kalem', updatedAt: serverTimestamp() }));
    await expect(k.saveMember(org(), { ...basin, email: 'yeni@nilufer.bel.tr', isOrgAdmin: true }, true)).rejects.toThrow();
    await expect(k.saveMember(org(), { ...kalem, isOrgAdmin: false, assignments: {} }, false)).rejects.toThrow();
    // Personel başka personel ekleyemez.
    await expect(createOrganizationAdmin(fs('basin', 'basin@nilufer.bel.tr'), 'basin').saveMember(org(), { ...basin, email: 'x@nilufer.bel.tr' }, true)).rejects.toThrow();

    const [, b] = await k.listMembers('bld-16-nilufer');
    await k.removeMember(org(), b!);
    expect((await k.listMembers('bld-16-nilufer'))[1]?.removedAt).toBeTruthy();
  });

  it('kurum pasifleşince ya da sözleşmesi bitince kurum yöneticisi çalışamaz; il yöneticisi ilindeki kurumları görür', async () => {
    const admin = createOrganizationAdmin(fs('eren', 'eren@ornek.com'), 'eren');
    await admin.create(nilufer, kalem);
    await admin.update(org(), { status: 'pasif' });
    const basin = { email: 'basin@nilufer.bel.tr', displayName: 'Basın', isOrgAdmin: false, assignments: {} };
    await expect(createOrganizationAdmin(fs('kalem', 'kalem@nilufer.bel.tr'), 'kalem').saveMember(org(), basin, true)).rejects.toThrow();
    await admin.update(org(), { status: 'aktif', contractEndsAt: new Date(Date.now() - 1000) });
    await expect(createOrganizationAdmin(fs('kalem', 'kalem@nilufer.bel.tr'), 'kalem').saveMember(org(), basin, true)).rejects.toThrow();

    await createGrantAdmin(fs('eren', 'eren@ornek.com'), 'eren').save(ilYoneticisi, true);
    expect((await createOrganizationAdmin(fs('ahmet'), 'ahmet').listForProvince('16')).map((o) => o.id)).toEqual(['bld-16-nilufer']);
    await expect(createOrganizationAdmin(fs('ahmet'), 'ahmet').listForProvince('34')).rejects.toThrow();
  });
});

describe('kilitli adlar', () => {
  it('işletme adı belediye ya da resmî kurum adı olamaz', async () => {
    const biz = (name: string) => ({
      type: 'hizmet', name, categoryIds: ['tesisatci'], location: { provinceCode: '16', districtId: '16-nilufer' }, phone: '5551112233',
      whatsapp: false, is24h: false, priceList: [], ownerUid: 'ali', status: 'yayinda',
      verification: { status: 'dogrulanmadi' }, membership: { tier: 'ucretsiz' }, rating: { sum: 0, count: 0 },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    const ali = fs('ali');
    for (const name of ['Nilüfer Belediyesi', 'NİLÜFER BELEDİYESİ', 'Bursa Valiliği', 'CityJoy Destek']) {
      await assertFails(setDoc(doc(ali, 'businesses/x'), biz(name)));
    }
    // Ad uygunsa kural telefon kaydını bekler; burada yalnızca ad denetimini ayırmak için updateDoc ile bakılır.
    await seed('businesses/y', { ...biz('Ahmet Usta'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await assertFails(updateDoc(doc(ali, 'businesses/y'), { name: 'Osmangazi Belediyesi', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(ali, 'businesses/y'), { name: 'Ahmet Usta Tesisat', updatedAt: serverTimestamp() }));
  });
});
