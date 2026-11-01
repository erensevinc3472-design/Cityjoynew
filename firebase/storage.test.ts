import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cityjoy',
    storage: { rules: readFileSync(path.join(here, 'storage.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearStorage());

const st = (uid: string) => env.authenticatedContext(uid).storage() as unknown as FirebaseStorage;
const guest = () => env.unauthenticatedContext().storage() as unknown as FirebaseStorage;
const jpeg = (size = 1000) => new Uint8Array(size);
const put = (s: FirebaseStorage, p: string, data = jpeg(), contentType = 'image/jpeg') => uploadBytes(ref(s, p), data, { contentType });

describe('Dosya deposu: gönderi fotoğrafları', () => {
  it('sahibi kendi klasörüne JPEG yükler; başkası, girişsiz, başka tür, büyük dosya, yanlış ad olmaz', async () => {
    await assertSucceeds(put(st('ayse'), 'posts/ayse/p1/0.jpg'));
    await assertSucceeds(put(st('ayse'), 'posts/ayse/p1/3.jpg'));
    await assertFails(put(st('ali'), 'posts/ayse/p1/1.jpg'));
    await assertFails(put(guest(), 'posts/ayse/p1/1.jpg'));
    await assertFails(put(st('ayse'), 'posts/ayse/p1/1.jpg', jpeg(), 'image/png'));
    await assertFails(put(st('ayse'), 'posts/ayse/p1/1.jpg', jpeg(1_500_001)));
    await assertFails(put(st('ayse'), 'posts/ayse/p1/4.jpg'));
    await assertFails(put(st('ayse'), 'posts/ayse/p1/0.png'));
    // Üzerine yazma kapalıdır (allow update: false). Emülatör var olan dosyaya yüklemeyi de "create" saydığı için bu
    // denetim burada sınanamaz; gerçek Firebase'de geçerlidir.
    // Başka klasörler kapalı.
    await assertFails(put(st('ayse'), 'baska/ayse.jpg'));
  });

  it('giriş yapmış kişi okur, girişsiz okuyamaz; yalnızca sahibi siler', async () => {
    await put(st('ayse'), 'posts/ayse/p1/0.jpg');
    await assertSucceeds(getBytes(ref(st('ali'), 'posts/ayse/p1/0.jpg')));
    await assertFails(getBytes(ref(guest(), 'posts/ayse/p1/0.jpg')));
    await assertFails(deleteObject(ref(st('ali'), 'posts/ayse/p1/0.jpg')));
    await assertSucceeds(deleteObject(ref(st('ayse'), 'posts/ayse/p1/0.jpg')));
  });
  it('diğer görseller: kendi klasörüne, bilinen türde, rastgele adla', async () => {
    await assertSucceeds(put(st('ayse'), 'media/ayse/etkinlik/abcDEF123456.jpg'));
    await assertSucceeds(put(st('ayse'), 'media/ayse/isletme-vitrin/abcDEF123456xyz.jpg'));
    await assertSucceeds(put(st('ayse'), 'media/ayse/profil/abcDEF123456.jpg'));
    await assertFails(put(st('ali'), 'media/ayse/etkinlik/abcDEF1234567.jpg'));
    await assertFails(put(st('ayse'), 'media/ayse/baska/abcDEF123456.jpg'));
    await assertFails(put(st('ayse'), 'media/ayse/kurum/kisa.jpg'));
    await assertFails(put(st('ayse'), 'media/ayse/kurum/abcDEF123456.jpg', jpeg(), 'image/png'));
    await assertSucceeds(getBytes(ref(st('ali'), 'media/ayse/etkinlik/abcDEF123456.jpg')));
    await assertFails(deleteObject(ref(st('ali'), 'media/ayse/etkinlik/abcDEF123456.jpg')));
  });
});
