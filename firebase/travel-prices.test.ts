import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createTravelPrices } from '@cityjoy/shared/firebase';
import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
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
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admins/eren'), { addedAt: 'konsol' });
  });
});

const fs = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;

describe('Planla fiyatları', () => {
  it('admin kaydeder, herkes okur; yoksa null', async () => {
    const guest = createTravelPrices(env.unauthenticatedContext().firestore() as unknown as Firestore);
    expect(await guest.get()).toBeNull();
    await createTravelPrices(fs('eren')).save('eren', { fuel: { benzin: 51.4, lpg: 26 }, busPerKm: { min: 1.2, max: 1.8 }, month: '2026-10' });
    expect(await guest.get()).toMatchObject({ fuel: { benzin: 51.4, lpg: 26 }, busPerKm: { min: 1.2, max: 1.8 }, month: '2026-10' });
  });

  it('admin olmayan ya da hatalı değer yazamaz', async () => {
    await assertFails(createTravelPrices(fs('ali')).save('ali', { fuel: { benzin: 50 }, month: '2026-10' }));
    const bad = (data: Record<string, unknown>) =>
      setDoc(doc(fs('eren'), 'config', 'travelPrices'), { fuel: { benzin: 50 }, month: '2026-10', updatedBy: 'eren', updatedAt: serverTimestamp(), ...data });
    await assertFails(bad({ fuel: { benzin: 0 } }));
    await assertFails(bad({ fuel: { kerosen: 30 } }));
    await assertFails(bad({ busPerKm: { min: 3, max: 1 } }));
    await assertFails(bad({ month: 'ekim' }));
  });
});
