import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { NoticePushMessage } from '@cityjoy/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { handleAnnouncementWrite } from '../src/announcements';
import { handleActivityChange, handleEventChange } from '../src/cancellations';
import { deleteExpiredSos, deleteUserLeftovers } from '../src/cleanup';
import type { NotifyDeps } from '../src/push';

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
    await db.doc('config/notificationTriggers').set({ acil: true, sos: true, mesaj: true, takip: true, duyuru: true, haber: true, etkinlik: false });
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
    await db.doc('users/u2').set({ displayName: 'Ayşe' });
    await deleteUserLeftovers(db, 'u1');
    for (const p of ['users/u1', 'users/u1/settings/notifications', 'pushTokens/u1', 'publicProfiles/u1']) {
      expect((await db.doc(p).get()).exists, p).toBe(false);
    }
    expect((await db.doc('users/u2').get()).exists).toBe(true);
  });
});
