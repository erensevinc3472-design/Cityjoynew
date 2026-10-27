import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { LEGAL_TEXT_VERSION } from '@cityjoy/shared';
import { createFirestoreOccupationRepository, createFirestoreProfileRepository } from '@cityjoy/shared/firebase';
import type { Firestore } from 'firebase/firestore';
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
beforeEach(() => env.clearFirestore());

const consent = { granted: true, at: new Date().toISOString(), textVersion: LEGAL_TEXT_VERSION };

describe('profil deposu kurallarla uyumlu', () => {
  it('oluşturur, okur, günceller, mahalleyi kurala göre değiştirir ve siler', async () => {
    const db = env.authenticatedContext('ayse').firestore() as unknown as Firestore;
    const repo = createFirestoreProfileRepository(db);

    await repo.create({ uid: 'ayse', displayName: 'Ayşe', language: 'tr', birthYear: 1990, consents: { terms: consent, privacyNotice: consent } });
    let p = (await repo.get('ayse'))!;
    expect(p.isPrivate).toBe(false);
    expect(p.createdAt).toMatch(/^\d{4}-/);

    await repo.update('ayse', { gender: 'kadin', occupationId: 'ogretmen', targeting: consent }, p);
    const loc = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
    await repo.update('ayse', { location: loc }, p);
    p = (await repo.get('ayse'))!;
    expect(p.location).toEqual(loc);
    expect(p.locationChangedAt).toBeTruthy();
    expect(p.consents.targeting?.granted).toBe(true);

    // Ay dolmadan ikinci mahalle değişikliği reddedilir; il/ilçe aynı kalıp başka alan güncellemesi serbest.
    await expect(repo.update('ayse', { location: { ...loc, neighbourhoodId: '16-nilufer-besevler' } }, p)).rejects.toThrow();
    await repo.update('ayse', { language: 'en' }, p);

    await repo.delete('ayse');
    expect(await repo.get('ayse')).toBeNull();
  });

  it('15 yaşındaki kullanıcının hesabı gizli açılır', async () => {
    const db = env.authenticatedContext('genc').firestore() as unknown as Firestore;
    const repo = createFirestoreProfileRepository(db);
    await repo.create({ uid: 'genc', displayName: 'Genç', language: 'tr', birthYear: new Date().getFullYear() - 15, consents: { terms: consent, privacyNotice: consent } });
    expect((await repo.get('genc'))!.isPrivate).toBe(true);
  });

  it('meslek listesi boşsa varsayılan liste döner', async () => {
    const db = env.unauthenticatedContext().firestore() as unknown as Firestore;
    const list = await createFirestoreOccupationRepository(db).listActive();
    expect(list.length).toBeGreaterThan(20);
    expect(list.map((o) => o.id)).toContain('belirtmek-istemiyorum');
  });
});
