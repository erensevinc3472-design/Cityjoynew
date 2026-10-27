import type { useRouter } from 'expo-router';

/**
 * Ekran geçmişini temizleyip açılış yönlendirmesine döner. Giriş, çıkış, kayıt ve ilk kurulum
 * adımlarından sonra kullanılır; böylece arkada eski ekranlar (ör. karşılama) birikmez.
 */
export function restartFlow(router: ReturnType<typeof useRouter>) {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

/** Bir önceki ekrana döner; ekran doğrudan açıldıysa (bağlantı, bildirim) verilen sayfaya gider. */
export function goBackOr(router: ReturnType<typeof useRouter>, fallback: Parameters<ReturnType<typeof useRouter>['replace']>[0]) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
