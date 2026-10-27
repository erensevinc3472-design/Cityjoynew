import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

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

const thisYear = new Date().getFullYear();
const consent = { granted: true, at: '2026-10-27T10:00:00Z', textVersion: 'taslak-1' };

function profile(uid: string, over: Record<string, unknown> = {}) {
  return {
    uid,
    displayName: 'Eren Deneme',
    language: 'tr',
    birthYear: thisYear - 30,
    occupationId: 'ogretmen',
    phoneVerified: false,
    emailVerified: false,
    isPrivate: false,
    consents: { terms: consent, privacyNotice: consent },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...over,
  };
}

const db = (uid?: string) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe('users', () => {
  it('kullanıcı kendi profilini oluşturur, okur ve siler', async () => {
    await assertSucceeds(setDoc(doc(db('ali'), 'users/ali'), profile('ali')));
    await assertSucceeds(getDoc(doc(db('ali'), 'users/ali')));
    await assertSucceeds(deleteDoc(doc(db('ali'), 'users/ali')));
  });

  it('başkasının profilini okuyamaz ve yazamaz; girişsiz erişim yok', async () => {
    await seed('users/ali', profile('ali', { createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
    await assertFails(getDoc(doc(db('veli'), 'users/ali')));
    await assertFails(getDoc(doc(db(), 'users/ali')));
    await assertFails(setDoc(doc(db('veli'), 'users/veli2'), profile('veli2')));
  });

  it('13 yaş altı kayıt olamaz; 13-17 yaş gizli hesap ve kampanya izni yok', async () => {
    await assertFails(setDoc(doc(db('cocuk'), 'users/cocuk'), profile('cocuk', { birthYear: thisYear - 10 })));
    await assertFails(setDoc(doc(db('genc'), 'users/genc'), profile('genc', { birthYear: thisYear - 15 })));
    await assertSucceeds(setDoc(doc(db('genc'), 'users/genc'), profile('genc', { birthYear: thisYear - 15, isPrivate: true })));
    await assertFails(
      updateDoc(doc(db('genc'), 'users/genc'), {
        'consents.commercialMessages': consent,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('kullanım şartları ve aydınlatma metni onayı zorunlu', async () => {
    await assertFails(
      setDoc(doc(db('ali'), 'users/ali'), profile('ali', { consents: { terms: { ...consent, granted: false }, privacyNotice: consent } })),
    );
    await assertFails(setDoc(doc(db('ali'), 'users/ali'), profile('ali', { consents: { terms: consent } })));
  });

  it('doğrulama durumları, doğum yılı ve bilinmeyen alanlar istemciden değiştirilemez', async () => {
    await assertFails(setDoc(doc(db('ali'), 'users/ali'), profile('ali', { phoneVerified: true })));
    await assertFails(setDoc(doc(db('ali'), 'users/ali'), profile('ali', { role: 'admin' })));
    await assertSucceeds(setDoc(doc(db('ali'), 'users/ali'), profile('ali')));
    await assertFails(updateDoc(doc(db('ali'), 'users/ali'), { birthYear: thisYear - 40, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('ali'), 'users/ali'), { emailVerified: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('ali'), 'users/ali'), { gender: 'erkek', updatedAt: serverTimestamp() }));
  });

  it('konum biçimi denetlenir; mahalle ayda bir kez değişir, ilk seçim serbest', async () => {
    const ref = doc(db('ali'), 'users/ali');
    await assertSucceeds(setDoc(ref, profile('ali')));
    await assertFails(updateDoc(ref, { location: { provinceCode: '16', districtId: '34-kadikoy' }, updatedAt: serverTimestamp() }));
    const first = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
    await assertSucceeds(updateDoc(ref, { location: first, locationChangedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    const second = { ...first, neighbourhoodId: '16-nilufer-beşevler' };
    await assertFails(updateDoc(ref, { location: second, locationChangedAt: serverTimestamp(), updatedAt: serverTimestamp() }));

    // 31 gün önce değiştirilmiş gibi.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users/ali'), { locationChangedAt: Timestamp.fromMillis(Date.now() - 31 * 864e5) });
    });
    await assertSucceeds(updateDoc(ref, { location: second, locationChangedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
});

describe('occupations, admins, auditLog', () => {
  const occupation = (uid: string) => ({ names: { tr: 'Öğretmen' }, order: 1, active: true, updatedBy: uid, updatedAt: serverTimestamp() });

  it('meslek listesini herkes okur, yalnızca admin yazar, kimse silemez', async () => {
    await seed('admins/eren', { addedAt: 'konsol' });
    await assertSucceeds(getDoc(doc(db(), 'occupations/ogretmen')));
    await assertFails(setDoc(doc(db('ali'), 'occupations/ogretmen'), occupation('ali')));
    await assertSucceeds(setDoc(doc(db('eren'), 'occupations/ogretmen'), occupation('eren')));
    await assertFails(deleteDoc(doc(db('eren'), 'occupations/ogretmen')));
  });

  it('acil numaraları girişsiz herkes okur, yalnızca admin geçerli kayıt yazar, kimse silemez', async () => {
    await seed('admins/eren', { addedAt: 'konsol' });
    const entry = (uid: string, over: Record<string, unknown> = {}) => ({
      number: '112', names: { tr: 'Acil', en: 'Emergency' }, icon: 'emergency', order: 1, active: true,
      updatedBy: uid, updatedAt: serverTimestamp(), ...over,
    });
    await assertSucceeds(getDoc(doc(db(), 'emergencyNumbers/112')));
    await assertFails(setDoc(doc(db('ali'), 'emergencyNumbers/112'), entry('ali')));
    await assertSucceeds(setDoc(doc(db('eren'), 'emergencyNumbers/112'), entry('eren')));
    await assertFails(setDoc(doc(db('eren'), 'emergencyNumbers/112'), entry('eren', { number: '11a2' })));
    await assertFails(setDoc(doc(db('eren'), 'emergencyNumbers/112'), entry('eren', { names: { en: 'No Turkish' } })));
    await assertFails(setDoc(doc(db('eren'), 'emergencyNumbers/112'), entry('eren', { extra: 1 })));
    await assertFails(deleteDoc(doc(db('eren'), 'emergencyNumbers/112')));
  });

  it('admin listesine istemciden yazılamaz', async () => {
    await assertFails(setDoc(doc(db('ali'), 'admins/ali'), { addedAt: 'x' }));
  });

  it('işlem kaydı yalnızca eklenir', async () => {
    await seed('admins/eren', { addedAt: 'konsol' });
    const entry = { actorUid: 'eren', module: 'meslekler', action: 'ekle', at: serverTimestamp(), summary: 'Öğretmen eklendi' };
    await assertSucceeds(setDoc(doc(db('eren'), 'auditLog/1'), entry));
    await assertFails(setDoc(doc(db('eren'), 'auditLog/2'), { ...entry, actorUid: 'baskasi' }));
    await assertFails(updateDoc(doc(db('eren'), 'auditLog/1'), { summary: 'değişti' }));
    await assertFails(deleteDoc(doc(db('eren'), 'auditLog/1')));
    await assertFails(getDoc(doc(db('ali'), 'auditLog/1')));
  });
});
