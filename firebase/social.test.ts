import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { PostInput } from '@cityjoy/shared';
import { createBannedWords, createFirestorePostRepository, createFirestoreSocialRepository, createProfileModeration } from '@cityjoy/shared/firebase';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
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
const input = (patch: Partial<PostInput> = {}): PostInput => ({ text: 'Sadece takipçilerime', category: 'genel', targets: ['takip'], region: ataevler, ...patch });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    for (const [uid, location] of [['ayse', ataevler], ['ali', moda], ['veli', moda], ['genc', ataevler]] as const) {
      await setDoc(doc(db, 'users', uid), { uid, displayName: uid, birthYear: 1990, location });
    }
  });
  await social('ayse').ensureProfile('ayse', 'Ayşe K.', false);
  await social('ali').ensureProfile('ali', 'Ali Y.', false);
  await social('genc').ensureProfile('genc', 'Genç', true);
});

describe('Keşfet profili ve takip', () => {
  it('profil: herkes okur, yalnızca sahibi yazar; başkasının adına profil açılamaz', async () => {
    expect((await social('ali').getProfile('ayse'))?.displayName).toBe('Ayşe K.');
    await assertSucceeds(social('ayse').updateProfile('ayse', { displayName: 'Ayşe K.', bio: 'Ataevler', isPrivate: false }));
    await assertFails(social('ali').updateProfile('ayse', { displayName: 'X', bio: '', isPrivate: false }));
    await assertFails(social('ali').ensureProfile('veli', 'Veli', false));
    await assertFails(updateDoc(doc(fs('ayse'), 'publicProfiles', 'ayse'), { bio: 'a'.repeat(161), updatedAt: serverTimestamp() }));
  });

  it('açık hesap doğrudan takip edilir; Takip gönderisini yalnızca takipçi görür (akış sorgusu dahil)', async () => {
    const id = await posts('ayse').create('ayse', 'Ayşe K.', input());
    await assertFails(getDoc(doc(fs('ali'), 'posts', id)));
    expect(await social('ali').follow('ali', 'ayse', false)).toBe('aktif');
    await assertSucceeds(getDoc(doc(fs('ali'), 'posts', id)));
    const feed = await posts('ali').feed({ target: 'takip', authorUids: ['ayse'] });
    expect(feed.posts.map((p) => p.id)).toEqual([id]);
    expect(await social('veli').counts('ayse')).toEqual({ followers: 1, following: 0 });
    // Takip etmeyenin akış sorgusu boş döner (reddedilen sorgu atlanır).
    expect((await posts('veli').feed({ target: 'takip', authorUids: ['ayse'] })).posts).toEqual([]);
    // Başkası adına ya da gizliliği atlayarak takip edilemez.
    await assertFails(social('veli').follow('ali', 'ayse', false));
    await assertFails(social('veli').follow('veli', 'genc', false));
  });

  it('gizli hesap: istek, yalnızca sahibi kabul eder; reddedince biter', async () => {
    expect(await social('ali').follow('ali', 'genc', true)).toBe('istek');
    expect(await social('genc').requests('genc')).toEqual([{ uid: 'ali', displayName: 'Ali Y.' }]);
    await assertFails(social('ali').accept('genc', 'ali'));
    await assertFails(social('veli').requests('genc'));
    await assertSucceeds(social('genc').accept('genc', 'ali'));
    expect(await social('ali').followState('ali', 'genc')).toBe('aktif');
    await assertSucceeds(social('genc').removeFollower('genc', 'ali'));
    expect(await social('ali').followState('ali', 'genc')).toBeNull();
  });

  it('engelleme: takipler biter, engellenen takip edemez ve yorum yazamaz', async () => {
    await social('ali').follow('ali', 'ayse', false);
    const id = await posts('ayse').create('ayse', 'Ayşe K.', input({ targets: ['genel'] }));
    await assertSucceeds(social('ayse').block('ayse', 'ali'));
    expect(await social('ali').followState('ali', 'ayse')).toBeNull();
    expect(await social('ali').isBlockedBy('ali', 'ayse')).toBe(true);
    await assertFails(social('ali').follow('ali', 'ayse', false));
    await assertFails(posts('ali').addComment(id, 'ali', 'Ali Y.', 'Merhaba'));
    await assertSucceeds(posts('veli').addComment(id, 'veli', 'Veli', 'Merhaba'));
    expect([...(await social('ayse').myBlocks('ayse'))]).toEqual(['ali']);
    await assertFails(social('veli').unblock('ayse', 'ali'));
    await assertSucceeds(social('ayse').unblock('ayse', 'ali'));
    await assertSucceeds(social('ali').follow('ali', 'ayse', false));
  });

  it('profil şikâyeti yalnızca admin görür; tanıtımı kaldırır, kişi yeniden yazamaz', async () => {
    await social('ayse').updateProfile('ayse', { displayName: 'Ayşe K.', bio: 'Kaba bir tanıtım', isPrivate: false });
    const p = (await social('ali').getProfile('ayse'))!;
    await assertSucceeds(social('ali').reportProfile(p, 'ali', 'taciz'));
    await assertFails(social('ali').reportProfile(p, 'ali', 'taciz'));
    await assertFails(social('ayse').reportProfile(p, 'ayse', 'diger'));
    await assertFails(createProfileModeration(fs('ali'), 'ali').listReports());
    const mod = createProfileModeration(fs('eren'), 'eren');
    const [r] = await mod.listReports();
    expect(r!.bio).toBe('Kaba bir tanıtım');
    await assertSucceeds(mod.removeBio(r!));
    expect(await social('ali').getProfile('ayse')).toMatchObject({ bio: '', bioRemoved: true });
    await assertFails(social('ayse').updateProfile('ayse', { displayName: 'Ayşe K.', bio: 'Yine', isPrivate: false }));
    await assertFails(updateDoc(doc(fs('ayse'), 'publicProfiles', 'ayse'), { bioRemoved: false }));
  });

  it('profil fotoğrafı: yalnızca kendi yüklediği; admin şikâyet üzerine kaldırır, kişi yenisini koyamaz', async () => {
    const photo = (uid: string, kind = 'profil') => {
      const p = `media/${uid}/${kind}/abcDEF123456.jpg`;
      return { path: p, url: `http://127.0.0.1:9199/v0/b/demo-cityjoy.appspot.com/o/${p.replaceAll('/', '%2F')}?alt=media&token=t`, width: 600, height: 600 };
    };
    await assertFails(social('ayse').setPhoto('ayse', photo('ali')));
    await assertFails(social('ayse').setPhoto('ayse', photo('ayse', 'kurum')));
    await assertFails(social('ali').setPhoto('ayse', photo('ali')));
    await assertSucceeds(social('ayse').setPhoto('ayse', photo('ayse')));
    expect((await social('ali').getProfile('ayse'))!.photo?.path).toBe('media/ayse/profil/abcDEF123456.jpg');
    // Ad değişince fotoğraf kalır.
    await assertSucceeds(social('ayse').updateProfile('ayse', { displayName: 'Ayşe Kaya', bio: '', isPrivate: false }));
    const p = (await social('ali').getProfile('ayse'))!;
    expect(p.photo).toBeDefined();
    await social('ali').reportProfile(p, 'ali', 'uygunsuz');
    await assertFails(updateDoc(doc(fs('ali'), 'publicProfiles', 'ayse'), { photoRemoved: true }));
    const mod = createProfileModeration(fs('eren'), 'eren');
    const [r] = await mod.listReports();
    expect(r!.current?.photo).toBeDefined();
    await assertSucceeds(mod.removePhoto(r!));
    expect(await social('ali').getProfile('ayse')).toMatchObject({ photoRemoved: true });
    expect((await social('ali').getProfile('ayse'))!.photo).toBeUndefined();
    await assertFails(social('ayse').setPhoto('ayse', photo('ayse')));
    await assertFails(updateDoc(doc(fs('ayse'), 'publicProfiles', 'ayse'), { photoRemoved: false }));
  });

  it('yasaklı kelime listesi: herkes okur, yalnızca admin yazar (işlem kaydıyla)', async () => {
    await assertFails(createBannedWords(fs('ali')).save('ali', ['salak']));
    expect(await createBannedWords(fs('eren')).save('eren', [' Salak ', 'salak', 'aptal'])).toEqual(['salak', 'aptal']);
    expect(await createBannedWords(fs('ali')).get()).toEqual(['salak', 'aptal']);
  });

  it('hesap silme: takipler, engeller ve profil silinir', async () => {
    await social('ali').follow('ali', 'ayse', false);
    await social('ayse').follow('ayse', 'ali', false);
    await social('ali').block('ali', 'genc');
    await assertSucceeds(social('ali').deleteAllOf('ali'));
    expect(await social('ayse').getProfile('ali')).toBeNull();
    expect(await social('ayse').counts('ayse')).toEqual({ followers: 0, following: 0 });
  });
});
