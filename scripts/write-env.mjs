// Firebase web yapılandırmasını FIREBASE_WEB_CONFIG ortam değişkeninden okuyup
// apps/mobile/.env.local ve apps/panel/.env.local dosyalarına yazar (bu dosyalar GitHub'a gönderilmez).
// Değişkene Firebase konsolundaki "const firebaseConfig = {...}" bloğu olduğu gibi yapıştırılabilir.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseFirebaseConfig(text) {
  const config = {};
  for (const key of KEYS) {
    const match = text.match(new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`));
    if (!match) throw new Error(`Firebase yapılandırmasında "${key}" bulunamadı.`);
    config[key] = match[1];
  }
  return config;
}

const toEnvName = (key) => key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase();

async function main() {
  const raw = process.env.FIREBASE_WEB_CONFIG;
  if (!raw) {
    console.error('FIREBASE_WEB_CONFIG ortam değişkeni yok.');
    process.exit(1);
  }
  const config = parseFirebaseConfig(raw);
  const lines = (prefix) => KEYS.map((k) => `${prefix}FIREBASE_${toEnvName(k)}=${config[k]}`).join('\n') + '\n';
  await writeFile(path.join(root, 'apps/mobile/.env.local'), lines('EXPO_PUBLIC_'));
  await writeFile(path.join(root, 'apps/panel/.env.local'), lines('VITE_'));
  console.log(`Yazıldı: proje ${config.projectId}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
