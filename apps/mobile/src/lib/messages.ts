import { useCallback, useEffect, useState } from 'react';
import type { Chat } from '@cityjoy/shared';

import { messageRepository } from './services';
import { deviceStorage } from './storage';

/** Sohbetlerim, ekran açıkken canlı. Döner: null = yükleniyor. */
export function useChats(uid: string | undefined) {
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!uid) return;
    setFailed(false);
    return messageRepository.watchChats(uid, setChats, () => {
      setFailed(true);
      setChats((c) => c ?? []);
    });
  }, [uid]);
  return { chats, failed };
}

// ---- Okundu bilgisi: kapatan kişi "görüldü" yazmaz, karşı tarafınkini de görmez (telefonda saklanır) ----

const RECEIPTS_KEY = 'messages:readReceipts:v1';
let receipts: boolean | null = null;
const listeners = new Set<() => void>();

export function useReadReceipts(): [boolean, (on: boolean) => void] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (receipts === null) {
      deviceStorage.get(RECEIPTS_KEY).then((v) => {
        receipts = v !== 'off';
        listeners.forEach((f) => f());
      });
    }
    return () => {
      listeners.delete(l);
    };
  }, []);
  const set = useCallback((on: boolean) => {
    receipts = on;
    deviceStorage.set(RECEIPTS_KEY, on ? 'on' : 'off');
    listeners.forEach((f) => f());
  }, []);
  return [receipts ?? true, set];
}
