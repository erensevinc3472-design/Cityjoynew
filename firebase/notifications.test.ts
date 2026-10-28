import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { DEFAULT_NOTIFICATION_PREFS, DEFAULT_NOTIFICATION_TRIGGERS } from '@cityjoy/shared';
import { createFirestoreSocialRepository, createNotificationSettings, createNotificationTriggers } from '@cityjoy/shared/firebase';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, type Firestore } from 'firebase/firestore';
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

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    for (const uid of ['ali', 'ayse']) {
      await setDoc(doc(db, 'users', uid), { uid, displayName: uid, birthYear: 1990 });
      await setDoc(doc(db, 'publicProfiles', uid), { displayName: uid === 'ali' ? 'Ali Y.' : 'Ayşe K.', bio: '', isPrivate: false, updatedAt: new Date() });
    }
  });
});

describe('Bildirimler', () => {
  it('tercihleri yalnızca kişinin kendisi okur ve yazar; bozuk kayıt reddedilir', async () => {
    const prefs = { categories: { ...DEFAULT_NOTIFICATION_PREFS.categories, etkinlik: false }, quietHours: { enabled: true, start: 23, end: 7 } };
    await createNotificationSettings(fs('ali')).save('ali', prefs);
    expect(await createNotificationSettings(fs('ali')).get('ali')).toEqual(prefs);
    await assertFails(getDoc(doc(fs('ayse'), 'users', 'ali', 'settings', 'notifications')));
    await assertFails(createNotificationSettings(fs('ayse')).save('ali', prefs));
    await assertFails(setDoc(doc(fs('ali'), 'users', 'ali', 'settings', 'notifications'), { categories: { acil: true }, quietHours: { enabled: false, start: 0, end: 0 }, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(fs('ali'), 'users', 'ali', 'settings', 'baska'), { categories: prefs.categories, quietHours: prefs.quietHours, updatedAt: serverTimestamp() }));
    await assertSucceeds(createNotificationSettings(fs('ali')).delete('ali'));
  });

  it('tetikleyicileri yalnızca admin değiştirir; acil ve SOS kapanmaz; kayda geçer', async () => {
    await assertFails(createNotificationTriggers(fs('ali')).save('ali', { ...DEFAULT_NOTIFICATION_TRIGGERS, takip: false }));
    const saved = await createNotificationTriggers(fs('eren')).save('eren', { ...DEFAULT_NOTIFICATION_TRIGGERS, takip: false, acil: false });
    expect(saved.takip).toBe(false);
    expect(saved.acil).toBe(true);
    expect((await createNotificationTriggers(fs('ali')).get()).takip).toBe(false);
    await assertFails(setDoc(doc(fs('eren'), 'config', 'notificationTriggers'), { triggers: { ...DEFAULT_NOTIFICATION_TRIGGERS, sos: false }, updatedBy: 'eren', updatedAt: serverTimestamp() }));
    expect((await getDocs(query(collection(fs('eren'), 'auditLog'), where('targetId', '==', 'notificationTriggers')))).size).toBe(1);
  });

  it('son takipçiler yalnızca kişinin kendisine dönük sorguyla', async () => {
    await createFirestoreSocialRepository(fs('ayse')).follow('ayse', 'ali', false);
    const list = await createFirestoreSocialRepository(fs('ali')).recentFollowers('ali');
    expect(list.map((x) => [x.uid, x.displayName])).toEqual([['ayse', 'Ayşe K.']]);
  });
});
