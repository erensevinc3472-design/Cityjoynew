import { useState } from 'react';

/**
 * Panel teması (Karar, Eren, 12 Kasım 2026: "Düğme olsun"): gece (koyu, varsayılan) ve gündüz (açık).
 * Seçim bu tarayıcıda saklanır; saklanamazsa yalnızca bu oturumda geçerli olur.
 */
export type Theme = 'dark' | 'light';

const KEY = 'cityjoy-panel-tema';

function stored(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyStoredTheme() {
  document.documentElement.dataset.theme = stored();
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(stored);
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Saklanamazsa yalnızca bu oturumda geçerli.
    }
  };
  return [theme, toggle];
}
