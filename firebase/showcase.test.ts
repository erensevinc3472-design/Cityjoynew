import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { CityShowcaseInput } from '@cityjoy/shared';
import { createFirestoreShowcaseRepository, createShowcaseAdmin } from '@cityjoy/shared/firebase';
import { collection, doc, getDocs, query, setDoc, Timestamp, where, type Firestore } from 'firebase/firestore';
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

const issue = (n: number): CityShowcaseInput => ({
  provinceCode: '16',
  issue: n,
  title: `Bursa Vitrini ${n}`,
  intro: 'Haftanın seçkisi.',
  weekOf: '2026-11-02',
  stories: [{ title: 'İskender durakları', theme: 'lezzet', items: [{ kind: 'yer', id: 'bursa-iskender', name: 'İskender kebap', note: 'Tereyağı masada.' }] }],
  status: 'taslak',
});

describe('Şehir Vitrini', () => {
  it('il yöneticisi kendi ilinde hazırlar ve yayına alır; uygulama yalnızca yayındakini görür; başka il yazamaz', async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const now = Timestamp.now();
      await setDoc(doc(ctx.firestore(), 'grants', 'ahmet@ornek.com__il-16'), {
        email: 'ahmet@ornek.com', displayName: 'Ahmet', role: 'il-yoneticisi', scope: { level: 'il', provinceCode: '16' },
        modules: { 'sehir-rehberi': ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla'] }, grantedBy: 'eren', grantedAt: now, updatedAt: now,
      });
    });
    const admin = createShowcaseAdmin(fs('ahmet'), 'ahmet');
    const app = createFirestoreShowcaseRepository(fs('ali'));
    const id1 = await admin.save(null, issue(1));
    await admin.save(null, issue(2));
    expect(await app.listPublished('16')).toEqual([]);
    const [two, one] = await admin.list('16');
    expect([two!.issue, one!.issue]).toEqual([2, 1]);
    await admin.setStatus(one!, 'yayinda');
    await admin.setStatus(two!, 'yayinda');
    expect((await app.listPublished('16')).map((s) => s.issue)).toEqual([2, 1]);
    expect((await app.listPublished('16'))[1]!.id).toBe(id1);

    // Başka ile yazamaz; sıradan kullanıcı yazamaz.
    await expect(admin.save(null, { ...issue(1), provinceCode: '35' })).rejects.toThrow();
    await expect(createShowcaseAdmin(fs('ali'), 'ali').save(null, issue(3))).rejects.toThrow();
    await admin.remove(one!);
    expect((await app.listPublished('16')).map((s) => s.issue)).toEqual([2]);
    const log = await getDocs(query(collection(fs('ahmet'), 'auditLog'), where('actorUid', '==', 'ahmet')));
    expect(log.docs.length).toBeGreaterThanOrEqual(5);
  }, 30000);
});
