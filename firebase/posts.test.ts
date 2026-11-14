import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { PostInput } from '@cityjoy/shared';
import { countUsage, takeFirestoreUsage, createFirestorePostRepository, createFirestoreSocialRepository, createFramesAdmin, createPostModeration } from '@cityjoy/shared/firebase';
import { deleteField, doc, getDoc, increment, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
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
  it('Kareler: yalnızca fotoğraflı ve Genel gönderi; ildeki herkes listeler; admin öne çıkarır ve kaldırır, geri açamaz', async () => {
    const r = repo('ayse');
    const photo = (id: string) => ({
      path: `posts/ayse/${id}/0.jpg`,
      url: `https://firebasestorage.googleapis.com/v0/b/cityjoy.appspot.com/o/posts%2Fayse%2F${id}%2F0.jpg?alt=media&token=t`,
      width: 1600,
      height: 1200,
    });
    const id = r.newId();
    await assertSucceeds(r.create('ayse', 'Ayşe K.', input({ text: '', targets: ['genel'], photos: [photo(id)], frames: true }), undefined, id));
    // Fotoğrafsız ya da Genel'e açık olmayan gönderi Karelere giremez (doğrudan yazımda kurallar reddeder).
    const plain = r.newId();
    await assertFails(setDoc(doc(fs('ayse'), 'posts', plain), {
      text: 'Yazı', category: 'genel', targets: { mahallem: false, bolgesel: false, genel: true }, region: ataevler, status: 'aktif', authorUid: 'ayse',
      authorName: 'Ayşe K.', likeCount: 0, commentCount: 0, reportCount: 0, frames: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    const local = r.newId();
    await r.create('ayse', 'Ayşe K.', input({ text: '', targets: ['mahallem'], photos: [photo(local)], frames: true }), undefined, local);
    expect((await r.get(local))?.frames).toBeUndefined();
    // Başka ildeki kişi de listeler (Genel).
    const page = await repo('istanbul').frames('16');
    expect(page.posts.map((p) => p.id)).toEqual([id]);
    expect(page.featured).toEqual([]);
    // Yalnızca admin öne çıkarır; kaldırınca listeden çıkar, admin geri açamaz, paylaşan da öne çıkaramaz.
    const post = (await r.get(id))!;
    await assertFails(createFramesAdmin(fs('ali'), 'ali').setFeatured(post, true));
    await assertFails(updateDoc(doc(fs('ayse'), 'posts', id), { framesFeatured: true, updatedAt: serverTimestamp() }));
    const admin = createFramesAdmin(fs('eren'), 'eren');
    await assertSucceeds(admin.setFeatured(post, true));
    expect((await repo('istanbul').frames('16')).featured.map((p) => p.id)).toEqual([id]);
    await assertSucceeds(admin.remove(post));
    expect((await repo('istanbul').frames('16')).posts).toEqual([]);
    await assertFails(updateDoc(doc(fs('eren'), 'posts', id), { frames: true, updatedAt: serverTimestamp() }));
  });

  it('kendi kayıtlı mahallesiyle paylaşır; başka mahalle, başkası adına, girişsiz, boş yazı olmaz', async () => {
    await assertSucceeds(repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['mahallem', 'bolgesel', 'genel'] })));
    await assertFails(repo('ayse').create('ayse', 'Ayşe K.', input({ region: fethiye })));
    await assertFails(repo('ali').create('ayse', 'Ayşe K.', input()));
    await assertFails(createFirestorePostRepository(guest()).create('x', 'X', input()));
    await assertFails(repo('ayse').create('ayse', 'Ayşe K.', input({ text: '   ' })));
    await assertFails(repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['herkes' as never] })));
  });

  it('fotoğraf: kendi klasöründen, bu gönderinin kimliğiyle, en çok on; yazısız olabilir; kaldırınca alan silinir', async () => {
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
    // Başkasının klasörü, başka gönderinin kimliği, sıra atlama, on birinci fotoğraf olmaz.
    const id = () => r.newId();
    let x = id();
    await assertFails(r.create('ayse', 'Ayşe K.', input({ photos: [photo('ali', x, 0)] }), undefined, x));
    x = id();
    await assertFails(r.create('ayse', 'Ayşe K.', input({ photos: [photo('ayse', ok, 0)] }), undefined, x));
    x = id();
    await assertFails(r.create('ayse', 'Ayşe K.', input({ photos: [photo('ayse', x, 1)] }), undefined, x));
    x = id();
    await assertFails(setDoc(doc(fs('ayse'), 'posts', x), {
      text: '', category: 'genel', targets: { mahallem: true, bolgesel: false, genel: false }, region: ataevler, status: 'aktif', authorUid: 'ayse',
      authorName: 'Ayşe K.', likeCount: 0, commentCount: 0, reportCount: 0, photos: Array.from({ length: 11 }, (_, i) => photo('ayse', x, i)),
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    // Albüm: on fotoğraf olur.
    x = id();
    await assertSucceeds(r.create('ayse', 'Ayşe K.', input({ text: '', photos: Array.from({ length: 10 }, (_, i) => photo('ayse', x, i)) }), undefined, x));
    expect((await r.get(x))?.photos).toHaveLength(10);
    // Yabancı adresli fotoğraf uygulamada gösterilmez (adresi uygulama denetler).
    x = id();
    await r.create('ayse', 'Ayşe K.', input({ photos: [{ ...photo('ayse', x, 0), url: 'https://kotu.example/posts%2Fayse%2F' + x + '%2F0.jpg?a' }] }), undefined, x);
    expect((await r.get(x))?.photos).toBeUndefined();
    // Sahibi kaldırınca fotoğraf alanı da boşalır.
    await assertSucceeds(r.remove(ok));
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect('photos' in ((await getDoc(doc(ctx.firestore(), 'posts', ok))).data() ?? {})).toBe(false);
    });
  });

  it('video: tek video, en çok 60 sn, bu gönderinin klasöründe; fotoğrafla birlikte olmaz; kaldırınca alan silinir', async () => {
    const r = repo('ayse');
    const video = (id: string, patch: Record<string, unknown> = {}) => ({
      path: `posts/ayse/${id}/video.mp4`,
      url: `https://firebasestorage.googleapis.com/v0/b/cityjoy.appspot.com/o/posts%2Fayse%2F${id}%2Fvideo.mp4?alt=media&token=t`,
      width: 720,
      height: 1280,
      durationSec: 42,
      ...patch,
    });
    const ok = r.newId();
    await assertSucceeds(r.create('ayse', 'Ayşe K.', input({ text: '', video: video(ok) }), undefined, ok));
    expect((await r.get(ok))?.video?.durationSec).toBe(42);
    const raw = (id: string, extra: Record<string, unknown>) =>
      setDoc(doc(fs('ayse'), 'posts', id), {
        text: '', category: 'genel', targets: { mahallem: true, bolgesel: false, genel: false }, region: ataevler, status: 'aktif', authorUid: 'ayse',
        authorName: 'Ayşe K.', likeCount: 0, commentCount: 0, reportCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
      });
    let x = r.newId();
    await assertFails(raw(x, { video: video(x, { durationSec: 61 }) }));
    x = r.newId();
    await assertFails(raw(x, { video: video(ok) }));
    x = r.newId();
    await assertFails(raw(x, { video: { ...video(x), path: `posts/ayse/${x}/video.avi` } }));
    x = r.newId();
    const photo = { path: `posts/ayse/${x}/0.jpg`, url: `https://firebasestorage.googleapis.com/v0/b/cityjoy.appspot.com/o/posts%2Fayse%2F${x}%2F0.jpg?alt=media&token=t`, width: 10, height: 10 };
    await assertFails(raw(x, { video: video(x), photos: [photo] }));
    // Paylaşım düzenleyicisi: kapak karesi ve düzenlemeler (en çok 10) yazılır; uygulama kapağı yalnızca aynı klasördeyse gösterir.
    const ed = r.newId();
    const poster = `https://firebasestorage.googleapis.com/v0/b/cityjoy.appspot.com/o/posts%2Fayse%2F${ed}%2Fcover.jpg?alt=media&token=t`;
    await assertSucceeds(r.create('ayse', 'Ayşe K.', input({ text: '', video: { ...video(ed), poster }, edits: [{ items: [{ kind: 'yazi', x: 0.5, y: 0.4, scale: 1, rotation: 0, text: 'Akşam', font: 'modern', color: '#FFFFFF', bg: 'yok', bgColor: '#111111', align: 'center', size: 0.08 }], muted: true, trimStart: 2, trimEnd: 20 }] }), undefined, ed));
    const got = await r.get(ed);
    expect(got?.video?.poster).toBe(poster);
    expect(got?.edits?.[0]).toMatchObject({ muted: true, trimStart: 2, trimEnd: 20 });
    x = r.newId();
    await assertFails(raw(x, { video: { ...video(x), poster: 5 } }));
    x = r.newId();
    await assertFails(raw(x, { video: video(x), edits: Array.from({ length: 11 }, () => null) }));
    x = r.newId();
    await assertFails(raw(x, { video: video(x), edits: 'x' }));
    await assertSucceeds(r.remove(ed));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = (await getDoc(doc(ctx.firestore(), 'posts', ed))).data() ?? {};
      expect('edits' in d || 'video' in d).toBe(false);
    });
    await assertSucceeds(r.remove(ok));
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect('video' in ((await getDoc(doc(ctx.firestore(), 'posts', ok))).data() ?? {})).toBe(false);
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

  it('kaydedilenler klasörleri: yalnızca kişinin kendisi, silinince gönderiler kalır', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['genel'] }));
    const f = await repo('ali').createFolder('ali', '  Gidilecek yerler  ');
    expect(f.name).toBe('Gidilecek yerler');
    await assertFails(repo('veli').createFolder('ali', 'Benim'));
    await assertFails(repo('veli').listFolders('ali'));
    await assertSucceeds(repo('ali').save('ali', id, f.id));
    expect(await repo('ali').savedFolder('ali', id)).toBe(f.id);
    expect((await repo('ali').listSavedEntries('ali')).map((e) => e.folder)).toEqual([f.id]);
    await assertSucceeds(repo('ali').setSavedFolder('ali', id, null));
    expect(await repo('ali').savedFolder('ali', id)).toBeNull();
    await assertSucceeds(repo('ali').setSavedFolder('ali', id, f.id));
    await assertFails(repo('veli').setSavedFolder('ali', id, null));
    // Kayıt tarihi ya da başka alan değiştirilemez; çok uzun ad olmaz.
    await assertFails(updateDoc(doc(fs('ali'), 'users', 'ali', 'savedPosts', id), { createdAt: Timestamp.fromDate(new Date('2020-01-01')) }));
    await assertFails(updateDoc(doc(fs('ali'), 'users', 'ali', 'savedPosts', id), { note: 'x' }));
    await assertFails(setDoc(doc(fs('ali'), 'users', 'ali', 'saveFolders', 'uzun'), { name: 'x'.repeat(41), createdAt: Timestamp.now() }));
    await assertSucceeds(repo('ali').renameFolder('ali', f.id, 'Hafta sonu'));
    expect((await repo('ali').listFolders('ali')).map((x) => x.name)).toEqual(['Hafta sonu']);
    await assertSucceeds(repo('ali').deleteFolder('ali', f.id));
    expect(await repo('ali').listFolders('ali')).toEqual([]);
    expect(await repo('ali').savedFolder('ali', id)).toBeNull();
    expect(await repo('ali').isSaved('ali', id)).toBe(true);
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

  it('etiket, sabitleme, izlenme: istemci etiketi yalnızca istek olarak yazar, sabitlemeyi sahibi yapar, etiketlenen kendini çıkarır', async () => {
    const r = repo('ayse');
    // İstek: en çok 20 kişi, kendisi olmaz; etiket, sabit ve izlenme alanlarını istemci yazamaz.
    const id = await r.create('ayse', 'Ayşe K.', input({ targets: ['genel'], tagRequest: ['ali', 'veli'] }));
    expect((await getDoc(doc(fs('ayse'), 'posts', id))).get('tagReq')).toEqual(['ali', 'veli']);
    // Uygulamanın yazdığı gibi (kullanım sayacıyla birlikte) doğrudan yazım.
    const raw = async (extra: Record<string, unknown>) => {
      const db = fs('ayse');
      const b = writeBatch(db);
      await countUsage(db, b, { type: 'u', id: 'ayse' }, 'gonderi', 'ayse');
      b.set(doc(db, 'posts', r.newId()), {
        text: 'Yazı', category: 'genel', targets: { mahallem: false, bolgesel: false, genel: true }, region: ataevler, status: 'aktif', authorUid: 'ayse',
        authorName: 'Ayşe K.', likeCount: 0, commentCount: 0, reportCount: 0, searchKeys: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
      });
      return b.commit();
    };
    await assertSucceeds(raw({ tagReq: ['ali'] }));
    await assertFails(raw({ tagReq: ['ayse'] }));
    await assertFails(raw({ tagReq: Array.from({ length: 21 }, (_, i) => `u${i}`) }));
    await assertFails(raw({ tags: ['ali'] }));
    await assertFails(raw({ pinned: true }));
    await assertFails(raw({ viewCount: 5 }));
    await assertFails(raw({ hasVideo: true }));

    // Sahibi sabitler ve kaldırır; başkası sabitleyemez; sabitlerken başka alan değişmez.
    await assertFails(repo('ali').setPinned(id, true));
    await assertSucceeds(r.setPinned(id, true));
    expect(await r.myPinnedCount('ayse')).toBe(1);
    expect((await repo('ali').pinnedByAuthor('ayse', false)).map((p) => p.id)).toEqual([id]);
    await assertFails(updateDoc(doc(fs('ayse'), 'posts', id), { pinned: true, viewCount: 99, updatedAt: serverTimestamp() }));
    await assertSucceeds(r.setPinned(id, false));
    expect(await r.myPinnedCount('ayse')).toBe(0);

    // Sunucunun yazdığı etiket: etiketlenen yalnızca kendini çıkarır, başkasını çıkaramaz; yabancı hiç dokunamaz.
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'posts', id), { tags: ['ali', 'veli'], tagNames: { ali: 'Ali', veli: 'Veli' }, tagReq: deleteField() }));
    expect((await repo('veli').taggedIn('ali')).map((p) => p.id)).toEqual([id]);
    await assertFails(updateDoc(doc(fs('ali'), 'posts', id), { tags: ['ali'], ['tagNames.veli']: deleteField() }));
    await assertFails(updateDoc(doc(fs('istanbul'), 'posts', id), { tags: ['ali'], ['tagNames.veli']: deleteField() }));
    await assertSucceeds(repo('ali').removeMyTag(id, 'ali'));
    expect(await r.get(id)).toMatchObject({ tags: ['veli'], tagNames: { veli: 'Veli' } });
    expect(await repo('ali').taggedIn('ali')).toEqual([]);
  });

  it('"Beni kim etiketleyebilir" ayarı yalnızca kişinin kendisine, yalnızca geçerli değerle', async () => {
    const social = (uid: string) => createFirestoreSocialRepository(fs(uid));
    expect(await social('ali').tagPolicy('ali')).toBe('herkes');
    await assertSucceeds(social('ali').setTagPolicy('ali', 'takip'));
    expect(await social('ali').tagPolicy('ali')).toBe('takip');
    await assertFails(setDoc(doc(fs('ali'), 'users/ali/settings/privacy'), { tagPolicy: 'herkesler', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(fs('ali'), 'users/ali/settings/privacy'), { tagPolicy: 'kimse', other: 1, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(fs('ayse'), 'users/ali/settings/privacy'), { tagPolicy: 'kimse', updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(fs('ayse'), 'users/ali/settings/privacy')));
  });

  it('harcama ölçümü: depolardaki okuma ve yazmalar koleksiyona göre sayılır', async () => {
    takeFirestoreUsage();
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input({ targets: ['genel'] }));
    await repo('ali').get(id);
    await repo('ali').byAuthor('ayse', false);
    const u = takeFirestoreUsage();
    expect(u.writes.posts).toBe(1);
    expect(u.writes.usage).toBe(1);
    expect(u.reads.posts).toBeGreaterThanOrEqual(2);
    expect(takeFirestoreUsage()).toEqual({ reads: {}, writes: {} });
  });
});
