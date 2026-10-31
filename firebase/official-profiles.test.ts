import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { orgProfileTarget, type Organization, type ProfileTarget } from '@cityjoy/shared';
import { createFirestoreOfficialProfileRepository, createOfficialProfileAdmin, listAuditLog } from '@cityjoy/shared/firebase';
import { doc, serverTimestamp, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
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

const nilufer = { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' } as const;
const ataevler = { level: 'mahalle', provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' } as const;
const org: Organization = {
  id: 'bld-16-nilufer', name: 'Nilüfer Belediyesi', kind: 'ilce-belediyesi', scope: nilufer, modules: ['gonderiler'],
  officialEmail: 'kalem@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: '',
};
const orgTarget = orgProfileTarget(org);
const muhtarTarget: ProfileTarget = { id: 'mahalle-16-nilufer-ataevler', type: 'muhtar', name: '', region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' } };
const now = Timestamp.now();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    const { id, createdAt: _c, contractEndsAt: _e, ...o } = org;
    await setDoc(doc(db, 'organizations', id), { ...o, createdAt: now, updatedAt: now });
    for (const [uid, isOrgAdmin] of [['kalem', true], ['basin', false]] as const) {
      await setDoc(doc(db, 'orgMembers', `${id}__${uid}@ornek.com`), {
        orgId: id, email: `${uid}@ornek.com`, displayName: uid, isOrgAdmin, assignments: { gonderiler: ['goruntule', 'ekle'] }, addedBy: 'eren', updatedAt: now,
      });
    }
    await setDoc(doc(db, 'grants', 'muhtar@ornek.com__mahalle-16-nilufer-ataevler'), {
      email: 'muhtar@ornek.com', displayName: 'Muhtar', role: 'muhtar', scope: ataevler, modules: { gonderiler: ['goruntule', 'ekle'] }, grantedBy: 'eren', grantedAt: now, updatedAt: now,
    });
    await setDoc(doc(db, 'grants', 'eski@ornek.com__mahalle-16-nilufer-ataevler'), {
      email: 'eski@ornek.com', displayName: 'Eski', role: 'muhtar', scope: ataevler, modules: { gonderiler: ['goruntule'] }, grantedBy: 'eren', grantedAt: now, updatedAt: now,
      revokedAt: now, revokedBy: 'eren',
    });
  });
});

const media = (uid: string, kind: string, id = 'abcDEF123456') => {
  const p = `media/${uid}/${kind}/${id}.jpg`;
  return { path: p, url: `http://127.0.0.1:9199/v0/b/demo-cityjoy.appspot.com/o/${p.replaceAll('/', '%2F')}?alt=media&token=t`, width: 800, height: 600 };
};

const info = { about: 'Nilüfer ilçesinin belediyesi.', phone: '0224 123 45 67', email: 'Bilgi@Nilufer.bel.tr', website: 'https://nilufer.bel.tr', hours: 'Hafta içi 08.30-17.30' };

describe('resmî profiller', () => {
  it('kurum yöneticisi kendi kurumunun profilini yazar, herkes (girişsiz) okur, işlem kaydına geçer', async () => {
    await assertSucceeds(createOfficialProfileAdmin(fs('kalem'), 'kalem').save(orgTarget, info));
    const p = await createFirestoreOfficialProfileRepository(guest()).get(org.id);
    expect(p).toMatchObject({ type: 'kurum', name: 'Nilüfer Belediyesi', email: 'bilgi@nilufer.bel.tr', region: { provinceCode: '16', districtId: '16-nilufer' } });
    const log = await listAuditLog(fs('eren'));
    expect(log.some((e) => e.targetId === org.id && e.module === 'kurumlar')).toBe(true);
  });

  it('personel, başka kişi ve yanlış ad / bölge yazamaz; admin yazar', async () => {
    await assertFails(createOfficialProfileAdmin(fs('basin'), 'basin').save(orgTarget, info));
    await assertFails(createOfficialProfileAdmin(fs('muhtar'), 'muhtar').save(orgTarget, info));
    await assertFails(createOfficialProfileAdmin(fs('kalem'), 'kalem').save({ ...orgTarget, name: 'Nilüfer Belediyesi Resmî' }, info));
    await assertFails(createOfficialProfileAdmin(fs('kalem'), 'kalem').save({ ...orgTarget, region: { provinceCode: '16' } }, info));
    await assertSucceeds(createOfficialProfileAdmin(fs('eren'), 'eren').save(orgTarget, { phone: '0224 000 00 00' }));
  });

  it('geçersiz alan reddedilir (http, bozuk telefon)', async () => {
    const db = fs('kalem');
    const base = { type: 'kurum', name: org.name, region: { provinceCode: '16', districtId: '16-nilufer' }, updatedBy: 'kalem', updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db, 'officialProfiles', org.id), { ...base, website: 'https://nilufer.bel.tr' }));
    await assertFails(setDoc(doc(db, 'officialProfiles', org.id), { ...base, website: 'http://nilufer.bel.tr' }));
    await assertFails(setDoc(doc(db, 'officialProfiles', org.id), { ...base, phone: 'beni ara' }));
    await assertFails(setDoc(doc(db, 'officialProfiles', org.id), { ...base, logo: 'x' }));
  });

  it('logo: yalnızca kendi yüklediği görsel bağlanır; başka yetkili değiştirmeden kaydedebilir', async () => {
    await assertFails(createOfficialProfileAdmin(fs('kalem'), 'kalem').save(orgTarget, { ...info, logo: media('baskasi', 'kurum') }));
    await assertFails(createOfficialProfileAdmin(fs('kalem'), 'kalem').save(orgTarget, { ...info, logo: media('kalem', 'etkinlik') }));
    await assertSucceeds(createOfficialProfileAdmin(fs('kalem'), 'kalem').save(orgTarget, { ...info, logo: media('kalem', 'kurum') }));
    expect((await createFirestoreOfficialProfileRepository(guest()).get(org.id))?.logo?.path).toBe('media/kalem/kurum/abcDEF123456.jpg');
    await assertSucceeds(createOfficialProfileAdmin(fs('eren'), 'eren').save(orgTarget, { ...info, logo: media('kalem', 'kurum'), hours: 'Her gün' }));
  });

  it('muhtar kendi mahallesinin profilini yazar; geri alınmış yetki ve başka mahalle yazamaz', async () => {
    await assertSucceeds(createOfficialProfileAdmin(fs('muhtar'), 'muhtar').save(muhtarTarget, { name: 'Ayşe Yılmaz', phone: '0532 000 00 00', hours: 'Hafta içi 09.00-17.00' }));
    expect(await createFirestoreOfficialProfileRepository(guest()).get(muhtarTarget.id)).toMatchObject({ type: 'muhtar', name: 'Ayşe Yılmaz' });
    await assertFails(createOfficialProfileAdmin(fs('eski'), 'eski').save(muhtarTarget, { name: 'Eski Muhtar' }));
    await assertFails(
      createOfficialProfileAdmin(fs('muhtar'), 'muhtar').save(
        { ...muhtarTarget, id: 'mahalle-16-nilufer-baska', region: { ...muhtarTarget.region!, neighbourhoodId: '16-nilufer-baska' } },
        { name: 'X' },
      ),
    );
    await assertFails(createOfficialProfileAdmin(fs('kalem'), 'kalem').save(muhtarTarget, { name: 'X' }));
  });
});
