import { useEffect } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { MEDIA_EDIT_LIMITS, type EditItem } from '@cityjoy/shared';

import { ItemFrame, itemContent } from '@/components/media-overlay';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface Props {
  item: EditItem;
  /** Medyanın ekrandaki boyutu. */
  w: number;
  h: number;
  onChange(item: EditItem): void;
  /** Yazıya dokununca yeniden düzenlenir. */
  onTap?(): void;
  /** Sürüklenirken çöp kutusu gösterilir; parmak çöpün üstündeyse true. */
  onDrag(state: { dragging: boolean; overTrash: boolean }): void;
  /** Parmağın ekrandaki konumu çöp kutusunun üstünde mi. */
  isOverTrash(x: number, y: number): boolean;
  onDelete(): void;
  /** Ekran okuyucu için ad (yazının kendisi ya da çıkartma). */
  label: string;
}

/**
 * Düzenleyicide taşınabilen yazı ya da çıkartma: tek parmakla sürüklenir, iki parmakla büyütülür ve döndürülür, çöp
 * kutusuna bırakılınca silinir. Hareket sırasında yalnızca dönüşüm değişir; parmak kalkınca yeni konum kaydedilir.
 */
export function EditableItem({ item, w, h, onChange, onTap, onDrag, isOverTrash, onDelete, label }: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);
  const rot = useSharedValue(0);

  // Kaydedilen yeni konum çizilince geçici dönüşüm sıfırlanır (çift kayma olmaz).
  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
    sc.value = 1;
    rot.value = 0;
  }, [item.x, item.y, item.scale, item.rotation, tx, ty, sc, rot]);

  const commit = (absX?: number, absY?: number) => {
    if (absX !== undefined && absY !== undefined && isOverTrash(absX, absY)) {
      onDrag({ dragging: false, overTrash: false });
      onDelete();
      return;
    }
    onDrag({ dragging: false, overTrash: false });
    onChange({
      ...item,
      x: clamp(item.x + tx.value / w, 0, 1),
      y: clamp(item.y + ty.value / h, 0, 1),
      scale: clamp(item.scale * sc.value, MEDIA_EDIT_LIMITS.scale[0], MEDIA_EDIT_LIMITS.scale[1]),
      rotation: Math.round(((item.rotation + (rot.value * 180) / Math.PI + 540) % 360) - 180),
    } as EditItem);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .averageTouches(true)
    .onStart(() => onDrag({ dragging: true, overTrash: false }))
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
      onDrag({ dragging: true, overTrash: isOverTrash(e.absoluteX, e.absoluteY) });
    })
    .onEnd((e) => commit(e.absoluteX, e.absoluteY))
    .onFinalize((_e, ok) => {
      if (!ok) onDrag({ dragging: false, overTrash: false });
    });
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onUpdate((e) => {
      sc.value = e.scale;
    })
    .onEnd(() => commit());
  const rotate = Gesture.Rotation()
    .runOnJS(true)
    .onUpdate((e) => {
      rot.value = e.rotation;
    })
    .onEnd(() => commit());
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((_e, ok) => {
      if (ok) onTap?.();
    });
  const gesture = Gesture.Race(tap, Gesture.Simultaneous(pan, pinch, rotate));

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${item.rotation + (rot.value * 180) / Math.PI}deg` },
      { scale: item.scale * sc.value },
    ],
  }));

  return (
    <ItemFrame item={item} w={w} h={h}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={style} accessible accessibilityLabel={label}>
          <View collapsable={false} style={{ padding: 6 }}>
            {itemContent(item, w)}
          </View>
        </Animated.View>
      </GestureDetector>
    </ItemFrame>
  );
}
