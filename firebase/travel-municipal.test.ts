import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { SEED_LOCAL, SEED_ROUTES } from '@cityjoy/shared';
import { createFirestoreTravelRepository, createMunicipalTravel, createTravelAdmin } from '@cityjoy/shared/firebase';
import { collection, doc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
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
const now = Timestamp.now();
const nilufer = { id: 'bld-16-nilufer', name: 'Nilüfer Belediyesi', cityId: '16', districtId: '16-nilufer' };

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    const org = (id: string, districtId: string, modules: string[]) =>
      setDoc(doc(db, 'organizations', id), {
        name: id, kind: 'ilce-belediyesi', scope: { level: 'ilce', provinceCode: '16', districtId }, modules,
        officialEmail: 'kalem@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: now, updatedAt: now,
      });
    await org('bld-16-nilufer', '16-nilufer', ['gonderiler', 'seyahat']);
    await org('bld-16-gemlik', '16-gemlik', ['gonderiler']);
    const member = (orgId: string, uid: string, assignments: object) =>
      setDoc(doc(db, 'orgMembers', `${orgId}__${uid}@ornek.com`), {
        orgId, email: `${uid}@ornek.com`, displayName: uid, isOrgAdmin: false, assignments, addedBy: 'eren', updatedAt: now,
      });
    await member('bld-16-nilufer', 'basin', { seyahat: ['goruntule', 'ekle', 'duzenle', 'sil'] });
    await member('bld-16-nilufer', 'fen', { gonderiler: ['goruntule', 'ekle'] });
    await member('bld-16-gemlik', 'gemlik', { gonderiler: ['goruntule', 'ekle'] });
  });
});

const route = {
  theme: 'doga' as const,
  length: 'yarim' as const,
  title: 'Göl Rotası',
  summary: 'Gölyazı ve Uluabat Gölü kıyısında yarım günlük bir rota.',
  durationMinutes: 240,
  stops: [
    { name: 'Gölyazı', note: 'Gün batımında göl kıyısı.', next: { mode: 'araba' as const, text: 'Araçla kısa bir yol' } },
    { name: 'Uluabat Gölü', note: 'Kuş gözlemi.' },
  ],
  tips: [],
  order: 1,
};

describe('seyahat 2. aşama', () => {
  it('rota ve yöresel: başlangıç içeriği taslak, uygulama yalnızca yayındakini görür', async () => {
    const admin = createTravelAdmin(fs('eren'), 'eren');
    const app = createFirestoreTravelRepository(fs('ali'));
    await admin.importSeed();
    expect(await app.listRoutes('16')).toEqual([]);
    expect(await app.listLocal('16')).toEqual([]);
    await admin.setStatus('rota', SEED_ROUTES[0].id, 'yayinda', 'rota');
    await admin.setStatus('yoresel', SEED_LOCAL[0].id, 'yayinda', 'yöresel');
    expect((await app.listRoutes('16')).map((r) => r.id)).toEqual([SEED_ROUTES[0].id]);
    expect((await app.getRoute(SEED_ROUTES[0].id))?.stops.length).toBeGreaterThan(1);
    expect((await app.listLocal('16')).map((x) => x.badges)).toEqual([['UNESCO']]);
    // Sürükleyerek sıralama: yalnızca sıra ve tarih yazılır, kurallardan geçer; uygulama yeni sırayı gösterir.
    await admin.setStatus('rota', SEED_ROUTES[1].id, 'yayinda', 'rota 2');
    const [r1, r2] = (await admin.listAll()).routes.filter((r) => r.status === 'yayinda');
    expect(await admin.reorder('rota', [r2!, r1!], 'Bursa rotaları')).toBe(2);
    expect((await app.listRoutes('16')).map((r) => r.id)).toEqual([r2!.id, r1!.id]);
    const places = (await admin.listAll()).places.filter((p) => p.cityId === '16');
    expect(await admin.reorder('yer', [...places].reverse(), 'Bursa yerleri')).toBeGreaterThan(0);
    await expect(createTravelAdmin(fs('ali'), 'ali').reorder('rota', [r2!, r1!], 'x')).rejects.toThrow();
    // Kullanıcı rota yazamaz.
    await expect(createTravelAdmin(fs('ali'), 'ali').saveRoute(null, { ...route, cityId: '16', status: 'yayinda' })).rejects.toThrow();
  }, 30000);

  it('belediye kendi tanıtımını ve rotasını onaya gönderir, admin yayına alır; yönetici alanlarına dokunamaz', async () => {
    const bld = createMunicipalTravel(fs('basin'), 'basin', nilufer);
    const admin = createTravelAdmin(fs('eren'), 'eren');
    const app = createFirestoreTravelRepository(fs('ali'));

    await bld.saveText({ slogan: 'Modern Bursa', description: 'Göller, köyler ve kültür merkezleriyle Nilüfer.', mayorName: 'Başkan' }, true);
    expect((await bld.get())?.status).toBe('onay-bekliyor');
    const rid = await bld.saveRoute(null, route, true);
    expect((await bld.listRoutes()).map((r) => r.id)).toEqual([rid]);
    expect(await app.listMunicipal('16')).toEqual([]);

    // Belediye yayına alamaz, nüfusu ve başkan adının gösterilmesini değiştiremez.
    await assertFails(updateDoc(doc(fs('basin'), 'travelMunicipal', nilufer.id), { status: 'yayinda', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(fs('basin'), 'travelMunicipal', nilufer.id), { population: 999999, updatedAt: serverTimestamp() }));
    await expect(admin.setStatus('belediye', nilufer.id, 'yayinda', 'Nilüfer')).resolves.toBeUndefined();
    const current = (await admin.listAll()).municipal[0]!;
    const { updatedAt: _u, ...rest } = current;
    await admin.saveMunicipal({ ...rest, population: 560000, populationYear: '2024', zone: 'merkez', showMayor: false }, 'Nilüfer');
    await admin.setStatus('rota', rid, 'yayinda', 'Göl Rotası');
    const list = await app.listMunicipal('16');
    expect(list.map((m) => [m.id, m.population, m.showMayor])).toEqual([[nilufer.id, 560000, false]]);
    expect((await app.listRoutes('16')).map((r) => r.municipalityId)).toEqual([nilufer.id]);

    // Belediye yayındaki tanıtımı değiştirince yeniden onaya düşer; admin alanları korunur.
    await bld.saveText({ slogan: 'Yeşil Nilüfer', description: 'Göller, köyler ve kültür merkezleriyle Nilüfer.' }, true);
    const after = (await admin.listAll()).municipal[0]!;
    expect([after.status, after.population, after.showMayor, after.mayorName]).toEqual(['onay-bekliyor', 560000, false, undefined]);

    // Seyahat görevi olmayan personel ve başka belediye yazamaz; başka ilçenin kimliğiyle de yazılamaz.
    await expect(createMunicipalTravel(fs('fen'), 'fen', nilufer).saveText({ slogan: 'Deneme', description: 'Deneme açıklaması yazısı.' }, true)).rejects.toThrow();
    const gemlik = { id: 'bld-16-gemlik', name: 'Gemlik Belediyesi', cityId: '16', districtId: '16-gemlik' };
    await expect(createMunicipalTravel(fs('gemlik'), 'gemlik', gemlik).saveText({ slogan: 'Zeytin', description: 'Zeytin başkenti Gemlik.' }, true)).rejects.toThrow();
    await expect(createMunicipalTravel(fs('basin'), 'basin', gemlik).saveRoute(null, route, true)).rejects.toThrow();
    // Başka ildeki şehre rota yazılamaz.
    await assertFails(setDoc(doc(collection(fs('basin'), 'travelRoutes')), { ...route, cityId: '34', municipalityId: nilufer.id, status: 'taslak', updatedAt: serverTimestamp() }));
    await assertSucceeds(getDocs(collection(fs('eren'), 'auditLog')));
    const log = await getDocs(collection(fs('eren'), 'auditLog'));
    expect(log.docs.filter((d) => d.data().orgId === nilufer.id).length).toBeGreaterThanOrEqual(3);
  }, 30000);

  it('seyahat bölümü yalnızca belediyeye verilebilir', async () => {
    const kulup = (modules: string[]) => ({
      name: 'Kulüp', kind: 'kulup', scope: { level: 'il', provinceCode: '16' }, modules,
      officialEmail: 'k@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await assertFails(setDoc(doc(fs('eren'), 'organizations', 'krm-kulup'), kulup(['seyahat'])));
    await assertSucceeds(setDoc(doc(fs('eren'), 'organizations', 'krm-kulup'), kulup(['gonderiler'])));
    await assertFails(
      setDoc(doc(fs('eren'), 'organizations', 'krm-kulup2'), {
        name: 'Kulüp', kind: 'kulup', scope: { level: 'il', provinceCode: '16' }, modules: ['seyahat'],
        officialEmail: 'k@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }),
    );
  }, 30000);
});
