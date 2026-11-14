import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, I18nManager, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MEDIA_EDIT_LIMITS, playRange, sanitizeMediaEdit, type EditItem, type MediaEdit, type TextItem } from '@cityjoy/shared';
import type { PreparedPhoto, PreparedVideo } from '@cityjoy/shared/firebase';

import { AppText } from '@/components/app-text';
import { mediaRect, Strokes } from '@/components/media-overlay';
import { formatDuration, useEditPlayback } from '@/components/post-video';
import { fonts } from '@/theme/tokens';
import { CropTool } from './crop-tool';
import { DrawTool } from './draw-tool';
import { EditableItem } from './editable-item';
import { StickerSheet, type StickerPick } from './sticker-sheet';
import { newTextItem, TextTool } from './text-tool';
import { ED, RoundButton, type IconName } from './ui';
import { VideoSheet } from './video-tools';

export type EditorMedia = { kind: 'photo'; photos: PreparedPhoto[] } | { kind: 'video'; video: PreparedVideo };
export interface EditorResult {
  media: EditorMedia;
  edits: (MediaEdit | null)[];
}

type Mode = 'none' | 'text' | 'sticker' | 'draw' | 'video' | 'cover' | 'crop';

const BAR = 76;
const TRASH = 64;

function confirmDiscard(title: string, ok: string, cancel: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(title)) onYes();
    return;
  }
  Alert.alert(title, undefined, [
    { text: cancel, style: 'cancel' },
    { text: ok, style: 'destructive', onPress: onYes },
  ]);
}

/** Videonun kapak karesi: seçilen saniyeden küçük bir JPEG (akışta ve ızgarada video oynamadan görünür). */
async function makeCover(player: ReturnType<typeof useVideoPlayer>, at: number): Promise<string | undefined> {
  try {
    const [thumb] = await player.generateThumbnailsAsync(Math.max(0, at), { maxWidth: 720 });
    if (!thumb) return undefined;
    const out = await (await ImageManipulator.manipulate(thumb).renderAsync()).saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return undefined;
  }
}

interface Props {
  media: EditorMedia;
  edits: readonly (MediaEdit | null)[];
  /** Konum çıkartması: "Osmangazi, Bursa". */
  place: string;
  provinceCode?: string;
  onDone(r: EditorResult): void;
  onCancel(): void;
}

/**
 * Paylaşım düzenleyicisi (Karar Eren, 13 Kasım 2026; taslak docs/tasarim-ornekleri/duzenleyici): fotoğraf ya da video
 * seçilince önce bu ekran açılır, "İleri" ile paylaşım formuna dönülür. Sağda araçlar (yazı, çıkartma, çizim, kırp;
 * videoda ses ve kapak); eklenen her şey taşınır, iki parmakla büyütülür ve döndürülür, çöpe sürüklenince silinir.
 * Hiçbiri dosyaya işlenmez (media-edit.ts); yalnızca fotoğraf kırpma/döndürme fotoğrafın kendisine uygulanır.
 */
export function MediaEditor(props: Props) {
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={props.onCancel}>
      <GestureHandlerRootView style={styles.root}>
        <EditorBody {...props} />
      </GestureHandlerRootView>
    </Modal>
  );
}

function EditorBody({ media, edits: initialEdits, place, provinceCode, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const video = media.kind === 'video' ? media.video : null;
  const [photos, setPhotos] = useState<PreparedPhoto[]>(media.kind === 'photo' ? media.photos : []);
  const count = video ? 1 : photos.length;
  const [edits, setEdits] = useState<MediaEdit[]>(() => Array.from({ length: count }, (_, i) => ({ ...(initialEdits[i] ?? {}) })));
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('none');
  const [editing, setEditing] = useState<{ at: number | null; item: TextItem } | null>(null);
  const [drag, setDrag] = useState({ dragging: false, overTrash: false });
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const edit = edits[index] ?? {};
  const items = edit.items ?? [];
  const mediaW = video ? video.width : photos[index]?.width ?? 1;
  const mediaH = video ? video.height : photos[index]?.height ?? 1;
  const rect = mediaRect(stage.width, stage.height, mediaW, mediaH, 'contain');
  // Ekran koordinatı (sahnenin kenar boşluğu 8).
  const abs = { left: rect.left + 8, top: rect.top + insets.top + 8, width: rect.width, height: rect.height };

  const player = useVideoPlayer(video ? { uri: video.uri } : null, (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
  });
  useEffect(() => {
    if (video) player.play();
  }, [player, video]);
  useEditPlayback(player, video ? edit : null, video?.durationSec ?? 0);
  useEffect(() => {
    if (video) player.muted = edit.muted === true;
  }, [player, video, edit.muted]);

  const update = (p: Partial<MediaEdit>) => {
    setDirty(true);
    setEdits((cur) => cur.map((e, i) => (i === index ? { ...e, ...p } : e)));
  };
  const setItems = (fn: (l: EditItem[]) => EditItem[]) => update({ items: fn(items) });
  const full = items.length >= MEDIA_EDIT_LIMITS.items;

  const addSticker = (s: StickerPick) => {
    setMode('none');
    if (full) return;
    const jitter = () => (Math.random() - 0.5) * 0.1;
    setItems((l) => [...l, { kind: 'cikartma', x: 0.5 + jitter(), y: 0.5 + jitter(), scale: 1, rotation: 0, type: s.type, label: s.label, ...(s.uid ? { uid: s.uid } : {}) }]);
  };

  const finishText = (item: TextItem | null) => {
    const at = editing?.at ?? null;
    setEditing(null);
    setMode('none');
    if (at === null) {
      if (item) setItems((l) => [...l, item]);
    } else setItems((l) => (item ? l.map((x, i) => (i === at ? item : x)) : l.filter((_, i) => i !== at)));
  };

  // Çöp kutusu: altta ortada; parmak yakınındaysa silinir.
  const trashY = screen.height - insets.bottom - BAR - TRASH;
  const isOverTrash = (x: number, y: number) => Math.hypot(x - screen.width / 2, y - trashY) < TRASH;

  // Akışta görünen alan: fotoğraf ve video en uzun 4:5, en geniş 1.91:1 kırpılır; dışı hafifçe karartılır.
  const guide = useMemo(() => {
    const r = mediaW / mediaH;
    if (r < 0.8) {
      const vis = rect.width / 0.8;
      return { y: (rect.height - vis) / 2, x: 0 };
    }
    if (r > 1.91) return { x: (rect.width - rect.height * 1.91) / 2, y: 0 };
    return null;
  }, [mediaW, mediaH, rect.width, rect.height]);

  const next = async () => {
    setBusy(true);
    try {
      const clean = edits.map((e) => sanitizeMediaEdit(e, video?.durationSec));
      if (video) {
        const at = edits[0]?.coverAt ?? playRange(edits[0], video.durationSec).start;
        const coverUri = await makeCover(player, at);
        onDone({ media: { kind: 'video', video: { ...video, coverUri } }, edits: clean });
      } else onDone({ media: { kind: 'photo', photos }, edits: clean });
    } finally {
      setBusy(false);
    }
  };

  const close = () => (dirty ? confirmDiscard(t('editor.discard'), t('editor.discardYes'), t('editor.cancel'), onCancel) : onCancel());

  const rail: { icon: IconName; label: string; onPress(): void; disabled?: boolean }[] = [
    { icon: 'title', label: t('editor.tools.text'), onPress: () => (setEditing({ at: null, item: newTextItem() }), setMode('text')), disabled: full },
    { icon: 'emoji-emotions', label: t('editor.tools.sticker'), onPress: () => setMode('sticker'), disabled: full },
    { icon: 'brush', label: t('editor.tools.draw'), onPress: () => setMode('draw') },
    { icon: video ? 'content-cut' : 'crop-rotate', label: video ? t('editor.tools.trim') : t('editor.tools.crop'), onPress: () => setMode(video ? 'video' : 'crop') },
    ...(video
      ? [
          { icon: (edit.muted ? 'volume-off' : 'volume-up') as IconName, label: edit.muted ? t('editor.tools.soundOff') : t('editor.tools.soundOn'), onPress: () => update({ muted: edit.muted ? undefined : true }) },
          { icon: 'image' as IconName, label: t('editor.tools.cover'), onPress: () => setMode('cover') },
        ]
      : []),
  ];

  const range = video ? playRange(edit, video.durationSec) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.stage, { marginTop: insets.top + 8 }]} onLayout={(e) => setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {stage.width > 0 ? (
          <View style={[styles.media, { left: rect.left, top: rect.top, width: rect.width, height: rect.height }]}>
            {video ? (
              <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" pointerEvents="none" />
            ) : (
              <Image source={{ uri: photos[index]?.uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={t('explore.photos.label', { n: index + 1, total: photos.length })} />
            )}
            {guide ? (
              <>
                <View pointerEvents="none" style={[styles.guide, guide.y ? { top: 0, left: 0, right: 0, height: guide.y } : { top: 0, bottom: 0, left: 0, width: guide.x }]} />
                <View pointerEvents="none" style={[styles.guide, guide.y ? { bottom: 0, left: 0, right: 0, height: guide.y } : { top: 0, bottom: 0, right: 0, width: guide.x }]} />
              </>
            ) : null}
            {mode !== 'draw' ? <Strokes strokes={edit.strokes ?? []} w={rect.width} h={rect.height} /> : null}
            {items.map((item, i) =>
              editing?.at === i ? null : (
                <EditableItem
                  key={`${index}-${i}-${item.kind}`}
                  item={item}
                  w={rect.width}
                  h={rect.height}
                  label={item.kind === 'yazi' ? item.text : item.label}
                  onChange={(n) => setItems((l) => l.map((x, k) => (k === i ? n : x)))}
                  onTap={item.kind === 'yazi' ? () => (setEditing({ at: i, item }), setMode('text')) : undefined}
                  onDrag={setDrag}
                  isOverTrash={isOverTrash}
                  onDelete={() => setItems((l) => l.filter((_, k) => k !== i))}
                />
              ),
            )}
          </View>
        ) : null}

        {mode === 'none' && !drag.dragging ? (
          <>
            <RoundButton icon="close" label={t('editor.close')} onPress={close} style={styles.close} />
            <View style={styles.rail}>
              {rail.map((r) => (
                <Pressable key={r.icon} accessibilityRole="button" accessibilityLabel={r.label} accessibilityState={{ disabled: !!r.disabled }} disabled={r.disabled} onPress={r.onPress} style={({ pressed }) => [styles.railItem, { opacity: r.disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
                  <AppText style={styles.railLabel}>{r.label}</AppText>
                  <View style={styles.railIcon}>
                    <MaterialIcons name={r.icon} size={22} color={ED.text} />
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </View>

      {drag.dragging ? (
        <View pointerEvents="none" style={[styles.trash, { top: trashY - TRASH / 2, left: screen.width / 2 - TRASH / 2 }, drag.overTrash && styles.trashOn]}>
          <MaterialIcons name="delete" size={28} color={ED.text} />
        </View>
      ) : null}

      <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }, mode !== 'none' && styles.hidden]} pointerEvents={mode === 'none' ? 'auto' : 'none'} importantForAccessibility={mode === 'none' ? 'auto' : 'no-hide-descendants'}>
        {range ? (
          <View style={styles.duration} accessible accessibilityLabel={t('editor.duration', { time: formatDuration(range.end - range.start) })}>
            <MaterialIcons name="movie" size={18} color={ED.text} />
            <AppText style={styles.durationText}>{formatDuration(range.end - range.start)}</AppText>
          </View>
        ) : photos.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs} style={styles.thumbScroll}>
            {photos.map((p, i) => (
              <Pressable key={p.uri} accessibilityRole="button" accessibilityState={{ selected: i === index }} accessibilityLabel={t('explore.photos.label', { n: i + 1, total: photos.length })} onPress={() => setIndex(i)} style={[styles.thumb, { borderColor: i === index ? ED.gold : 'transparent' }]}>
                <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.grow} />
        )}
        <Pressable accessibilityRole="button" onPress={next} disabled={busy} style={({ pressed }) => [styles.next, { opacity: busy ? 0.6 : pressed ? 0.8 : 1 }]}>
          {busy ? <ActivityIndicator color={ED.onGold} /> : <AppText style={styles.nextText}>{t('editor.next')}</AppText>}
          {!busy ? <MaterialIcons name="arrow-forward" size={20} color={ED.onGold} style={styles.arrow} /> : null}
        </Pressable>
      </View>

      {mode === 'text' && editing ? <TextTool initial={editing.item} w={rect.width} onDone={finishText} /> : null}
      {mode === 'sticker' ? <StickerSheet place={place} provinceCode={provinceCode} onPick={addSticker} onClose={() => setMode('none')} /> : null}
      {mode === 'draw' ? <DrawTool rect={abs} initial={edit.strokes ?? []} onDone={(strokes) => (update({ strokes }), setMode('none'))} /> : null}
      {(mode === 'video' || mode === 'cover') && video ? (
        <VideoSheet player={player} durationSec={video.durationSec} edit={edit} onChange={update} onClose={() => (player.play(), setMode('none'))} startOnCover={mode === 'cover'} />
      ) : null}
      {mode === 'crop' && photos[index] ? (
        <CropTool
          photo={photos[index]}
          area={{ width: screen.width - 24, height: screen.height - insets.top - insets.bottom - 160 }}
          onCancel={() => setMode('none')}
          onDone={(p) => {
            setMode('none');
            if (p.uri === photos[index].uri) return;
            setDirty(true);
            setPhotos((cur) => cur.map((x, i) => (i === index ? p : x)));
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ED.bg },
  stage: { flex: 1, marginHorizontal: 8, marginBottom: 0 },
  media: { position: 'absolute', borderRadius: 18, overflow: 'hidden', backgroundColor: '#000000' },
  guide: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.28)' },
  close: { position: 'absolute', top: 10, start: 10 },
  rail: { position: 'absolute', top: 10, end: 10, gap: 12, alignItems: 'flex-end' },
  railItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  railLabel: { color: ED.text, fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  railIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  trash: { position: 'absolute', width: TRASH, height: TRASH, borderRadius: TRASH / 2, borderWidth: 2, borderColor: ED.text, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  trashOn: { backgroundColor: ED.danger, borderColor: ED.danger, transform: [{ scale: 1.15 }] },
  bar: { minHeight: BAR, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  hidden: { opacity: 0 },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 16, borderRadius: 23, borderWidth: 1, borderColor: ED.line, backgroundColor: ED.panel },
  durationText: { color: ED.text, fontFamily: fonts.heading, fontSize: 16, lineHeight: 20 },
  thumbScroll: { flex: 1 },
  thumbs: { gap: 8, alignItems: 'center' },
  thumb: { width: 46, height: 46, borderRadius: 10, borderWidth: 2, overflow: 'hidden', backgroundColor: ED.chip },
  grow: { flex: 1 },
  next: { marginStart: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingHorizontal: 24, borderRadius: 25, backgroundColor: ED.gold },
  nextText: { color: ED.onGold, fontFamily: fonts.heading, fontSize: 17, lineHeight: 22 },
  arrow: { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] },
});

