import { useEffect, useState } from 'react';
import { createIntroVideo } from '@cityjoy/shared/firebase';

import { isFirebaseConfigured } from './firebase-config';
import { firestore } from './firebase';

let pending: Promise<string> | null = null;

/** Tanıtım videosu bağlantısı (panelden girilir); oturum başına bir kez okunur. Yoksa ya da okunamazsa boş. */
export function useIntroVideoUrl() {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    pending ??= createIntroVideo(firestore).get().catch(() => {
      pending = null;
      return '';
    });
    let alive = true;
    pending.then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, []);
  return url;
}
