import { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { EDIT_ALIGN, EDIT_COLORS, EDIT_FONTS, EDIT_TEXT_BG, MEDIA_EDIT_LIMITS, type EditAlign, type TextItem } from '@cityjoy/shared';

import { EDIT_FONT_FAMILY } from '@/components/media-overlay';
import { ED, Pill, RoundButton, Sheet, SheetLabel, Swatches, TextButton, type IconName } from './ui';

/** Boyut çubuğunun aralığı (medya genişliğine oran). */
const SIZE_MIN = 0.035;
const SIZE_MAX = 0.16;
const TRACK = 200;

export const newTextItem = (): TextItem => ({ kind: 'yazi', x: 0.5, y: 0.4, scale: 1, rotation: 0, text: '', font: 'modern', color: '#FFFFFF', bg: 'yok', bgColor: '#111111', align: 'center', size: 0.08 });

const ALIGN_ICON: Record<EditAlign, IconName> = { left: 'format-align-left', center: 'format-align-center', right: 'format-align-right' };
const BG_ICON: Record<TextItem['bg'], IconName> = { yok: 'format-color-reset', dolu: 'format-color-fill', yari: 'opacity' };

/**
 * Yazı ekleme ve düzenleme (taslak ekran 2 ve 3): yazı tipi, renk, alt zemin (yok/dolu/yarı saydam) ve rengi, hizalama,
 * soldaki çubukla boyut. Değişiklik anında yazıda görünür. "Bitti" ile kaydedilir; boş yazı eklenmez.
 */
export function TextTool({ initial, w, onDone }: { initial: TextItem; w: number; onDone(item: TextItem | null): void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState(initial);
  const [colors, setColors] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const set = (p: Partial<TextItem>) => setItem((cur) => ({ ...cur, ...p }));
  const next = <T,>(list: readonly T[], v: T) => list[(list.indexOf(v) + 1) % list.length];

  const done = () => {
    Keyboard.dismiss();
    const text = item.text.trim();
    onDone(text ? { ...item, text } : null);
  };

  const size = Math.max(12, item.size * w);
  const bg = item.bg === 'dolu' ? item.bgColor : item.bg === 'yari' ? `${item.bgColor}99` : 'transparent';

  // Boyut çubuğu: yukarı büyük, aşağı küçük.
  const fromY = (y: number) => {
    const r = 1 - Math.min(1, Math.max(0, y / TRACK));
    set({ size: Math.round((SIZE_MIN + r * (SIZE_MAX - SIZE_MIN)) * 1000) / 1000 });
  };
  const slide = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => fromY(e.y))
    .onUpdate((e) => fromY(e.y));
  const knob = (1 - (item.size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * TRACK;

  return (
    <View style={[StyleSheet.absoluteFill, styles.dim]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.flex, { paddingTop: insets.top + 8 }]}>
        <View style={styles.top}>
          <TextButton title={t('editor.done')} onPress={done} />
        </View>

        <Pressable style={styles.middle} onPress={() => (colors ? (setColors(false), input.current?.focus()) : done())} accessible={false}>
          <TextInput
            ref={input}
            value={item.text}
            onChangeText={(text) => set({ text })}
            onFocus={() => setColors(false)}
            autoFocus
            multiline
            maxLength={MEDIA_EDIT_LIMITS.text}
            placeholder={t('editor.textPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.6)"
            accessibilityLabel={t('editor.text')}
            selectionColor={ED.gold}
            style={{
              fontFamily: EDIT_FONT_FAMILY[item.font],
              fontSize: size,
              color: item.color,
              textAlign: item.align,
              backgroundColor: bg,
              borderRadius: size * 0.3,
              paddingHorizontal: size * 0.35,
              paddingVertical: size * 0.12,
              maxWidth: w * 0.9,
              minWidth: 40,
            }}
          />
        </Pressable>

        <View style={[styles.slider, { top: insets.top + 90 }]} accessible accessibilityRole="adjustable" accessibilityLabel={t('editor.size')}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => set({ size: Math.min(SIZE_MAX, Math.max(SIZE_MIN, item.size + (e.nativeEvent.actionName === 'increment' ? 0.01 : -0.01))) })}>
          <GestureDetector gesture={slide}>
            <View style={styles.trackArea}>
              <View style={styles.track} />
              <View style={[styles.knob, { top: knob - 9 }]} />
            </View>
          </GestureDetector>
        </View>

        {colors ? (
          <Sheet style={{ paddingBottom: insets.bottom + 16 }}>
            <SheetLabel>{t('editor.textColor')}</SheetLabel>
            <Swatches colors={EDIT_COLORS} value={item.color} onChange={(color) => set({ color })} label={t('editor.textColor')} />
            <SheetLabel>{t('editor.background')}</SheetLabel>
            <View style={styles.row}>
              {EDIT_TEXT_BG.map((b) => (
                <Pill key={b} title={t(`editor.bg.${b}`)} selected={item.bg === b} onPress={() => set({ bg: b })} />
              ))}
            </View>
            <SheetLabel>{t('editor.backgroundColor')}</SheetLabel>
            <Swatches colors={EDIT_COLORS} value={item.bgColor} onChange={(bgColor) => set({ bgColor, bg: item.bg === 'yok' ? 'dolu' : item.bg })} label={t('editor.backgroundColor')} />
          </Sheet>
        ) : (
          <View style={styles.bottom}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.fontRow}>
              {EDIT_FONTS.map((f) => (
                <Pill key={f} title={t(`editor.fonts.${f}`)} selected={item.font === f} onPress={() => set({ font: f })} textStyle={{ fontFamily: EDIT_FONT_FAMILY[f] }} />
              ))}
            </ScrollView>
            <View style={styles.tools}>
              <RoundButton icon="palette" label={t('editor.colors')} onPress={() => (Keyboard.dismiss(), setColors(true))} />
              <RoundButton icon={BG_ICON[item.bg]} label={`${t('editor.background')}: ${t(`editor.bg.${item.bg}`)}`} onPress={() => set({ bg: next(EDIT_TEXT_BG, item.bg) })} active={item.bg !== 'yok'} />
              <RoundButton icon={ALIGN_ICON[item.align]} label={t('editor.align')} onPress={() => set({ align: next(EDIT_ALIGN, item.align) })} />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 20 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  slider: { position: 'absolute', start: 6, width: 36, height: TRACK + 20, alignItems: 'center' },
  trackArea: { width: 36, height: TRACK, alignItems: 'center', marginTop: 10 },
  track: { width: 4, height: TRACK, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  knob: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: ED.text },
  bottom: { gap: 10, paddingBottom: 10, paddingHorizontal: 12 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 18, padding: 8, alignSelf: 'flex-start' },
  fontRow: { flexDirection: 'row', gap: 8 },
});
