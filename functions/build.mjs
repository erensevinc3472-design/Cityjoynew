// Sunucu işlevlerini tek dosyaya paketler. Ortak kod (@cityjoy/shared) npm'de olmadığı için pakete gömülür;
// firebase-admin ve firebase-functions bulutta package.json'dan kurulur.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['firebase-admin', 'firebase-functions'],
  logLevel: 'warning',
});
