// Panel > Uygulama görünümü için uygulamanın web derlemesi (yalnızca okur, kayıt yapmaz; apps/mobile/src/lib/preview.ts).
// Derleme apps/panel/public/uygulama klasörüne konur; panel derlenince yayında `/uygulama/` adresinden açılır.
// Kullanım: node scripts/build-preview-app.mjs   (panel:deploy bunu kendisi çalıştırır)
import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const mobile = join(root, 'apps/mobile');
const out = join(mobile, 'dist-panel-preview');
const target = join(root, 'apps/panel/public/uygulama');
const env = { ...process.env, EXPO_PUBLIC_PANEL_PREVIEW: '1' };

execSync('node scripts/copy-locations.mjs', { cwd: mobile, stdio: 'inherit', env });
rmSync(out, { recursive: true, force: true });
execSync(`npx expo export --platform web --output-dir dist-panel-preview --clear`, { cwd: mobile, stdio: 'inherit', env });
rmSync(target, { recursive: true, force: true });
cpSync(out, target, { recursive: true });
rmSync(out, { recursive: true, force: true });
console.log('Önizleme derlemesi hazır: apps/panel/public/uygulama');
