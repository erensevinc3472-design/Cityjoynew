import tr from '../locales-tr.json';

type Dict = { [key: string]: string | Dict };

/** Panel metinleri dil dosyasından gelir. Şimdilik yalnızca Türkçe; yeni dil dosyası eklenince buradan seçilir. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const value = key.split('.').reduce<string | Dict | undefined>(
    (node, part) => (typeof node === 'object' ? node[part] : undefined),
    tr as Dict,
  );
  if (typeof value !== 'string') return key;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''));
}
