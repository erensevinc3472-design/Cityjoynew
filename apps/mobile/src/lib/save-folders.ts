import { useCallback, useEffect, useState } from 'react';
import { SAVE_FOLDER_LIMITS, type SaveFolder } from '@cityjoy/shared/firebase';

import { postRepository } from './services';

/**
 * Kaydettiklerim klasörleri (Eren, 13 Kasım 2026). Oturumda bir kez okunur, ekranlar arasında paylaşılır
 * (ayrıntıdaki "Klasör" düğmesi ve Kaydettiklerim aynı listeyi görür). En çok 20 klasör.
 */
const cache = new Map<string, SaveFolder[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function put(uid: string, list: SaveFolder[]) {
  cache.set(uid, list);
  emit();
}

export function useSaveFolders(uid: string | undefined) {
  const [folders, setFolders] = useState<SaveFolder[] | null>(() => (uid ? cache.get(uid) ?? null : null));
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    if (!uid) return;
    setFailed(false);
    postRepository.listFolders(uid).then((l) => put(uid, l), () => setFailed(true));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const sync = () => setFolders(cache.get(uid) ?? null);
    listeners.add(sync);
    if (cache.has(uid)) sync();
    else reload();
    return () => {
      listeners.delete(sync);
    };
  }, [uid, reload]);

  const full = (folders?.length ?? 0) >= SAVE_FOLDER_LIMITS.count;

  const create = async (name: string): Promise<SaveFolder> => {
    if (!uid) throw new Error('signed-out');
    const f = await postRepository.createFolder(uid, name);
    put(uid, [...(cache.get(uid) ?? []), f]);
    return f;
  };
  const rename = async (id: string, name: string) => {
    if (!uid) return;
    await postRepository.renameFolder(uid, id, name);
    put(uid, (cache.get(uid) ?? []).map((f) => (f.id === id ? { ...f, name: name.trim().slice(0, SAVE_FOLDER_LIMITS.name) } : f)));
  };
  const remove = async (id: string) => {
    if (!uid) return;
    await postRepository.deleteFolder(uid, id);
    put(uid, (cache.get(uid) ?? []).filter((f) => f.id !== id));
  };

  return { folders, failed, full, reload, create, rename, remove };
}
