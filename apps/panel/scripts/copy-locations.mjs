// Geliştirme ve web önizlemesi için mahalle dosyalarını public/ klasörüne kopyalar.
// Canlıda bu dosyalar veri havuzundan (EXPO_PUBLIC_LOCATIONS_BASE_URL) okunur.
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.resolve(here, '../../../packages/shared/data/locations/neighbourhoods');
const to = path.resolve(here, '../public/locations/neighbourhoods');

await rm(to, { recursive: true, force: true });
await cp(from, to, { recursive: true });
