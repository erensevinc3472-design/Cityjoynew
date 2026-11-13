import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { playRange, VIEW_MIN_SECONDS, type MediaEdit, type PostVideo } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { MediaOverlay } from '@/components/media-overlay';
import { markViewed } from '@/lib/views';

/** Videonun oranı fotoğraflardaki gibi sınırlanır: en uzun 4:5 dik, en geniş 16:9 yatay. */
export const ratioOf = (v: Pick<PostVideo, 'width' | 'height'>) => (v.width > 0 && v.height > 0 ? Math.min(16 / 9, Math.max(0.8, v.width / v.height)) : 0.8);

export const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`;

// Kaldığı yer (Eren, 12 Kasım 2026: "tam ekrana geçince baştan başlamasın, ama ekrandan gidip gelince baştan başlasın"):
// yalnızca akıştan tam ekrana geçerken ve tam ekrandan akışa dönerken video aynı saniyeden sürer (handOffVideo). Kaydırıp
// ekrandan çıkan video geri gelince baştan başlar.
const resumeAt = new Map<string, number>();
const handoff = new Map<string, number>();
const HANDOFF_MS = 1500;
/** Bu video birazdan başka oynatıcıda (tam ekran ya da akış) kaldığı yerden sürsün. */
export function handOffVideo(url: string) {
  handoff.set(url, Date.now() + HANDOFF_MS);
}

/**
 * Kaldığı yerden süren oynatıcı. Telefon videoyu önbelleğe alır (useCaching): akıştan tam ekrana geçerken ya da geri
 * dönerken yeniden indirilmez; hem açılış hızlanır hem veri maliyeti düşer.
 */
export function useResumingPlayer(url: string, setup: (p: VideoPlayer) => void): VideoPlayer {
  const [start] = useState(() => ((handoff.get(url) ?? 0) > Date.now() ? (resumeAt.get(url) ?? 0) : 0));
  const player = useVideoPlayer({ uri: url, useCaching: true }, (p) => {
    p.timeUpdateEventInterval = 0.25;
    setup(p);
    if (start > 0.3) p.currentTime = start;
  });
  useEffect(() => {
    // Bazı telefonlarda video hazır olmadan verilen konum yok sayılır: hazır olunca bir kez daha.
    let seek = start > 0.3;
    const ready = player.addListener('statusChange', ({ status }) => {
      if (!seek || status !== 'readyToPlay') return;
      seek = false;
      if (player.currentTime < start - 0.5) player.currentTime = start;
    });
    const time = player.addListener('timeUpdate', (e) => {
      resumeAt.set(url, e.currentTime);
    });
    return () => {
      ready.remove();
      time.remove();
    };
  }, [player]); // eslint-disable-line react-hooks/exhaustive-deps
  return player;
}

/**
 * Düzenleyicide kırpılan video yalnızca seçilen aralıkta döner; sessiz paylaşılan video hep sessizdir (dosyaya işlenmez,
 * oynatırken uygulanır). Dönen aralığı verir.
 */
export function useEditPlayback(player: VideoPlayer, edit: MediaEdit | null | undefined, durationSec: number) {
  const range = playRange(edit, durationSec);
  const trimmed = edit?.trimStart !== undefined;
  const muted = edit?.muted === true;
  useEffect(() => {
    if (!trimmed) return;
    if (player.currentTime < range.start || player.currentTime > range.end) player.currentTime = range.start;
    const sub = player.addListener('timeUpdate', (e) => {
      if (e.currentTime >= range.end - 0.1 || e.currentTime < range.start - 0.5) player.currentTime = range.start;
    });
    return () => sub.remove();
  }, [player, trimmed, range.start, range.end]);
  useEffect(() => {
    if (!muted) return;
    player.muted = true;
    const sub = player.addListener('mutedChange', () => {
      if (!player.muted) player.muted = true;
    });
    return () => sub.remove();
  }, [player, muted]);
  return range;
}

/**
 * İzlenme: video gerçekten en az VIEW_MIN_SECONDS oynayınca bir kez işaretlenir (lib/views toplu gönderir). Atlamalar
 * (kırpma başına dönme, ileri sarma) sayılmaz; yalnızca akan oynatma süresi toplanır.
 */
export function useViewCount(player: VideoPlayer, viewId: string | undefined) {
  useEffect(() => {
    if (!viewId) return;
    let last = -1;
    let played = 0;
    const sub = player.addListener('timeUpdate', (e) => {
      const d = e.currentTime - last;
      last = e.currentTime;
      if (d > 0 && d < 1.5) played += d;
      if (played >= VIEW_MIN_SECONDS) {
        markViewed(viewId);
        sub.remove();
      }
    });
    return () => sub.remove();
  }, [player, viewId]);
}

/** Görünen süre: kırpıldıysa seçilen kısmın uzunluğu. */
export const editedDuration = (video: PostVideo, edit: MediaEdit | null | undefined) => {
  const r = playRange(edit, video.durationSec);
  return Math.max(1, Math.round(r.end - r.start));
};

// Akıştaki ses tercihi bütün videolarda ortak: biri sesi açınca sonrakiler de sesli oynar (uygulama açıkken).
let feedMuted = true;
const muteListeners = new Set<(m: boolean) => void>();
function useFeedMuted(): [boolean, () => void] {
  const [m, setM] = useState(feedMuted);
  useEffect(() => {
    muteListeners.add(setM);
    return () => {
      muteListeners.delete(setM);
    };
  }, []);
  return [
    m,
    () => {
      feedMuted = !feedMuted;
      muteListeners.forEach((l) => l(feedMuted));
    },
  ];
}

interface Props {
  video: PostVideo;
  maxWidth: number;
  /**
   * Akış (Eren, 12 Kasım 2026: "akışta otomatik oynatılsın, tam ekran için bir kere dokunmak gereksin"): ekranda en çok
   * görünen tek video sessiz ve döngüde kendiliğinden oynar; dokununca tam ekran açılır (onOpen). Veri maliyeti için
   * aynı anda yalnızca bir oynatıcı vardır, ekrandan çıkan video durur.
   */
  active?: boolean;
  onOpen?(): void;
  /** Düzenleyici: yazı, çıkartma, kırpma, ses. */
  edit?: MediaEdit | null;
  /** İzlenme sayılacak gönderi. */
  viewId?: string;
}

/**
 * Gönderi videosu. Akışta (onOpen verilmişse) yukarıdaki gibi; gönderi sayfasında önce süreyle birlikte oynat düğmesi
 * görünür, dokununca oynatıcı açılır (ses, durdurma, tam ekran oynatıcının kendi düğmeleriyle).
 */
export function PostVideoView({ video, maxWidth, active, onOpen, edit, viewId }: Props) {
  const { t } = useTranslation();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen, maxWidth);
  const height = Math.round(width / ratioOf(video));
  const [started, setStarted] = useState(false);
  const duration = editedDuration(video, edit);
  const overlay = <MediaOverlay edit={edit} frameW={width} frameH={height} mediaW={video.width} mediaH={video.height} fit="cover" />;
  const poster = video.poster ? <Image source={{ uri: video.poster }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={video.poster} accessible={false} /> : null;

  if (onOpen) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('explore.video.open')}, ${formatDuration(duration)}`}
        onPress={() => {
          if (active) handOffVideo(video.url);
          onOpen();
        }}
        style={[styles.poster, { width, height }]}>
        {poster}
        {active ? <AutoPlayer url={video.url} width={width} height={height} edit={edit} durationSec={video.durationSec} viewId={viewId} /> : (
          <View style={styles.play}>
            <MaterialIcons name="play-arrow" size={44} color="#FFFFFF" />
          </View>
        )}
        {overlay}
        <View pointerEvents="none" style={styles.badge}>
          <MaterialIcons name="videocam" size={14} color="#FFFFFF" />
          <AppText style={styles.badgeText}>{formatDuration(duration)}</AppText>
        </View>
      </Pressable>
    );
  }

  if (started) return <Player url={video.url} width={width} height={height} edit={edit} video={video} viewId={viewId} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('explore.video.play', { duration: formatDuration(duration) })}
      onPress={() => setStarted(true)}
      style={[styles.poster, { width, height }]}>
      {poster}
      {overlay}
      <View style={styles.play}>
        <MaterialIcons name="play-arrow" size={44} color="#FFFFFF" />
      </View>
      <View style={styles.badge}>
        <MaterialIcons name="videocam" size={14} color="#FFFFFF" />
        <AppText style={styles.badgeText}>{formatDuration(duration)}</AppText>
      </View>
    </Pressable>
  );
}

/** Akışta kendiliğinden oynayan video: döngüde, ses tercihi ortak, köşede ses düğmesi. */
function AutoPlayer({ url, width, height, edit, durationSec, viewId }: { url: string; width: number; height: number; edit?: MediaEdit | null; durationSec: number; viewId?: string }) {
  const { t } = useTranslation();
  const [muted, toggleMuted] = useFeedMuted();
  const player = useResumingPlayer(url, (p) => {
    p.loop = true;
    p.muted = feedMuted;
  });
  useEffect(() => {
    player.play();
  }, [player]);
  const silent = edit?.muted === true;
  useEditPlayback(player, edit, durationSec);
  useViewCount(player, viewId);
  useEffect(() => {
    player.muted = silent || muted;
  }, [player, muted, silent]);
  return (
    <>
      <VideoView player={player} style={[StyleSheet.absoluteFill, { width, height }]} nativeControls={false} contentFit="cover" pointerEvents="none" />
      {silent ? (
        <View accessible accessibilityLabel={t('explore.video.silent')} style={styles.mute}>
          <MaterialIcons name="volume-off" size={16} color="#FFFFFF" />
        </View>
      ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? t('explore.video.unmute') : t('explore.video.mute')}
        onPress={toggleMuted}
        hitSlop={10}
        style={styles.mute}>
        <MaterialIcons name={muted ? 'volume-off' : 'volume-up'} size={16} color="#FFFFFF" />
      </Pressable>
      )}
    </>
  );
}

function Player({ url, width, height, edit, video, viewId }: { url: string; width: number; height: number; edit?: MediaEdit | null; video: PostVideo; viewId?: string }) {
  const { t } = useTranslation();
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  // Oynatıcı ekrana yerleştikten sonra başlar (web'de daha önce verilen komut kaybolabiliyor).
  useEffect(() => {
    player.play();
  }, [player]);
  useEditPlayback(player, edit, video.durationSec);
  useViewCount(player, viewId);
  // Düzenlenmiş videoda (kırpma ya da yazı) yerel düğmeler yerine kendi dokunuşumuz: yerel çubuk kırpılan kısma atlatır ve
  // yazıların üstünü kapatır. Dokununca durur ya da sürer; döngüde oynar.
  const plain = edit?.trimStart === undefined && !edit?.items?.length && !edit?.strokes?.length;
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    player.loop = !plain;
  }, [player, plain]);
  if (plain) return <VideoView player={player} style={{ width, height, backgroundColor: '#000000' }} nativeControls contentFit="contain" />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={paused ? t('explore.video.resume') : t('explore.video.pause')}
      onPress={() => {
        if (paused) player.play();
        else player.pause();
        setPaused(!paused);
      }}
      style={{ width, height, backgroundColor: '#000000' }}>
      <VideoView player={player} style={{ width, height }} nativeControls={false} contentFit="contain" pointerEvents="none" />
      <MediaOverlay edit={edit} frameW={width} frameH={height} mediaW={video.width} mediaH={video.height} fit="contain" />
      {paused ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={styles.play}>
            <MaterialIcons name="play-arrow" size={44} color="#FFFFFF" />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: '#0B1F24', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  play: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, end: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' },
  badgeText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16 },
  mute: { position: 'absolute', bottom: 10, end: 10, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
});
