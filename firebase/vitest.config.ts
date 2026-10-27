import { defineConfig } from 'vitest/config';

// Testler aynı emülatör veritabanını paylaştığı için dosyalar sırayla çalışır.
export default defineConfig({ test: { fileParallelism: false } });
