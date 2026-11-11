// Emülatörde hazırlanan "İçini gez" gezilerini yayındaki Firebase'e taşır (Panel > Seyahat ile aynı kayıt kodu,
// işlem kaydı dahil). Giriş: admin hesabının e-postası ve şifresi, çalıştıran kişi kendisi yazar (dosyaya yazılmaz).
//   Deneme (giriş yok, yalnızca resimleri hazırlar ve listeyi gösterir):  npx vite-node scripts/seyahat-gezi-yukle.ts -- 16 --dene
//   Yükleme:                                                              npx vite-node scripts/seyahat-gezi-yukle.ts -- 16
// Emülatör (8080) ve resimleri veren yerel depo (9199) açık olmalı. Yayında olan yerde yalnızca gezi değişir,
// diğer alanlara dokunulmaz; yayında olmayan yer emülatördeki hâliyle eklenir. Yüklenen resimler önbellekte tutulur,
// yarıda kalırsa yeniden çalıştırınca kaldığı yerden sürer.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import sharp from 'sharp';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { createTravelAdmin } from '@cityjoy/shared/firebase';
import { PHOTO_UPLOAD, mediaPath } from '@cityjoy/shared';

const args = process.argv.slice(2).filter((a) => a !== '--');
const cityId = args.find((a) => /^\d\d$/.test(a));
const dry = args.includes('--dene');
if (!cityId) throw new Error('İl kodu gerekli, örnek: 16');

const EMU = 'http://127.0.0.1:8080/v1/projects/cityjoynew/databases/(default)/documents';
const CACHE_DIR = 'node_modules/.cache';
const CACHE = `${CACHE_DIR}/gezi-yukle.json`;
const cache: Record<string, { path: string; url: string; width: number; height: number }> = existsSync(CACHE)
  ? JSON.parse(readFileSync(CACHE, 'utf8'))
  : {};

// Firestore REST değerini düz değere çevirir.
const plain = (v: any): any =>
  'stringValue' in v ? v.stringValue
  : 'integerValue' in v ? Number(v.integerValue)
  : 'doubleValue' in v ? v.doubleValue
  : 'booleanValue' in v ? v.booleanValue
  : 'nullValue' in v ? null
  : 'timestampValue' in v ? v.timestampValue
  : 'arrayValue' in v ? (v.arrayValue.values ?? []).map(plain)
  : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, plain(x)]))
  : undefined;

async function emulatorPlaces() {
  const out: { id: string; data: any }[] = [];
  let token = '';
  do {
    const r: any = await (await fetch(`${EMU}/travelPlaces?pageSize=300${token ? `&pageToken=${token}` : ''}`, { headers: { Authorization: 'Bearer owner' } })).json();
    for (const d of r.documents ?? []) {
      const data = plain({ mapValue: d });
      if (data.cityId === cityId && data.tour?.length) out.push({ id: d.name.split('/').pop(), data });
    }
    token = r.nextPageToken ?? '';
  } while (token);
  return out.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
}

async function jpeg(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Resim okunamadı: ${url}`);
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
    .rotate()
    .resize({ width: PHOTO_UPLOAD.maxEdge, height: PHOTO_UPLOAD.maxEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  if (data.length > PHOTO_UPLOAD.maxBytes) throw new Error(`Resim çok büyük (${data.length}): ${url}`);
  return { data, width: info.width, height: info.height };
}

function ask(q: string, hidden = false): Promise<string> {
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) (rl as any)._writeToOutput = (s: string) => s.includes(q) && process.stdout.write(s);
    rl.question(q, (a) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      done(a.trim());
    });
  });
}

const env = Object.fromEntries(
  readFileSync('apps/panel/.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^VITE_FIREBASE_\w+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

const places = await emulatorPlaces();
const scenes = places.reduce((n, p) => n + p.data.tour.length, 0);
console.log(`Emülatörde ${places.length} yer, ${scenes} sahne.`);

if (dry) {
  let total = 0;
  for (const p of places) {
    const sizes = [];
    for (const s of p.data.tour) {
      const j = await jpeg(s.image.url);
      total += j.data.length;
      sizes.push(`${Math.round(j.data.length / 1024)}KB`);
    }
    console.log(`${p.id} (${p.data.name}): ${sizes.join(' ')}`);
  }
  console.log(`Toplam ${Math.round(total / 1024 / 1024)} MB. Deneme bitti, hiçbir şey yüklenmedi.`);
  process.exit(0);
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
console.log(`Yayındaki proje: ${env.VITE_FIREBASE_PROJECT_ID}. Panel admin hesabınla gir.`);
const email = await ask('E-posta: ');
const password = await ask('Şifre (yazarken görünmez): ', true);
const uid = (await signInWithEmailAndPassword(auth, email, password)).user.uid;
console.log('Giriş yapıldı.');

const storage = getStorage(app);
const admin = createTravelAdmin(getFirestore(app), uid);
const rand = () => [...randomBytes(20)].map((b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');
mkdirSync(CACHE_DIR, { recursive: true });

for (const p of places) {
  const tour = [];
  for (const s of p.data.tour) {
    const key = `${uid}|${s.image.path}`;
    if (!cache[key]) {
      const j = await jpeg(s.image.url);
      const path = mediaPath(uid, 'seyahat', rand());
      const r = ref(storage, path);
      await uploadBytes(r, j.data, { contentType: 'image/jpeg' });
      cache[key] = { path, url: await getDownloadURL(r), width: j.width, height: j.height };
      writeFileSync(CACHE, JSON.stringify(cache, null, 1));
    }
    tour.push({ ...s, image: cache[key] });
  }
  const live = await admin.getPlace(p.id);
  const { id: _i, updatedAt: _u, ...base } = (live ?? p.data) as any;
  await admin.savePlace(p.id, { ...base, tour });
  console.log(`${live ? 'gezi eklendi' : 'yeni yer    '}  ${p.id} (${tour.length} sahne)`);
}
console.log('Bitti.');
process.exit(0);
