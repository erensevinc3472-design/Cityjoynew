import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { inboxSection, threadId, type ChatContext, type ListingInput } from '@cityjoy/shared';
import { createFirestoreListingRepository, createFirestoreMessageRepository, createListingModeration } from '@cityjoy/shared/firebase';
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where, type Firestore } from 'firebase/firestore';
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

const fs = (uid: string, verified = true) =>
  env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: verified }).firestore() as unknown as Firestore;
const repo = (uid: string, verified = true) => createFirestoreListingRepository(fs(uid, verified));
const msg = (uid: string) => createFirestoreMessageRepository(fs(uid));
const NAMES: Record<string, string> = { ali: 'Ali Y.', ayse: 'Ayşe K.', veli: 'Veli', genc: 'Genç', yeni: 'Yeni' };
const ataevler = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
const fethiye = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-fethiye' };
const year = new Date().getFullYear();
const old = new Date(Date.now() - 30 * 86400000);

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const users = [['ali', 1990, old, ataevler], ['ayse', 1992, old, fethiye], ['veli', 1985, old, ataevler], ['genc', year - 15, old, ataevler], ['yeni', 1990, new Date(), ataevler]] as const;
    for (const [uid, birthYear, createdAt, location] of users) {
      await setDoc(doc(db, 'users', uid), { uid, displayName: uid, birthYear, createdAt, location });
      await setDoc(doc(db, 'publicProfiles', uid), { displayName: NAMES[uid], bio: '', isPrivate: false, updatedAt: new Date() });
    }
    await setDoc(doc(db, 'grants', 'ahmet@ornek.com__il-16'), {
      email: 'ahmet@ornek.com', displayName: 'Ahmet', role: 'il-yoneticisi', scope: { level: 'il', provinceCode: '16' },
      modules: { moderasyon: ['goruntule', 'duzenle', 'sil'] }, grantedBy: 'eren', grantedAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
  });
});

const input = (patch: Partial<ListingInput> = {}): ListingInput => ({
  kind: 'satilik',
  category: 'ev-mobilya',
  condition: 'az-kullanilmis',
  title: 'Ahşap çalışma masası',
  description: 'Az kullanıldı, çiziksiz.',
  price: 1500,
  rentUnit: null,
  swapFor: '',
  region: ataevler,
  ...patch,
});

/** Kuralları atlayarak ilanın yayın tarihini geri alır (yenileme ve süre denemeleri). */
const age = (id: string, days: number) =>
  env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'listings', id), { listedAt: Timestamp.fromDate(new Date(Date.now() - days * 86400000)) }));

describe('Çarşı ilanları', () => {
  it('e-postası doğrulanmış yetişkin kendi mahallesiyle ilan verir; başka mahalle, çocuk, doğrulanmamış e-posta, yanlış ad olmaz', async () => {
    const id = await repo('ali').create('ali', 'Ali Y.', input());
    const l = await repo('ayse').get(id);
    expect(l?.title).toBe('Ahşap çalışma masası');
    expect(l?.status).toBe('yayinda');
    await assertFails(repo('ali').create('ali', 'Ali Y.', input({ region: fethiye })));
    await assertFails(repo('genc').create('genc', 'Genç', input()));
    await assertFails(repo('veli', false).create('veli', 'Veli', input()));
    await assertFails(repo('veli').create('veli', 'Ayşe K.', input()));
  });

  it('fiyat türe uyar: satılık ve kiralıkta zorunlu, ücretsiz ve takasta yok; kiralıkta süre birimi; fotoğraf şimdilik yok', async () => {
    await assertFails(repo('ali').create('ali', 'Ali Y.', input({ price: null })));
    await assertFails(repo('ali').create('ali', 'Ali Y.', input({ kind: 'ucretsiz', price: 100 })));
    await assertFails(repo('ali').create('ali', 'Ali Y.', input({ kind: 'kiralik', price: 200, rentUnit: null })));
    await assertSucceeds(repo('ali').create('ali', 'Ali Y.', input({ kind: 'kiralik', price: 200, rentUnit: 'gun' })));
    await assertSucceeds(repo('ali').create('ali', 'Ali Y.', input({ kind: 'takas', price: null, swapFor: 'Bisiklet' })));
    await assertFails(
      setDoc(doc(fs('veli'), 'listings', 'foto'), {
        kind: 'ucretsiz', category: 'diger', condition: 'iyi', title: 'Saksı', description: '', price: null, rentUnit: null, swapFor: '',
        region: ataevler, ownerUid: 'veli', ownerName: 'Veli', status: 'yayinda', photos: ['https://ornek.com/a.jpg'], reportCount: 0,
      }),
    );
  });

  it('günlük ilan sınırı: yeni hesapta 2, eski hesapta 5', async () => {
    await repo('yeni').create('yeni', 'Yeni', input());
    await repo('yeni').create('yeni', 'Yeni', input());
    await assertFails(repo('yeni').create('yeni', 'Yeni', input()));
    for (let i = 0; i < 5; i++) await repo('veli').create('veli', 'Veli', input());
    await assertFails(repo('veli').create('veli', 'Veli', input()));
  });

  it('giriş yapan herkes ilde, ilçede, kategoride listeler; girişsiz okunmaz; kaldırılan ilanı başkası görmez', async () => {
    const id = await repo('ali').create('ali', 'Ali Y.', input());
    await repo('veli').create('veli', 'Veli', input({ kind: 'ucretsiz', price: null, category: 'kitap-hobi', title: 'Roman kitapları' }));
    expect((await repo('ayse').list({ provinceCode: '16' })).listings).toHaveLength(2);
    expect((await repo('ayse').list({ provinceCode: '16', districtId: '16-nilufer', kind: 'ucretsiz' })).listings.map((x) => x.title)).toEqual(['Roman kitapları']);
    expect((await repo('ayse').list({ provinceCode: '16', key: 'masa' })).listings.map((x) => x.id)).toEqual([id]);
    expect((await repo('ayse').list({ provinceCode: '34' })).listings).toHaveLength(0);
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore() as unknown as Firestore, 'listings', id)));
    // Süresi dolan ilan listeden düşer.
    await age(id, 31);
    expect((await repo('ayse').list({ provinceCode: '16' })).listings).toHaveLength(1);
    await repo('ali').remove(id);
    await assertFails(getDoc(doc(fs('ayse'), 'listings', id)));
    expect(await repo('ali').listMine('ali')).toHaveLength(0);
  });

  it('sahibi düzenler, satıldı işaretler, son günlerde yeniler; başkası dokunamaz', async () => {
    const id = await repo('ali').create('ali', 'Ali Y.', input());
    await assertSucceeds(repo('ali').update(id, input({ price: 1200, title: 'Ahşap masa (indirim)' })));
    await assertFails(repo('veli').update(id, input({ price: 1 })));
    // Bölge değiştirilemez.
    await assertFails(updateDoc(doc(fs('ali'), 'listings', id), { region: fethiye }));
    // Yeni ilan yenilenemez; 27 gün sonra yenilenir.
    await assertFails(repo('ali').renew(id));
    await age(id, 28);
    await assertSucceeds(repo('ali').renew(id));
    await assertSucceeds(repo('ali').setSold(id, true));
    expect((await repo('ayse').get(id))?.status).toBe('satildi');
    // Satılan ilan listede görünmez, düzenlenmez; yeniden yayına alınır.
    expect((await repo('ayse').list({ provinceCode: '16' })).listings).toHaveLength(0);
    await assertFails(repo('ali').update(id, input()));
    await assertSucceeds(repo('ali').setSold(id, false));
    await assertFails(repo('veli').setSold(id, true));
    await assertFails(repo('veli').remove(id));
  });

  it('şikâyet kişi başına bir, kendi ilanına olmaz; moderatör kendi ilinde kaldırır', async () => {
    const id = await repo('ali').create('ali', 'Ali Y.', input());
    const l = (await repo('ali').get(id))!;
    await assertSucceeds(repo('ayse').report(l, 'ayse', 'dolandiricilik'));
    await assertFails(repo('ayse').report(l, 'ayse', 'spam'));
    await assertFails(repo('ali').report(l, 'ali', 'spam'));
    await assertFails(createListingModeration(fs('veli'), 'veli').listReports({ provinceCode: '16' }));
    const mod = createListingModeration(fs('ahmet'), 'ahmet');
    const [r] = await mod.listReports({ provinceCode: '16' });
    expect(r.listing?.title).toBe('Ahşap çalışma masası');
    await mod.remove(r);
    await assertFails(getDoc(doc(fs('ayse'), 'listings', id)));
  });

  it('favoriler yalnızca kişinin kendisine', async () => {
    const id = await repo('ali').create('ali', 'Ali Y.', input());
    await repo('ayse').setFavorite('ayse', id, true);
    expect([...(await repo('ayse').favoriteIds('ayse'))]).toEqual([id]);
    expect((await repo('ayse').listFavorites('ayse')).map((x) => x.id)).toEqual([id]);
    await assertFails(getDocs(collection(fs('veli'), 'users', 'ayse', 'favoriteListings')));
    await assertFails(setDoc(doc(fs('veli'), 'users', 'ayse', 'favoriteListings', id), { createdAt: new Date() }));
  });

  it('ilan sohbeti: alıcı ilan sahibine yazar, iki tarafta Çarşı bölümünde; satılan ilana, yanlış başlıkla, satıcı kendi başlatamaz', async () => {
    const id = await repo('ali').create('ali', 'Ali Y.', input());
    const ctx: ChatContext = { type: 'ilan', id, title: 'Ahşap çalışma masası' };
    // Yanlış başlık ya da ilan sahibi olmayan kişiye.
    await assertFails(msg('ayse').send('ayse', 'ali', 'Merhaba', { chat: null, myName: 'Ayşe K.', otherName: 'Ali Y.', mutual: false, context: { ...ctx, title: 'Başka' } }));
    await assertFails(msg('ayse').send('ayse', 'veli', 'Merhaba', { chat: null, myName: 'Ayşe K.', otherName: 'Veli', mutual: false, context: ctx }));
    await assertSucceeds(msg('ayse').send('ayse', 'ali', 'Masa duruyor mu?', { chat: null, myName: 'Ayşe K.', otherName: 'Ali Y.', mutual: false, context: ctx }));
    const chat = (await msg('ali').getChat(threadId('ayse', 'ali', ctx)))!;
    expect(chat.accepted).toBe(true);
    expect(chat.names.ali).toBe('Ali Y.');
    expect(inboxSection(chat, 'ali')).toBe('carsi');
    expect(inboxSection(chat, 'ayse')).toBe('carsi');
    // Satıcı cevaplar; başkası okuyamaz.
    await assertSucceeds(msg('ali').send('ali', 'ayse', 'Duruyor', { chat, myName: 'Ali Y.', otherName: 'Ayşe K.', mutual: false }));
    await assertFails(getDoc(doc(fs('veli'), 'chats', chat.id)));
    await assertFails(getDocs(query(collection(fs('veli'), 'chats'), where('context.id', '==', id))));
    // Satılan ilana yeni sohbet açılmaz.
    await repo('ali').setSold(id, true);
    await assertFails(msg('veli').send('veli', 'ali', 'Selam', { chat: null, myName: 'Veli', otherName: 'Ali Y.', mutual: false, context: ctx }));
  });
});
