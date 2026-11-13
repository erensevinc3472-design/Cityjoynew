import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WeatherDay } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { FormScreen } from '@/components/form-screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository } from '@/lib/locations';
import { useUserLocation } from '@/lib/user-location';
import { useWeather, weatherIcon } from '@/lib/weather';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

// Türkiye sürekli UTC+3; saatler cihazın saat diliminden bağımsız Türkiye saatiyle yazılır.
const trClock = (iso: string) => {
  const d = new Date(Date.parse(iso) + 3 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};
const trHour = (iso: string) => String(new Date(Date.parse(iso) + 3 * 3600_000).getUTCHours()).padStart(2, '0');

/** Hava ayrıntısı (Eren, 13 Kasım 2026): kullanıcının ili için şimdi, saatlik, günlük, rüzgâr, nem, gün doğumu/batımı. */
export default function WeatherScreen() {
  const { t, i18n } = useTranslation();
  const c = useThemeColors();
  const { location } = useUserLocation();
  const code = location?.provinceCode;
  const { file, state, reload } = useWeather(code);
  const place = code ? locationRepository.getProvince(code)?.name ?? '' : '';

  if (!code) {
    return (
      <FormScreen title={t('weather.title')}>
        <AppText muted>{t('weather.noLocation')}</AppText>
      </FormScreen>
    );
  }

  const subtitle = file ? t('weather.updated', { place, time: trClock(file.updatedAt) }) : place;
  if (!file) {
    return (
      <FormScreen title={t('weather.title')} subtitle={subtitle}>
        {state === 'error' ? <StateMessage kind="error" onRetry={reload} /> : <StateMessage kind="loading" />}
      </FormScreen>
    );
  }

  const today = file.days[0];
  const lo = Math.min(...file.days.map((d) => d.min));
  const hi = Math.max(...file.days.map((d) => d.max));
  const span = Math.max(1, hi - lo);
  const dayName = (d: WeatherDay, i: number) =>
    i === 0 ? t('weather.today') : new Date(`${d.date}T12:00:00+03:00`).toLocaleDateString(i18n.language, { weekday: 'long' });
  const card = [styles.card, { backgroundColor: c.surface, borderColor: c.border }];

  return (
    <FormScreen title={t('weather.title')} subtitle={subtitle}>
      {state === 'offline' ? <AppText variant="caption" muted>{t('weather.offline')}</AppText> : null}

      <View style={styles.now} accessible accessibilityLabel={`${file.now.temp}°, ${t(`weather.kinds.${file.now.kind}`)}`}>
        <MaterialIcons name={weatherIcon(file.now.kind, file.now.night) as never} size={52} color={c.accent} />
        <AppText style={[styles.deg, { color: c.textStrong }]}>{file.now.temp}°</AppText>
        <AppText muted style={styles.center}>
          {t(`weather.kinds.${file.now.kind}`)}
          {today ? ` · ${t('weather.high', { v: today.max })} · ${t('weather.low', { v: today.min })}` : ''}
        </AppText>
      </View>

      <View style={card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hours}>
          {file.hours.map((h, i) => (
            <View
              key={h.t}
              style={[styles.hour, i === 0 && { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}
              accessible
              accessibilityLabel={`${i === 0 ? t('weather.now') : trHour(h.t)}: ${h.temp}°, ${t(`weather.kinds.${h.kind}`)}`}
            >
              <AppText variant="caption" muted>{i === 0 ? t('weather.now') : trHour(h.t)}</AppText>
              <MaterialIcons name={weatherIcon(h.kind, h.night) as never} size={22} color={c.accent} />
              <AppText variant="label">{h.temp}°</AppText>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={card}>
        {file.days.map((d, i) => (
          <View
            key={d.date}
            style={[styles.day, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
            accessible
            accessibilityLabel={`${dayName(d, i)}: ${t(`weather.kinds.${d.kind}`)}, ${t('weather.low', { v: d.min })}, ${t('weather.high', { v: d.max })}`}
          >
            <AppText style={styles.dayName} numberOfLines={1}>{dayName(d, i)}</AppText>
            <MaterialIcons name={weatherIcon(d.kind, false) as never} size={20} color={c.accent} />
            <AppText muted style={styles.temp}>{d.min}°</AppText>
            <View style={[styles.bar, { backgroundColor: c.surfaceStrong }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: c.accent, start: `${((d.min - lo) / span) * 100}%`, end: `${((hi - d.max) / span) * 100}%` },
                ]}
              />
            </View>
            <AppText style={styles.temp}>{d.max}°</AppText>
          </View>
        ))}
      </View>

      <View style={styles.facts}>
        <Fact label={t('weather.wind')} value={t('weather.windValue', { v: Math.round(file.now.wind * 3.6) })} />
        <Fact label={t('weather.humidity')} value={`%${file.now.humidity}`} />
        {file.sunrise ? <Fact label={t('weather.sunrise')} value={trClock(file.sunrise)} /> : null}
        {file.sunset ? <Fact label={t('weather.sunset')} value={trClock(file.sunset)} /> : null}
      </View>

      <AppText variant="caption" muted style={styles.center}>{t('weather.source', { source: file.source })}</AppText>
    </FormScreen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <View style={[styles.card, styles.fact, { backgroundColor: c.surface, borderColor: c.border }]}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  now: { alignItems: 'center', gap: spacing.xs },
  deg: { fontFamily: fonts.heading, fontSize: 60, lineHeight: 68 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm },
  hours: { gap: spacing.xs },
  hour: { alignItems: 'center', gap: 4, minWidth: 52, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  day: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  dayName: { width: 92 },
  temp: { width: 32, textAlign: 'center' },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: { flexBasis: '47%', flexGrow: 1, gap: 2 },
});
