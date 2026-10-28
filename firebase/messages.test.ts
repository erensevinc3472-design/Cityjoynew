import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { chatId, type Chat } from '@cityjoy/shared';
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

  it('hesap silinince mesajlarım ve sohbetlerim silinir', async () => {
    await send('ali', 'ayse', 'Merhaba');
    await send('ayse', 'ali', 'Selam');
    await msg('ali').deleteAllOf('ali');
    expect(await msg('ayse').getChat(chatId('ali', 'ayse'))).toBeNull();
  });
});
