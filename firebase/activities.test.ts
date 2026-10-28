import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { ActivityInput } from '@cityjoy/shared';
import { createActivityModeration, createFirestoreActivityRepository, createFirestoreEventRepository } from '@cityjoy/shared/firebase';
import { doc, getDoc, increment, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
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
const repo = (uid: string) => createFirestoreActivityRepository(fs(uid));

const thisYear = new Date().getFullYear();
const ataevler = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
const now = Timestamp.now();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    const user = (uid: string, age: number, provinceCode = '16') =>
      setDoc(doc(db, 'users', uid), { uid, displayName: uid, birthYear: thisYear - age, location: { ...ataevler, provinceCode, districtId: `${provinceCode}-x`, neighbourhoodId: `${provinceCode}-x-y` } });
    await user('ayse', 30);
    await user('ali', 25);
    await user('veli', 40);
    await user('genc', 16);
    await user('istanbul', 30, '34');
    await setDoc(doc(db, 'grants', 'ahmet@ornek.com__il-16'), {
      email: 'ahmet@ornek.com', displayName: 'Ahmet', role: 'il-yoneticisi', scope: { level: 'il', provinceCode: '16' },
      modules: { moderasyon: ['goruntule', 'duzenle', 'sil'] }, grantedBy: 'eren', grantedAt: now, updatedAt: now,
    });
  });
});

const input = (patch: Partial<ActivityInput> = {}): ActivityInput => {
  const start = new Date(Date.now() + 2 * 86400000);
  return {
    title: 'Parkta yürüyüş',
    description: 'Bir saatlik tempolu yürüyüş, herkes gelebilir.',
    category: 'yuruyus-doga',
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 3600000).toISOString(),
    region: ataevler,
    address: 'Ataevler Parkı, kafeterya önü',
    capacity: 2,
    ...patch,
  };
};

describe('aktiviteler', () => {
  it('yetişkin kendi ilinde açar; 18 yaş altı, başka il ve girişsiz açamaz', async () => {
    await assertSucceeds(repo('ayse').create('ayse', 'Ayşe K.', input()));
    await assertFails(repo('genc').create('genc', 'Genç', input()));
    await assertFails(repo('istanbul').create('istanbul', 'İ.', input()));
    await assertFails(createFirestoreActivityRepository(guest()).create('x', 'X', input()));
    // Başkası adına, 30 günden ileri ya da 12 saatten uzun olmaz.
    await assertFails(repo('ali').create('ayse', 'Ayşe K.', input()));
    const far = new Date(Date.now() + 40 * 86400000);
    await assertFails(repo('ayse').create('ayse', 'A', input({ startsAt: far.toISOString(), endsAt: new Date(far.getTime() + 3600000).toISOString() })));
    const s = new Date(Date.now() + 86400000);
    await assertFails(repo('ayse').create('ayse', 'A', input({ startsAt: s.toISOString(), endsAt: new Date(s.getTime() + 13 * 3600000).toISOString() })));
  });

  it('tam adres yalnızca düzenleyene ve katılana; katılım yetişkin, kontenjan içinde, sayaç hilesiz', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input());
    expect(await repo('ayse').address(id)).toBe('Ataevler Parkı, kafeterya önü');
    expect(await repo('ali').address(id)).toBeNull();
    await assertFails(getDoc(doc(guest(), 'activities', id)));
    await assertSucceeds(getDoc(doc(fs('ali'), 'activities', id)));

    await assertFails(repo('genc').join(id, 'genc', null));
    await assertFails(repo('ayse').join(id, 'ayse', null));
    await assertSucceeds(repo('ali').join(id, 'ali', { name: 'Ali' }));
    expect(await repo('ali').address(id)).toBe('Ataevler Parkı, kafeterya önü');
    // Sayacı tek başına artırmak ya da iki artırmak olmaz.
    await assertFails(updateDoc(doc(fs('veli'), 'activities', id), { attendeeCount: increment(1) }));
    await assertSucceeds(repo('veli').join(id, 'veli', null));
    expect((await repo('ayse').get(id))?.attendeeCount).toBe(2);
    // Kontenjan (2) doldu.
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'users', 'can'), { uid: 'can', birthYear: thisYear - 30, location: ataevler }));
    await assertFails(repo('can').join(id, 'can', null));
    expect(await repo('ayse').namedAttendees(id)).toEqual(['Ali']);
    await assertSucceeds(repo('veli').leave(id, 'veli'));
    expect((await repo('ayse').get(id))?.attendeeCount).toBe(1);
  });

  it('düzenleyen iptal eder, tarih / yer değiştiremez; başkası iptal edemez', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input());
    await assertFails(repo('ali').cancel(id));
    await assertFails(updateDoc(doc(fs('ayse'), 'activities', id), { title: 'Başka' }));
    await assertSucceeds(repo('ayse').cancel(id));
    expect((await repo('ayse').get(id))?.status).toBe('iptal');
    await assertFails(repo('ali').join(id, 'ali', null));
  });

  it('şikâyet: kişi başına bir, sayaç birlikte artar, kendi aktivitesine olmaz; il yöneticisi görür ve kaldırır', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input());
    const a = (await repo('ali').get(id))!;
    await assertSucceeds(repo('ali').report(a, 'ali', 'tehlikeli'));
    await assertFails(repo('ali').report(a, 'ali', 'tehlikeli'));
    await assertFails(repo('ayse').report(a, 'ayse', 'diger'));
    await assertFails(updateDoc(doc(fs('veli'), 'activities', id), { reportCount: increment(5) }));
    expect(await repo('ali').hasReported(id, 'ali')).toBe(true);

    // Kullanıcı şikâyet listesini okuyamaz; il yöneticisi kendi ilini okur ve karar verir.
    await assertFails(createActivityModeration(fs('veli'), 'veli').listReports({ provinceCode: '16' }));
    const mod = createActivityModeration(fs('ahmet'), 'ahmet');
    const list = await mod.listReports({ provinceCode: '16' });
    expect(list).toHaveLength(1);
    await assertFails(createActivityModeration(fs('ahmet'), 'ahmet').listReports({ provinceCode: '34' }));
    await assertSucceeds(mod.remove(list[0]!));
    expect((await repo('ayse').get(id))?.status).toBe('kaldirildi');
    await assertFails(getDoc(doc(fs('ali'), 'activities', id)));
  });

  it('hesap silme: katılımlar (etkinlik sorgusuyla) silinir, açılan aktivite kaldırılır ve adres silinir', async () => {
    const id = await repo('ayse').create('ayse', 'Ayşe K.', input({ capacity: 5 }));
    await repo('ali').join(id, 'ali', null);
    await assertSucceeds(createFirestoreEventRepository(fs('ali')).leaveAll('ali'));
    expect((await repo('ayse').get(id))?.attendeeCount).toBe(0);
    await assertSucceeds(repo('ayse').deleteAllOf('ayse'));
    let after: { a?: Record<string, unknown>; d?: boolean } = {};
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      after = { a: (await getDoc(doc(db, 'activities', id))).data(), d: (await getDoc(doc(db, 'activities', id, 'private', 'details'))).exists() };
    });
    expect(after).toMatchObject({ a: { status: 'kaldirildi', organizerName: '' }, d: false });
    // Başkası kaldıramaz.
    const id2 = await repo('veli').create('veli', 'Veli', input());
    const aliDb = fs('ali');
    const b = writeBatch(aliDb);
    b.update(doc(aliDb, 'activities', id2), { status: 'kaldirildi', organizerName: '', updatedAt: Timestamp.now() });
    await assertFails(b.commit());
  });
});
