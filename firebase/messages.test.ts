import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { chatId, chatTitle, inboxSection, isHiddenFor, threadId, type Chat, type ChatContext, type ChatMessage } from '@cityjoy/shared';
import { createFirestoreMessageRepository, createFirestoreSocialRepository, createMessageModeration } from '@cityjoy/shared/firebase';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
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
const msg = (uid: string) => createFirestoreMessageRepository(fs(uid));
const social = (uid: string) => createFirestoreSocialRepository(fs(uid));
const NAMES: Record<string, string> = { ali: 'Ali Y.', ayse: 'Ayşe K.', veli: 'Veli', genc: 'Genç', yeni: 'Yeni' };
const year = new Date().getFullYear();
const old = new Date(Date.now() - 30 * 86400000);

/** ali'den diğerine mesaj (sohbet yoksa açılır). */
async function send(from: string, to: string, text: string, mutual = false) {
  const chat = await msg(from).getChat(chatId(from, to));
  await msg(from).send(from, to, text, { chat, myName: NAMES[from], otherName: NAMES[to], mutual });
}
const chatOf = async (uid: string, a: string, b: string) => (await msg(uid).getChat(chatId(a, b))) as Chat;

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    for (const [uid, birthYear, createdAt] of [['ali', 1990, old], ['ayse', 1992, old], ['veli', 1985, old], ['genc', year - 15, old], ['yeni', 1990, new Date()]] as const) {
      await setDoc(doc(db, 'users', uid), { uid, displayName: uid, birthYear, createdAt });
      await setDoc(doc(db, 'publicProfiles', uid), { displayName: NAMES[uid], bio: '', isPrivate: uid === 'genc', updatedAt: new Date() });
    }
    await setDoc(doc(db, 'businesses/kafe'), { ownerUid: 'veli', status: 'yayinda', name: 'Kafe Veli' });
    await setDoc(doc(db, 'businesses/kapali'), { ownerUid: 'veli', status: 'gizli', name: 'Kapalı' });
  });
});

describe('Mesajlar', () => {
  it('takipleşmeyen kişiye ilk mesaj istek olur; cevap yazınca kabul edilir; yalnızca iki taraf okur', async () => {
    await send('ali', 'ayse', 'Merhaba, parktaki etkinlik ne zaman?');
    let chat = await chatOf('ayse', 'ali', 'ayse');
    expect(chat.accepted).toBe(false);
    expect(chat.unread).toEqual({ ali: 0, ayse: 1 });
    // Takipleşmedikleri hâlde "kabul edilmiş" sohbet açılamaz.
    await assertFails(msg('veli').send('veli', 'ayse', 'Selam', { chat: null, myName: 'Veli', otherName: 'Ayşe K.', mutual: true }));
    await assertFails(getDoc(doc(fs('veli'), 'chats', chatId('ali', 'ayse'))));
    await assertFails(getDocs(collection(fs('veli'), 'chats', chatId('ali', 'ayse'), 'messages')));
    await send('ayse', 'ali', 'Cumartesi 10.00');
    chat = await chatOf('ali', 'ali', 'ayse');
    expect(chat.accepted).toBe(true);
    expect(chat.unread).toEqual({ ali: 1, ayse: 1 });
    await msg('ali').markRead(chat, 'ali', true);
    chat = await chatOf('ali', 'ali', 'ayse');
    expect(chat.unread.ali).toBe(0);
    expect(chat.seen.ali).toBeTruthy();
    // Karşı tarafın okunmamış sayısını sıfırlayamaz, başkasının adına mesaj yazamaz.
    await assertFails(updateDoc(doc(fs('ali'), 'chats', chat.id), { 'unread.ayse': 0 }));
    await assertFails(setDoc(doc(fs('ali'), 'chats', chat.id, 'messages', 'x'), { from: 'ayse', text: 'sahte', status: 'aktif', createdAt: serverTimestamp() }));
  });

  it('takipleşen iki kişide sohbet baştan açık', async () => {
    await social('ali').follow('ali', 'ayse', false);
    await social('ayse').follow('ayse', 'ali', false);
    await send('ali', 'ayse', 'Selam komşu', true);
    expect((await chatOf('ayse', 'ali', 'ayse')).accepted).toBe(true);
  });

  it('yetişkin ile 13-17 yaş arası birbirine yazamaz; engel yazışmayı durdurur', async () => {
    await assertFails(send('ali', 'genc', 'Merhaba'));
    await assertFails(send('genc', 'ali', 'Merhaba'));
    await send('ali', 'ayse', 'Merhaba');
    await social('ayse').block('ayse', 'ali');
    await assertFails(send('ali', 'ayse', 'Neden cevap yok?'));
    // Engelleyen de yazamaz (önce engeli kaldırmalı).
    await assertFails(send('ayse', 'ali', 'Son söz'));
  });

  it('yeni hesap 24 saatte en çok 10 yeni sohbet açar; sayaç geri alınamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (let i = 0; i < 11; i++) {
        await setDoc(doc(ctx.firestore(), 'users', `k${i}`), { uid: `k${i}`, displayName: 'k', birthYear: 1990, createdAt: old });
        await setDoc(doc(ctx.firestore(), 'publicProfiles', `k${i}`), { displayName: `K${i}`, bio: '', isPrivate: false, updatedAt: new Date() });
      }
    });
    for (let i = 0; i < 10; i++) await msg('yeni').send('yeni', `k${i}`, 'Merhaba', { chat: null, myName: 'Yeni', otherName: `K${i}`, mutual: false });
    await assertFails(msg('yeni').send('yeni', 'k10', 'Merhaba', { chat: null, myName: 'Yeni', otherName: 'K10', mutual: false }));
    await assertFails(setDoc(doc(fs('yeni'), 'chatQuota', 'yeni'), { windowStart: serverTimestamp(), count: 1 }));
    await assertFails(updateDoc(doc(fs('yeni'), 'chatQuota', 'yeni'), { count: 0 }));
  });

  it('kendi mesajını siler; şikâyet yalnızca karşı tarafın mesajına; admin kopyayı görüp kaldırır', async () => {
    await send('ali', 'ayse', 'IBAN TR120006100519786457841326 kapora');
    await send('ayse', 'ali', 'Olmaz');
    const chat = await chatOf('ayse', 'ali', 'ayse');
    const list = (await getDocs(collection(fs('ayse'), 'chats', chat.id, 'messages'))).docs.map((d) => ({ id: d.id, ...(d.data() as { from: string; text: string }), status: 'aktif' as const, createdAt: '' }));
    const fromAli = list.find((m) => m.from === 'ali')!;
    const fromAyse = list.find((m) => m.from === 'ayse')!;
    await assertFails(msg('ayse').deleteMessage(chat, fromAli));
    await assertFails(msg('ayse').report(chat, fromAyse, 'ayse', 'spam'));
    await assertFails(msg('veli').report(chat, fromAli, 'veli', 'spam'));
    await assertFails(msg('ayse').report(chat, { ...fromAli, text: 'başka metin' }, 'ayse', 'dolandiricilik'));
    await assertSucceeds(msg('ayse').report(chat, fromAli, 'ayse', 'dolandiricilik'));
    await assertSucceeds(msg('ayse').deleteMessage(chat, fromAyse));
    expect((await chatOf('ali', 'ali', 'ayse')).last?.text).toBe('');
    await assertFails(createMessageModeration(fs('ali'), 'ali').listReports());
    const reports = await createMessageModeration(fs('eren'), 'eren').listReports();
    expect(reports.map((r) => r.text)).toEqual([fromAli.text]);
    // Admin sohbetin kendisini okuyamaz.
    await assertFails(getDocs(collection(fs('eren'), 'chats', chat.id, 'messages')));
    await createMessageModeration(fs('eren'), 'eren').remove(reports[0]);
    const removed = await getDoc(doc(fs('ayse'), 'chats', chat.id, 'messages', fromAli.id));
    expect(removed.get('status')).toBe('kaldirildi');
    expect(removed.get('text')).toBe('');
    expect(await createMessageModeration(fs('eren'), 'eren').listReports()).toEqual([]);
  });

  it('işletmeye yazılan sohbet baştan açık, sahibinde "İşletmem"de; kişisel sohbetle karışmaz', async () => {
    const kafe: ChatContext = { type: 'isletme', id: 'kafe', title: 'Kafe Veli' };
    const toBiz = (from: string, ctx: ChatContext, text = 'Yarın açık mısınız?') =>
      msg(from).send(from, 'veli', text, { chat: null, myName: NAMES[from], otherName: 'Veli', mutual: false, context: ctx });
    await toBiz('ali', kafe);
    const id = threadId('ali', 'veli', kafe);
    let chat = (await msg('veli').getChat(id)) as Chat;
    expect(chat.accepted).toBe(true);
    expect(inboxSection(chat, 'veli')).toBe('isletmem');
    expect(inboxSection(chat, 'ali')).toBe('sohbetler');
    expect(chatTitle(chat, 'ali')).toBe('Kafe Veli');
    expect(chatTitle(chat, 'veli')).toBe('Ali Y.');
    await msg('veli').send('veli', 'ali', 'Evet, 8-22', { chat, myName: 'Veli', otherName: 'Ali Y.', mutual: false });
    chat = (await msg('ali').getChat(id)) as Chat;
    expect(chat.unread.ali).toBe(1);
    // Aynı iki kişinin kişisel sohbeti ayrı (ve takipleşmedikleri için istek).
    await send('ali', 'veli', 'Selam');
    expect((await chatOf('veli', 'ali', 'veli')).accepted).toBe(false);
    // İşletme müşteriye ilk mesajı atamaz; sahte ad, gizli işletme, başkasının işletmesi, yaş sınırı ve engel geçmez.
    await assertFails(msg('veli').send('veli', 'ayse', 'Kampanya!', { chat: null, myName: 'Veli', otherName: 'Ayşe K.', mutual: false, context: kafe }));
    await assertFails(toBiz('ayse', { ...kafe, title: 'Başka Ad' }));
    await assertFails(toBiz('ayse', { ...kafe, id: 'kapali', title: 'Kapalı' }));
    await assertFails(msg('ayse').send('ayse', 'ali', 'Merhaba', { chat: null, myName: 'Ayşe K.', otherName: 'Ali Y.', mutual: false, context: kafe }));
    await assertFails(toBiz('genc', kafe));
    await social('veli').block('veli', 'ayse');
    await assertFails(toBiz('ayse', kafe));
  });

  it('sohbeti sil: yalnızca benim listemden kalkar; yeni mesajla geri gelir, eskiler görünmez', async () => {
    await send('ali', 'ayse', 'Eski mesaj');
    await send('ayse', 'ali', 'Eski cevap');
    let chat = await chatOf('ali', 'ali', 'ayse');
    await msg('ali').hide(chat, 'ali');
    chat = await chatOf('ali', 'ali', 'ayse');
    expect(isHiddenFor(chat, 'ali')).toBe(true);
    expect(chat.unread.ali).toBe(0);
    expect(isHiddenFor(await chatOf('ayse', 'ali', 'ayse'), 'ayse')).toBe(false);
    // Karşı tarafın yerine silemez.
    await assertFails(updateDoc(doc(fs('ali'), 'chats', chat.id), { 'hidden.ayse': serverTimestamp() }));
    await new Promise((r) => setTimeout(r, 50));
    await send('ayse', 'ali', 'Yeni mesaj');
    chat = await chatOf('ali', 'ali', 'ayse');
    expect(isHiddenFor(chat, 'ali')).toBe(false);
    const seen = await new Promise<ChatMessage[]>((resolve, reject) => {
      const stop = msg('ali').watchMessages(chat.id, (list) => { stop(); resolve(list); }, reject, chat.hidden.ali);
    });
    expect(seen.map((m) => m.text)).toEqual(['Yeni mesaj']);
  });

  it('hesap silinince mesajlarım ve sohbetlerim silinir', async () => {
    await send('ali', 'ayse', 'Merhaba');
    await send('ayse', 'ali', 'Selam');
    await msg('ali').deleteAllOf('ali');
    expect(await msg('ayse').getChat(chatId('ali', 'ayse'))).toBeNull();
  });
});
