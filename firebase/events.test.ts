import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { publishersFor, type Action, type EventInput, type Organization, type Publisher } from '@cityjoy/shared';
import { createEventPanel, createFirestoreEventRepository, listAuditLog } from '@cityjoy/shared/firebase';
import { doc, getDoc, increment, Timestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
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
  id: 'bld-16-nilufer', name: 'Nilüfer Belediyesi', kind: 'ilce-belediyesi', scope: nilufer, modules: ['gonderiler', 'etkinlikler'],
  officialEmail: 'kalem@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: '',
};
const staff: Record<string, Action[]> = {
  basin: ['goruntule', 'ekle', 'duzenle'],
  kalem: ['goruntule', 'ekle', 'duzenle', 'onayla'],
  fen: ['goruntule', 'ekle', 'yayinla', 'sil'],
};
const muhtarModules = (extra: Action[] = []) => ({ etkinlikler: ['goruntule', 'ekle', 'duzenle', ...extra] });
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
        orgId: id, email: `${uid}@ornek.com`, displayName: uid, isOrgAdmin: uid === 'kalem', assignments: { etkinlikler: actions }, addedBy: 'eren', updatedAt: now,
      });
    }
    const grant = (email: string, role: string, scope: object, modules: object) =>
      setDoc(doc(db, 'grants', `${email}__${'neighbourhoodId' in scope ? `mahalle-${(scope as typeof ataevler).neighbourhoodId}` : 'il-16'}`), {
        email, displayName: email, role, scope, modules, grantedBy: 'eren', grantedAt: now, updatedAt: now,
      });
    await grant('muhtar@ornek.com', 'muhtar', ataevler, muhtarModules());
    await grant('muhtar2@ornek.com', 'muhtar', { ...ataevler, neighbourhoodId: '16-nilufer-baska' }, muhtarModules(['yayinla']));
    await grant('ahmet@ornek.com', 'il-yoneticisi', { level: 'il', provinceCode: '16' }, { etkinlikler: ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla', 'yayinla'] });
  });
});

/** Oturumdaki kişinin yayınlayan hesabı (paneldeki seçimle aynı). */
async function publisher(uid: string): Promise<Publisher> {
  const db = fs(uid);
  const member = (await getDoc(doc(db, 'orgMembers', `${org.id}__${uid}@ornek.com`)).catch(() => null))?.data();
  if (member) return publishersFor([], [{ org, member: { ...(member as never), assignments: member.assignments } }], new Date(), 'etkinlikler')[0]!;
  const key = uid === 'muhtar2' ? 'mahalle-16-nilufer-baska' : uid === 'ahmet' ? 'il-16' : 'mahalle-16-nilufer-ataevler';
  const g = (await getDoc(doc(db, 'grants', `${uid}@ornek.com__${key}`))).data()!;
  return publishersFor([{ id: key, ...(g as never), grantedAt: '' }], [], new Date(), 'etkinlikler')[0]!;
}
const panel = (uid: string) => createEventPanel(fs(uid), { uid, name: uid });
const day = 86400000;
const input = (patch: Partial<EventInput> = {}): EventInput => ({
  title: 'Nilüfer Caz Gecesi',
  description: 'Açık havada ücretsiz caz konseri.',
  category: 'muzik',
  startsAt: new Date(Date.now() + 2 * day).toISOString(),
  endsAt: new Date(Date.now() + 2 * day + 3 * 3600000).toISOString(),
  venueName: 'Nilüfer Kültür Merkezi',
  address: 'Kültür Cad. No: 1',
  region: { provinceCode: '16', districtId: '16-nilufer' },
  free: true,
  ...patch,
});
const upcoming = () => createFirestoreEventRepository(guest()).listUpcoming('16');

describe('etkinlikler', () => {
  it('basın hazırlar, özel kalem onaylar; herkes görür; işlem kaydı', async () => {
    const p = await publisher('basin');
    await expect(panel('basin').save(p, input(), 'yayinla')).rejects.toThrow();
    const id = await panel('basin').save(p, input({ free: false, priceNote: '50 TL', ticketUrl: 'https://bilet.ornek.com/caz', capacity: 2 }), 'onaya');
    expect(await upcoming()).toEqual([]);
    const [e] = await panel('kalem').listPending({ orgId: org.id });
    await panel('kalem').approve(e!);
    expect((await upcoming()).map((x) => [x.id, x.priceNote, x.capacity, x.attendeeCount])).toEqual([[id, '50 TL', 2, 0]]);
    const log = await listAuditLog(fs('eren'));
    expect(log.filter((x) => x.module === 'etkinlikler').map((x) => x.actorUid).sort()).toEqual(['basin', 'kalem']);
  });

  it('bütün alanları dolu etkinlik (ücretli, adresli, bilet bağlantılı, kontenjanlı) doğrudan yayınlanır', async () => {
    const full = input({
      title: 'Nilüfer Caz Gecesi', description: 'Nilüfer Kültür Merkezi bahçesinde açık havada caz konseri. Tüm Bursalılar davetlidir.',
      address: 'Kültür Cad. No: 1, Nilüfer', free: false, priceNote: '50 TL, öğrenciye 25 TL', ticketUrl: 'https://bilet.nilufer.bel.tr/caz', capacity: 2,
      region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' },
    });
    await panel('fen').save(await publisher('fen'), full, 'yayinla');
    expect(await upcoming()).toHaveLength(1);
  });

  it('katılım: sayaç tam bir artar / azalır, kontenjan dolunca katılım alınmaz; ad yalnızca izinle görünür', async () => {
    const id = await panel('fen').save(await publisher('fen'), input({ capacity: 2 }), 'yayinla');
    const repo = (uid: string) => createFirestoreEventRepository(fs(uid));
    await repo('ali').join(id, 'ali', { name: 'Ali K.' });
    await repo('veli').join(id, 'veli', null);
    expect((await upcoming())[0]?.attendeeCount).toBe(2);
    // Kontenjan dolu; ikinci kez katılınamaz; sayaç elle değiştirilemez.
    await expect(repo('ayse').join(id, 'ayse', null)).rejects.toThrow();
    await expect(repo('ali').join(id, 'ali', null)).rejects.toThrow();
    await assertFails(updateDoc(doc(fs('ayse'), 'events', id), { attendeeCount: increment(-1) }));
    expect(await repo('ali').myAttendance(id, 'ali')).toEqual({ shareName: true });
    // Organizatör yalnızca adını paylaşanı görür; başkası katılım kaydını okuyamaz.
    expect(await panel('kalem').listNamedAttendees(id)).toEqual(['Ali K.']);
    await assertFails(getDoc(doc(fs('ayse'), 'events', id, 'attendees', 'veli')));
    await repo('veli').leave(id, 'veli');
    await repo('ayse').join(id, 'ayse', null);
    // Profil > Katıldıklarım: yalnızca kendi katılımları.
    expect((await repo('ali').listJoined('ali')).map((x) => [x.kind, x.id])).toEqual([['etkinlik', id]]);
    await expect(repo('veli').listJoined('ali')).rejects.toThrow();
    // Hesap silmede bütün katılımlar silinir.
    await repo('ali').leaveAll('ali');
    expect((await upcoming())[0]?.attendeeCount).toBe(1);
  });

  it('iptal edilen etkinlik "iptal" olarak görünür, katılım alınmaz; yayından kaldırılan görünmez', async () => {
    const id = await panel('fen').save(await publisher('fen'), input(), 'yayinla');
    const [e] = await upcoming();
    await panel('fen').cancel(e!, false);
    expect((await upcoming()).map((x) => [x.id, x.status])).toEqual([[id, 'iptal']]);
    await expect(createFirestoreEventRepository(fs('ali')).join(id, 'ali', null)).rejects.toThrow();
    // Fen işlerinde "Sil" var; basın müdüründe yok.
    await expect(panel('basin').unpublish((await upcoming())[0]!, false)).rejects.toThrow();
    await panel('fen').unpublish((await upcoming())[0]!, false);
    expect(await upcoming()).toEqual([]);
  });

  it('kurallar: bölge dışı, http bağlantı, 60 günden uzun ve geçmiş etkinlik yazılamaz; muhtarınkini il yöneticisi onaylar', async () => {
    const p = await publisher('fen');
    await expect(panel('fen').save(p, input({ region: { provinceCode: '16', districtId: '16-osmangazi' } }), 'yayinla')).rejects.toThrow();
    await expect(panel('fen').save(p, input({ ticketUrl: 'http://bilet.ornek.com' }), 'yayinla')).rejects.toThrow();
    await expect(panel('fen').save(p, input({ endsAt: new Date(Date.now() + 90 * day).toISOString() }), 'yayinla')).rejects.toThrow();
    await expect(panel('fen').save(p, input({ startsAt: new Date(Date.now() - 3 * day).toISOString(), endsAt: new Date(Date.now() - day).toISOString() }), 'yayinla')).rejects.toThrow();
    await expect(panel('fen').save(p, input({ free: false }), 'yayinla')).rejects.toThrow();

    const mahalle = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
    await panel('muhtar').save(await publisher('muhtar'), input({ region: mahalle }), 'onaya');
    const [e] = await panel('ahmet').listPending({ provinceCode: '16' });
    await panel('ahmet').approve(e!);
    expect(await upcoming()).toHaveLength(1);
  });
});
