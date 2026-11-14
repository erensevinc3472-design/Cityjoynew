import { MaterialIcons } from '@expo/vector-icons';
import { useGlobalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { isLanguageCode } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { onPreviewBlocked, setPreviewLocation } from '@/lib/preview';
import { IS_PANEL_PREVIEW } from '@/lib/preview-flag';
import { useSettings, type ThemeMode } from '@/lib/settings';

/**
 * Panel > Uygulama görünümü ile önizlemedeki uygulama arasındaki köprü (yalnızca panel önizleme derlemesinde çalışır).
 * - Açık ekranı panele bildirir (yan panel o ekranın bağlantılarını gösterir).
 * - Panelden gelen "şu ekrana git", "şu konumdan bak", tema ve dil seçimlerini uygular.
 * - Kayıt denenince "Önizlemede kayıt yapılmaz" uyarısı ("Panel önizlemesi" etiketi panelde, telefon çerçevesinin üstünde).
 * Mesajlar yalnızca aynı adresten (panelin kendisi) kabul edilir. Bu metinler yalnızca yöneticiye görünür (Türkçe).
 */
export function PreviewBridge() {
  if (!IS_PANEL_PREVIEW) return null;
  return <Bridge />;
}

const THEMES: ThemeMode[] = ['system', 'light', 'dark'];

function Bridge() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const router = useRouter();
  const { setThemeMode, setLanguage } = useSettings();
  const [blocked, setBlocked] = useState(false);

  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    try {
      window.parent?.postMessage({ type: 'cj-route', pathname, params: JSON.parse(paramsKey) }, window.location.origin);
    } catch {}
  }, [pathname, paramsKey]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || typeof e.data !== 'object') return;
      const m = e.data as { type?: string; href?: string; provinceCode?: string; districtId?: string; theme?: string; language?: string };
      if (m.type === 'cj-nav' && typeof m.href === 'string' && m.href.startsWith('/')) router.push(m.href as Href);
      if (m.type === 'cj-view-as') setPreviewLocation(m.provinceCode ? { provinceCode: m.provinceCode, ...(m.districtId ? { districtId: m.districtId } : {}) } : null);
      if (m.type === 'cj-settings') {
        if (m.theme && THEMES.includes(m.theme as ThemeMode)) setThemeMode(m.theme as ThemeMode);
        if (m.language && isLanguageCode(m.language)) setLanguage(m.language);
      }
    };
    window.addEventListener('message', onMessage);
    try {
      window.parent?.postMessage({ type: 'cj-ready' }, window.location.origin);
    } catch {}
    return () => window.removeEventListener('message', onMessage);
  }, [router, setThemeMode, setLanguage]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onPreviewBlocked(() => {
      setBlocked(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setBlocked(false), 3500);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {blocked ? (
        <View pointerEvents="none" style={styles.toastWrap} accessibilityLiveRegion="polite">
          <View style={styles.toast}>
            <MaterialIcons name="lock-outline" size={16} color="#fff" />
            <AppText style={styles.toastText}>Önizlemede kayıt yapılmaz. Değişiklikleri panelden ya da telefondan yap.</AppText>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', bottom: 24, left: 12, right: 12, alignItems: 'center', zIndex: 1001 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(20,30,40,0.92)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, maxWidth: 360 },
  toastText: { color: '#fff', fontSize: 13, lineHeight: 18, flexShrink: 1 },
});
