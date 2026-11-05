import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { NoticePushMessage } from '@cityjoy/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sendAdminPush, sendDueAdminPushes } from '../src/admin-push';
import { citySlug, nosyProvider, syncPharmacies } from '../src/pharmacy';
import { estimateAudienceFor, handleAnnouncementWrite, sendScheduledAnnouncements } from '../src/announcements';
import { handleActivityChange, handleEventChange } from '../src/cancellations';
import { deleteExpiredPushLog, deleteExpiredSos, deleteUserLeftovers } from '../src/cleanup';
import { handleActivityCover, handleListingPhotos, handleMediaChange, handlePostPhotos, MEDIA_FIELDS } from '../src/photos';
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

  describe('hedefli bildirim', () => {
    // 60 kişi: 30'u 65+ yaş kadın emekli, 20'si 30 yaş erkek mühendis, 10'u 70 yaş kadın emekli (hedefleme izni sorulmadı).
    async function crowd() {
      const batch = db.batch();
      const add = (i: number, birthYear: number, gender: string, occupationId: string) => {
        batch.set(db.doc(`users/h${i}`), { uid: `h${i}`, location: { provinceCode: '16', districtId: '16-nilufer' }, birthYear, gender, occupationId, consents: {} });
        batch.set(db.doc(`pushTokens/h${i}`), { tokens: [`T-h${i}`], language: 'tr', updatedAt: Timestamp.now() });
      };
      for (let i = 0; i < 30; i++) add(i, 1955, 'kadin', 'emekli');
      for (let i = 30; i < 50; i++) add(i, 1996, 'erkek', 'muhendis');
      for (let i = 50; i < 60; i++) add(i, 1956, 'kadin', 'emekli');
      await batch.commit();
    }

    it('bildirim yalnızca hedefe uyanlara gider (ayrı izin aranmaz); 50 kişiden küçük gruba gitmez; acilde hedef yok sayılır', async () => {
      await crowd();
      const { sent, deps } = fakeSender();
      // Erkek: 20 kişi -> 50'den az, gönderilmez.
      expect(await handleAnnouncementWrite(db, 't1', undefined, ann({ pushTarget: { genders: ['erkek'] } }), deps)).toBe(0);
      expect((await db.doc('pushLog/duyuru_t1').get()).get('skipped')).toBe('kucuk-grup');
      // 65+ yaş emekli kadın: 40 kişi -> gönderilmez; 13+ yaş: 60 kişi -> gider. Bölge dışındakiler yok, yaşı olmayanlar yok.
      expect(await handleAnnouncementWrite(db, 't2', undefined, ann({ pushTarget: { ageMin: 65, occupations: ['emekli'] } }), deps)).toBe(0);
      expect(await handleAnnouncementWrite(db, 't4', undefined, ann({ pushTarget: { ageMin: 13 } }), deps)).toBe(60);
      expect(sent.some((m) => m.to === 'T-o1' || m.to === 'T-n1')).toBe(false);
      // Acil duyuruda hedef yok sayılır: bölgedeki herkese (60 + önceki 2).
      sent.length = 0;
      await handleAnnouncementWrite(db, 't3', undefined, ann({ kind: 'acil', endsAt: later, pushTarget: { ageMin: 65 } }), deps);
      expect(sent.length).toBe(62);
    });

    it('panel yaklaşık sayıyı yalnızca yetkili kişiye ve kendi bölgesinde söyler', async () => {
      await crowd();
      const org = 'bld-16-nilufer';
      await db.doc(`organizations/${org}`).set({ status: 'aktif', modules: ['gonderiler'], scope: { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' } });
      await db.doc(`orgMembers/${org}__basin@ornek.com`).set({ assignments: { gonderiler: ['goruntule', 'ekle'] } });
      await db.doc(`orgMembers/${org}__izleyen@ornek.com`).set({ assignments: { gonderiler: ['goruntule'] } });
      const region = { provinceCode: '16', districtId: '16-nilufer' };
      const basin = { uid: 'b', email: 'basin@ornek.com', emailVerified: true };
      expect(await estimateAudienceFor(db, basin, { publisherKey: org, region, target: { genders: ['erkek'] } }, NOW)).toEqual({ tooSmall: true, approx: 0 });
      expect(await estimateAudienceFor(db, basin, { publisherKey: org, region, target: null }, NOW)).toEqual({ tooSmall: false, approx: 60 });
      expect(await estimateAudienceFor(db, basin, { publisherKey: org, region: { provinceCode: '16', districtId: '16-osmangazi' }, target: null }, NOW)).toEqual({ denied: true });
      expect(await estimateAudienceFor(db, { uid: 'i', email: 'izleyen@ornek.com', emailVerified: true }, { publisherKey: org, region, target: null }, NOW)).toEqual({ denied: true });
      expect(await estimateAudienceFor(db, { ...basin, emailVerified: false }, { publisherKey: org, region, target: null }, NOW)).toEqual({ denied: true });
    });
  });

  it('planlı duyuru yayın anı gelmeden gitmez; zamanı gelince bir kez gider', async () => {
    const { sent, deps } = fakeSender();
    const at = Timestamp.fromDate(new Date(NOW.getTime() + 2 * 3600000));
    const planned = ann({ publishedAt: at, scheduledAt: at });
    await db.doc('announcements/p1').set(planned);
    expect(await handleAnnouncementWrite(db, 'p1', undefined, planned, deps)).toBe(0);
    expect(await sendScheduledAnnouncements(db, deps)).toBe(0);
    // İki saat sonra.
    const later2 = { ...deps, now: new Date(NOW.getTime() + 2 * 3600000 + 5 * 60000) };
    expect(await sendScheduledAnnouncements(db, later2)).toBe(2);
    expect(await sendScheduledAnnouncements(db, later2)).toBe(0);
    expect(sent.map((m) => m.to).sort()).toEqual(['T-n1', 'T-n2']);
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

  it('videolu gönderi kaldırılınca klasör silinir, video alanı boşaltılır', async () => {
    const deleted: string[] = [];
    const video = { path: 'posts/u1/p2/video.mp4', url: 'https://x', width: 720, height: 1280, durationSec: 30 };
    const before = { authorUid: 'u1', status: 'aktif', text: '', video };
    await db.doc('posts/p2').set({ ...before, status: 'kaldirildi' });
    expect(await handlePostPhotos(db, 'p2', before, { ...before, status: 'kaldirildi' }, async (p) => void deleted.push(p))).toBe(true);
    expect(deleted).toEqual(['posts/u1/p2/']);
    expect((await db.doc('posts/p2').get()).get('video')).toBeUndefined();
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
    expect(deleted).toEqual(['posts/u1/', 'media/u1/ilan/', 'media/u1/aktivite/']);
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

describe('Çarşı ilan fotoğrafları', () => {
  const m = (uid: string, id: string) => ({ path: `media/${uid}/ilan/${id}.jpg`, url: 'u', width: 10, height: 10 });

  it('ilandan çıkan fotoğrafın dosyası silinir; başkasının klasöründeki dosyaya dokunulmaz', async () => {
    const deleted: string[] = [];
    const del = async (p: string) => void deleted.push(p);
    const a = m('s1', 'aaaaaaaaaa');
    const b = m('s1', 'bbbbbbbbbb');
    const before = { ownerUid: 's1', status: 'yayinda', photos: [a, b] };
    expect(await handleListingPhotos(db, 'l1', before, { ...before, photos: [b] }, del)).toEqual([a.path]);
    expect(await handleListingPhotos(db, 'l1', before, before, del)).toEqual([]);
    expect(await handleListingPhotos(db, 'l1', { ...before, photos: [m('x9', 'cccccccccc')] }, { ...before, photos: [] }, del)).toEqual([]);
    expect(deleted).toEqual([a.path]);
  });

  it('moderatör kaldırınca fotoğraf alanı boşaltılır; sahibi kaldırınca dosyalar silinir', async () => {
    const a = m('s1', 'aaaaaaaaaa');
    const live = { ownerUid: 's1', status: 'yayinda', photos: [a] };
    await db.doc('listings/l2').set({ ...live, status: 'kaldirildi' });
    expect(await handleListingPhotos(db, 'l2', live, { ...live, status: 'kaldirildi' }, async () => {})).toEqual([]);
    expect((await db.doc('listings/l2').get()).get('photos')).toEqual([]);
    const deleted: string[] = [];
    expect(await handleListingPhotos(db, 'l2', { ...live, status: 'kaldirildi' }, { ...live, status: 'kaldirildi', photos: [] }, async (p) => void deleted.push(p))).toEqual([a.path]);
  });
});

describe('aktivite kapağı', () => {
  it('iptalde kalır; kaldırılınca alan silinir, ardından dosya silinir', async () => {
    const cover = { path: 'media/o1/aktivite/kkkkkkkkkk.jpg', url: 'u', width: 10, height: 10 };
    const live = { organizerUid: 'o1', status: 'aktif', cover };
    const deleted: string[] = [];
    const del = async (p: string) => void deleted.push(p);
    expect(await handleActivityCover(db, 'a1', live, { ...live, status: 'iptal' }, del)).toEqual([]);
    await db.doc('activities/a1').set({ ...live, status: 'kaldirildi' });
    expect(await handleActivityCover(db, 'a1', live, { ...live, status: 'kaldirildi' }, del)).toEqual([]);
    expect((await db.doc('activities/a1').get()).get('cover')).toBeUndefined();
    const { cover: _, ...removed } = { ...live, status: 'kaldirildi' };
    expect(await handleActivityCover(db, 'a1', { ...live, status: 'kaldirildi' }, removed, del)).toEqual([cover.path]);
    expect(deleted).toEqual([cover.path]);
  });
});

describe('Seyahat kapakları', () => {
  it('değişen ya da silinen kaydın kapağı silinir; değişmeyen kalır', async () => {
    const a = { path: 'media/eren/seyahat/aaaaaaaaaa.jpg', url: 'u', width: 10, height: 10 };
    const b = { path: 'media/basin/seyahat/bbbbbbbbbb.jpg', url: 'u', width: 10, height: 10 };
    const del = async () => {};
    expect(await handleMediaChange(MEDIA_FIELDS.travel, { cover: a, slogan: 'x' }, { cover: a, slogan: 'y' }, del)).toEqual([]);
    expect(await handleMediaChange(MEDIA_FIELDS.travel, { cover: a }, { cover: b }, del)).toEqual([a.path]);
    expect(await handleMediaChange(MEDIA_FIELDS.travel, { cover: b }, undefined, del)).toEqual([b.path]);
  });
});

describe('admin bildirimi', () => {
  async function people() {
    const batch = db.batch();
    for (let i = 0; i < 70; i++) {
      // 0-59: Bursa / Osmangazi yetişkin; 0-29 kampanya izinli; 60-69: 16 yaşında izinli; hepsinin telefonu var.
      const teen = i >= 60;
      batch.set(db.doc(`users/a${i}`), {
        uid: `a${i}`, location: { provinceCode: '16', districtId: '16-osmangazi' }, birthYear: teen ? 2010 : 1985, gender: i % 2 ? 'kadin' : 'erkek',
        occupationId: 'esnaf', consents: i < 30 || teen ? { commercialMessages: { granted: true } } : {},
      });
      batch.set(db.doc(`pushTokens/a${i}`), { tokens: [`T-a${i}`], language: 'tr', updatedAt: Timestamp.now() });
    }
    batch.set(db.doc('users/ist'), { uid: 'ist', location: { provinceCode: '34' }, birthYear: 1980, consents: { commercialMessages: { granted: true } } });
    batch.set(db.doc('pushTokens/ist'), { tokens: ['T-ist'], language: 'en', updatedAt: Timestamp.now() });
    await batch.commit();
  }
  const push = (over: Record<string, unknown> = {}) => ({
    kind: 'duyuru', title: 'Kar uyarısı', body: 'Yarın yoğun kar bekleniyor.', region: { provinceCode: '16' }, scope: '16', link: { type: 'yok' },
    status: 'planli', sendAt: Timestamp.fromDate(NOW), createdBy: 'eren', ...over,
  });

  it('duyuru bölgedeki herkese bir kez gider; sonuç belgeye yazılır', async () => {
    await people();
    const { sent, deps } = fakeSender();
    await db.doc('adminPushes/p1').set(push());
    expect(await sendAdminPush(db, 'p1', push(), deps)).toBe(70);
    expect(await sendAdminPush(db, 'p1', push(), deps)).toBe(0);
    expect((await db.doc('adminPushes/p1').get()).data()).toMatchObject({ status: 'gonderildi', recipients: 70 });
    expect(sent.some((m) => m.to === 'T-ist')).toBe(false);
    expect(sent[0]).toMatchObject({ title: 'Kar uyarısı', body: 'Yarın yoğun kar bekleniyor.', data: { adminPushId: 'p1' } });
  });

  it('reklam yalnızca kampanya izni veren yetişkinlere, "Reklam" etiketiyle; ülke geneli il dışını da kapsar', async () => {
    await people();
    const { sent, deps } = fakeSender();
    const ad = push({ kind: 'reklam', region: {}, scope: 'TR', business: { id: 'b1', name: 'Kahve Durağı' }, link: { type: 'isletme', id: 'b1' } });
    await db.doc('adminPushes/p2').set(ad);
    expect(await sendAdminPush(db, 'p2', ad, deps)).toBe(31);
    const tr = sent.find((m) => m.to === 'T-a0')!;
    expect(tr).toMatchObject({ title: 'Reklam · Kahve Durağı: Kar uyarısı', data: { href: { pathname: '/business/[id]', params: { id: 'b1' } } } });
    expect(sent.find((m) => m.to === 'T-ist')?.title).toBe('Ad · Kahve Durağı: Kar uyarısı');
    expect(sent.some((m) => m.to === 'T-a60' || m.to === 'T-a40')).toBe(false);
  });

  it('reklam bildirimi yazı olarak gider, dokununca işletmenin paylaşımını açar', async () => {
    await people();
    const { sent, deps } = fakeSender();
    const ad = push({ kind: 'reklam', business: { id: 'b1', name: 'Dürümcü' }, link: { type: 'gonderi', id: 'post1' } });
    await db.doc('adminPushes/p5').set(ad);
    await sendAdminPush(db, 'p5', ad, deps);
    expect(sent[0]).toMatchObject({ data: { href: { pathname: '/explore/[id]', params: { id: 'post1' } }, adminPushId: 'p5' } });
  });

  it('hedefli gönderimde 50 kişiden küçük gruba gitmez; planlı bildirim zamanı gelince gider', async () => {
    await people();
    const { sent, deps } = fakeSender();
    const small = push({ target: { genders: ['kadin'] }, region: { provinceCode: '16', districtId: '16-osmangazi' } });
    await db.doc('adminPushes/p3').set(small);
    expect(await sendAdminPush(db, 'p3', small, deps)).toBe(0);
    expect((await db.doc('adminPushes/p3').get()).data()).toMatchObject({ status: 'gonderildi', recipients: 0, skipped: 'kucuk-grup' });
    const later2 = push({ sendAt: Timestamp.fromDate(new Date(NOW.getTime() + 3600000)) });
    await db.doc('adminPushes/p4').set(later2);
    expect(await sendAdminPush(db, 'p4', later2, deps)).toBe(0);
    expect(await sendDueAdminPushes(db, deps)).toBe(0);
    expect(await sendDueAdminPushes(db, { ...deps, now: new Date(NOW.getTime() + 2 * 3600000) })).toBe(70);
    expect(sent.length).toBe(70);
  });
});

describe('nöbetçi eczane çekimi', () => {
  const ok = { id: 'deneme', fetchProvince: async ({ code }: { code: string }) => [{ name: `Eczane ${code}`, district: 'Merkez', address: 'Cad. 1' }] };
  it('illeri yazar, hata alanı panele düşer; ikinci deneme yalnızca eksik illeri çeker; aynı gün gizlemeler korunur', async () => {
    const flaky = { id: 'deneme', fetchProvince: async ({ code }: { code: string }) => { if (code === '34') throw new Error('zaman aşımı'); return ok.fetchProvince({ code }); } };
    const r = await syncPharmacies(db, flaky, { now: NOW, provinces: ['16', '34'] });
    expect(r).toEqual({ ok: ['16'], failed: [{ code: '34', error: 'zaman aşımı' }] });
    expect((await db.doc('dutyPharmacies/16').get()).data()).toMatchObject({ date: '2026-11-01', source: 'deneme', items: [{ name: 'Eczane 16' }], hidden: [] });
    expect((await db.doc('dataSourceStatus/pharmacy').get()).get('provinces.34.error')).toBe('zaman aşımı');
    await db.doc('dutyPharmacies/16').update({ hidden: ['merkez|eczane 16'], hours: { start: '18:30', end: '09:00' } });
    const calls: string[] = [];
    const spy = { id: 'deneme', fetchProvince: async (p: { code: string }) => { calls.push(p.code); return ok.fetchProvince(p); } };
    await syncPharmacies(db, spy, { now: NOW, provinces: ['16', '34'], onlyStale: true });
    expect(calls).toEqual(['34']);
    await syncPharmacies(db, spy, { now: NOW, provinces: ['16'] });
    expect((await db.doc('dutyPharmacies/16').get()).get('hidden')).toEqual(['merkez|eczane 16']);
    await syncPharmacies(db, spy, { now: new Date('2026-11-02T06:00:00Z'), provinces: ['16'] });
    expect((await db.doc('dutyPharmacies/16').get()).data()).toMatchObject({ hidden: [], hours: { start: '18:30', end: '09:00' } });
    expect((await db.collection('dataSourceRuns').get()).size).toBe(4);
  });

  it('NosyAPI bağdaştırıcısı: il adresi Türkçe harfsiz, anahtar başlıkta, yanıt çevrilir', async () => {
    expect(citySlug('Şanlıurfa')).toBe('sanliurfa');
    let seen: { url: string; auth: string } | null = null;
    const fake = (async (url: string, init: { headers: Record<string, string> }) => {
      seen = { url, auth: init.headers.Authorization };
      return { ok: true, json: async () => ({ data: [{ pharmacyName: 'Şifa', address: 'Cad. 1', district: 'Osmangazi', phone: '0224' }, { pharmacyName: 'Eksik' }] }) };
    }) as unknown as typeof fetch;
    const items = await nosyProvider('ANAHTAR', fake).fetchProvince({ code: '16', name: 'Bursa' });
    expect(items).toEqual([{ name: 'Şifa', district: 'Osmangazi', address: 'Cad. 1', phone: '0224' }]);
    expect(seen).toEqual({ url: 'https://www.nosyapi.com/apiv2/service/pharmacies-on-duty?city=bursa', auth: 'Bearer ANAHTAR' });
  });
});

