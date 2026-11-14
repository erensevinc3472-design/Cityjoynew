import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { VideoPlayer, VideoThumbnail } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { I18nManager, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { playRange, POST_LIMITS, type MediaEdit } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { formatDuration } from '@/components/post-video';
import { fonts } from '@/theme/tokens';
import { ED, Sheet, SheetLabel, TextButton } from './ui';

const FRAMES = 8;
const HANDLE = 16;

/** Zaman çizelgesinin küçük kareleri (telefonda; web'de düz şerit). */
export function useFrames(player: VideoPlayer, durationSec: number) {
  const [frames, setFrames] = useState<VideoThumbnail[] | null>(null);
  useEffect(() => {
    let alive = true;
    const times = Array.from({ length: FRAMES }, (_, i) => Math.min(durationSec - 0.1, (durationSec * (i + 0.5)) / FRAMES));
    player
      .generateThumbnailsAsync(times, { maxWidth: 160 })
      .then((l) => alive && setFrames(l))
      .catch(() => alive && setFrames([]));
    return () => {
      alive = false;
    };
  }, [player, durationSec]);
  return frames;
}

function Strip({ frames, width }: { frames: VideoThumbnail[] | null; width: number }) {
  const w = width / FRAMES;
  return (
    <View style={[styles.strip, { width }]}>
      {Array.from({ length: FRAMES }, (_, i) => (
        <View key={i} style={{ width: w, height: '100%', backgroundColor: i % 2 ? '#123036' : '#0F282D' }}>
          {frames?.[i] ? <Image source={frames[i]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Video aracı (taslak ekran 6): başı ve sonu altın tutamaçlarla seçilir (en az 1, en çok 60 sn), videonun sesi kapatılır,
 * akışta görünecek kapak karesi seçilir. Video yeniden işlenmez; seçimler oynatırken uygulanır.
 */
export function VideoSheet({ player, durationSec, edit, onChange, onClose, startOnCover }: { player: VideoPlayer; durationSec: number; edit: MediaEdit; onChange(p: Partial<MediaEdit>): void; onClose(): void; startOnCover?: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const frames = useFrames(player, durationSec);
  const [cover, setCover] = useState(!!startOnCover);
  const [width, setWidth] = useState(0);
  const range = playRange(edit, durationSec);
  const [sel, setSel] = useState(range);
  const selRef = useRef(sel);
  selRef.current = sel;
  const startAt = useRef(0);

  const toTime = (dx: number) => (width > 0 ? (dx / width) * durationSec : 0);
  const commit = () => {
    const s = selRef.current;
    const full = s.start < 0.05 && s.end > durationSec - 0.05;
    onChange(full ? { trimStart: undefined, trimEnd: undefined } : { trimStart: Math.round(s.start * 100) / 100, trimEnd: Math.round(s.end * 100) / 100 });
    player.currentTime = s.start;
    player.play();
  };
  const handle = (side: 'start' | 'end') =>
    Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .hitSlop({ horizontal: 14, vertical: 10 })
      .onBegin(() => {
        startAt.current = selRef.current[side];
        player.pause();
      })
      .onUpdate((e) => {
        const s = selRef.current;
        const v = startAt.current + toTime(e.translationX);
        const next =
          side === 'start'
            ? { start: Math.max(0, Math.min(v, s.end - 1), s.end - POST_LIMITS.videoSeconds), end: s.end }
            : { start: s.start, end: Math.min(durationSec, Math.max(v, s.start + 1), s.start + POST_LIMITS.videoSeconds) };
        setSel(next);
        player.currentTime = side === 'start' ? next.start : next.end;
      })
      .onFinalize(commit);

  const x = (sec: number) => (sec / durationSec) * width;
  const secs = Math.round(sel.end - sel.start);

  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="box-none">
      <Pressable style={styles.flex} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('editor.close')} />
      <Sheet style={{ paddingBottom: insets.bottom + 12 }}>
        <View style={styles.head}>
          {cover ? <TextButton title={t('editor.back')} onPress={() => setCover(false)} /> : <View />}
          <TextButton title={t('editor.done')} onPress={onClose} />
        </View>
        {cover ? (
          <>
            <SheetLabel>{t('editor.video.coverTitle')}</SheetLabel>
            <View style={styles.coverRow} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
              {Array.from({ length: FRAMES }, (_, i) => {
                const at = Math.round(((durationSec * (i + 0.5)) / FRAMES) * 100) / 100;
                const on = edit.coverAt !== undefined ? Math.abs(edit.coverAt - at) < 0.01 : i === 0;
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t('editor.video.coverAt', { time: formatDuration(at) })}
                    onPress={() => {
                      onChange({ coverAt: at });
                      player.pause();
                      player.currentTime = at;
                    }}
                    style={[styles.coverCell, { width: width / FRAMES - 4, borderColor: on ? ED.gold : 'transparent' }]}>
                    {frames?.[i] ? <Image source={frames[i]} style={StyleSheet.absoluteFill} contentFit="cover" /> : <AppText style={styles.cellText}>{formatDuration(at)}</AppText>}
                  </Pressable>
                );
              })}
            </View>
            <AppText style={styles.note}>{t('editor.video.coverNote')}</AppText>
          </>
        ) : (
          <>
            <SheetLabel>{t('editor.video.trimTitle', { from: formatDuration(sel.start), to: formatDuration(sel.end), n: secs })}</SheetLabel>
            <View style={styles.timeline} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
              {width > 0 ? (
                <>
                  <Strip frames={frames} width={width} />
                  <View pointerEvents="none" style={[styles.shade, { start: 0, width: x(sel.start) }]} />
                  <View pointerEvents="none" style={[styles.shade, { start: x(sel.end), width: width - x(sel.end) }]} />
                  <View pointerEvents="none" style={[styles.frame, { start: x(sel.start), width: x(sel.end) - x(sel.start) }]} />
                  <GestureDetector gesture={handle('start')}>
                    <View style={[styles.handle, { start: x(sel.start) - HANDLE / 2 }]} accessible accessibilityRole="adjustable" accessibilityLabel={t('editor.video.start')}
                      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                      onAccessibilityAction={(e) => {
                        const s = Math.max(0, Math.min(sel.end - 1, sel.start + (e.nativeEvent.actionName === 'increment' ? 1 : -1)));
                        setSel({ ...sel, start: s });
                        selRef.current = { ...sel, start: s };
                        commit();
                      }}>
                      <View style={styles.grip} />
                    </View>
                  </GestureDetector>
                  <GestureDetector gesture={handle('end')}>
                    <View style={[styles.handle, { start: x(sel.end) - HANDLE / 2 }]} accessible accessibilityRole="adjustable" accessibilityLabel={t('editor.video.end')}
                      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                      onAccessibilityAction={(e) => {
                        const v = Math.min(durationSec, Math.max(sel.start + 1, sel.end + (e.nativeEvent.actionName === 'increment' ? 1 : -1)));
                        setSel({ ...sel, end: v });
                        selRef.current = { ...sel, end: v };
                        commit();
                      }}>
                      <View style={styles.grip} />
                    </View>
                  </GestureDetector>
                </>
              ) : null}
            </View>
            <View style={styles.row}>
              <AppText style={styles.rowText}>{t('editor.video.sound')}</AppText>
              <Switch
                value={!edit.muted}
                onValueChange={(on) => onChange({ muted: on ? undefined : true })}
                trackColor={{ true: ED.gold, false: ED.chip }}
                thumbColor="#FFFFFF"
                accessibilityLabel={t('editor.video.sound')}
              />
            </View>
            <Pressable accessibilityRole="button" onPress={() => setCover(true)} style={({ pressed }) => [styles.row, styles.rowLine, { opacity: pressed ? 0.7 : 1 }]}>
              <AppText style={styles.rowText}>{t('editor.video.cover')}</AppText>
              <View style={styles.pick}>
                <AppText style={styles.pickText}>{t('editor.video.choose')}</AppText>
                <MaterialIcons name="chevron-right" size={20} color={ED.gold} style={styles.flip} />
              </View>
            </Pressable>
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { zIndex: 20, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeline: { height: 64, justifyContent: 'center', marginHorizontal: HANDLE / 2, direction: 'ltr' },
  strip: { height: 56, flexDirection: 'row', borderRadius: 10, overflow: 'hidden' },
  shade: { position: 'absolute', top: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.6)' },
  frame: { position: 'absolute', top: 2, bottom: 2, borderWidth: 3, borderColor: ED.gold, borderRadius: 10 },
  handle: { position: 'absolute', top: 2, bottom: 2, width: HANDLE, borderRadius: 6, backgroundColor: ED.gold, alignItems: 'center', justifyContent: 'center' },
  grip: { width: 3, height: 20, borderRadius: 2, backgroundColor: ED.onGold, opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ED.line },
  rowText: { color: ED.text, fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  pick: { flexDirection: 'row', alignItems: 'center' },
  pickText: { color: ED.gold, fontFamily: fonts.bodySemi, fontSize: 15 },
  flip: { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] },
  coverRow: { flexDirection: 'row', justifyContent: 'space-between' },
  coverCell: { aspectRatio: 0.6, borderRadius: 8, borderWidth: 3, overflow: 'hidden', backgroundColor: ED.chip, alignItems: 'center', justifyContent: 'center' },
  cellText: { color: ED.muted, fontSize: 11 },
  note: { color: ED.muted, fontSize: 13, lineHeight: 18 },
});
