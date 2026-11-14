import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { DEFAULT_APP_CONFIG, emptyBanner } from '@cityjoy/shared';
import { createAppConfigAdmin, getAppConfig } from '@cityjoy/shared/firebase';
import { deleteDoc, doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
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
const guest = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

describe('Uygulama ayarları', () => {
  it('admin kaydeder (geçmiş ve işlem kaydıyla), giriş yapmamış kişi de okur; geri alınabilir', async () => {
    expect(await getAppConfig(guest())).toEqual(DEFAULT_APP_CONFIG);
    const admin = createAppConfigAdmin(fs('eren'));
    const banner = { ...emptyBanner(), text: { ...emptyBanner().text, tr: 'Bu gece bakım var' }, provinces: ['16'] };
    await admin.save('eren', { ...DEFAULT_APP_CONFIG, banner, closed: ['carsi'], minVersion: { ios: '1.0.3', android: '1.0.3' } });
    const read = await getAppConfig(guest());
    expect(read.banner?.text.tr).toBe('Bu gece bakım var');
    expect(read.closed).toEqual(['carsi']);
    const history = await admin.history();
    expect(history).toHaveLength(1);
    expect(history[0].parts).toEqual(['banner', 'update', 'closed']);
    await admin.rollback('eren', history[0]);
    expect(await getAppConfig(guest())).toEqual(DEFAULT_APP_CONFIG);
    expect((await admin.history())[0].rollback).toBe(true);
  });

  it('admin olmayan yazamaz ve geçmişi okuyamaz; Acil kapatılamaz; geçmiş silinemez', async () => {
    await assertFails(createAppConfigAdmin(fs('ali')).save('ali', { ...DEFAULT_APP_CONFIG, closed: ['travel'] }));
    await assertFails(createAppConfigAdmin(fs('ali')).history());
    const raw = (data: Record<string, unknown>) =>
      setDoc(doc(fs('eren'), 'config', 'app'), { ...DEFAULT_APP_CONFIG, updatedBy: 'eren', updatedAt: serverTimestamp(), ...data });
    await assertFails(raw({ closed: ['urgent'] }));
    await assertFails(raw({ banner: { kind: 'bakim', text: { tr: '' }, provinces: [] } }));
    await assertFails(raw({ gizli: true }));
    await createAppConfigAdmin(fs('eren')).save('eren', { ...DEFAULT_APP_CONFIG, closed: ['travel'] });
    const [h] = await createAppConfigAdmin(fs('eren')).history();
    await assertFails(deleteDoc(doc(fs('eren'), 'appConfigHistory', h.id)));
  });
});
