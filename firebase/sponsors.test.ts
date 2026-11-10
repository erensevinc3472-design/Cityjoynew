import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { pickSponsor, type SponsorInput } from '@cityjoy/shared';
import { createSponsorAdmin, createSponsorRepository } from '@cityjoy/shared/firebase';
import { doc, setDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
const input: SponsorInput = { name: 'Osmangazi Belediyesi', line: 'Bu sayfa Osmangazi Belediyesi katkılarıyla', url: 'https://www.osmangazi.bel.tr', provinceCode: '16', places: ['sosyal'], startsOn: '2026-01-01', endsOn: '2099-12-31', active: true };

describe('Sponsorlar', () => {
  it('admin ekler ve düzenler; uygulama ilin ve Türkiye genelinin sponsorlarını okur; başkası yazamaz', async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins', 'eren'), { email: 'eren@ornek.com' });
    });
    const admin = createSponsorAdmin(fs('eren'), 'eren');
    await admin.save(null, input);
    await admin.save(null, { ...input, name: 'Ulusal Marka', provinceCode: 'TR', places: ['sosyal', 'firsatlar'] });
    await admin.save(null, { ...input, name: 'İzmir Sponsoru', provinceCode: '35' });
    const all = await admin.listAll();
    expect(all).toHaveLength(3);
    const own = all.find((s) => s.provinceCode === '16')!;
    await admin.save(own.id, { ...input, url: undefined, active: false });

    const app = createSponsorRepository(env.unauthenticatedContext().firestore() as unknown as Firestore);
    const list = await app.listFor('16');
    expect(list.map((s) => s.name).sort()).toEqual(['Osmangazi Belediyesi', 'Ulusal Marka']);
    expect(list.find((s) => s.provinceCode === '16')!.url).toBeUndefined();
    expect(pickSponsor(list, '16', 'sosyal')?.name).toBe('Ulusal Marka');

    await assertFails(setDoc(doc(fs('ali'), 'sponsors', 'x'), { ...input, updatedBy: 'ali', updatedAt: serverTimestamp() }));
    await assertFails(createSponsorAdmin(fs('eren'), 'eren').save(null, { ...input, url: 'http://kotu.com' }));
    await assertFails(createSponsorAdmin(fs('ali'), 'ali').remove(own));
    await admin.remove(own);
    expect(await admin.listAll()).toHaveLength(2);
  });
});
