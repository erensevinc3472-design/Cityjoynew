import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { PostInput } from '@cityjoy/shared';
import { createFirestoreBusinessRepository, createFirestorePostRepository, createFirestoreSocialRepository, createIntroVideo, createSearchSuggestions } from '@cityjoy/shared/firebase';
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
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

const fs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }).firestore() as unknown as Firestore;
const social = (uid: string) => createFirestoreSocialRepository(fs(uid));
const posts = (uid: string) => createFirestorePostRepository(fs(uid));

const ataevler = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
const moda = { provinceCode: '34', districtId: '34-kadikoy', neighbourhoodId: '34-kadikoy-moda' };
const post = (text: string, targets: PostInput['targets'], region = ataevler): PostInput => ({ text, category: 'genel', targets, region });
const business = (name: string, provinceCode = '16', districtId = '16-nilufer', phone = '05321234567') => ({
  type: 'hizmet' as const,
  name,
  categoryIds: ['berber'],
  location: { provinceCode, districtId },
  phone,
  whatsapp: true,
  is24h: false,
  priceList: [],
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    for (const [uid, location] of [['ayse', ataevler], ['ali', moda], ['veli', ataevler]] as const) {
      await setDoc(doc(db, 'users', uid), { uid, displayName: uid, birthYear: 1990, location });
    }
    // Ara'dan önce açılmış profil: anahtarı yok.
    await setDoc(doc(db, 'publicProfiles', 'eski'), { displayName: 'Şükrü B.', bio: '', isPrivate: true, updatedAt: new Date() });
  });
});

describe('Ara', () => {
  it('kişiler adla bulunur (gizli hesap dahil, tanıtım aranmaz); eski profillere anahtar eklenir', async () => {
    await social('ayse').ensureProfile('ayse', 'Ayşe K.', false);
    await social('ayse').updateProfile('ayse', { displayName: 'Ayşe K.', bio: 'Kitap kurdu', isPrivate: false });
    expect((await social('ali').searchPeople('ays')).map((p) => p.uid)).toEqual(['ayse']);
    expect(await social('ali').searchPeople('kitap')).toEqual([]);
    expect(await social('ali').searchPeople('sukru')).toEqual([]);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'eski'), { uid: 'eski', displayName: 'Şükrü', birthYear: 1990, location: ataevler });
    });
    await social('eski').ensureProfile('eski', 'Şükrü B.', true);
    expect((await social('ali').searchPeople('sukru')).map((p) => p.uid)).toEqual(['eski']);
    // Anahtar sayısı sınırlı; giriş yapmayan arayamaz.
    await assertFails(updateDoc(doc(fs('ayse'), 'publicProfiles', 'ayse'), { searchKeys: Array.from({ length: 41 }, (_, i) => `k${i}`), updatedAt: serverTimestamp() }));
    await assertFails(getDocs(query(collection(env.unauthenticatedContext().firestore() as unknown as Firestore, 'publicProfiles'), where('searchKeys', 'array-contains', 'ays'), limit(5))));
  });

  it('gönderiler: yalnızca görebildiğin akışlardan; silinen gönderinin anahtarları da silinir', async () => {
    const genel = await posts('ali').create('ali', 'Ali Y.', post('Kadıköy berberleri hakkında soru', ['genel'], moda));
    const bursa = await posts('veli').create('veli', 'Veli', post('Nilüfer berber önerisi?', ['bolgesel']));
    const mahalle = await posts('veli').create('veli', 'Veli', post('Ataevler berber kapalı mı', ['mahallem']));
    const istanbul = await posts('ali').create('ali', 'Ali Y.', post('Moda berber çok iyi', ['bolgesel'], moda));
    const found = await posts('ayse').search('berb', { provinceCode: '16', neighbourhoodId: ataevler.neighbourhoodId });
    expect(found.map((p) => p.id).sort()).toEqual([genel, bursa, mahalle].sort());
    expect(found.map((p) => p.id)).not.toContain(istanbul);
    // Başka ilin Bölgesel gönderisi istenirse sorgu reddedilir.
    await assertFails(posts('ayse').search('berb', { provinceCode: '34' }));
    await posts('veli').remove(bursa);
    expect((await env.withSecurityRulesDisabled(async (ctx) => (await getDoc(doc(ctx.firestore(), 'posts', bursa))).get('searchKeys'))) ?? null).toBeNull();
    expect((await posts('ayse').search('berb', { provinceCode: '16' })).map((p) => p.id)).not.toContain(bursa);
    // Kısa kelimeler (3 harften az) gönderi anahtarı olmaz.
    expect(await posts('ayse').search('ka', {})).toEqual([]);
  });

  it('işletmeler: ildeki yayındakiler adla bulunur, gizlenen bulunmaz', async () => {
    const repo = createFirestoreBusinessRepository(fs('ali'));
    const id = await repo.create('ali', business('Şükrü Berber'));
    await createFirestoreBusinessRepository(fs('veli')).create('veli', business('Moda Berber', '34', '34-kadikoy', '02161112233'));
    const ayse = createFirestoreBusinessRepository(fs('ayse'));
    expect((await ayse.searchByName('16', 'berb')).map((b) => b.id)).toEqual([id]);
    expect((await ayse.searchByName('16', 'sukru')).map((b) => b.id)).toEqual([id]);
    await repo.update(id, business('Ali Kuaför'));
    expect(await ayse.searchByName('16', 'sukru')).toEqual([]);
    expect((await ayse.searchByName('16', 'kuaf')).map((b) => b.id)).toEqual([id]);
    await repo.setHidden(id, true);
    expect(await ayse.searchByName('16', 'kuaf')).toEqual([]);
  });

  it('önerilen aramalar: herkes okur, yalnızca admin yazar ve kayda geçer', async () => {
    await assertFails(createSearchSuggestions(fs('ali')).save('ali', { tr: ['Berber'] }));
    const saved = await createSearchSuggestions(fs('eren')).save('eren', { tr: ['Nöbetçi eczane', 'nobetci eczane', 'Berber'], en: ['Pharmacy'] });
    expect(saved.tr).toEqual(['Nöbetçi eczane', 'Berber']);
    expect((await createSearchSuggestions(fs('ayse')).get()).en).toEqual(['Pharmacy']);
    await assertSucceeds(getDocs(query(collection(fs('eren'), 'auditLog'), where('targetId', '==', 'searchSuggestions'))));
    await assertFails(
      setDoc(doc(fs('eren'), 'config', 'searchSuggestions'), { terms: { tr: Array.from({ length: 13 }, (_, i) => `x${i}`) }, updatedBy: 'eren', updatedAt: serverTimestamp() }),
    );
  });

  it('tanıtım videosu: herkes okur, yalnızca admin yazar, yalnızca https, kayda geçer', async () => {
    await assertFails(createIntroVideo(fs('ali')).save('ali', 'https://www.youtube.com/watch?v=abc'));
    expect(await createIntroVideo(fs('eren')).save('eren', ' https://www.youtube.com/watch?v=abc ')).toBe('https://www.youtube.com/watch?v=abc');
    expect(await createIntroVideo(fs('ayse')).get()).toBe('https://www.youtube.com/watch?v=abc');
    await assertSucceeds(getDocs(query(collection(fs('eren'), 'auditLog'), where('targetId', '==', 'introVideo'))));
    await assertFails(setDoc(doc(fs('eren'), 'config', 'introVideo'), { url: 'javascript:alert(1)', updatedBy: 'eren', updatedAt: serverTimestamp() }));
    expect(await createIntroVideo(fs('eren')).save('eren', 'http://ornek.com/video')).toBe('');
  });
});
