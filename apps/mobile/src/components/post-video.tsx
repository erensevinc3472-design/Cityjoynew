import { MaterialIcons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PostVideo } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';

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
}

/**
 * Gönderi videosu. Akışta (onOpen verilmişse) yukarıdaki gibi; gönderi sayfasında önce süreyle birlikte oynat düğmesi
 * görünür, dokununca oynatıcı açılır (ses, durdurma, tam ekran oynatıcının kendi düğmeleriyle).
 */
export function PostVideoView({ video, maxWidth, active, onOpen }: Props) {
  const { t } = useTranslation();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen, maxWidth);
  const height = Math.round(width / ratioOf(video));
  const [started, setStarted] = useState(false);

  if (onOpen) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('explore.video.open')}, ${formatDuration(video.durationSec)}`}
        onPress={() => {
          if (active) handOffVideo(video.url);
          onOpen();
        }}
        style={[styles.poster, { width, height }]}>
        {active ? <AutoPlayer url={video.url} width={width} height={height} /> : (
          <View style={styles.play}>
            <MaterialIcons name="play-arrow" size={44} color="#FFFFFF" />
          </View>
        )}
        <View pointerEvents="none" style={styles.badge}>
          <MaterialIcons name="videocam" size={14} color="#FFFFFF" />
          <AppText style={styles.badgeText}>{formatDuration(video.durationSec)}</AppText>
        </View>
      </Pressable>
    );
  }

  if (started) return <Player url={video.url} width={width} height={height} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('explore.video.play', { duration: formatDuration(video.durationSec) })}
      onPress={() => setStarted(true)}
      style={[styles.poster, { width, height }]}>
      <View style={styles.play}>
        <MaterialIcons name="play-arrow" size={44} color="#FFFFFF" />
      </View>
      <View style={styles.badge}>
        <MaterialIcons name="videocam" size={14} color="#FFFFFF" />
        <AppText style={styles.badgeText}>{formatDuration(video.durationSec)}</AppText>
      </View>
    </Pressable>
  );
}

/** Akışta kendiliğinden oynayan video: döngüde, ses tercihi ortak, köşede ses düğmesi. */
function AutoPlayer({ url, width, height }: { url: string; width: number; height: number }) {
  const { t } = useTranslation();
  const [muted, toggleMuted] = useFeedMuted();
  const player = useResumingPlayer(url, (p) => {
    p.loop = true;
    p.muted = feedMuted;
  });
  useEffect(() => {
    player.play();
  }, [player]);
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  return (
    <>
      <VideoView player={player} style={[StyleSheet.absoluteFill, { width, height }]} nativeControls={false} contentFit="cover" pointerEvents="none" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? t('explore.video.unmute') : t('explore.video.mute')}
        onPress={toggleMuted}
        hitSlop={10}
        style={styles.mute}>
        <MaterialIcons name={muted ? 'volume-off' : 'volume-up'} size={16} color="#FFFFFF" />
      </Pressable>
    </>
  );
}

function Player({ url, width, height }: { url: string; width: number; height: number }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  // Oynatıcı ekrana yerleştikten sonra başlar (web'de daha önce verilen komut kaybolabiliyor).
  useEffect(() => {
    player.play();
  }, [player]);
  return <VideoView player={player} style={{ width, height, backgroundColor: '#000000' }} nativeControls contentFit="contain" />;
}

const styles = StyleSheet.create({
  poster: { backgroundColor: '#0B1F24', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  play: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, end: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' },
  badgeText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16 },
  mute: { position: 'absolute', bottom: 10, end: 10, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
});
