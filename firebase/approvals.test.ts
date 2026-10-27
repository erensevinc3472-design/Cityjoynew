import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { bulkApprovable, defaultModulesFor, ROLE_TEMPLATES } from '@cityjoy/shared';
import {
  createApprovalAdmin,
  createFirestoreBusinessRepository,
  createGrantAdmin,
  createVerificationRequests,
  listAuditLog,
} from '@cityjoy/shared/firebase';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
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

const fs = (uid: string, email = `${uid}@ornek.com`) =>
  env.authenticatedContext(uid, { email, email_verified: true }).firestore() as unknown as Firestore;

const actor = (uid: string) => ({ uid, email: `${uid}@ornek.com`, name: uid });
const input = (name: string, provinceCode = '16', districtId = '16-nilufer', phone = '05321234567') => ({
  type: 'hizmet' as const,
  name,
  categoryIds: ['tesisatci'],
  location: { provinceCode, districtId },
  phone,
  whatsapp: true,
  is24h: false,
  priceList: [],
});

/** Bursa il yöneticisi (ahmet) ve iki işletme sahibi (ali: Bursa, veli: İstanbul). */
async function setup() {
  await createGrantAdmin(fs('eren'), 'eren').save(
    { email: 'ahmet@ornek.com', displayName: 'Ahmet', role: 'il-yoneticisi', scope: { level: 'il', provinceCode: '16' }, modules: defaultModulesFor('il-yoneticisi', ROLE_TEMPLATES) },
    true,
  );
  const ali = await createFirestoreBusinessRepository(fs('ali')).create('ali', input('Ali Tesisat'));
  const veli = await createFirestoreBusinessRepository(fs('veli')).create('veli', input('Veli Tesisat', '34', '34-kadikoy', '02161112233'));
  const get = (uid: string, id: string) => createFirestoreBusinessRepository(fs(uid)).get(id).then((b) => b!);
  return { ali, veli, get };
}

describe('onay merkezi: işletme doğrulaması', () => {
  it('sahip ister > il yöneticisi onaylar > admin onaylar > işletme doğrulanır; her adım kayıtta', async () => {
    const { ali, get } = await setup();
    const requests = createVerificationRequests(fs('ali'));
    await requests.request('ali', await get('ali', ali), 'Dükkânımıza gelebilirsiniz');
    expect(await requests.get(ali)).toMatchObject({ status: 'il-onayi-bekliyor', title: 'Ali Tesisat', note: 'Dükkânımıza gelebilirsiniz' });
    // Bekleyen istek ikinci kez gönderilemez.
    await expect(requests.request('ali', await get('ali', ali))).rejects.toThrow();

    const ahmet = createApprovalAdmin(fs('ahmet'), actor('ahmet'));
    const pending = await ahmet.listPending('16');
    expect(pending.map((a) => a.targetId)).toEqual([ali]);
    // Başka ilin listesi okunamaz.
    await expect(ahmet.listPending('34')).rejects.toThrow();
    await ahmet.approveFirst(pending[0]);

    const eren = createApprovalAdmin(fs('eren'), actor('eren'));
    const waiting = await eren.listPending();
    expect(waiting[0]).toMatchObject({ status: 'admin-onayi-bekliyor', firstApproval: { uid: 'ahmet', email: 'ahmet@ornek.com' } });
    expect(await eren.approveFinal(waiting, { bulk: false })).toBe(1);

    expect((await get('ali', ali)).verification.status).toBe('dogrulandi');
    expect((await requests.get(ali))?.status).toBe('onaylandi');
    expect((await eren.listDecided()).map((a) => a.status)).toEqual(['onaylandi']);
    const log = await listAuditLog(fs('eren'));
    expect(log.filter((e) => e.module === 'onaylar').map((e) => e.actorUid).sort()).toEqual(['ahmet', 'eren']);
  });

  it('il yöneticisi gerekçeyle reddeder; sahip gerekçeyi görür ve yeniden ister', async () => {
    const { ali, get } = await setup();
    const requests = createVerificationRequests(fs('ali'));
    await requests.request('ali', await get('ali', ali));
    const ahmet = createApprovalAdmin(fs('ahmet'), actor('ahmet'));
    const [a] = await ahmet.listPending('16');
    await expect(ahmet.reject(a, 'yok', false)).rejects.toThrow();
    await ahmet.reject(a, 'Adres doğrulanamadı', false);
    expect(await requests.get(ali)).toMatchObject({ status: 'reddedildi', decision: { stage: 1, reason: 'Adres doğrulanamadı' } });
    await requests.request('ali', await get('ali', ali));
    expect((await requests.get(ali))?.status).toBe('il-onayi-bekliyor');
    // İsteğini geri çeker.
    await requests.cancel(ali);
    expect(await requests.get(ali)).toBeNull();
  });

  it('il yöneticisi istek gelmemiş işletmeyi kendisi önerir; kendi işletmesini ve başka ilinkini öneremez', async () => {
    const { ali, veli, get } = await setup();
    const ahmet = createApprovalAdmin(fs('ahmet'), actor('ahmet'));
    await ahmet.proposeBusiness(await get('ahmet', ali), 'Yerinde gördüm');
    expect((await createApprovalAdmin(fs('eren'), actor('eren')).listPending())[0]).toMatchObject({ status: 'admin-onayi-bekliyor', requestedBy: 'ahmet' });
    // Bekleyen istek varken ikinci kez önerilemez.
    await expect(ahmet.proposeBusiness(await get('ahmet', ali))).rejects.toThrow();
    await expect(ahmet.proposeBusiness(await get('veli', veli))).rejects.toThrow();
    const own = await createFirestoreBusinessRepository(fs('ahmet')).create('ahmet', input('Ahmet Usta', '16', '16-osmangazi', '02242223344'));
    await expect(ahmet.proposeBusiness(await get('ahmet', own))).rejects.toThrow();
  });

  it('yetkisizler karar veremez, sahte istek açılamaz', async () => {
    const { ali, veli, get } = await setup();
    const aliBiz = await get('ali', ali);
    // Başkasının işletmesine istek, yanlış ad / yer, doğrudan onaylı istek.
    await expect(createVerificationRequests(fs('veli')).request('veli', aliBiz)).rejects.toThrow();
    await expect(createVerificationRequests(fs('ali')).request('ali', { ...aliBiz, name: 'Belediye Onaylı' })).rejects.toThrow();
    await assertFails(
      setDoc(doc(fs('ali'), `approvals/isletme-dogrulama__${ali}`), {
        kind: 'isletme-dogrulama', module: 'isletme-dogrulama', targetId: ali, title: 'Ali Tesisat',
        region: { provinceCode: '16', districtId: '16-nilufer' }, status: 'onaylandi', requestedBy: 'ali',
        requestedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }),
    );
    await createVerificationRequests(fs('ali')).request('ali', aliBiz);
    await createVerificationRequests(fs('veli')).request('veli', await get('veli', veli));
    const [a] = await createApprovalAdmin(fs('eren'), actor('eren')).listPending('16');
    // Sahip kendi isteğini onaylayamaz; il yöneticisi başka ilde karar veremez ve 2. aşamayı yapamaz.
    await expect(createApprovalAdmin(fs('ali'), actor('ali')).approveFirst(a)).rejects.toThrow();
    const veliReq = (await createApprovalAdmin(fs('eren'), actor('eren')).listPending('34'))[0];
    await expect(createApprovalAdmin(fs('ahmet'), actor('ahmet')).approveFirst(veliReq)).rejects.toThrow();
    await createApprovalAdmin(fs('ahmet'), actor('ahmet')).approveFirst(a);
    await expect(createApprovalAdmin(fs('ahmet'), actor('ahmet')).approveFinal([a], { bulk: false })).rejects.toThrow();
    // İl yöneticisinin onayı başkası adına yazılamaz.
    await assertFails(
      updateDoc(doc(fs('ahmet'), 'approvals', veliReq.id), {
        status: 'admin-onayi-bekliyor', updatedAt: serverTimestamp(),
        firstApproval: { uid: 'ahmet', email: 'baskasi@ornek.com', name: 'Ahmet', at: serverTimestamp() },
      }),
    );
    // Başkası okuyamaz, sahibi okur.
    await assertFails(getDoc(doc(fs('veli'), 'approvals', a.id)));
    await assertSucceeds(getDoc(doc(fs('ali'), 'approvals', a.id)));
  });

  it('admin toplu onaylar; işletme silinince istek de silinir', async () => {
    const { ali, veli, get } = await setup();
    await createVerificationRequests(fs('ali')).request('ali', await get('ali', ali));
    await createVerificationRequests(fs('veli')).request('veli', await get('veli', veli));
    const eren = createApprovalAdmin(fs('eren'), actor('eren'));
    const all = await eren.listPending();
    expect(bulkApprovable(all, 'tumu')).toHaveLength(2);
    // Admin, il yöneticisi onayı olmadan da (ilk aşamadaki işi) onaylayabilir.
    expect(await eren.approveFinal(bulkApprovable(all, 'tumu'), { bulk: true })).toBe(2);
    expect((await get('veli', veli)).verification.status).toBe('dogrulandi');

    await createFirestoreBusinessRepository(fs('ali')).delete(ali);
    expect(await createVerificationRequests(fs('ali')).get(ali)).toBeNull();
  });

  it('güvenilir yöneticiler: yalnızca admin ekler, görür ve çıkarır', async () => {
    await setup();
    const eren = createApprovalAdmin(fs('eren'), actor('eren'));
    const id = await eren.saveTrusted({ email: 'Ahmet@Ornek.com', displayName: 'Ahmet Bey', provinceCode: '16', modules: ['bildirimler'] });
    expect(id).toBe('ahmet@ornek.com__il-16');
    const [t] = await eren.listTrusted();
    expect(t).toMatchObject({ email: 'ahmet@ornek.com', provinceCode: '16', modules: ['bildirimler'] });
    await expect(createApprovalAdmin(fs('ahmet'), actor('ahmet')).listTrusted()).rejects.toThrow();
    await expect(createApprovalAdmin(fs('ahmet'), actor('ahmet')).saveTrusted({ email: 'ahmet@ornek.com', displayName: 'Ben', provinceCode: '16', modules: [] })).rejects.toThrow();
    // Tanımsız kategori yazılamaz.
    await expect(eren.saveTrusted({ email: 'a@b.co', displayName: 'A', provinceCode: '16', modules: ['meslekler'] })).rejects.toThrow();
    await eren.removeTrusted(t);
    expect((await eren.listTrusted())[0].removedAt).toBeTruthy();
    await assertFails(deleteDoc(doc(fs('eren'), 'trustedApprovers', id)));
  });
});
