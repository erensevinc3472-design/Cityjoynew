import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { publishersFor, type Action, type AnnouncementInput, type Organization, type Publisher } from '@cityjoy/shared';
import { createAnnouncementPanel, createFirestoreAnnouncementRepository, listAuditLog } from '@cityjoy/shared/firebase';
import { doc, getDoc, Timestamp, setDoc, updateDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
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
  id: 'bld-16-nilufer', name: 'Nilüfer Belediyesi', kind: 'ilce-belediyesi', scope: nilufer, modules: ['gonderiler', 'bildirimler'],
  officialEmail: 'kalem@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: '',
};
const staff: Record<string, Action[]> = {
  basin: ['goruntule', 'ekle', 'duzenle'],
  kalem: ['goruntule', 'ekle', 'duzenle', 'onayla'],
  fen: ['goruntule', 'ekle', 'yayinla', 'sil'],
};
const muhtarModules = (extra: Action[] = []) => ({ gonderiler: ['goruntule', 'ekle', 'duzenle', ...extra] });
const now = Timestamp.now();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    const { id, createdAt: _c, contractEndsAt: _e, ...o } = org;
    await setDoc(doc(db, 'organizations', id), { ...o, createdAt: now, updatedAt: now });
    for (const [uid, actions] of Object.entries(staff)) {
      await setDoc(doc(db, 'orgMembers', `${id}__${uid}@ornek.com`), {
        orgId: id, email: `${uid}@ornek.com`, displayName: uid, isOrgAdmin: uid === 'kalem', assignments: { gonderiler: actions }, addedBy: 'eren', updatedAt: now,
      });
    }
    const grant = (email: string, role: string, scope: object, modules: object) =>
      setDoc(doc(db, 'grants', `${email}__${'neighbourhoodId' in scope ? `mahalle-${(scope as typeof ataevler).neighbourhoodId}` : 'il-16'}`), {
        email, displayName: email, role, scope, modules, grantedBy: 'eren', grantedAt: now, updatedAt: now,
      });
    await grant('muhtar@ornek.com', 'muhtar', ataevler, muhtarModules());
    await grant('muhtar2@ornek.com', 'muhtar', { ...ataevler, neighbourhoodId: '16-nilufer-baska' }, muhtarModules(['yayinla']));
    await grant('ahmet@ornek.com', 'il-yoneticisi', { level: 'il', provinceCode: '16' }, { gonderiler: ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla', 'yayinla'] });
  });
});

/** Oturumdaki kişinin yayınlayan hesabı (paneldeki seçimle aynı). */
async function publisher(uid: string): Promise<Publisher> {
  const db = fs(uid);
  const member = (await getDoc(doc(db, 'orgMembers', `${org.id}__${uid}@ornek.com`)).catch(() => null))?.data();
  if (member) return publishersFor([], [{ org, member: { ...(member as never), assignments: member.assignments } }])[0]!;
  const key = uid === 'muhtar2' ? 'mahalle-16-nilufer-baska' : uid === 'ahmet' ? 'il-16' : 'mahalle-16-nilufer-ataevler';
  const g = (await getDoc(doc(db, 'grants', `${uid}@ornek.com__${key}`))).data()!;
  return publishersFor([{ id: key, ...(g as never), grantedAt: '' }], [])[0]!;
}
const panel = (uid: string) => createAnnouncementPanel(fs(uid), { uid, name: uid });
const input = (patch: Partial<AnnouncementInput> = {}): AnnouncementInput => ({
  kind: 'duyuru',
  title: 'Su kesintisi',
  body: 'Yarın 09.00-13.00 arasında su kesintisi olacaktır.',
  region: { provinceCode: '16', districtId: '16-nilufer' },
  ...patch,
});
const live = () => createFirestoreAnnouncementRepository(guest()).listLive('16');

describe('resmî duyurular', () => {
  it('kurum: basın hazırlar ve onaya gönderir, özel kalem onaylar, herkes görür', async () => {
    const p = await publisher('basin');
    // Onaysız yayınlama yetkisi olmayan doğrudan yayınlayamaz.
    await expect(panel('basin').save(p, input(), 'yayinla')).rejects.toThrow();
    const id = await panel('basin').save(p, input(), 'onaya');
    expect(await live()).toEqual([]);
    await assertFails(getDoc(doc(guest(), 'announcements', id)));

    const kalem = panel('kalem');
    const pending = await kalem.listPending({ orgId: org.id });
    expect(pending.map((a) => a.id)).toEqual([id]);
    // Hazırlayan kendi duyurusunu onaylayamaz (onay yetkisi yok).
    await expect(panel('basin').approve(pending[0]!)).rejects.toThrow();
    await kalem.approve(pending[0]!);
    expect((await live()).map((a) => [a.id, a.author])).toEqual([[id, { type: 'kurum', orgId: org.id, name: 'Nilüfer Belediyesi' }]]);
    const log = await listAuditLog(fs('eren'));
    expect(log.filter((e) => e.module === 'gonderiler').map((e) => e.actorUid).sort()).toEqual(['basin', 'kalem']);
  });

  it('ret gerekçesiyle geri döner; hazırlayan düzeltip yeniden gönderir', async () => {
    const p = await publisher('basin');
    const id = await panel('basin').save(p, input(), 'onaya');
    const [a] = await panel('kalem').listPending({ orgId: org.id });
    await panel('kalem').reject(a!, 'Saat bilgisi yanlış');
    const mine = await panel('basin').listFor(p);
    expect(mine[0]).toMatchObject({ id, status: 'reddedildi', reviewNote: 'Saat bilgisi yanlış' });
    await panel('basin').save(p, input({ body: 'Yarın 10.00-14.00 arasında su kesintisi olacaktır.' }), 'onaya', mine[0]);
    expect((await panel('basin').listFor(p))[0]).toMatchObject({ status: 'onay-bekliyor' });
    expect((await panel('basin').listFor(p))[0]?.reviewNote).toBeUndefined();
  });

  it('"Onaysız yayınla" olan acil duyuruyu doğrudan yayınlar; acil en çok 7 gün; bölge dışına yazılamaz', async () => {
    const p = await publisher('fen');
    const soon = new Date(Date.now() + 86400000).toISOString();
    await panel('fen').save(p, input({ kind: 'acil', title: 'Yol kapalı', endsAt: soon }), 'yayinla');
    expect((await live()).map((a) => a.kind)).toEqual(['acil']);
    await expect(panel('fen').save(p, input({ kind: 'acil', endsAt: new Date(Date.now() + 10 * 86400000).toISOString() }), 'yayinla')).rejects.toThrow();
    await expect(panel('fen').save(p, input({ kind: 'acil' }), 'yayinla')).rejects.toThrow();
    await expect(panel('fen').save(p, input({ region: { provinceCode: '16', districtId: '16-osmangazi' } }), 'yayinla')).rejects.toThrow();
    await expect(panel('fen').save(p, input({ region: { provinceCode: '16' } }), 'yayinla')).rejects.toThrow();
    // Başka kurum adıyla ya da üye olmadan yazılamaz.
    await expect(panel('fen').save({ ...p, author: { type: 'kurum', orgId: org.id, name: 'Valilik' } }, input(), 'taslak')).rejects.toThrow();
    await expect(panel('veli').save(p, input(), 'taslak')).rejects.toThrow();
    // "Sil" yetkisi olan hazırlayan yayından kaldırır.
    const [a] = await live();
    await panel('fen').unpublish(a!, false);
    expect(await live()).toEqual([]);
  });

  it('muhtar: onaya gönderdiği duyuruyu il yöneticisi onaylar; "onaysız yayınla" olan muhtar doğrudan yayınlar', async () => {
    const p = await publisher('muhtar');
    const mahalle = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
    await expect(panel('muhtar').save(p, input({ region: mahalle }), 'yayinla')).rejects.toThrow();
    // Kendi mahallesi dışına (ilçe geneline) yazamaz.
    await expect(panel('muhtar').save(p, input(), 'onaya')).rejects.toThrow();
    await panel('muhtar').save(p, input({ region: mahalle }), 'onaya');

    const ahmet = panel('ahmet');
    const [a] = await ahmet.listPending({ provinceCode: '16' });
    expect(a?.author).toEqual({ type: 'kisi', role: 'muhtar', grantKey: 'mahalle-16-nilufer-ataevler' });
    await ahmet.approve(a!);
    expect(await live()).toHaveLength(1);

    const p2 = await publisher('muhtar2');
    await panel('muhtar2').save(p2, input({ region: { ...mahalle, neighbourhoodId: '16-nilufer-baska' } }), 'yayinla');
    expect(await live()).toHaveLength(2);
    // Muhtar başka muhtarın duyurusunu kaldıramaz; il yöneticisi kaldırır.
    const list = await live();
    await expect(panel('muhtar').unpublish(list[0]!, true)).rejects.toThrow();
    await ahmet.unpublish(list[0]!, true);
    expect(await live()).toHaveLength(1);
  });

  it('sabitleme: muhtar mahalle duyurusunu sabitler; ilçe geneli ya da acil duyuru sabitlenemez', async () => {
    const mahalle = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
    const p2 = await publisher('muhtar2');
    const baska = { ...mahalle, neighbourhoodId: '16-nilufer-baska' };
    const id = await panel('muhtar2').save(p2, input({ region: baska, pinned: true }), 'yayinla');
    expect((await live()).find((a) => a.id === id)?.pinned).toBe(true);
    const fen = await publisher('fen');
    await expect(panel('fen').save(fen, input({ pinned: true }), 'yayinla')).rejects.toThrow();
    const soon = new Date(Date.now() + 86400000).toISOString();
    await expect(panel('fen').save(fen, input({ kind: 'acil', endsAt: soon, region: { ...mahalle }, pinned: true }), 'yayinla')).rejects.toThrow();
  });

  it('yayındaki duyuru değiştirilemez; hazırlayan yalnızca kendi taslağını düzenler', async () => {
    const p = await publisher('fen');
    const id = await panel('fen').save(p, input(), 'yayinla');
    await assertFails(updateDoc(doc(fs('fen'), 'announcements', id), { title: 'Başka başlık', updatedAt: serverTimestamp() }));
    const draft = await panel('basin').save(await publisher('basin'), input(), 'taslak');
    await assertFails(updateDoc(doc(fs('kalem'), 'announcements', draft), { title: 'Başka başlık', updatedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(fs('kalem'), 'announcements', draft)));
    await assertFails(getDoc(doc(fs('veli'), 'announcements', draft)));
  });
});
