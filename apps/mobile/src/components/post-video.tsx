import { MaterialIcons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PostVideo } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';

/** Videonun oranı fotoğraflardaki gibi sınırlanır: en uzun 4:5 dik, en geniş 16:9 yatay. */
const ratioOf = (v: Pick<PostVideo, 'width' | 'height'>) => (v.width > 0 && v.height > 0 ? Math.min(16 / 9, Math.max(0.8, v.width / v.height)) : 0.8);

export const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`;

/**
 * Gönderi videosu: akışta kendiliğinden oynamaz (veri ve depolama maliyeti). Önce süreyle birlikte oynat düğmesi
 * görünür; dokununca oynatıcı açılır ve oynamaya başlar (ses, durdurma, tam ekran oynatıcının kendi düğmeleriyle).
 */
export function PostVideoView({ video, maxWidth }: { video: PostVideo; maxWidth: number }) {
  const { t } = useTranslation();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen, maxWidth);
  const height = Math.round(width / ratioOf(video));
  const [started, setStarted] = useState(false);

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
  poster: { backgroundColor: '#0B1F24', alignItems: 'center', justifyContent: 'center' },
  play: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, end: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' },
  badgeText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16 },
});
