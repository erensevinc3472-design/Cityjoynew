import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { DEFAULT_IMPORTANT_DAYS, type ImportantDay } from '@cityjoy/shared';
import { createImportantDaysService } from '@cityjoy/shared/firebase';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
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

const orgId = 'bld-16-osmangazi';
const now = Timestamp.now();
const local: ImportantDay[] = [{ id: 'kurtulus', title: 'Bursa’nın Kurtuluşu', kind: 'yerel', md: '09-11', idea: 'Tören programı' }];

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/eren'), { addedAt: 'konsol' });
    await setDoc(doc(db, 'organizations', orgId), {
      name: 'Osmangazi Belediyesi', kind: 'ilce-belediyesi', scope: { level: 'ilce', provinceCode: '16', districtId: '16-osmangazi' },
      modules: ['gonderiler', 'istatistik'], officialEmail: 'kalem@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: now, updatedAt: now,
    });
    for (const [uid, isOrgAdmin, assignments] of [['kalem', true, {}], ['basin', false, { gonderiler: ['goruntule', 'ekle'] }], ['analiz', false, { istatistik: ['goruntule'] }]] as const) {
      await setDoc(doc(db, 'orgMembers', `${orgId}__${uid}@ornek.com`), {
        orgId, email: `${uid}@ornek.com`, displayName: uid, isOrgAdmin, assignments, addedBy: 'eren', updatedAt: now,
      });
    }
  });
});

describe('Basın Masası: önemli günler', () => {
  it('ülke geneli listeyi yalnızca admin yazar, herkes okur', async () => {
    await assertSucceeds(createImportantDaysService(fs('eren'), 'eren').saveNational(DEFAULT_IMPORTANT_DAYS));
    expect((await createImportantDaysService(fs('basin'), 'basin').loadNational())?.length).toBe(DEFAULT_IMPORTANT_DAYS.length);
    await assertFails(createImportantDaysService(fs('kalem'), 'kalem').saveNational(DEFAULT_IMPORTANT_DAYS));
    await assertFails(setDoc(doc(fs('eren'), 'config', 'importantDays'), { days: [], extra: 1, updatedBy: 'eren', updatedAt: serverTimestamp() }));
  });

  it('yerel günleri kurum yöneticisi ve duyuru hazırlayan yazar; kurum üyeleri okur, dışarıdan okunmaz', async () => {
    await assertSucceeds(createImportantDaysService(fs('kalem'), 'kalem').saveLocal(orgId, local, { module: 'kurumlar', action: 'duzenle' }));
    await assertSucceeds(createImportantDaysService(fs('basin'), 'basin').saveLocal(orgId, local, { module: 'gonderiler', action: 'ekle' }));
    expect(await createImportantDaysService(fs('analiz'), 'analiz').loadLocal(orgId)).toEqual(local);
    await assertFails(createImportantDaysService(fs('analiz'), 'analiz').saveLocal(orgId, local, { module: 'gonderiler', action: 'ekle' }));
    await assertFails(getDoc(doc(fs('ayse'), 'orgDays', orgId)));
    await assertFails(createImportantDaysService(fs('ayse'), 'ayse').saveLocal(orgId, local, { module: 'gonderiler', action: 'ekle' }));
    // 60'tan fazla gün yazılamaz.
    await assertFails(setDoc(doc(fs('kalem'), 'orgDays', orgId), { days: Array(61).fill(local[0]), updatedBy: 'kalem', updatedAt: serverTimestamp() }));
  });
});
