import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { AdoptionInput } from '@cityjoy/shared';
import { createAdoptionPanel, createAdoptionRepository } from '@cityjoy/shared/firebase';
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-cityjoy', firestore: { rules: readFileSync(path.join(here, 'firestore.rules'), 'utf8') } });
});
afterAll(() => env.cleanup());
const fs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@ornek.com`, email_verified: true }).firestore() as unknown as Firestore;
const guest = () => env.unauthenticatedContext().firestore() as unknown as Firestore;
const now = Timestamp.now();

const dernek = { id: 'krm-pati-dostlari', name: 'Pati Dostları Derneği', scope: { level: 'il', provinceCode: '16' } as const };
const belediye = { id: 'bld-16-osmangazi', name: 'Osmangazi Belediyesi', scope: { level: 'ilce', provinceCode: '16', districtId: '16-osmangazi' } as const };
const pamuk: AdoptionInput = {
  name: 'Pamuk', species: 'kopek', age: '2 yaşında', sex: 'disi', vaccinated: true, neutered: false, urgent: true,
  about: 'Sevimli ve enerjik, diğer hayvanlarla uyumlu.', region: { provinceCode: '16', districtId: '16-osmangazi' }, phone: '0224 000 00 00',
};

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    const org = (o: typeof dernek | typeof belediye, kind: string, modules: string[]) =>
      setDoc(doc(db, 'organizations', o.id), { name: o.name, kind, scope: o.scope, modules, officialEmail: 'x@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: now, updatedAt: now });
    await org(dernek, 'dernek', ['sahiplendirme']);
    await org(belediye, 'ilce-belediyesi', ['etkinlikler', 'sahiplendirme']);
    const member = (orgId: string, uid: string, assignments: object, isOrgAdmin = false) =>
      setDoc(doc(db, 'orgMembers', `${orgId}__${uid}@ornek.com`), { orgId, email: `${uid}@ornek.com`, displayName: uid, isOrgAdmin, assignments, addedBy: 'eren', updatedAt: now });
    await member(dernek.id, 'gonullu', { sahiplendirme: ['goruntule', 'ekle', 'duzenle'] });
    await member(dernek.id, 'baskan', {}, true);
    await member(belediye.id, 'barinak', { sahiplendirme: ['goruntule', 'ekle', 'duzenle'] });
    await member(belediye.id, 'basin', { etkinlikler: ['goruntule', 'ekle'] });
  });
});

describe('hayvan sahiplendirme', () => {
  it('dernek ve belediye barınağı ilan verir; herkes görür; sahiplendirildi olarak işaretlenir', async () => {
    const id = await createAdoptionPanel(fs('gonullu'), 'gonullu').save(dernek, pamuk);
    await assertSucceeds(createAdoptionPanel(fs('barinak'), 'barinak').save(belediye, { ...pamuk, name: 'Duman', species: 'kedi', urgent: false }));
    // Kurum yöneticisi (görev işaretlemeden) de ilan verir.
    await assertSucceeds(createAdoptionPanel(fs('baskan'), 'baskan').save(dernek, { ...pamuk, name: 'Lola' }));
    const list = await createAdoptionRepository(guest()).listLive('16');
    expect(list.map((a) => a.name).sort()).toEqual(['Duman', 'Lola', 'Pamuk']);
    const [a] = await createAdoptionPanel(fs('gonullu'), 'gonullu').listFor(dernek.id);
    await createAdoptionPanel(fs('gonullu'), 'gonullu').setStatus(dernek, a!, 'sahiplendirildi');
    const after = (await createAdoptionRepository(guest()).listLive('16')).map((x) => x.name);
    expect(after).toHaveLength(2);
    expect(after).not.toContain(a!.name);
    expect((await createAdoptionRepository(guest()).get(a!.id))?.status).toBe('sahiplendirildi');
    expect(id).toBeTruthy();
  });

  it('görevi olmayan, bölge dışına, başka kurum adına ya da iletişimsiz ilan verilemez', async () => {
    await expect(createAdoptionPanel(fs('basin'), 'basin').save(belediye, pamuk)).rejects.toThrow();
    await expect(createAdoptionPanel(fs('ayse'), 'ayse').save(dernek, pamuk)).rejects.toThrow();
    await expect(createAdoptionPanel(fs('barinak'), 'barinak').save(belediye, { ...pamuk, region: { provinceCode: '16', districtId: '16-nilufer' } })).rejects.toThrow();
    await expect(createAdoptionPanel(fs('gonullu'), 'gonullu').save({ ...dernek, name: 'Başka Ad' }, pamuk)).rejects.toThrow();
    await expect(createAdoptionPanel(fs('gonullu'), 'gonullu').save(dernek, { ...pamuk, phone: undefined })).rejects.toThrow();
  });

  it('dernek hesabına yalnızca sahiplendirme verilir; gönüllülük etkinliği ücretli olamaz', async () => {
    const ref = doc(fs('eren'), 'organizations', 'krm-baska-dernek');
    const base = { name: 'Başka Dernek', kind: 'dernek', scope: { level: 'il', provinceCode: '16' }, officialEmail: 'y@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: now, updatedAt: now };
    await assertFails(setDoc(ref, { ...base, modules: ['sahiplendirme', 'etkinlikler'] }));
    await assertFails(setDoc(doc(fs('eren'), 'organizations', 'krm-bir-kurum'), { ...base, kind: 'kurum', modules: ['sahiplendirme'] }));
    expect((await getDoc(ref).catch(() => null))?.exists() ?? false).toBe(false);
  });
});
