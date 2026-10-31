import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { BusinessInput } from '@cityjoy/shared';
import { createBusinessAdmin, createFirestoreBusinessRepository, createFirestorePostRepository } from '@cityjoy/shared/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
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

const fs = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const biz = (uid: string) => createFirestoreBusinessRepository(fs(uid));
const posts = (uid: string) => createFirestorePostRepository(fs(uid));

const location = { provinceCode: '16', districtId: '16-osmangazi', neighbourhoodId: '16-osmangazi-alemdar' };
const input: BusinessInput = {
  type: 'yeme-icme', name: 'Cengiz Kebap', categoryIds: ['kebapci'], location, address: 'Atatürk Cad. 1',
  phone: '02241234567', whatsapp: false, is24h: false, priceList: [{ name: 'İskender', price: '450 TL' }],
  weeklyHours: [null, { open: '11:00', close: '23:00' }, { open: '11:00', close: '23:00' }, { open: '11:00', close: '23:00' }, { open: '11:00', close: '23:00' }, { open: '11:00', close: '02:00' }, { open: '11:00', close: '23:00' }],
  paymentMethods: ['nakit', 'kart'], amenities: ['aile-alani', 'paket-servis'],
};
const media = (uid: string, kind: string, id = 'abcDEF123456') => {
  const p = `media/${uid}/${kind}/${id}.jpg`;
  return { path: p, url: `http://127.0.0.1:9199/v0/b/demo-cityjoy.appspot.com/o/${p.replaceAll('/', '%2F')}?alt=media&token=t`, width: 800, height: 600 };
};
const post = (targets: ('genel' | 'takip' | 'bolgesel' | 'mahallem')[], text = 'Bugün öğlen menüsü hazır') => ({ text, category: 'firsat' as const, targets, region: location });

describe('işletme sayfası', () => {
  it('logo ve vitrin: kendi görseli, kademeye göre en çok sayı (ücretsiz 3, panelden değişir)', async () => {
    const vitrin = (n: number, uid = 'cengiz') => Array.from({ length: n }, (_, i) => media(uid, 'isletme-vitrin', `vitrinFoto${String(i).padStart(3, '0')}`));
    await expect(biz('cengiz').create('cengiz', { ...input, logo: media('baskasi', 'isletme-logo') })).rejects.toThrow();
    const id = await biz('cengiz').create('cengiz', { ...input, logo: media('cengiz', 'isletme-logo'), gallery: vitrin(3) });
    expect((await biz('x').get(id))!.gallery).toHaveLength(3);
    expect((await biz('x').get(id))!.logo?.path).toBe('media/cengiz/isletme-logo/abcDEF123456.jpg');
    await expect(biz('cengiz').update(id, { ...input, gallery: vitrin(4) })).rejects.toThrow();
    // Başka siteden adres kuralda sayılmaz ama uygulama göstermez.
    await biz('cengiz').update(id, { ...input, gallery: [{ ...vitrin(1)[0], url: 'https://kotu.site/x.jpg' }] });
    expect((await biz('x').get(id))!.gallery).toEqual([]);
    // Admin sınırı artırınca 4 olur; logo kaldırılınca alan silinir.
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'config/limits'), { vitrinUcretsiz: 4 }));
    await biz('cengiz').update(id, { ...input, gallery: vitrin(4) });
    const b = (await biz('x').get(id))!;
    expect(b.gallery).toHaveLength(4);
    expect(b.logo).toBeUndefined();
    // Premium kademede bile en çok 30.
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'config/limits'), { vitrinUcretsiz: 100 }));
    await expect(biz('cengiz').update(id, { ...input, gallery: vitrin(31) })).rejects.toThrow();
  }, 30000);

  it('bilgiler, yetkililer ve izinleri, yetkilinin düzenlemesi ve ayrılması', async () => {
    const id = await biz('cengiz').create('cengiz', input);
    const b = (await biz('x').get(id))!;
    expect(b).toMatchObject({ followerCount: 0, managers: [], paymentMethods: ['nakit', 'kart'], amenities: ['paket-servis', 'aile-alani'] });
    expect(b.weeklyHours?.[0]).toBeNull();
    expect(b.weeklyHours?.[5]).toEqual({ open: '11:00', close: '02:00' });

    // Sahibi en çok 3 yetkili atar; kendini atayamaz; yabancı atayamaz.
    const ayse = { uid: 'ayse', name: 'Ayşe K.', post: 'onayla' as const, edit: true, reply: true, messages: false };
    const veli = { uid: 'veli', name: 'Veli T.', post: 'kapali' as const, edit: false, reply: false, messages: false };
    await biz('cengiz').setManagers(id, [ayse, veli]);
    await expect(biz('yabanci').setManagers(id, [{ ...ayse, uid: 'yabanci' }])).rejects.toThrow();
    await assertFails(updateDoc(doc(fs('cengiz'), 'businesses', id), { managerUids: ['cengiz'], managers: { cengiz: { name: 'C', post: 'dogrudan', edit: true, reply: true } } }));
    await assertFails(updateDoc(doc(fs('cengiz'), 'businesses', id), {
      managerUids: ['a', 'b', 'c', 'd'],
      managers: Object.fromEntries(['a', 'b', 'c', 'd'].map((u) => [u, { name: u, post: 'kapali', edit: false, reply: false }])),
    }));
    expect((await biz('ayse').listManaged('ayse')).map((x) => x.id)).toEqual([id]);

    // Düzenleme izni olan yetkili bilgileri değiştirir ama telefonu değiştiremez; izni olmayan hiç değiştiremez.
    await biz('ayse').update(id, { ...input, description: 'Odun ateşinde' });
    await expect(biz('ayse').update(id, { ...input, phone: '02249999999' })).rejects.toThrow();
    await expect(biz('veli').update(id, { ...input, description: 'Veli yazdı' })).rejects.toThrow();
    expect((await biz('x').get(id))!.description).toBe('Odun ateşinde');

    // Yetkili yalnızca kendini çıkarabilir.
    await assertFails(updateDoc(doc(fs('veli'), 'businesses', id), { managerUids: ['veli'], managers: { veli: { name: 'Veli T.', post: 'kapali', edit: false, reply: false } } }));
    await biz('veli').leaveManaged(id, 'veli');
    expect((await biz('x').get(id))!.managers.map((m) => m.uid)).toEqual(['ayse']);

    // Panel: admin yetkiliyi çıkarır, işlem kayda geçer; admin olmayan çıkaramaz.
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' }));
    await expect(createBusinessAdmin(fs('ali'), 'ali').removeManager((await biz('x').get(id))!, 'ayse')).rejects.toThrow();
    await createBusinessAdmin(fs('eren'), 'eren').removeManager((await biz('x').get(id))!, 'ayse');
    expect((await biz('x').get(id))!.managers).toEqual([]);
    const log = await getDocs(collection(fs('eren'), 'auditLog'));
    expect(log.docs.map((d) => d.data().summary)).toContain('Yetkili çıkarıldı (Ayşe K.): Cengiz Kebap');
  }, 30000);

  it('takip: sayaç tam bir değişir, iki kez takip edilemez; takip akışına işletmenin Takip gönderileri düşer', async () => {
    const id = await biz('cengiz').create('cengiz', input);
    await biz('ali').follow(id, 'ali');
    await expect(biz('ali').follow(id, 'ali')).rejects.toThrow();
    await assertFails(updateDoc(doc(fs('ali'), 'businesses', id), { followerCount: 5 }));
    expect((await biz('x').get(id))!.followerCount).toBe(1);
    expect(await biz('ali').followedIds('ali')).toEqual([id]);

    await posts('cengiz').create('cengiz', 'Cengiz U.', post(['takip'], 'Sadece takipçilere indirim'), { business: { id, name: 'Cengiz Kebap' }, pending: false });
    const feed = (uid: string) => posts(uid).feed({ target: 'takip', authorUids: [], businessIds: [id] });
    expect((await feed('ali')).posts.map((p) => [p.authorName, p.business?.id])).toEqual([['Cengiz Kebap', id]]);
    expect((await feed('veli')).posts).toEqual([]);
    expect(await posts('ali').byBusiness(id, { following: true })).toHaveLength(1);
    expect(await posts('veli').byBusiness(id, { following: false })).toHaveLength(0);

    await biz('ali').unfollow(id, 'ali');
    expect((await biz('x').get(id))!.followerCount).toBe(0);
    // Hesap silmede takipler bırakılır.
    await biz('veli').follow(id, 'veli');
    await biz('veli').leaveAllOf('veli');
    expect((await biz('x').get(id))!.followerCount).toBe(0);
  }, 30000);

  it('işletme adına paylaşım: sahibi doğrudan, yetkili onayla ya da doğrudan, izni kapalı ve yabancı paylaşamaz', async () => {
    const id = await biz('cengiz').create('cengiz', input);
    await biz('cengiz').setManagers(id, [
      { uid: 'ayse', name: 'Ayşe K.', post: 'onayla', edit: false, reply: false, messages: false },
      { uid: 'mehmet', name: 'Mehmet S.', post: 'dogrudan', edit: false, reply: false, messages: false },
      { uid: 'veli', name: 'Veli T.', post: 'kapali', edit: false, reply: false, messages: false },
    ]);
    const as = (pending: boolean) => ({ business: { id, name: 'Cengiz Kebap' }, pending });

    await posts('cengiz').create('cengiz', 'Cengiz U.', post(['genel']), as(false));
    await posts('mehmet').create('mehmet', 'Mehmet S.', post(['genel'], 'Akşam canlı müzik'), as(false));
    const waiting = await posts('ayse').create('ayse', 'Ayşe K.', post(['genel'], 'Yeni tatlı menüsü'), as(true));
    // Onay bekleyen olarak işaretlemeden yayınlayamaz; izni kapalı ve yabancı hiç paylaşamaz; bölge işletmeninki olmalı.
    await expect(posts('ayse').create('ayse', 'Ayşe K.', post(['genel']), as(false))).rejects.toThrow();
    await expect(posts('veli').create('veli', 'Veli T.', post(['genel']), as(true))).rejects.toThrow();
    await expect(posts('yabanci').create('yabanci', 'Y.', post(['genel']), as(false))).rejects.toThrow();
    await expect(posts('cengiz').create('cengiz', 'Cengiz U.', { ...post(['genel']), region: { ...location, neighbourhoodId: '16-osmangazi-baska' } }, as(false))).rejects.toThrow();

    // Bekleyen paylaşım akışta yok; sahibi ve yetkililer görür, yabancı göremez.
    expect((await posts('ali').byBusiness(id, { following: false })).map((p) => p.text).sort()).toEqual(['Akşam canlı müzik', 'Bugün öğlen menüsü hazır']);
    expect((await posts('cengiz').pendingOf(id)).map((p) => p.id)).toEqual([waiting]);
    await expect(posts('ali').pendingOf(id)).rejects.toThrow();
    // Yetkili kendi paylaşımını onaylayamaz; sahibi onaylar.
    await expect(posts('ayse').approve(waiting)).rejects.toThrow();
    await posts('cengiz').approve(waiting);
    expect(await posts('ali').byBusiness(id, { following: false })).toHaveLength(3);
    // Sahibi yetkilinin paylaşımını kaldırabilir.
    await posts('cengiz').remove(waiting);
    expect(await posts('ali').byBusiness(id, { following: false })).toHaveLength(2);
  }, 30000);
});
