import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { EditFont, EditItem, EditStroke, MediaEdit, StickerItem, StickerKind, TextItem } from '@cityjoy/shared';

import { fonts } from '@/theme/tokens';

/**
 * Paylaşım düzenleyicisinin yazı, çıkartma ve çizimlerini medyanın üstüne çizer (media-edit.ts). Dosyaya işlenmez:
 * akışta, tam ekranda ve düzenleyicide aynı bileşen kullanılır, böylece her yerde aynı yerde görünür.
 */

export const EDIT_FONT_FAMILY: Record<EditFont, string> = {
  modern: fonts.heading,
  klasik: fonts.serifSemi,
  el: fonts.hand,
  kalin: fonts.poster,
  daktilo: fonts.mono,
};

/** Yazı tipine göre satır yüksekliği (El yazısı ve Kalın daha sıkı). */
const LINE: Record<EditFont, number> = { modern: 1.2, klasik: 1.2, el: 1.05, kalin: 1.1, daktilo: 1.25 };

export const STICKER_ICON: Record<StickerKind, ComponentProps<typeof MaterialIcons>['name'] | null> = {
  emoji: null,
  konum: 'place',
  bahset: 'alternate-email',
  saat: 'schedule',
  hava: 'wb-sunny',
  tarih: 'event',
  etiket: 'tag',
};

/**
 * Medyanın ekranda kapladığı dikdörtgen: `cover` çerçeveyi doldurur (taşan kısım kırpılır), `contain` sığar. Yazılar
 * medyanın kendi çerçevesine göre konumlandığı için katman bu dikdörtgene yerleşir.
 */
export function mediaRect(frameW: number, frameH: number, mediaW: number, mediaH: number, fit: 'cover' | 'contain') {
  if (!(mediaW > 0 && mediaH > 0)) return { left: 0, top: 0, width: frameW, height: frameH };
  const s = fit === 'cover' ? Math.max(frameW / mediaW, frameH / mediaH) : Math.min(frameW / mediaW, frameH / mediaH);
  const width = mediaW * s;
  const height = mediaH * s;
  return { left: (frameW - width) / 2, top: (frameH - height) / 2, width, height };
}

const alpha = (hex: string, a: string) => `${hex}${a}`;

export function TextView({ item, w }: { item: TextItem; w: number }) {
  const size = Math.max(8, item.size * w);
  const bg = item.bg === 'dolu' ? item.bgColor : item.bg === 'yari' ? alpha(item.bgColor, '99') : undefined;
  return (
    <Text
      style={{
        fontFamily: EDIT_FONT_FAMILY[item.font],
        fontSize: size,
        lineHeight: size * LINE[item.font],
        color: item.color,
        textAlign: item.align,
        maxWidth: w * 0.9,
        ...(bg
          ? { backgroundColor: bg, paddingHorizontal: size * 0.35, paddingVertical: size * 0.12, borderRadius: size * 0.3, overflow: 'hidden' }
          : { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: size * 0.12, textShadowOffset: { width: 0, height: 1 } }),
      }}>
      {item.text}
    </Text>
  );
}

export function StickerView({ item, w }: { item: StickerItem; w: number }) {
  if (item.type === 'emoji') return <Text style={{ fontSize: w * 0.14, lineHeight: w * 0.17 }}>{item.label}</Text>;
  const size = w * 0.045;
  const icon = STICKER_ICON[item.type];
  const tint = item.type === 'bahset' || item.type === 'etiket' ? '#0E4F57' : '#1B1B1B';
  return (
    <View style={[styles.pill, { paddingHorizontal: size * 0.7, paddingVertical: size * 0.35, borderRadius: size * 0.6, gap: size * 0.25 }]}>
      {icon && item.type !== 'bahset' && item.type !== 'etiket' ? <MaterialIcons name={icon} size={size * 1.15} color="#C8873A" /> : null}
      <Text numberOfLines={1} style={{ fontFamily: fonts.heading, fontSize: size, lineHeight: size * 1.25, color: tint, maxWidth: w * 0.7 }}>
        {item.label}
      </Text>
    </View>
  );
}

export function itemContent(item: EditItem, w: number): ReactNode {
  return item.kind === 'yazi' ? <TextView item={item} w={w} /> : <StickerView item={item} w={w} />;
}

/** Ögenin merkezini (x, y) noktasına koyan, kendisi dokunuşu engellemeyen yer tutucu. */
export function ItemFrame({ item, w, h, children }: { item: EditItem; w: number; h: number; children: ReactNode }) {
  const box = 2 * Math.max(w, h);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: item.x * w - box / 2, top: item.y * h - box / 2, width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

export function strokePath(points: readonly number[], w: number, h: number): string {
  let d = '';
  for (let i = 0; i + 1 < points.length; i += 2) d += `${i ? 'L' : 'M'}${((points[i] / 1000) * w).toFixed(1)} ${((points[i + 1] / 1000) * h).toFixed(1)}`;
  return d;
}

export function Strokes({ strokes, w, h }: { strokes: readonly EditStroke[]; w: number; h: number }) {
  if (!strokes.length) return null;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {strokes.map((s, i) => (
        <Path
          key={i}
          d={strokePath(s.points, w, h)}
          stroke={s.color}
          strokeOpacity={s.marker ? 0.45 : 1}
          strokeWidth={Math.max(1, s.width * w)}
          strokeLinecap={s.marker ? 'square' : 'round'}
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

interface Props {
  edit: MediaEdit | null | undefined;
  /** Görünen çerçeve (ör. akıştaki kart). */
  frameW: number;
  frameH: number;
  /** Medyanın kendi boyutu. */
  mediaW: number;
  mediaH: number;
  fit: 'cover' | 'contain';
  /** Bahset çıkartmasına dokununca (yalnızca tam ekranda; akışta dokunuş medyanındır). */
  onMention?(uid: string): void;
}

/** Medyanın üstündeki katman; çerçeve dışına taşmaz. */
export function MediaOverlay({ edit, frameW, frameH, mediaW, mediaH, fit, onMention }: Props) {
  if (!edit || (!edit.items?.length && !edit.strokes?.length) || !(frameW > 0 && frameH > 0)) return null;
  const r = mediaRect(frameW, frameH, mediaW, mediaH, fit);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: r.left, top: r.top, width: r.width, height: r.height }}>
        <Strokes strokes={edit.strokes ?? []} w={r.width} h={r.height} />
        {(edit.items ?? []).map((item, i) => {
          const body = <View style={{ transform: [{ rotate: `${item.rotation}deg` }, { scale: item.scale }] }}>{itemContent(item, r.width)}</View>;
          const uid = item.kind === 'cikartma' && item.type === 'bahset' ? item.uid : undefined;
          return (
            <ItemFrame key={i} item={item} w={r.width} h={r.height}>
              {uid && onMention ? (
                <Pressable accessibilityRole="link" accessibilityLabel={item.kind === 'cikartma' ? item.label : undefined} onPress={() => onMention(uid)}>
                  {body}
                </Pressable>
              ) : (
                <View pointerEvents="none" accessible accessibilityLabel={item.kind === 'yazi' ? item.text : item.label}>
                  {body}
                </View>
              )}
            </ItemFrame>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
});
