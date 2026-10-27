import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { grantDocId, ROLE_TEMPLATES, defaultModulesFor } from '@cityjoy/shared';
import {
  createBusinessAdmin,
  createGrantAdmin,
  createServiceCategoryAdmin,
  deleteOwnAccessRequest,
  getOwnAccessRequest,
  listAuditLog,
  loadOwnGrants,
  submitAccessRequest,
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

const fs = (uid: string, email?: string) =>
  env.authenticatedContext(uid, email ? { email, email_verified: true } : {}).firestore() as unknown as Firestore;

async function seed(p: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), p), data);
  });
}

const bursa = { level: 'il', provinceCode: '16' } as const;
const ilYoneticisi = {
  uid: 'ahmet',
  displayName: 'Ahmet Yılmaz',
  email: 'ahmet@ornek.com',
  role: 'il-yoneticisi' as const,
  scope: bursa,
  modules: defaultModulesFor('il-yoneticisi', ROLE_TEMPLATES),
};

describe('yetki verme', () => {
  it('admin yetki verir; kişi kendi yetkisini görür, başkası göremez', async () => {
    const admin = createGrantAdmin(fs('eren'), 'eren');
    const id = await admin.save(ilYoneticisi, true);
    expect(id).toBe(grantDocId('ahmet', bursa));

    const own = await loadOwnGrants(fs('ahmet'), 'ahmet');
    expect(own).toHaveLength(1);
    expect(own[0]!.role).toBe('il-yoneticisi');
    await assertFails(getDoc(doc(fs('veli'), 'grants', id)));
    expect((await admin.listAll()).map((g) => g.id)).toEqual([id]);

    // Her işlem kayda geçer.
    const log = await listAuditLog(fs('eren'));
    expect(log.some((e) => e.module === 'yetkiler' && e.targetId === id && e.action === 'ekle')).toBe(true);
  });

  it('admin olmayan yetki veremez; il yöneticisi de veremez', async () => {
    await createGrantAdmin(fs('eren'), 'eren').save(ilYoneticisi, true);
    await expect(
      createGrantAdmin(fs('ahmet'), 'ahmet').save({ ...ilYoneticisi, uid: 'veli', displayName: 'Veli' }, true),
    ).rejects.toThrow();
    await expect(createGrantAdmin(fs('veli'), 'veli').save({ ...ilYoneticisi, uid: 'veli' }, true)).rejects.toThrow();
  });

  it('panelden admin rolü, ülke geneli liste yetkisi ya da yetki verme yetkisi verilemez', async () => {
    const base = {
      uid: 'ahmet', displayName: 'Ahmet', role: 'il-yoneticisi', scope: bursa, grantedBy: 'eren',
      grantedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    const ref = doc(fs('eren'), 'grants', grantDocId('ahmet', bursa));
    await assertFails(setDoc(ref, { ...base, role: 'admin', scope: { level: 'ulke' }, modules: { konumlar: ['goruntule'] } }));
    await assertFails(setDoc(ref, { ...base, modules: { 'acil-numaralar': ['goruntule', 'duzenle'] } }));
    await assertFails(setDoc(ref, { ...base, modules: { meslekler: ['goruntule'] } }));
    await assertFails(setDoc(ref, { ...base, modules: { yetkiler: ['goruntule', 'ekle'] } }));
    // Kimlik bölgeyle uyuşmalı; rol bölge düzeyine uymalı (il yöneticisi ilçeye verilmez).
    await assertFails(setDoc(doc(fs('eren'), 'grants', 'ahmet__il-34'), { ...base, modules: { konumlar: ['goruntule'] } }));
    await assertFails(
      setDoc(doc(fs('eren'), 'grants', 'ahmet__ilce-16-nilufer'), {
        ...base, scope: { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' }, modules: { konumlar: ['goruntule'] },
      }),
    );
    // Admin kendine yetki veremez.
    await assertFails(
      setDoc(doc(fs('eren'), 'grants', 'eren__il-16'), { ...base, uid: 'eren', modules: { konumlar: ['goruntule'] } }),
    );
    await assertSucceeds(setDoc(ref, { ...base, modules: { konumlar: ['goruntule'] } }));
  });

  it('geri alınan ya da süresi dolan yetki sunucuda geçmez; yetki silinemez', async () => {
    const admin = createGrantAdmin(fs('eren'), 'eren');
    await admin.save(ilYoneticisi, true);
    await seed('serviceSuggestions/s1', { uid: 'ali', text: 'Saat tamircisi', provinceCode: '16', status: 'yeni', createdAt: Timestamp.now() });
    await assertSucceeds(getDoc(doc(fs('ahmet'), 'serviceSuggestions/s1')));

    const [g] = await admin.listAll();
    await admin.revoke(g!);
    await assertFails(getDoc(doc(fs('ahmet'), 'serviceSuggestions/s1')));
    // Geri alınmış yetki yeniden geri alınamaz, içeriği gizlice değiştirilemez.
    await assertFails(updateDoc(doc(fs('eren'), 'grants', g!.id), { revokedAt: serverTimestamp(), revokedBy: 'eren', updatedAt: serverTimestamp() }));

    // Yeniden verilebilir, bu kez süresi geçmiş olarak.
    await admin.save({ ...ilYoneticisi, expiresAt: new Date(Date.now() - 60_000) }, false);
    await assertFails(getDoc(doc(fs('ahmet'), 'serviceSuggestions/s1')));
    await admin.save({ ...ilYoneticisi, expiresAt: new Date(Date.now() + 86_400_000) }, false);
    await assertSucceeds(getDoc(doc(fs('ahmet'), 'serviceSuggestions/s1')));

    await assertFails(deleteDoc(doc(fs('eren'), 'grants', g!.id)));
  });
});

describe('il yöneticisi kendi ilinde çalışır', () => {
  beforeEach(async () => {
    await createGrantAdmin(fs('eren'), 'eren').save(ilYoneticisi, true);
    await seed('serviceSuggestions/bursa', { uid: 'ali', text: 'Saat tamircisi', provinceCode: '16', status: 'yeni', createdAt: Timestamp.now() });
    await seed('serviceSuggestions/istanbul', { uid: 'ali', text: 'Kayıkçı', provinceCode: '34', status: 'yeni', createdAt: Timestamp.now() });
  });

  it('yalnızca kendi ilinin eksik hizmet önerilerini görür ve incelendi yapar; işlem kaydı yazılır', async () => {
    const mine = createServiceCategoryAdmin(fs('ahmet'), 'ahmet');
    const list = await mine.listSuggestions({ provinceCode: '16' });
    expect(list.map((s) => s.id)).toEqual(['bursa']);
    await expect(mine.listSuggestions({ provinceCode: '34' })).rejects.toThrow();
    await expect(mine.listSuggestions()).rejects.toThrow();

    await mine.markReviewed(list[0]!);
    const other = { id: 'istanbul', uid: 'ali', text: 'Kayıkçı', provinceCode: '34', status: 'yeni' as const, createdAt: '' };
    await expect(mine.markReviewed(other)).rejects.toThrow();

    const log = await listAuditLog(fs('ahmet'), { actorUid: 'ahmet' });
    expect(log.map((e) => e.targetId)).toEqual(['bursa']);
    // Başkasının kayıtlarını ve tüm kaydı göremez.
    await expect(listAuditLog(fs('ahmet'))).rejects.toThrow();
  });

  it('yetkisi olmayan bölgeye ya da bölgesiz işlem kaydı ekleyemez', async () => {
    const audit = (region?: Record<string, string>) =>
      setDoc(doc(fs('ahmet'), 'auditLog/x'), {
        actorUid: 'ahmet', module: 'hizmet-kategorileri', action: 'onayla', at: serverTimestamp(), summary: 'deneme',
        ...(region ? { region } : {}),
      });
    await assertFails(audit());
    await assertFails(audit({ provinceCode: '34' }));
    await assertSucceeds(audit({ provinceCode: '16' }));
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

describe('yetki talebi', () => {
  it('kişi kendi e-postasıyla talep gönderir, admin görür ve yetki verince talep kapanır', async () => {
    const me = { uid: 'veli', displayName: 'Veli Kaya', email: 'veli@ornek.com' };
    await submitAccessRequest(fs('veli', 'veli@ornek.com'), me, 'Nilüfer Belediyesi basın birimi');
    // Başkasının e-postasıyla gönderemez.
    await expect(submitAccessRequest(fs('can', 'can@ornek.com'), { uid: 'can', displayName: 'Can', email: 'eren@ornek.com' }, '')).rejects.toThrow();
    // Aynı gün ikinci kez gönderemez.
    await expect(submitAccessRequest(fs('veli', 'veli@ornek.com'), me, 'tekrar')).rejects.toThrow();
    // Başkası göremez.
    await assertFails(getDoc(doc(fs('can', 'can@ornek.com'), 'accessRequests/veli')));

    const admin = createGrantAdmin(fs('eren'), 'eren');
    const [req] = await admin.listRequests();
    expect(req?.email).toBe('veli@ornek.com');

    await admin.save(
      {
        uid: 'veli', displayName: req!.displayName, email: req!.email, role: 'belediye',
        scope: { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' }, modules: defaultModulesFor('belediye', ROLE_TEMPLATES),
      },
      true,
    );
    expect((await getOwnAccessRequest(fs('veli', 'veli@ornek.com'), 'veli'))?.status).toBe('yetki-verildi');
    expect(await admin.listRequests()).toEqual([]);
  });

  it('admin talebi reddeder; kişi kendi talebini silebilir', async () => {
    await submitAccessRequest(fs('veli', 'veli@ornek.com'), { uid: 'veli', displayName: 'Veli', email: 'veli@ornek.com' }, '');
    const admin = createGrantAdmin(fs('eren'), 'eren');
    await admin.rejectRequest((await admin.listRequests())[0]!);
    expect((await getOwnAccessRequest(fs('veli', 'veli@ornek.com'), 'veli'))?.status).toBe('reddedildi');
    await deleteOwnAccessRequest(fs('veli', 'veli@ornek.com'), 'veli');
    expect(await getOwnAccessRequest(fs('veli', 'veli@ornek.com'), 'veli')).toBeNull();
  });
});
