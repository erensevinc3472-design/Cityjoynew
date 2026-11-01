import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { NoticePushMessage } from '@cityjoy/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { handleAnnouncementWrite } from '../src/announcements';
import { handleActivityChange, handleEventChange } from '../src/cancellations';
import { deleteExpiredPushLog, deleteExpiredSos, deleteUserLeftovers } from '../src/cleanup';
import { handleMediaChange, handlePostPhotos, MEDIA_FIELDS } from '../src/photos';
import type { NotifyDeps } from '../src/push';
import { handleFollowWrite, handleMessageCreate } from '../src/social';

// Emülatördeki veritabanıyla çalışır (npm test, firebase emulators:exec). Gerçek bildirim gönderilmez.
let app: App;
let db: Firestore;
const NOW = new Date('2026-11-01T09:00:00Z'); // Türkiye saatiyle 12.00
const later = Timestamp.fromDate(new Date('2026-11-05T10:00:00Z'));

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-cityjoy' }, 'functions-test');
  db = getFirestore(app);
});
afterAll(() => deleteApp(app));
beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-cityjoy/databases/(default)/documents`, { method: 'DELETE' });
});

function fakeSender(dead: string[] = []) {
  const sent: NoticePushMessage[] = [];
  const deps: NotifyDeps = { now: NOW, send: async (m) => { sent.push(...m); return dead; } };
  return { sent, deps };
}

async function attend(path: string, uid: string, language = 'tr', tokens = [`T-${uid}`]) {
  await db.doc(`${path}/attendees/${uid}`).set({ uid, shareName: false, createdAt: Timestamp.now() });
  await db.doc(`pushTokens/${uid}`).set({ tokens, language, updatedAt: Timestamp.now() });
}

describe('etkinlik iptali', () => {
  const before = { status: 'yayinda', title: 'Kitap Günü', endsAt: later };
  const after = { ...before, status: 'iptal' };

  it('katılanlara kendi dillerinde bildirim gider, telefonu olmayan atlanır', async () => {
    await attend('events/e1', 'a');
    await attend('events/e1', 'b', 'en');
    await db.doc('events/e1/attendees/c').set({ uid: 'c', shareName: false, createdAt: Timestamp.now() });
    const { sent, deps } = fakeSender();
    expect(await handleEventChange(db, 'e1', before, after, deps)).toBe(2);
    expect(sent.map((m) => m.title).sort()).toEqual(['Etkinlik iptal edildi', 'Event cancelled']);
    expect(sent[0].data.href).toEqual({ pathname: '/events/[id]', params: { id: 'e1' } });
  });

  it('iptal dışındaki değişiklikte, bitmiş etkinlikte ve admin kapattıysa gitmez', async () => {
    await attend('events/e1', 'a');
    const { sent, deps } = fakeSender();
    await handleEventChange(db, 'e1', before, { ...before, attendeeCount: 3 }, deps);
    await handleEventChange(db, 'e1', before, { ...after, endsAt: Timestamp.fromDate(new Date('2026-10-01T00:00:00Z')) }, deps);
    // Panel tetikleyicileri `triggers` alanına kaydeder.
    await db.doc('config/notificationTriggers').set({ triggers: { acil: true, sos: true, mesaj: true, takip: true, duyuru: true, haber: true, etkinlik: false } });
    await handleEventChange(db, 'e1', before, after, deps);
    expect(sent).toEqual([]);
  });

  it('kişi etkinlik bildirimini kapattıysa gitmez; geçersiz telefon adresi silinir', async () => {
    await attend('events/e1', 'a');
    await attend('events/e1', 'b', 'tr', ['T-b', 'ESKI']);
    await db.doc('users/a/settings/notifications').set({ categories: { etkinlik: false } });
    const { sent, deps } = fakeSender(['ESKI']);
    await handleEventChange(db, 'e1', before, after, deps);
    expect(sent.map((m) => m.to).sort()).toEqual(['ESKI', 'T-b']);
    expect((await db.doc('pushTokens/b').get()).get('tokens')).toEqual(['T-b']);
  });
});

describe('aktivite iptali', () => {
  it('düzenleyen hariç katılanlara gider', async () => {
    await attend('activities/a1', 'org');
    await attend('activities/a1', 'x');
    const { sent, deps } = fakeSender();
    const before = { status: 'aktif', title: 'Pazar yürüyüşü', organizerUid: 'org', endsAt: later };
    expect(await handleActivityChange(db, 'a1', before, { ...before, status: 'iptal' }, deps)).toBe(1);
    expect(sent[0]).toMatchObject({ to: 'T-x', title: 'Aktivite iptal edildi' });
    expect(sent[0].body).toContain('Pazar yürüyüşü');
  });
});

describe('duyuru bildirimi', () => {
  async function resident(uid: string, location: Record<string, string>) {
    await db.doc(`users/${uid}`).set({ uid, location });
    await db.doc(`pushTokens/${uid}`).set({ tokens: [`T-${uid}`], language: 'tr', updatedAt: Timestamp.now() });
  }
  const ann = (over: Record<string, unknown> = {}) => ({
    kind: 'duyuru', title: 'Pazar yeri taşınıyor', status: 'yayinda', region: { provinceCode: '16', districtId: '16-nilufer' },
    author: { type: 'kurum', orgId: 'bld-16-nilufer', name: 'Nilüfer Belediyesi' }, ...over,
  });

  beforeEach(async () => {
    await resident('n1', { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: 'm1' });
    await resident('n2', { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: 'm2' });
    await resident('o1', { provinceCode: '16', districtId: '16-osmangazi' });
    await resident('i1', { provinceCode: '34', districtId: '34-kadikoy' });
  });

  it('yayına girince yalnızca bölgedekilere, bir kez gider', async () => {
    const { sent, deps } = fakeSender();
    expect(await handleAnnouncementWrite(db, 'd1', { status: 'onay-bekliyor' }, ann(), deps)).toBe(2);
    expect(sent.map((m) => m.to).sort()).toEqual(['T-n1', 'T-n2']);
    expect(sent[0]).toMatchObject({ title: 'Duyuru · Nilüfer Belediyesi', body: 'Pazar yeri taşınıyor' });
    expect(await handleAnnouncementWrite(db, 'd1', { status: 'onay-bekliyor' }, ann(), deps)).toBe(0);
  });

  it('mahalleye yönelik muhtar duyurusu yalnızca o mahalleye; il geneli acil duyuru herkese, yüksek öncelikle', async () => {
    const { sent, deps } = fakeSender();
    await handleAnnouncementWrite(db, 'd2', undefined, ann({ region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: 'm1' }, author: { type: 'kisi', role: 'muhtar', grantKey: 'x' } }), deps);
    expect(sent.map((m) => [m.to, m.title])).toEqual([['T-n1', 'Duyuru · Muhtarlık']]);
    sent.length = 0;
    await handleAnnouncementWrite(db, 'd3', undefined, ann({ kind: 'acil', region: { provinceCode: '16' }, endsAt: later }), deps);
    expect(sent.map((m) => m.to).sort()).toEqual(['T-n1', 'T-n2', 'T-o1']);
    expect(sent[0].priority).toBe('high');
  });

  it('taslakta, yayındakinin güncellenmesinde ve süresi geçmişse gitmez', async () => {
    const { sent, deps } = fakeSender();
    await handleAnnouncementWrite(db, 'd4', undefined, ann({ status: 'taslak' }), deps);
    await handleAnnouncementWrite(db, 'd5', ann(), ann({ status: 'kaldirildi' }), deps);
    await handleAnnouncementWrite(db, 'd6', undefined, ann({ kind: 'acil', endsAt: Timestamp.fromDate(new Date('2026-10-01T00:00:00Z')) }), deps);
    expect(sent).toEqual([]);
  });
});

async function phone(uid: string, language = 'tr') {
  await db.doc(`pushTokens/${uid}`).set({ tokens: [`T-${uid}`], language, updatedAt: Timestamp.now() });
}

describe('mesaj bildirimi', () => {
  const msg = (from: string, text = 'Merhaba, bisiklet duruyor mu?') => ({ from, text, status: 'aktif', createdAt: Timestamp.now() });

  it('karşı tarafa gönderenin adı ve mesajla gider; dokununca sohbet açılır', async () => {
    await phone('ali');
    await phone('veli');
    await db.doc('chats/ali_veli').set({ members: ['ali', 'veli'], names: { ali: 'Ali Y.', veli: 'Veli K.' }, startedBy: 'ali', accepted: true, unread: { veli: 1 } });
    const { sent, deps } = fakeSender();
    expect(await handleMessageCreate(db, 'ali_veli', msg('ali'), deps)).toBe(1);
    expect(sent[0]).toMatchObject({ to: 'T-veli', title: 'Ali Y.', body: 'Merhaba, bisiklet duruyor mu?' });
    expect(sent[0].data.href).toEqual({ pathname: '/messages/[uid]', params: { uid: 'ali' } });
  });

  it('uzun mesaj kısaltılır; silinen mesajda ve mesaj bildirimini kapatana gitmez', async () => {
    await phone('veli');
    await db.doc('chats/ali_veli').set({ members: ['ali', 'veli'], names: { ali: 'Ali Y.' }, startedBy: 'ali', accepted: true, unread: {} });
    const { sent, deps } = fakeSender();
    await handleMessageCreate(db, 'ali_veli', msg('ali', 'x'.repeat(400)), deps);
    expect(sent[0].body.length).toBe(150);
    await handleMessageCreate(db, 'ali_veli', { ...msg('ali'), status: 'silindi' }, deps);
    await db.doc('users/veli/settings/notifications').set({ categories: { mesaj: false } });
    await handleMessageCreate(db, 'ali_veli', msg('ali'), deps);
    expect(sent).toHaveLength(1);
  });

  it('mesaj isteğinde metin görünmez ve yalnızca ilk mesajda gider', async () => {
    await phone('veli', 'en');
    await db.doc('chats/ali_veli').set({ members: ['ali', 'veli'], names: { ali: 'Ali Y.' }, startedBy: 'ali', accepted: false, unread: { veli: 1 } });
    const { sent, deps } = fakeSender();
    await handleMessageCreate(db, 'ali_veli', msg('ali'), deps);
    expect(sent[0]).toMatchObject({ title: 'Message request', body: 'Ali Y. wants to send you a message.' });
    await db.doc('chats/ali_veli').update({ unread: { veli: 2 } });
    await handleMessageCreate(db, 'ali_veli', msg('ali'), deps);
    expect(sent).toHaveLength(1);
  });

  it('işletmeye yazılınca sahip ve mesaj izni olan yetkili alır; cevap müşteriye işletme adıyla gider', async () => {
    for (const u of ['musteri', 'sahip', 'yetkili', 'izinsiz']) await phone(u);
    await db.doc('businesses/b1').set({ name: 'Fırın', managerUids: ['yetkili', 'izinsiz'], managers: { yetkili: { messages: true }, izinsiz: { messages: false } } });
    const chat = { members: ['musteri', 'sahip'], names: { musteri: 'Ali Y.', sahip: 'Veli K.' }, startedBy: 'musteri', accepted: true, unread: {}, context: { type: 'isletme', id: 'b1', title: 'Fırın' } };
    await db.doc('chats/t1').set(chat);
    const { sent, deps } = fakeSender();
    expect(await handleMessageCreate(db, 't1', msg('musteri'), deps)).toBe(2);
    expect(sent.map((m) => m.to).sort()).toEqual(['T-sahip', 'T-yetkili']);
    expect(sent[0]).toMatchObject({ title: 'Ali Y. · Fırın', data: { href: { pathname: '/messages/[uid]', params: { uid: 'musteri', thread: 't1' } } } });
    sent.length = 0;
    await handleMessageCreate(db, 't1', msg('yetkili', 'Evet, açığız'), deps);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'T-musteri', title: 'Fırın', body: 'Evet, açığız', data: { href: { pathname: '/messages/[uid]', params: { uid: 'sahip', thread: 't1' } } } });
  });

  it('Çarşı sohbetinde başlıkta ilanın adı da yazar', async () => {
    await phone('satici');
    await db.doc('chats/t2').set({ members: ['alici', 'satici'], names: { alici: 'Ali Y.' }, startedBy: 'alici', accepted: true, unread: {}, context: { type: 'ilan', id: 'l1', title: 'Çocuk bisikleti' } });
    const { sent, deps } = fakeSender();
    await handleMessageCreate(db, 't2', msg('alici'), deps);
    expect(sent[0]).toMatchObject({ to: 'T-satici', title: 'Ali Y. · Çocuk bisikleti' });
  });
});

describe('takip bildirimi', () => {
  const follow = (status: string) => ({ followerUid: 'ali', followeeUid: 'veli', status, createdAt: Timestamp.now() });
  beforeEach(async () => {
    await phone('ali');
    await phone('veli');
    await db.doc('publicProfiles/ali').set({ displayName: 'Ali Y.' });
    await db.doc('publicProfiles/veli').set({ displayName: 'Veli K.' });
  });

  it('yeni takipçi hesap sahibine gider; bırakıp yeniden takip edince 7 gün tekrar gitmez', async () => {
    const { sent, deps } = fakeSender();
    expect(await handleFollowWrite(db, 'ali_veli', undefined, follow('aktif'), deps)).toBe(1);
    expect(sent[0]).toMatchObject({ to: 'T-veli', title: 'Yeni takipçi', body: 'Ali Y. seni takip etmeye başladı.', data: { href: { pathname: '/u/[uid]', params: { uid: 'ali' } } } });
    await handleFollowWrite(db, 'ali_veli', undefined, follow('aktif'), deps);
    expect(sent).toHaveLength(1);
    // Takibi bırakmak bildirim göndermez.
    expect(await handleFollowWrite(db, 'ali_veli', follow('aktif'), undefined, deps)).toBe(0);
  });

  it('gizli hesaba istek sahibine, kabul isteyene gider', async () => {
    const { sent, deps } = fakeSender();
    await handleFollowWrite(db, 'ali_veli', undefined, follow('istek'), deps);
    expect(sent[0]).toMatchObject({ to: 'T-veli', title: 'Takip isteği', data: { href: { pathname: '/me' } } });
    await handleFollowWrite(db, 'ali_veli', follow('istek'), follow('aktif'), deps);
    expect(sent[1]).toMatchObject({ to: 'T-ali', title: 'Takip isteğin kabul edildi', body: 'Artık Veli K. adlı kişiyi takip ediyorsun.' });
  });

  it('tekrar önleme kayıtları süresi dolunca günlük temizlikte silinir', async () => {
    const { deps } = fakeSender();
    await handleFollowWrite(db, 'ali_veli', undefined, follow('aktif'), deps);
    await db.doc('pushLog/duyuru_d1').set({ at: Timestamp.now() });
    expect(await deleteExpiredPushLog(db, new Date(NOW.getTime() + 8 * 86_400_000))).toBe(1);
    expect((await db.doc('pushLog/takip_ali_veli').get()).exists).toBe(false);
    expect((await db.doc('pushLog/duyuru_d1').get()).exists).toBe(true);
  });
});

describe('gönderi fotoğrafları', () => {
  const photo = { path: 'posts/u1/p1/0.jpg', url: 'https://x', width: 10, height: 10 };
  it('moderatör kaldırınca dosyalar ve kayıttaki alan silinir; sahibi kaldırınca dosyalar silinir', async () => {
    const deleted: string[] = [];
    const del = async (p: string) => void deleted.push(p);
    const before = { authorUid: 'u1', status: 'aktif', text: 'x', photos: [photo] };
    await db.doc('posts/p1').set({ ...before, status: 'kaldirildi' });
    expect(await handlePostPhotos(db, 'p1', before, { ...before, status: 'kaldirildi' }, del)).toBe(true);
    expect(deleted).toEqual(['posts/u1/p1/']);
    expect((await db.doc('posts/p1').get()).get('photos')).toBeUndefined();
    // Sahibi kaldırdı: alan zaten boş.
    expect(await handlePostPhotos(db, 'p1', before, { authorUid: 'u1', status: 'kaldirildi', text: '' }, del)).toBe(true);
    expect(deleted).toEqual(['posts/u1/p1/', 'posts/u1/p1/']);
  });

  it('fotoğrafsız ya da hâlâ yayında gönderide bir şey yapılmaz', async () => {
    const del = async () => {
      throw new Error('silinmemeli');
    };
    const live = { authorUid: 'u1', status: 'aktif', photos: [photo] };
    expect(await handlePostPhotos(db, 'p1', live, { ...live, likeCount: 1 }, del)).toBe(false);
    expect(await handlePostPhotos(db, 'p1', { authorUid: 'u1', status: 'aktif' }, { authorUid: 'u1', status: 'kaldirildi' }, del)).toBe(false);
  });
});

describe('temizlik', () => {
  it('süresi dolan SOS kayıtları silinir, diğerleri kalır', async () => {
    await db.doc('sosAlerts/eski').set({ fromUid: 'a', deleteAt: Timestamp.fromDate(new Date('2026-10-01T00:00:00Z')) });
    await db.doc('sosAlerts/yeni').set({ fromUid: 'a', deleteAt: later });
    expect(await deleteExpiredSos(db, NOW)).toBe(1);
    expect((await db.doc('sosAlerts/eski').get()).exists).toBe(false);
    expect((await db.doc('sosAlerts/yeni').get()).exists).toBe(true);
  });

  it('hesap silinince kişinin kalan kayıtları silinir, başkasınınkiler kalır', async () => {
    await db.doc('users/u1').set({ displayName: 'Ali' });
    await db.doc('users/u1/settings/notifications').set({ categories: {} });
    await db.doc('pushTokens/u1').set({ tokens: ['T'] });
    await db.doc('publicProfiles/u1').set({ displayName: 'Ali' });
    await db.doc('pushCount/u1').set({ day: '2026-11-01', count: 2 });
    await db.doc('serviceSuggestions/s1').set({ uid: 'u1', text: 'Kilim tamiri' });
    await db.doc('serviceSuggestions/s2').set({ uid: 'u2', text: 'Saat tamiri' });
    await db.doc('usage/u-u1~oneri').set({ type: 'u', sid: 'u1', kind: 'oneri', count: 1 });
    await db.doc('users/u2').set({ displayName: 'Ayşe' });
    const deleted: string[] = [];
    await deleteUserLeftovers(db, 'u1', async (p) => void deleted.push(p));
    expect(deleted).toEqual(['posts/u1/']);
    for (const p of ['users/u1', 'users/u1/settings/notifications', 'pushTokens/u1', 'publicProfiles/u1', 'pushCount/u1', 'serviceSuggestions/s1', 'usage/u-u1~oneri']) {
      expect((await db.doc(p).get()).exists, p).toBe(false);
    }
    expect((await db.doc('users/u2').get()).exists).toBe(true);
    expect((await db.doc('serviceSuggestions/s2').get()).exists).toBe(true);
  });
});

describe('bildirim öncelikleri', () => {
  async function resident(uid: string) {
    await db.doc(`users/${uid}`).set({ uid, location: { provinceCode: '16', districtId: '16-nilufer' } });
    await db.doc(`pushTokens/${uid}`).set({ tokens: [`T-${uid}`], language: 'tr', updatedAt: Timestamp.now() });
  }
  const ann = (author: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
    kind: 'duyuru', title: 'Pazar yeri taşınıyor', status: 'yayinda', region: { provinceCode: '16', districtId: '16-nilufer' }, author, ...over,
  });
  const muhtar = { type: 'kisi', role: 'muhtar', grantKey: 'g1' };
  const kurum = { type: 'kurum', orgId: 'bld', name: 'Nilüfer Belediyesi' };

  it('normal öncelikte günlük sesli tavandan sonra sessiz gelir; kurum duyurusu her zaman çalar', async () => {
    await resident('a');
    await db.doc('config/notificationTriggers').set({ dailySoundCap: 2 });
    const { sent, deps } = fakeSender();
    for (const id of ['m1', 'm2', 'm3']) await handleAnnouncementWrite(db, id, undefined, ann(muhtar), deps);
    expect(sent.map((m) => [m.sound ?? null, m.channelId])).toEqual([['default', 'genel'], ['default', 'genel'], [null, 'sessiz']]);
    await handleAnnouncementWrite(db, 'k1', undefined, ann(kurum), deps);
    expect(sent[3]).toMatchObject({ sound: 'default', channelId: 'genel' });
    // Ertesi gün tavan yeniden başlar.
    await handleAnnouncementWrite(db, 'm4', undefined, ann(muhtar), { ...deps, now: new Date('2026-11-02T09:00:00Z') });
    expect(sent[4]).toMatchObject({ sound: 'default' });
  });

  it('uygulama içi seçilen tür telefona gitmez; admin işaretlediyse her zaman çalar', async () => {
    await resident('a');
    await db.doc('config/notificationTriggers').set({ priorities: { 'muhtar-duyuru': 'inapp' }, dailySoundCap: 1 });
    const { sent, deps } = fakeSender();
    expect(await handleAnnouncementWrite(db, 'm1', undefined, ann(muhtar), deps)).toBe(0);
    await db.doc('pushCount/a').set({ day: '2026-11-01', count: 5 });
    expect(await handleAnnouncementWrite(db, 'm2', undefined, ann(muhtar, { ringAlways: true }), deps)).toBe(1);
    expect(sent[0]).toMatchObject({ sound: 'default', channelId: 'genel' });
  });
});

describe('etkinlik, kurum ve işletme görselleri', () => {
  const m = (uid: string, kind: string, id: string) => ({ path: `media/${uid}/${kind}/${id}.jpg`, url: 'u', width: 10, height: 10 });

  it('değişen ya da kaldırılan görselin dosyası silinir, kalan silinmez', async () => {
    const deleted: string[] = [];
    const del = async (p: string) => void deleted.push(p);
    const a = m('o1', 'isletme-vitrin', 'aaaaaaaaaa');
    const b = m('o1', 'isletme-vitrin', 'bbbbbbbbbb');
    const logo = m('o1', 'isletme-logo', 'llllllllll');
    const before = { ownerUid: 'o1', managerUids: ['m1'], logo, gallery: [a, b] };
    expect(await handleMediaChange(MEDIA_FIELDS.businesses, before, { ...before, gallery: [b] }, del)).toEqual([a.path]);
    // Kayıt silinince hepsi.
    expect(await handleMediaChange(MEDIA_FIELDS.businesses, before, undefined, del)).toEqual([logo.path, a.path, b.path]);
    expect(deleted).toEqual([a.path, logo.path, a.path, b.path]);
  });

  it('vitrinde sahibin ve yetkililerin dışındaki kişinin dosyası silinmez', async () => {
    const deleted: string[] = [];
    const before = { ownerUid: 'o1', managerUids: ['m1'], gallery: [m('x9', 'isletme-vitrin', 'xxxxxxxxxx'), m('m1', 'isletme-vitrin', 'mmmmmmmmmm')] };
    expect(await handleMediaChange(MEDIA_FIELDS.businesses, before, { ...before, gallery: [] }, async (p) => void deleted.push(p))).toEqual(['media/m1/isletme-vitrin/mmmmmmmmmm.jpg']);
    expect(deleted).toEqual(['media/m1/isletme-vitrin/mmmmmmmmmm.jpg']);
  });

  it('profil fotoğrafı değişince ya da profil silinince eski dosya silinir', async () => {
    const gone: string[] = [];
    const del = async (p: string) => void gone.push(p);
    const a = m('u1', 'profil', 'aaaaaaaaaa');
    const b = m('u1', 'profil', 'bbbbbbbbbb');
    expect(await handleMediaChange(MEDIA_FIELDS.publicProfiles, { photo: a }, { photo: b }, del)).toEqual([a.path]);
    expect(await handleMediaChange(MEDIA_FIELDS.publicProfiles, { photo: b, displayName: 'A' }, { photo: b, displayName: 'B' }, del)).toEqual([]);
    expect(await handleMediaChange(MEDIA_FIELDS.publicProfiles, { photo: b }, undefined, del)).toEqual([b.path]);
    expect(gone).toEqual([a.path, b.path]);
  });

  it('etkinlik kapağı yalnızca hazırlayanın klasöründense silinir; yeni kayıtta bir şey yapılmaz', async () => {
    const del = async () => {
      throw new Error('silinmemeli');
    };
    const ev = { preparedBy: 'k1', cover: m('k2', 'etkinlik', 'cccccccccc') };
    expect(await handleMediaChange(MEDIA_FIELDS.events, ev, { preparedBy: 'k1' }, del)).toEqual([]);
    expect(await handleMediaChange(MEDIA_FIELDS.events, undefined, ev, del)).toEqual([]);
    const gone: string[] = [];
    const own = { preparedBy: 'k1', cover: m('k1', 'etkinlik', 'dddddddddd') };
    expect(await handleMediaChange(MEDIA_FIELDS.officialProfiles, { logo: own.cover }, { logo: own.cover }, del)).toEqual([]);
    expect(await handleMediaChange(MEDIA_FIELDS.events, own, { preparedBy: 'k1' }, async (p) => void gone.push(p))).toEqual([own.cover.path]);
  });
});
