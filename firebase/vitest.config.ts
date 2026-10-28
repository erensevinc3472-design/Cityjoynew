import { defineConfig } from 'vitest/config';

// Testler aynı emülatör veritabanını paylaştığı için dosyalar sırayla çalışır. Emülatöre ilk bağlanma yavaş
// bilgisayarlarda 10 saniyeyi aşabildiği için hazırlık süresi uzun tutulur.
export default defineConfig({ test: { fileParallelism: false, hookTimeout: 60000 } });
