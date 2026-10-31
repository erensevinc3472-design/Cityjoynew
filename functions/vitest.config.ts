import { defineConfig } from 'vitest/config';

// Emülatöre ilk bağlanma (yönetici kütüphanesi önce bulut ortamını arar) yavaş bilgisayarlarda 10 saniyeyi aşabilir.
export default defineConfig({ test: { fileParallelism: false, testTimeout: 30000, hookTimeout: 60000 } });
