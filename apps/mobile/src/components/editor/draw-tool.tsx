import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { EDIT_COLORS, MEDIA_EDIT_LIMITS, type EditStroke } from '@cityjoy/shared';

import { Strokes } from '@/components/media-overlay';
import { ED, RoundButton, Swatches, TextButton } from './ui';

type Tool = 'kalem' | 'fosforlu' | 'silgi';
/** Üç kalınlık (medya genişliğine oran). */
const WIDTHS = [0.008, 0.016, 0.03] as const;
const ERASE_R = 30; // 0-1000 ölçeğinde

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Parmakla çizim (taslak ekran 5): kalem, fosforlu kalem, silgi; üç kalınlık; renkler; geri al. Noktalar medyanın
 * çerçevesine göre 0-1000 arası saklanır; çizgi ve nokta sayısı sınırlıdır.
 */
export function DrawTool({ rect, initial, onDone }: { rect: Rect; initial: readonly EditStroke[]; onDone(strokes: EditStroke[]): void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [strokes, setStrokes] = useState<EditStroke[]>([...initial]);
  const [live, setLive] = useState<number[] | null>(null);
  const [tool, setTool] = useState<Tool>('kalem');
  const [width, setWidth] = useState<number>(WIDTHS[1]);
  const [color, setColor] = useState<string>(EDIT_COLORS[2]);
  const pts = useRef<number[]>([]);

  const toPt = (x: number, y: number) => [Math.round(Math.min(1, Math.max(0, x / rect.width)) * 1000), Math.round(Math.min(1, Math.max(0, y / rect.height)) * 1000)];
  const erase = (x: number, y: number) => {
    const [px, py] = toPt(x, y);
    setStrokes((cur) => {
      const left = cur.filter((s) => {
        for (let i = 0; i + 1 < s.points.length; i += 2) if (Math.hypot(s.points[i] - px, s.points[i + 1] - py) < ERASE_R) return false;
        return true;
      });
      return left.length === cur.length ? cur : left;
    });
  };

  const full = strokes.length >= MEDIA_EDIT_LIMITS.strokes;
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      if (tool === 'silgi') return erase(e.x, e.y);
      if (full) return;
      pts.current = toPt(e.x, e.y);
      setLive([...pts.current]);
    })
    .onUpdate((e) => {
      if (tool === 'silgi') return erase(e.x, e.y);
      if (full || !pts.current.length || pts.current.length >= MEDIA_EDIT_LIMITS.points * 2) return;
      const [x, y] = toPt(e.x, e.y);
      const n = pts.current.length;
      if (Math.hypot(x - pts.current[n - 2], y - pts.current[n - 1]) < 6) return;
      pts.current.push(x, y);
      setLive([...pts.current]);
    })
    .onFinalize(() => {
      if (tool !== 'silgi' && pts.current.length >= 2) {
        const p = pts.current.length === 2 ? [...pts.current, pts.current[0] + 1, pts.current[1]] : pts.current;
        setStrokes((cur) => [...cur, { points: p, color, width, ...(tool === 'fosforlu' ? { marker: true } : {}) }].slice(0, MEDIA_EDIT_LIMITS.strokes));
      }
      pts.current = [];
      setLive(null);
    });

  const shown = live ? [...strokes, { points: live, color, width, ...(tool === 'fosforlu' ? { marker: true } : {}) }] : strokes;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <GestureDetector gesture={pan}>
        <View style={[styles.surface, rect]} accessible accessibilityLabel={t('editor.drawArea')}>
          <Strokes strokes={shown} w={rect.width} h={rect.height} />
        </View>
      </GestureDetector>
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <RoundButton icon="undo" label={t('editor.undo')} onPress={() => setStrokes((cur) => cur.slice(0, -1))} disabled={!strokes.length} />
        <TextButton title={t('editor.done')} onPress={() => onDone(strokes)} />
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.toolRow}>
          <RoundButton icon="brush" label={t('editor.draw.kalem')} active={tool === 'kalem'} onPress={() => setTool('kalem')} />
          <RoundButton icon="highlight" label={t('editor.draw.fosforlu')} active={tool === 'fosforlu'} onPress={() => setTool('fosforlu')} />
          <RoundButton icon="auto-fix-normal" label={t('editor.draw.silgi')} active={tool === 'silgi'} onPress={() => setTool('silgi')} />
          <View style={styles.grow} />
          {WIDTHS.map((wd, i) => (
            <RoundButton key={wd} icon="circle" size={30 + i * 6} label={t('editor.draw.width', { n: i + 1 })} active={width === wd} onPress={() => setWidth(wd)} />
          ))}
        </View>
        <Swatches colors={EDIT_COLORS} value={color} onChange={(c) => (setColor(c), tool === 'silgi' && setTool('kalem'))} label={t('editor.colors')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 20 },
  surface: { position: 'absolute' },
  top: { position: 'absolute', start: 12, end: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottom: { position: 'absolute', start: 0, end: 0, bottom: 0, gap: 10, paddingHorizontal: 12, paddingTop: 10, backgroundColor: 'rgba(7,20,23,0.75)' },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
});

