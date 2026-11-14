import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isWeatherStale } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { useWeather, weatherIcon } from '@/lib/weather';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Ana sayfada konumun yanında küçük hava düğmesi (Eren, 13 Kasım 2026: seçenek A; büyük kart yer kaplıyordu).
 * Dokununca hava ayrıntısı açılır. Dosya yoksa ya da 8 saatten eskiyse hiç görünmez (yanlış bilgi göstermez).
 */
export function WeatherChip({ provinceCode }: { provinceCode: string | undefined }) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const { file } = useWeather(provinceCode);
  if (!file || isWeatherStale(file, new Date())) return null;
  const kind = t(`weather.kinds.${file.now.kind}`);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${file.now.temp}°, ${kind}. ${t('weather.open')}`}
      onPress={() => router.push('/weather')}
      hitSlop={4}
      style={({ pressed }) => [styles.chip, { backgroundColor: c.heroChip, borderColor: c.accentBorder, opacity: pressed ? 0.7 : 1 }]}
    >
      <MaterialIcons name={weatherIcon(file.now.kind, file.now.night) as never} size={18} color={c.heroAccent} />
      <AppText style={[styles.text, { color: c.heroText }]}>{file.now.temp}°</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 34, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1 },
  text: { fontFamily: fonts.bodySemi, fontSize: 13 },
});
