import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useSession } from './session';

/** Uygulama en az bu kadar arka planda kaldıysa dönüşte Keşfet açılır. Kısa geçişlerde kullanıcı kaldığı ekranda kalır. */
const RETURN_AFTER_MS = 10 * 60 * 1000;
/** Bu ekranlarda yarım iş olabilir (gönderi yazma, mesaj, SOS, kurulum): dönüşte yerinde kalınır. */
const KEEP = ['/explore/new', '/messages', '/sos', '/complete-profile', '/permission-location', '/location', '/language', '/welcome', '/sign-in', '/sign-up', '/reset-password'];

/**
 * Açılış sayfası (Eren, 12 Kasım 2026): oturum açıkken uygulamaya dönülünce Keşfet karşılar ("insanların en çok
 * kullanacağı yer"). Uygulama yeniden başlatılınca açılış yönlendirmesi (app/index.tsx) yapar; burası telefon
 * kilitlenip ya da başka uygulamaya geçilip uzun süre sonra dönüldüğünde çalışır. Bildirime dokunarak dönüldüyse
 * bildirimin açtığı ekran korunur.
 */
export function ReturnToExplore() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSession();
  const path = useRef(pathname);
  path.current = pathname;
  const signedIn = useRef(!!user);
  signedIn.current = !!user;

  useEffect(() => {
    let left: { at: number; path: string } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        left = { at: Date.now(), path: path.current };
        return;
      }
      if (s !== 'active' || !left) return;
      const was = left;
      left = null;
      if (Date.now() - was.at < RETURN_AFTER_MS) return;
      // Bildirim bir ekran açacaksa ona fırsat verilir; ekran değiştiyse dokunulmaz.
      clearTimeout(timer);
      timer = setTimeout(() => {
        const now = path.current;
        if (!signedIn.current || now !== was.path || now === '/explore' || KEEP.some((k) => now.startsWith(k))) return;
        if (router.canDismiss()) router.dismissAll();
        router.replace('/explore');
      }, 500);
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [router]);

  return null;
}
