import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PHOTO_UPLOAD } from '@cityjoy/shared';
import type { PreparedPhoto } from '@cityjoy/shared/firebase';

import { ED, Pill, RoundButton, TextButton } from './ui';

const RATIOS = { orijinal: 0, kare: 1, dikey: 0.8, yatay: 1.91 } as const;
type Ratio = keyof typeof RATIOS;

/**
 * Fotoğrafa özel "Kırp / Döndür": orijinal, kare, 4:5 dikey, yatay; 90 derece döndürme. Kırpma penceresi parmakla
 * kaydırılır. Fotoğrafın kendisine uygulanır (yeni küçük JPEG); yazı ve çizimler oranlı olduğu için yerinde kalır.
 */
export function CropTool({ photo, area, onDone, onCancel }: { photo: PreparedPhoto; area: { width: number; height: number }; onDone(p: PreparedPhoto): void; onCancel(): void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [img, setImg] = useState(photo);
  const [ratio, setRatio] = useState<Ratio>('orijinal');
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  // Fotoğrafın ekranda sığdığı boyut.
  const s = Math.min(area.width / img.width, area.height / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  const r = RATIOS[ratio] || dw / dh;
  const cw = dw / dh > r ? dh * r : dw;
  const ch = dw / dh > r ? dh : dw / r;
  const maxX = (dw - cw) / 2;
  const maxY = (dh - ch) / 2;
  const ox = Math.max(-maxX, Math.min(maxX, off.x));
  const oy = Math.max(-maxY, Math.min(maxY, off.y));

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => setStart({ x: ox, y: oy }))
    .onUpdate((e) => setOff({ x: start.x + e.translationX, y: start.y + e.translationY }));

  const save = async (ctxOf: (c: ReturnType<typeof ImageManipulator.manipulate>) => void) => {
    const ctx = ImageManipulator.manipulate(img.uri!);
    ctxOf(ctx);
    const out = await (await ctx.renderAsync()).saveAsync({ compress: PHOTO_UPLOAD.quality, format: SaveFormat.JPEG });
    return { uri: out.uri, width: out.width, height: out.height };
  };

  const rotate = async () => {
    setBusy(true);
    try {
      setImg(await save((c) => c.rotate(90)));
      setOff({ x: 0, y: 0 });
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (ratio === 'orijinal') return onDone(img);
    setBusy(true);
    try {
      const k = img.width / dw;
      const crop = {
        originX: Math.max(0, Math.round((maxX + ox) * k)),
        originY: Math.max(0, Math.round((maxY + oy) * k)),
        width: Math.min(img.width, Math.round(cw * k)),
        height: Math.min(img.height, Math.round(ch * k)),
      };
      onDone(await save((c) => c.crop(crop)));
    } catch {
      onDone(img);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.top}>
        <TextButton title={t('editor.cancel')} onPress={onCancel} />
        <TextButton title={t('editor.done')} onPress={apply} />
      </View>
      <View style={styles.stage}>
        <View style={{ width: dw, height: dh }}>
          <Image source={{ uri: img.uri }} style={{ width: dw, height: dh }} contentFit="contain" accessibilityLabel={t('editor.crop.title')} />
          {ratio !== 'orijinal' ? (
            <>
              <View pointerEvents="none" style={[styles.mask, { top: 0, start: 0, end: 0, height: maxY + oy }]} />
              <View pointerEvents="none" style={[styles.mask, { bottom: 0, start: 0, end: 0, height: maxY - oy }]} />
              <View pointerEvents="none" style={[styles.mask, { top: maxY + oy, height: ch, left: 0, width: maxX + ox }]} />
              <View pointerEvents="none" style={[styles.mask, { top: maxY + oy, height: ch, right: 0, width: maxX - ox }]} />
              <GestureDetector gesture={pan}>
                <View style={[styles.window, { left: maxX + ox, top: maxY + oy, width: cw, height: ch }]} accessible accessibilityLabel={t('editor.crop.move')}>
                  <View style={[styles.third, { left: '33.3%', top: 0, bottom: 0, width: 1 }]} />
                  <View style={[styles.third, { left: '66.6%', top: 0, bottom: 0, width: 1 }]} />
                  <View style={[styles.third, { top: '33.3%', left: 0, right: 0, height: 1 }]} />
                  <View style={[styles.third, { top: '66.6%', left: 0, right: 0, height: 1 }]} />
                </View>
              </GestureDetector>
            </>
          ) : null}
          {busy ? <ActivityIndicator color={ED.gold} style={StyleSheet.absoluteFill} /> : null}
        </View>
      </View>
      <View style={styles.bottom}>
        {(Object.keys(RATIOS) as Ratio[]).map((k) => (
          <Pill key={k} title={t(`editor.crop.${k}`)} selected={ratio === k} onPress={() => (setRatio(k), setOff({ x: 0, y: 0 }))} />
        ))}
        <RoundButton icon="rotate-right" label={t('editor.crop.rotate')} onPress={rotate} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: ED.bg, zIndex: 30 },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', direction: 'ltr' },
  mask: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  window: { position: 'absolute', borderWidth: 2, borderColor: ED.text },
  third: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)' },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
});
