import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { t } from '../lib/t';

/**
 * Sürükleyerek sıralama (Eren, 29 Ekim 2026: "yandan tutup sırasını değiştirebileceğim bir ekran"). Satırın solundaki
 * tutamaktan tutulur; fare, dokunmatik ekran (pointer olayları) ve klavyeyle (tutamakta ↑ ↓) çalışır. Öğeler kapsayıcı
 * içinde `data-sort-id` taşır. `onMove` öğenin yeni yerini bildirir; listeyi tutan taraf uygular.
 */
export function useDragSort(ids: string[], onMove: (id: string, to: number) => void) {
  const container = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const targetIndex = (id: string, y: number) => {
    const others = [...(container.current?.querySelectorAll<HTMLElement>('[data-sort-id]') ?? [])].filter((el) => el.dataset.sortId !== id);
    return others.filter((el) => {
      const b = el.getBoundingClientRect();
      return b.top + b.height / 2 < y;
    }).length;
  };

  // Sürükleme sayfa genelinde izlenir: satır yer değiştirince tarayıcı düğmedeki yakalamayı bırakabiliyor.
  const latest = useRef({ ids, onMove });
  latest.current = { ids, onMove };
  useEffect(() => {
    if (!dragging) return;
    const move = (e: globalThis.PointerEvent) => {
      const to = targetIndex(dragging, e.clientY);
      if (to !== latest.current.ids.indexOf(dragging)) latest.current.onMove(dragging, to);
    };
    const end = () => setDragging(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [dragging]);

  const handleProps = (id: string, label: string) => ({
    type: 'button' as const,
    className: 'drag-handle',
    'aria-label': t('sort.handle', { name: label }),
    title: t('sort.hint'),
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setDragging(id);
    },
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      const i = ids.indexOf(id);
      const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
      if (to < 0 || to >= ids.length) return;
      e.preventDefault();
      onMove(id, to);
      // Odak taşınan satırın tutamağında kalsın (React aynı düğmeyi yeniden yerleştirir).
      requestAnimationFrame(() => container.current?.querySelector<HTMLElement>(`[data-sort-id="${CSS.escape(id)}"] .drag-handle`)?.focus());
    },
  });

  const itemProps = (id: string) => ({ 'data-sort-id': id, className: dragging === id ? 'dragging' : undefined });

  // Herhangi bir kapsayıcıya (tbody, div) bağlanır.
  const containerRef = useCallback((el: HTMLElement | null) => {
    container.current = el;
  }, []);

  return { containerRef, handleProps, itemProps, dragging };
}

export const moveId = (ids: string[], id: string, to: number) => {
  const next = ids.filter((x) => x !== id);
  next.splice(to, 0, id);
  return next;
};

/**
 * Bir listenin kaydedilmemiş yeni sırası. Liste değişince (kayıt, yeniden okuma, başka şehir) bekleyen sıra sıfırlanır.
 * Döner: gösterilecek liste, sürükleme yardımcıları, değişti mi, sıfırla.
 */
export function useSortableList<T extends { id: string }>(items: T[]) {
  const signature = items.map((x) => x.id).join('|');
  const [pending, setPending] = useState<string[] | null>(null);
  useEffect(() => setPending(null), [signature]);
  const ids = pending ?? items.map((x) => x.id);
  const list = ids.map((id) => items.find((x) => x.id === id)).filter((x): x is T => !!x);
  const drag = useDragSort(ids, (id, to) => setPending(moveId(ids, id, to)));
  const dirty = !!pending && pending.join('|') !== signature;
  return { list, dirty, reset: () => setPending(null), ...drag };
}

/** Sıralama şeridi: değişmeden önce ipucu, değişince kaydet / vazgeç. Yüksekliği sabit (sürüklerken satırlar kaymasın). */
export function SortBar({ dirty, busy, onSave, onCancel }: { dirty: boolean; busy?: boolean; onSave(): void; onCancel(): void }) {
  return (
    <div className={dirty ? 'sort-bar dirty' : 'sort-bar'} role="status">
      <span>{dirty ? t('sort.changed') : t('sort.hint')}</span>
      <div className="actions" style={{ visibility: dirty ? 'visible' : 'hidden' }}>
        <button className="btn" disabled={busy || !dirty} onClick={onSave}>{t('sort.save')}</button>
        <button className="btn ghost" disabled={busy || !dirty} onClick={onCancel}>{t('sort.cancel')}</button>
      </div>
    </div>
  );
}

/** Tutamak simgesi (altı nokta). */
export function GripIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true" focusable="false">
      {[3, 9, 15].map((y) => (
        <g key={y}>
          <circle cx="4" cy={y} r="1.6" fill="currentColor" />
          <circle cx="10" cy={y} r="1.6" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}
