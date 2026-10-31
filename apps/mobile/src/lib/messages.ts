import { useCallback, useEffect, useMemo, useState } from 'react';
import { counterpartOf, type Chat } from '@cityjoy/shared';

import { businessRepository, messageRepository } from './services';
import { deviceStorage } from './storage';

/** Sohbet ekranının adresi: işletme sohbetinde sohbetin kimliği de gider (aynı kişiyle kişisel sohbetten ayrı). */
export function chatHref(c: Chat, me: string) {
  return { pathname: '/messages/[uid]' as const, params: { uid: counterpartOf(c, me), ...(c.context ? { thread: c.id } : {}) } };
}

/**
 * Sohbetlerim, ekran açıkken canlı. Döner: null = yükleniyor. Mesaj izni olan yetkilide, yetkili olduğu işletmelere
 * yazılan sohbetler de katılır (İşletmem bölümüne düşer); `teamInbox` o zaman true.
 */
export function useChats(uid: string | undefined) {
  const [own, setOwn] = useState<Chat[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [team, setTeam] = useState<Record<string, Chat[]>>({});
  useEffect(() => {
    if (!uid) return;
    setFailed(false);
    businessRepository.listManaged(uid).then(
      (list) => setTeamIds(list.filter((b) => b.managers.some((x) => x.uid === uid && x.messages)).map((b) => b.id)),
      () => {},
    );
    return messageRepository.watchChats(uid, setOwn, () => {
      setFailed(true);
      setOwn((c) => c ?? []);
    });
  }, [uid]);
  const key = teamIds.join(',');
  useEffect(() => {
    if (!key) return;
    const stops = key.split(',').map((id) => messageRepository.watchBusinessChats(id, (l) => setTeam((t) => ({ ...t, [id]: l })), () => {}));
    return () => stops.forEach((stop) => stop());
  }, [key]);
  const chats = useMemo(
    () => (own === null ? null : [...own, ...Object.values(team).flat()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
    [own, team],
  );
  return { chats, failed, teamInbox: teamIds.length > 0 };
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
