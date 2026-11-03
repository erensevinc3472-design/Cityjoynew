import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ageBandOf, dayKey, mayorProfileTarget, type Organization, type UserProfile } from '@cityjoy/shared';
import { createFirestoreOfficialFollowRepository, createOfficialProfileAdmin, getOfficialStats } from '@cityjoy/shared/firebase';
import { doc, getDoc, increment, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
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

const osmangazi = { level: 'ilce', provinceCode: '16', districtId: '16-osmangazi' } as const;
const org: Organization = {
  id: 'bld-16-osmangazi', name: 'Osmangazi Belediyesi', kind: 'ilce-belediyesi', scope: osmangazi, modules: ['gonderiler', 'istatistik', 'baskan'],
  officialEmail: 'kalem@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: '',
};
const alipasa = { provinceCode: '16', districtId: '16-osmangazi', neighbourhoodId: '16-osmangazi-alipasa' };
const ataevler = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
const now = Timestamp.now();

const person = (uid: string, location?: typeof alipasa, birthYear = 1990): Pick<UserProfile, 'uid' | 'location' | 'birthYear'> => ({ uid, location, birthYear });

async function seedUser(uid: string, location?: typeof alipasa, birthYear = 1990) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), {
      uid, displayName: uid, language: 'tr', birthYear, isPrivate: false, phoneVerified: false, emailVerified: false,
      ...(location ? { location } : {}), consents: {}, createdAt: now, updatedAt: now,
    });
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    const { id, createdAt: _c, contractEndsAt: _e, ...o } = org;
    await setDoc(doc(db, 'organizations', id), { ...o, createdAt: now, updatedAt: now });
    const members = [
      ['kalem', true, {}],
      ['analiz', false, { istatistik: ['goruntule'] }],
      ['ozelkalem', false, { baskan: ['goruntule', 'duzenle'] }],
      ['basin', false, { gonderiler: ['goruntule', 'ekle'] }],
    ] as const;
    for (const [uid, isOrgAdmin, assignments] of members) {
      await setDoc(doc(db, 'orgMembers', `${id}__${uid}@ornek.com`), {
        orgId: id, email: `${uid}@ornek.com`, displayName: uid, isOrgAdmin, assignments, addedBy: 'eren', updatedAt: now,
      });
    }
    await setDoc(doc(db, 'officialProfiles', id), { type: 'kurum', name: org.name, region: { provinceCode: '16', districtId: '16-osmangazi' }, updatedBy: 'eren', updatedAt: now });
  });
  await seedUser('ayse', alipasa, 1990);
  await seedUser('mehmet', ataevler, 2003);
  await seedUser('konumsuz', undefined, 1960);
});

describe('resmî hesap takibi', () => {
  it('takip kişinin kayıtlı mahallesine ve yaşına sayılır; takipten çıkınca düşer', async () => {
    await assertSucceeds(createFirestoreOfficialFollowRepository(fs('ayse')).follow(org.id, person('ayse', alipasa)));
    await assertSucceeds(createFirestoreOfficialFollowRepository(fs('mehmet')).follow(org.id, person('mehmet', ataevler, 2003)));
    await assertSucceeds(createFirestoreOfficialFollowRepository(fs('konumsuz')).follow(org.id, person('konumsuz', undefined, 1960)));
    let s = await getOfficialStats(fs('kalem'), org.id);
    expect(s.total).toBe(3);
    expect(s.p).toEqual({ '16': 2 });
    expect(s.d).toEqual({ '16-osmangazi': 1, '16-nilufer': 1 });
    expect(s.n).toEqual({ '16-osmangazi-alipasa': 1, '16-nilufer-ataevler': 1 });
    expect(s.a).toEqual({ '35-44': 1, [ageBandOf(2003)]: 1, '55+': 1 });
    expect(s.f[dayKey()]).toBe(3);

    await assertSucceeds(createFirestoreOfficialFollowRepository(fs('mehmet')).unfollow(org.id, 'mehmet'));
    s = await getOfficialStats(fs('kalem'), org.id);
    expect(s.total).toBe(2);
    expect(s.unfollows).toBe(1);
    expect(s.u[dayKey()]).toBe(1);
    expect(s.n['16-nilufer-ataevler']).toBe(0);
  });

  it('kayıtlı konumdan farklı mahalle, sahte yaş ya da sayaçsız takip reddedilir', async () => {
    const db = fs('ayse');
    await assertFails(createFirestoreOfficialFollowRepository(db).follow(org.id, person('ayse', ataevler)));
    await assertFails(createFirestoreOfficialFollowRepository(db).follow(org.id, person('ayse', alipasa, 2000)));
    await assertFails(setDoc(doc(db, 'officialFollows', `ayse__${org.id}`), { uid: 'ayse', profileId: org.id, ...alipasa, ageBand: '35-44', createdAt: serverTimestamp() }));
    // Olmayan profil takip edilemez.
    await assertFails(createFirestoreOfficialFollowRepository(db).follow('bld-16-yok', person('ayse', alipasa)));
  });

  it('sayaç elle şişirilemez', async () => {
    const db = fs('ayse');
    await assertSucceeds(createFirestoreOfficialFollowRepository(db).follow(org.id, person('ayse', alipasa)));
    await assertFails(updateDoc(doc(db, 'officialStats', org.id), { total: increment(5), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'officialStats', org.id), { n: { '16-osmangazi-alipasa': increment(1) }, updatedAt: serverTimestamp() }, { merge: true }));
    // Takip kaydı değişmeden yalnızca zaman yazılırsa sayılar aynı kalmalı (zararsız).
    await assertSucceeds(setDoc(doc(db, 'officialStats', org.id), { updatedAt: serverTimestamp() }, { merge: true }));
    // İkinci kez takip (aynı kayıt) sayacı artıramaz.
    const batch = writeBatch(db);
    batch.set(doc(db, 'officialStats', org.id), { total: increment(1), updatedAt: serverTimestamp() }, { merge: true });
    await assertFails(batch.commit());
  });

  it('mahalle değişince sayılar eski mahalleden yenisine taşınır', async () => {
    await createFirestoreOfficialFollowRepository(fs('ayse')).follow(org.id, person('ayse', alipasa));
    await seedUser('ayse', ataevler, 1990);
    // Eski konumla taşıma denemesi kurala takılır; güncel konumla geçer.
    await assertSucceeds(createFirestoreOfficialFollowRepository(fs('ayse')).reconcile(person('ayse', ataevler)));
    const s = await getOfficialStats(fs('kalem'), org.id);
    expect(s.total).toBe(1);
    expect(s.n).toEqual({ '16-osmangazi-alipasa': 0, '16-nilufer-ataevler': 1 });
    expect(s.d).toEqual({ '16-osmangazi': 0, '16-nilufer': 1 });
    expect(s.p).toEqual({ '16': 1 });
    expect(s.f[dayKey()]).toBe(1);
  });

  it('takip kaydını yalnızca kişi görür; sayaçları kurum yöneticisi, görevli personel ve admin görür', async () => {
    await createFirestoreOfficialFollowRepository(fs('ayse')).follow(org.id, person('ayse', alipasa));
    await assertSucceeds(getDoc(doc(fs('ayse'), 'officialFollows', `ayse__${org.id}`)));
    await assertFails(getDoc(doc(fs('kalem'), 'officialFollows', `ayse__${org.id}`)));
    await assertSucceeds(getOfficialStats(fs('kalem'), org.id));
    await assertSucceeds(getOfficialStats(fs('analiz'), org.id));
    await assertSucceeds(getOfficialStats(fs('eren'), org.id));
    await assertFails(getOfficialStats(fs('basin'), org.id));
    await assertFails(getOfficialStats(fs('ayse'), org.id));
  });
});

describe('belediye başkanı', () => {
  const target = mayorProfileTarget(org)!;

  it('başkan profilini kurum yöneticisi ve başkan bölümündeki görevli yazar, diğer personel yazamaz', async () => {
    await assertSucceeds(createOfficialProfileAdmin(fs('kalem'), 'kalem').save(target, { name: 'Erkan Aydın', about: 'Osmangazi Belediye Başkanı' }));
    await assertSucceeds(createOfficialProfileAdmin(fs('ozelkalem'), 'ozelkalem').save(target, { name: 'Erkan Aydın' }));
    await assertFails(createOfficialProfileAdmin(fs('basin'), 'basin').save(target, { name: 'Erkan Aydın' }));
    await assertFails(createOfficialProfileAdmin(fs('kalem'), 'kalem').save({ ...target, region: { provinceCode: '34' } }, { name: 'Erkan Aydın' }));
  });

  it('başkanın istatistiğini yalnızca başkan bölümünde görevli kişiler görür (admin ve kurum yöneticisi değil)', async () => {
    await createOfficialProfileAdmin(fs('kalem'), 'kalem').save(target, { name: 'Erkan Aydın' });
    await assertSucceeds(createFirestoreOfficialFollowRepository(fs('ayse')).follow(target.id, person('ayse', alipasa)));
    expect((await getOfficialStats(fs('ozelkalem'), target.id)).total).toBe(1);
    await assertFails(getOfficialStats(fs('kalem'), target.id));
    await assertFails(getOfficialStats(fs('analiz'), target.id));
    await assertFails(getOfficialStats(fs('eren'), target.id));
  });

  it('başkan bölümü yalnızca belediyelere verilir', async () => {
    const db = fs('eren');
    await assertFails(setDoc(doc(db, 'organizations', 'krm-16-valilik'), {
      name: 'Bursa Valiliği', kind: 'kurum', scope: { level: 'il', provinceCode: '16' }, modules: ['baskan'], officialEmail: 'v@ornek.com',
      status: 'aktif', createdBy: 'eren', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(setDoc(doc(db, 'organizations', 'krm-16-valilik'), {
      name: 'Bursa Valiliği', kind: 'kurum', scope: { level: 'il', provinceCode: '16' }, modules: ['istatistik'], officialEmail: 'v@ornek.com',
      status: 'aktif', createdBy: 'eren', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  });
});
