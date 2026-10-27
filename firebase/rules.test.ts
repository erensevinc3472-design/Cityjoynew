import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

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

const thisYear = new Date().getFullYear();
const consent = { granted: true, at: '2026-10-27T10:00:00Z', textVersion: 'taslak-1' };

function profile(uid: string, over: Record<string, unknown> = {}) {
  return {
    uid,
    displayName: 'Eren Deneme',
    language: 'tr',
    birthYear: thisYear - 30,
    occupationId: 'ogretmen',
    phoneVerified: false,
    emailVerified: false,
    isPrivate: false,
    consents: { terms: consent, privacyNotice: consent },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...over,
  };
}

const db = (uid?: string) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe('users', () => {
  it('kullanıcı kendi profilini oluşturur, okur ve siler', async () => {
    await assertSucceeds(setDoc(doc(db('ali'), 'users/ali'), profile('ali')));
    await assertSucceeds(getDoc(doc(db('ali'), 'users/ali')));
    await assertSucceeds(deleteDoc(doc(db('ali'), 'users/ali')));
  });

  it('başkasının profilini okuyamaz ve yazamaz; girişsiz erişim yok', async () => {
    await seed('users/ali', profile('ali', { createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
    await assertFails(getDoc(doc(db('veli'), 'users/ali')));
    await assertFails(getDoc(doc(db(), 'users/ali')));
    await assertFails(setDoc(doc(db('veli'), 'users/veli2'), profile('veli2')));
  });

  it('13 yaş altı kayıt olamaz; 13-17 yaş gizli hesap ve kampanya izni yok', async () => {
    await assertFails(setDoc(doc(db('cocuk'), 'users/cocuk'), profile('cocuk', { birthYear: thisYear - 10 })));
    await assertFails(setDoc(doc(db('genc'), 'users/genc'), profile('genc', { birthYear: thisYear - 15 })));
    await assertSucceeds(setDoc(doc(db('genc'), 'users/genc'), profile('genc', { birthYear: thisYear - 15, isPrivate: true })));
    await assertFails(
      updateDoc(doc(db('genc'), 'users/genc'), {
        'consents.commercialMessages': consent,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('kullanım şartları ve aydınlatma metni onayı zorunlu', async () => {
    await assertFails(
      setDoc(doc(db('ali'), 'users/ali'), profile('ali', { consents: { terms: { ...consent, granted: false }, privacyNotice: consent } })),
    );
    await assertFails(setDoc(doc(db('ali'), 'users/ali'), profile('ali', { consents: { terms: consent } })));
  });

  it('doğrulama durumları, doğum yılı ve bilinmeyen alanlar istemciden değiştirilemez', async () => {
    await assertFails(setDoc(doc(db('ali'), 'users/ali'), profile('ali', { phoneVerified: true })));
    await assertFails(setDoc(doc(db('ali'), 'users/ali'), profile('ali', { role: 'admin' })));
    await assertSucceeds(setDoc(doc(db('ali'), 'users/ali'), profile('ali')));
    await assertFails(updateDoc(doc(db('ali'), 'users/ali'), { birthYear: thisYear - 40, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('ali'), 'users/ali'), { emailVerified: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('ali'), 'users/ali'), { gender: 'erkek', updatedAt: serverTimestamp() }));
  });

  it('konum biçimi denetlenir; mahalle ayda bir kez değişir, ilk seçim serbest', async () => {
    const ref = doc(db('ali'), 'users/ali');
    await assertSucceeds(setDoc(ref, profile('ali')));
    await assertFails(updateDoc(ref, { location: { provinceCode: '16', districtId: '34-kadikoy' }, updatedAt: serverTimestamp() }));
    const first = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
    await assertSucceeds(updateDoc(ref, { location: first, locationChangedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    const second = { ...first, neighbourhoodId: '16-nilufer-beşevler' };
    await assertFails(updateDoc(ref, { location: second, locationChangedAt: serverTimestamp(), updatedAt: serverTimestamp() }));

    // 31 gün önce değiştirilmiş gibi.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users/ali'), { locationChangedAt: Timestamp.fromMillis(Date.now() - 31 * 864e5) });
    });
    await assertSucceeds(updateDoc(ref, { location: second, locationChangedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
});

describe('occupations, admins, auditLog', () => {
  const occupation = (uid: string) => ({ names: { tr: 'Öğretmen' }, order: 1, active: true, updatedBy: uid, updatedAt: serverTimestamp() });

  it('meslek listesini herkes okur, yalnızca admin yazar, kimse silemez', async () => {
    await seed('admins/eren', { addedAt: 'konsol' });
    await assertSucceeds(getDoc(doc(db(), 'occupations/ogretmen')));
    await assertFails(setDoc(doc(db('ali'), 'occupations/ogretmen'), occupation('ali')));
    await assertSucceeds(setDoc(doc(db('eren'), 'occupations/ogretmen'), occupation('eren')));
    await assertFails(deleteDoc(doc(db('eren'), 'occupations/ogretmen')));
  });

  it('acil numaraları girişsiz herkes okur, yalnızca admin geçerli kayıt yazar, kimse silemez', async () => {
    await seed('admins/eren', { addedAt: 'konsol' });
    const entry = (uid: string, over: Record<string, unknown> = {}) => ({
      number: '112', names: { tr: 'Acil', en: 'Emergency' }, icon: 'emergency', order: 1, active: true,
      updatedBy: uid, updatedAt: serverTimestamp(), ...over,
    });
    await assertSucceeds(getDoc(doc(db(), 'emergencyNumbers/112')));
    await assertFails(setDoc(doc(db('ali'), 'emergencyNumbers/112'), entry('ali')));
    await assertSucceeds(setDoc(doc(db('eren'), 'emergencyNumbers/112'), entry('eren')));
    await assertFails(setDoc(doc(db('eren'), 'emergencyNumbers/112'), entry('eren', { number: '11a2' })));
    await assertFails(setDoc(doc(db('eren'), 'emergencyNumbers/112'), entry('eren', { names: { en: 'No Turkish' } })));
    await assertFails(setDoc(doc(db('eren'), 'emergencyNumbers/112'), entry('eren', { extra: 1 })));
    await assertFails(deleteDoc(doc(db('eren'), 'emergencyNumbers/112')));
  });

  it('hizmet kategorileri: herkes okur, yalnızca admin iki seviyeli ağaç yazar', async () => {
    await seed('admins/eren', { addedAt: 'konsol' });
    const c = (uid: string, parentId: string | null, over: Record<string, unknown> = {}) => ({
      parentId, names: { tr: 'Kategori' }, icon: 'build', order: 1, active: true, updatedBy: uid, updatedAt: serverTimestamp(), ...over,
    });
    await assertSucceeds(getDoc(doc(db(), 'serviceCategories/ev')));
    await assertFails(setDoc(doc(db('ali'), 'serviceCategories/ev'), c('ali', null)));
    await assertSucceeds(setDoc(doc(db('eren'), 'serviceCategories/ev'), c('eren', null)));
    await assertSucceeds(setDoc(doc(db('eren'), 'serviceCategories/cilingir'), c('eren', 'ev', { urgent: true })));
    // Üstü olmayan ya da üçüncü seviye kategori kurulamaz.
    await assertFails(setDoc(doc(db('eren'), 'serviceCategories/x'), c('eren', 'yok')));
    await assertFails(setDoc(doc(db('eren'), 'serviceCategories/y'), c('eren', 'cilingir')));
    await assertFails(deleteDoc(doc(db('eren'), 'serviceCategories/ev')));
    await assertSucceeds(getDoc(doc(db(), 'catalogVersions/serviceCategories')));
    await assertFails(setDoc(doc(db('ali'), 'catalogVersions/serviceCategories'), { updatedAt: serverTimestamp(), updatedBy: 'ali' }));
  });

  it('hizmet önerisi: giriş yapan kendi adına gönderir, yalnızca admin okur ve incelendi yapar', async () => {
    await seed('admins/eren', { addedAt: 'konsol' });
    const s = (uid: string, over: Record<string, unknown> = {}) => ({ uid, text: 'Kilim tamiri', provinceCode: '16', status: 'yeni', createdAt: serverTimestamp(), ...over });
    await assertFails(setDoc(doc(db(), 'serviceSuggestions/0'), s('misafir')));
    await assertFails(setDoc(doc(db('ali'), 'serviceSuggestions/1'), s('veli')));
    await assertFails(setDoc(doc(db('ali'), 'serviceSuggestions/1'), s('ali', { text: 'x' })));
    await assertFails(setDoc(doc(db('ali'), 'serviceSuggestions/1'), s('ali', { status: 'incelendi' })));
    await assertSucceeds(setDoc(doc(db('ali'), 'serviceSuggestions/1'), s('ali')));
    await assertFails(getDoc(doc(db('ali'), 'serviceSuggestions/1')));
    await assertSucceeds(getDoc(doc(db('eren'), 'serviceSuggestions/1')));
    await assertFails(updateDoc(doc(db('eren'), 'serviceSuggestions/1'), { text: 'değişti' }));
    await assertSucceeds(updateDoc(doc(db('eren'), 'serviceSuggestions/1'), { status: 'incelendi', reviewedBy: 'eren', reviewedAt: serverTimestamp() }));
  });

  it('işletme: sahibi bilgilerini yazar ama doğrulama, kademe, puan ve öne çıkmayı değiştiremez', async () => {
    await seed('admins/eren', { addedAt: 'konsol' });
    const content = {
      type: 'hizmet', name: 'Ali Tesisat', categoryIds: ['tesisatci'], location: { provinceCode: '16', districtId: '16-nilufer' },
      phone: '05321234567', whatsapp: true, is24h: false, priceList: [],
    };
    const fresh = (uid: string, over: Record<string, unknown> = {}) => ({
      ...content, ownerUid: uid, status: 'yayinda', verification: { status: 'dogrulanmadi' }, membership: { tier: 'ucretsiz' },
      rating: { sum: 0, count: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...over,
    });
    await assertFails(setDoc(doc(db(), 'businesses/b1'), fresh('misafir')));
    await assertFails(setDoc(doc(db('ali'), 'businesses/b1'), fresh('veli')));
    await assertFails(setDoc(doc(db('ali'), 'businesses/b1'), fresh('ali', { verification: { status: 'dogrulandi' } })));
    await assertFails(setDoc(doc(db('ali'), 'businesses/b1'), fresh('ali', { membership: { tier: 'premium' } })));
    await assertFails(setDoc(doc(db('ali'), 'businesses/b1'), fresh('ali', { rating: { sum: 500, count: 100 } })));
    await assertFails(setDoc(doc(db('ali'), 'businesses/b1'), fresh('ali', { type: 'evden-uretim', address: 'Ev adresim' })));
    // Telefon kaydı olmadan işletme açılamaz; telefon başkasınınsa da açılamaz.
    await assertFails(setDoc(doc(db('ali'), 'businesses/b1'), fresh('ali')));
    const create = (uid: string, id: string) => {
      const f = db(uid);
      const b = writeBatch(f);
      b.set(doc(f, `businesses/${id}`), fresh(uid));
      b.set(doc(f, 'businessPhones/05321234567'), { businessId: id, ownerUid: uid });
      return b.commit();
    };
    await assertSucceeds(create('ali', 'b1'));
    await assertFails(create('veli', 'b2'));

    await assertSucceeds(getDoc(doc(db(), 'businesses/b1')));
    await assertSucceeds(updateDoc(doc(db('ali'), 'businesses/b1'), { name: 'Ali Usta Tesisat', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('ali'), 'businesses/b1'), { featuredUntil: Timestamp.now(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('ali'), 'businesses/b1'), { 'verification.status': 'dogrulandi', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('veli'), 'businesses/b1'), { name: 'Başkası', updatedAt: serverTimestamp() }));

    // Gizlenen işletmeyi yalnızca sahibi ve admin görür.
    await assertSucceeds(updateDoc(doc(db('ali'), 'businesses/b1'), { status: 'gizli', updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(db('veli'), 'businesses/b1')));
    await assertSucceeds(getDoc(doc(db('eren'), 'businesses/b1')));

    // Admin doğrular ve kaldırır ama bilgileri değiştiremez; kaldırılanı sahibi açamaz.
    await assertSucceeds(updateDoc(doc(db('eren'), 'businesses/b1'), { verification: { status: 'dogrulandi', verifiedAt: serverTimestamp() } }));
    await assertFails(updateDoc(doc(db('eren'), 'businesses/b1'), { name: 'Admin yazdı' }));
    await assertSucceeds(updateDoc(doc(db('eren'), 'businesses/b1'), { status: 'kaldirildi' }));
    await assertFails(updateDoc(doc(db('ali'), 'businesses/b1'), { status: 'yayinda', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db('veli'), 'businesses/b1')));
    const aliDb = db('ali');
    const del = writeBatch(aliDb);
    del.delete(doc(aliDb, 'businesses/b1'));
    del.delete(doc(aliDb, 'businessPhones/05321234567'));
    await assertSucceeds(del.commit());
  });

  it('değerlendirme: arama şartı, kişi başına bir, puan toplamı elle şişirilemez, sahibi kendine yazamaz', async () => {
    await seed('businesses/b1', {
      type: 'hizmet', name: 'Ali Tesisat', categoryIds: ['tesisatci'], location: { provinceCode: '16', districtId: '16-nilufer' },
      phone: '05321234567', whatsapp: true, is24h: false, priceList: [], ownerUid: 'ali', status: 'yayinda',
      verification: { status: 'dogrulanmadi' }, membership: { tier: 'ucretsiz' }, rating: { sum: 8, count: 2 },
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    const review = (stars: number) => ({ uid: 'ayse', stars, text: 'Zamanında geldi, temiz çalıştı.', authorName: 'Ayşe K.', status: 'yayinda', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    const write = (uid: string, stars: number, rating: { sum: number; count: number }) => {
      const f = db(uid);
      const b = writeBatch(f);
      b.set(doc(f, `businesses/b1/reviews/${uid}`), { ...review(stars), uid });
      b.update(doc(f, 'businesses/b1'), { rating });
      return b.commit();
    };
    // Henüz yorum yokken "var mı?" okuması reddedilmez.
    await assertSucceeds(getDoc(doc(db('ayse'), 'businesses/b1/reviews/ayse')));
    // Arama kaydı yoksa yazamaz.
    await assertFails(write('ayse', 5, { sum: 13, count: 3 }));
    await assertSucceeds(setDoc(doc(db('ayse'), 'contacts/b1_ayse'), { uid: 'ayse', businessId: 'b1', at: serverTimestamp() }));
    await assertFails(setDoc(doc(db('ayse'), 'contacts/b1_veli'), { uid: 'ayse', businessId: 'b1', at: serverTimestamp() }));
    // Puan toplamı yanlışsa ya da hiç güncellenmezse yazamaz.
    await assertFails(write('ayse', 5, { sum: 50, count: 3 }));
    await assertFails(setDoc(doc(db('ayse'), 'businesses/b1/reviews/ayse'), review(5)));
    await assertSucceeds(write('ayse', 5, { sum: 13, count: 3 }));
    // Puanı tek başına şişiremez.
    await assertFails(updateDoc(doc(db('ayse'), 'businesses/b1'), { rating: { sum: 100, count: 3 } }));
    // Sahibi kendine yazamaz (arama kaydı olsa bile).
    await seed('contacts/b1_ali', { uid: 'ali', businessId: 'b1', at: Timestamp.now() });
    await assertFails(write('ali', 5, { sum: 18, count: 4 }));
    // Sahibi cevap yazar ama yıldızı değiştiremez.
    await assertSucceeds(updateDoc(doc(db('ali'), 'businesses/b1/reviews/ayse'), { reply: { text: 'Teşekkürler!', at: serverTimestamp() } }));
    await assertFails(updateDoc(doc(db('ali'), 'businesses/b1/reviews/ayse'), { stars: 1 }));
    // Yazan siler, puan birlikte düşer.
    const ayseDb = db('ayse');
    const del = writeBatch(ayseDb);
    del.delete(doc(ayseDb, 'businesses/b1/reviews/ayse'));
    del.update(doc(ayseDb, 'businesses/b1'), { rating: { sum: 8, count: 2 } });
    await assertFails(deleteDoc(doc(db('ayse'), 'businesses/b1/reviews/ayse')));
    await assertSucceeds(del.commit());
    // Şikâyet: kişi başına bir, kendi yorumunu şikâyet edemez.
    const rep = (reporter: string, over: Record<string, unknown> = {}) => ({ businessId: 'b1', reviewUid: 'ayse', reporterUid: reporter, reason: 'hakaret', status: 'yeni', createdAt: serverTimestamp(), ...over });
    await assertSucceeds(setDoc(doc(db('veli'), 'reviewReports/b1_ayse_veli'), rep('veli')));
    await assertFails(setDoc(doc(db('veli'), 'reviewReports/baska'), rep('veli')));
    await assertFails(setDoc(doc(db('ayse'), 'reviewReports/b1_ayse_ayse'), rep('ayse')));
    await assertFails(getDoc(doc(db('veli'), 'reviewReports/b1_ayse_veli')));
  });

  it('aile: davetle karşılıklı bağ; kullanılmış/süresi dolmuş davet olmaz; bağı iki taraf da siler', async () => {
    const invite = (from: string, over: Record<string, unknown> = {}) => ({
      fromUid: from, fromName: 'Ali', createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 3600_000), ...over,
    });
    await assertFails(setDoc(doc(db('ali'), 'familyInvites/ABCDEFGH'), invite('ali', { expiresAt: Timestamp.fromMillis(Date.now() + 48 * 3600_000) })));
    await assertFails(setDoc(doc(db('ali'), 'familyInvites/ABCDEFGH'), invite('veli')));
    await assertSucceeds(setDoc(doc(db('ali'), 'familyInvites/ABCDEFGH'), invite('ali')));
    const accept = (uid: string, code = 'ABCDEFGH', other = 'ali') => {
      const f = db(uid);
      const [a, b] = [uid, other].sort();
      const batch = writeBatch(f);
      batch.update(doc(f, `familyInvites/${code}`), { usedBy: uid, usedAt: serverTimestamp() });
      batch.set(doc(f, `familyLinks/${a}_${b}`), { members: [a, b], names: { [uid]: 'X', [other]: 'Ali' }, inviteCode: code, createdAt: serverTimestamp() });
      return batch.commit();
    };
    // Davetsiz bağ kurulamaz; kendi davetini kabul edemez.
    await assertFails(setDoc(doc(db('ayse'), 'familyLinks/ali_ayse'), { members: ['ali', 'ayse'], names: {}, inviteCode: 'ZZZZZZZZ', createdAt: serverTimestamp() }));
    await assertFails(accept('ali', 'ABCDEFGH', 'ali'));
    await assertSucceeds(accept('ayse'));
    // Kullanılmış davet ikinci kez kullanılamaz.
    await assertFails(accept('veli'));
    // Süresi dolmuş davet.
    await seed('familyInvites/EXPRDCDE', { fromUid: 'ali', fromName: 'Ali', createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await assertFails(accept('veli', 'EXPRDCDE'));
    // Bağı yalnızca iki taraf görür; ikisi de silebilir.
    await assertSucceeds(getDoc(doc(db('ayse'), 'familyLinks/ali_ayse')));
    await assertFails(getDoc(doc(db('veli'), 'familyLinks/ali_ayse')));
    await assertFails(deleteDoc(doc(db('veli'), 'familyLinks/ali_ayse')));
    await assertSucceeds(deleteDoc(doc(db('ayse'), 'familyLinks/ali_ayse')));
  });

  it('SOS: yalnızca aile üyelerine; yabancıya ve 10 kişiden fazlasına gönderilemez; alıcı yalnızca kendi işaretini koyar; admin göremez', async () => {
    await seed('admins/eren', { addedAt: 'konsol' });
    const family = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'];
    for (const m of family) {
      const [a, b] = ['ali', m].sort();
      await seed(`familyLinks/${a}_${b}`, { members: [a, b], names: {}, inviteCode: 'X', createdAt: Timestamp.now() });
    }
    const alert = (recipients: string[], over: Record<string, unknown> = {}) => ({
      fromUid: 'ali', fromName: 'Ali', recipients, test: false, status: 'aktif',
      location: { lat: 40.19, lng: 29.06, accuracy: 12, at: serverTimestamp() },
      createdAt: serverTimestamp(), liveUntil: Timestamp.fromMillis(Date.now() + 30 * 60_000),
      deleteAt: Timestamp.fromMillis(Date.now() + 30 * 86400_000), deliveredTo: {}, seenBy: {}, ...over,
    });
    await assertFails(setDoc(doc(db('ali'), 'sosAlerts/s0'), alert(['b1', 'yabanci'])));
    await assertFails(setDoc(doc(db('ali'), 'sosAlerts/s0'), alert(family)));
    await assertFails(setDoc(doc(db('ali'), 'sosAlerts/s0'), alert(['b1'], { liveUntil: Timestamp.fromMillis(Date.now() + 5 * 3600_000) })));
    await assertSucceeds(setDoc(doc(db('ali'), 'sosAlerts/s1'), alert(family.slice(0, 10))));
    await assertSucceeds(setDoc(doc(db('ali'), 'sosAlerts/s2'), alert(['b1', 'b2'])));

    await assertSucceeds(getDoc(doc(db('b1'), 'sosAlerts/s2')));
    await assertFails(getDoc(doc(db('b3'), 'sosAlerts/s2')));
    await assertFails(getDoc(doc(db('eren'), 'sosAlerts/s2')));
    await assertSucceeds(updateDoc(doc(db('b1'), 'sosAlerts/s2'), { 'deliveredTo.b1': serverTimestamp(), 'seenBy.b1': serverTimestamp() }));
    await assertFails(updateDoc(doc(db('b1'), 'sosAlerts/s2'), { 'seenBy.b2': serverTimestamp() }));
    await assertFails(updateDoc(doc(db('b1'), 'sosAlerts/s2'), { status: 'bitti' }));
    await assertSucceeds(updateDoc(doc(db('ali'), 'sosAlerts/s2'), { status: 'guvende' }));
    await assertSucceeds(updateDoc(doc(db('ali'), 'sosAlerts/s2'), { location: { lat: 40.2, lng: 29.1, at: serverTimestamp() } }));
    await assertFails(updateDoc(doc(db('ali'), 'sosAlerts/s2'), { recipients: ['b1', 'b2', 'b3'] }));
    await assertFails(deleteDoc(doc(db('b1'), 'sosAlerts/s2')));
    await assertSucceeds(deleteDoc(doc(db('ali'), 'sosAlerts/s2')));
  });

  it('admin listesine istemciden yazılamaz', async () => {
    await assertFails(setDoc(doc(db('ali'), 'admins/ali'), { addedAt: 'x' }));
  });

  it('işlem kaydı yalnızca eklenir', async () => {
    await seed('admins/eren', { addedAt: 'konsol' });
    const entry = { actorUid: 'eren', module: 'meslekler', action: 'ekle', at: serverTimestamp(), summary: 'Öğretmen eklendi' };
    await assertSucceeds(setDoc(doc(db('eren'), 'auditLog/1'), entry));
    await assertFails(setDoc(doc(db('eren'), 'auditLog/2'), { ...entry, actorUid: 'baskasi' }));
    await assertFails(updateDoc(doc(db('eren'), 'auditLog/1'), { summary: 'değişti' }));
    await assertFails(deleteDoc(doc(db('eren'), 'auditLog/1')));
    await assertFails(getDoc(doc(db('ali'), 'auditLog/1')));
  });
});
