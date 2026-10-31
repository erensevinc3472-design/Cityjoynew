import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { PostInput } from '@cityjoy/shared';
import { createFirestorePostRepository, createPostModeration } from '@cityjoy/shared/firebase';
import { doc, getDoc, increment, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
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

const fs = (uid: string, email = `${uid}@ornek.com`) =>
  env.authenticatedContext(uid, { email, email_verified: true }).firestore() as unknown as Firestore;
const guest = () => env.unauthenticatedContext().firestore() as unknown as Firestore;
const repo = (uid: string) => createFirestorePostRepository(fs(uid));

const ataevler = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
const fethiye = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-fethiye' };
const moda = { provinceCode: '34', districtId: '34-kadikoy', neighbourhoodId: '34-kadikoy-moda' };
const now = Timestamp.now();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    const user = (uid: string, location: typeof ataevler) => setDoc(doc(db, 'users', uid), { uid, displayName: uid, birthYear: 1990, location });
    await user('ayse', ataevler);
    await user('ali', ataevler);
    await user('veli', fethiye);
    await user('istanbul', moda);
    await setDoc(doc(db, 'grants', 'ahmet@ornek.com__il-16'), {
      email: 'ahmet@ornek.com', displayName: 'Ahmet', role: 'il-yoneticisi', scope: { level: 'il', provinceCode: '16' },
      modules: { moderasyon: ['goruntule', 'duzenle', 'sil'] }, grantedBy: 'eren', grantedAt: now, updatedAt: now,
    });
  });
});

const input = (patch: Partial<PostInput> = {}): PostInput => ({
  text: 'Parktaki banklar yenilenmiş.',
  category: 'genel',
  targets: ['mahallem'],
  region: ataevler,
  ...patch,
});

describe('Keşfet gönderileri', () => {
  it('kendi kayıtlı mahallesiyle paylaşır; başka mahalle, başkası adına, girişsiz, boş yazı olmaz', async () => {
    await assertSucceeds(repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['mahallem', 'bolgesel', 'genel'] })));
    await assertFails(repo('ayse').create('ayse', 'Ayşe K.', input({ region: fethiye })));
    await assertFails(repo('ali').create('ayse', 'Ayşe K.', input()));
    await assertFails(createFirestorePostRepository(guest()).create('x', 'X', input()));
    await assertFails(repo('ayse').create('ayse', 'Ayşe K.', input({ text: '   ' })));
    await assertFails(repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['herkes' as never] })));
  });

  it('fotoğraf: kendi klasöründen, bu gönderinin kimliğiyle, en çok dört; yazısız olabilir; kaldırınca alan silinir', async () => {
    const r = repo('ayse');
    const photo = (uid: string, id: string, i: number) => ({
      path: `posts/${uid}/${id}/${i}.jpg`,
      url: `https://firebasestorage.googleapis.com/v0/b/cityjoy.appspot.com/o/posts%2F${uid}%2F${id}%2F${i}.jpg?alt=media&token=t`,
      width: 1600,
      height: 1200,
    });
    const ok = r.newId();
    await assertSucceeds(r.create('ayse', 'Ayşe K.', input({ text: '', photos: [photo('ayse', ok, 0), photo('ayse', ok, 1)] }), undefined, ok));
    expect((await r.get(ok))?.photos?.map((p) => p.path)).toEqual([`posts/ayse/${ok}/0.jpg`, `posts/ayse/${ok}/1.jpg`]);
    // Başkasının klasörü, başka gönderinin kimliği, sıra atlama, beşinci fotoğraf, yabancı adres olmaz.
    const id = () => r.newId();
    let x = id();
    await assertFails(r.create('ayse', 'Ayşe K.', input({ photos: [photo('ali', x, 0)] }), undefined, x));
    x = id();
    await assertFails(r.create('ayse', 'Ayşe K.', input({ photos: [photo('ayse', ok, 0)] }), undefined, x));
    x = id();
    await assertFails(r.create('ayse', 'Ayşe K.', input({ photos: [photo('ayse', x, 1)] }), undefined, x));
    x = id();
    await assertFails(r.create('ayse', 'Ayşe K.', input({ photos: [0, 1, 2, 3, 4].map((i) => photo('ayse', x, i)) }), undefined, x));
    x = id();
    await assertFails(r.create('ayse', 'Ayşe K.', input({ photos: [{ ...photo('ayse', x, 0), url: 'https://kotu.example/posts%2Fayse%2F' + x + '%2F0.jpg?a' }] }), undefined, x));
    // Sahibi kaldırınca fotoğraf alanı da boşalır.
    await assertSucceeds(r.remove(ok));
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect('photos' in ((await getDoc(doc(ctx.firestore(), 'posts', ok))).data() ?? {})).toBe(false);
    });
  });

  it('görünürlük: Mahallem yalnızca o mahallede, Bölgesel yalnızca o ilde, Genel herkese (sorgular da)', async () => {
    const m = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['mahallem'] }));
    const b = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['bolgesel'] }));
    const g = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['genel'] }));
    const read = (uid: string, id: string) => getDoc(doc(fs(uid), 'posts', id));
    await assertSucceeds(read('ali', m));
    await assertFails(read('veli', m));
    await assertSucceeds(read('veli', b));
    await assertFails(read('istanbul', b));
    await assertSucceeds(read('istanbul', g));
    await assertFails(getDoc(doc(guest(), 'posts', g)));

    expect((await repo('ali').feed({ target: 'mahallem', neighbourhoodId: ataevler.neighbourhoodId })).posts.map((p) => p.id)).toEqual([m]);
    await assertFails(repo('veli').feed({ target: 'mahallem', neighbourhoodId: ataevler.neighbourhoodId }));
    expect((await repo('veli').feed({ target: 'bolgesel', provinceCode: '16' })).posts.map((p) => p.id)).toEqual([b]);
    expect((await repo('veli').feed({ target: 'bolgesel', provinceCode: '16', districtId: '16-nilufer' })).posts.map((p) => p.id)).toEqual([b]);
    await assertFails(repo('istanbul').feed({ target: 'bolgesel', provinceCode: '16' }));
    expect((await repo('istanbul').feed({ target: 'genel' })).posts.map((p) => p.id)).toEqual([g]);
  });

  it('beğeni: sayaç kayıtla birlikte tam bir değişir, kişi başına bir; beğenilenler tek sorguyla gelir', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['mahallem'] }));
    await assertSucceeds(repo('ali').like(id, 'ali'));
    await assertFails(repo('ali').like(id, 'ali'));
    await assertFails(repo('veli').like(id, 'veli'));
    await assertFails(updateDoc(doc(fs('ali'), 'posts', id), { likeCount: increment(1) }));
    expect([...(await repo('ali').likedIds('ali'))]).toEqual([id]);
    await assertSucceeds(repo('ali').unlike(id, 'ali'));
    expect((await repo('ayse').get(id))?.likeCount).toBe(0);
  });

  it('sahibi kaldırır (yazı boşalır), başkası kaldıramaz ya da düzenleyemez', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['genel'] }));
    await assertFails(repo('ali').remove(id));
    await assertFails(updateDoc(doc(fs('ayse'), 'posts', id), { text: 'Başka', updatedAt: Timestamp.now() }));
    await assertSucceeds(repo('ayse').remove(id));
    expect(await repo('ayse').get(id)).toMatchObject({ status: 'kaldirildi', text: '', authorName: '' });
    await assertFails(getDoc(doc(fs('ali'), 'posts', id)));
  });

  it('şikâyet: kişi başına bir, kendi gönderisine olmaz; il yöneticisi görür ve kaldırır', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['bolgesel'] }));
    const p = (await repo('ali').get(id))!;
    await assertSucceeds(repo('ali').report(p, 'ali', 'spam'));
    await assertFails(repo('ali').report(p, 'ali', 'spam'));
    await assertFails(repo('ayse').report(p, 'ayse', 'diger'));
    await assertFails(updateDoc(doc(fs('veli'), 'posts', id), { reportCount: increment(5) }));
    expect(await repo('ali').hasReported(id, 'ali')).toBe(true);

    await assertFails(createPostModeration(fs('veli'), 'veli').listReports({ provinceCode: '16' }));
    await assertFails(createPostModeration(fs('ahmet'), 'ahmet').listReports({ provinceCode: '34' }));
    const mod = createPostModeration(fs('ahmet'), 'ahmet');
    const list = await mod.listReports({ provinceCode: '16' });
    expect(list).toHaveLength(1);
    await assertSucceeds(mod.remove(list[0]!));
    expect((await repo('ayse').get(id))?.status).toBe('kaldirildi');
    await assertFails(getDoc(doc(fs('veli'), 'posts', id)));
  });

  it('yorum: görebilen yazar, sayaç birlikte değişir; sahibi kapatır; yazan ve sahibi siler', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['mahallem'] }));
    const c = await repo('ali').addComment(id, 'ali', 'Ali', 'Çok güzel olmuş!');
    expect((await repo('ali').comments(id)).map((x) => x.text)).toEqual(['Çok güzel olmuş!']);
    expect((await repo('ayse').get(id))?.commentCount).toBe(1);
    // Başka mahalledeki göremez, yazamaz; sayacı tek başına artırmak olmaz.
    await assertFails(repo('veli').comments(id));
    await assertFails(repo('veli').addComment(id, 'veli', 'Veli', 'Merhaba'));
    await assertFails(updateDoc(doc(fs('ali'), 'posts', id), { commentCount: increment(1), lastComment: c.id }));
    // Başkası silemez; gönderi sahibi siler.
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'users', 'can'), { uid: 'can', birthYear: 1990, location: ataevler }));
    await assertFails(repo('can').deleteComment(id, c.id));
    await assertSucceeds(repo('ayse').deleteComment(id, c.id));
    expect((await repo('ayse').get(id))?.commentCount).toBe(0);
    // Yorumlar kapalıyken yazılamaz; yalnızca sahibi kapatır.
    await assertFails(repo('ali').setCommentsOff(id, true));
    await assertSucceeds(repo('ayse').setCommentsOff(id, true));
    await assertFails(repo('ali').addComment(id, 'ali', 'Ali', 'Bir daha'));
  });

  it('yorum şikâyeti: kişi başına bir; il yöneticisi görür, yorumu siler', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['bolgesel'] }));
    const p = (await repo('veli').get(id))!;
    const c = await repo('ali').addComment(id, 'ali', 'Ali', 'Kaba bir yorum');
    await assertFails(repo('ali').reportComment(p, c, 'ali', 'taciz'));
    await assertSucceeds(repo('veli').reportComment(p, c, 'veli', 'taciz'));
    await assertFails(repo('veli').reportComment(p, c, 'veli', 'taciz'));
    await assertFails(createPostModeration(fs('veli'), 'veli').listCommentReports({ provinceCode: '16' }));
    const mod = createPostModeration(fs('ahmet'), 'ahmet');
    const list = await mod.listCommentReports({ provinceCode: '16' });
    expect(list).toHaveLength(1);
    expect(list[0]!.text).toBe('Kaba bir yorum');
    await assertSucceeds(mod.removeComment(list[0]!));
    expect(await repo('ayse').comments(id)).toEqual([]);
    expect((await repo('ayse').get(id))?.commentCount).toBe(0);
  });

  it('kaydetme yalnızca kişinin kendisine', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['genel'] }));
    await assertSucceeds(repo('ali').save('ali', id));
    expect(await repo('ali').isSaved('ali', id)).toBe(true);
    expect((await repo('ali').listSaved('ali')).map((p) => p.id)).toEqual([id]);
    expect([...(await repo('ali').savedIds('ali'))]).toEqual([id]);
    await assertFails(repo('veli').savedIds('ali'));
    await assertFails(getDoc(doc(fs('veli'), 'users', 'ali', 'savedPosts', id)));
    await assertFails(repo('veli').save('ali', id));
    await assertSucceeds(repo('ali').unsave('ali', id));
    expect(await repo('ali').listSaved('ali')).toEqual([]);
  });

  it('hesap silme: gönderiler boşaltılır, beğeniler geri alınır', async () => {
    const mine = await repo('ali').create('ali', 'Ali', input({ targets: ['genel'] }));
    const other = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['genel'] }));
    await repo('ali').like(other, 'ali');
    await repo('ali').addComment(other, 'ali', 'Ali', 'Yorumum');
    await repo('ali').save('ali', other);
    await assertSucceeds(repo('ali').deleteAllOf('ali'));
    expect(await repo('ali').get(mine)).toMatchObject({ status: 'kaldirildi', text: '' });
    expect(await repo('ayse').get(other)).toMatchObject({ likeCount: 0, commentCount: 0 });
    expect(await repo('ali').listSaved('ali')).toEqual([]);
  });
});
