import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_CATEGORIES, canUseActivities, type Activity } from '@cityjoy/shared';

import { ActivityCard } from '@/components/activity-card';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { FeaturedCard, FilterChip, FilterRow, SectionTitle, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useActivities, useNeighbourhoodNames } from '@/lib/activities';
import { locationRepository as repo } from '@/lib/locations';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const WEEK_MS = 7 * 86_400_000;

/**
 * Aktiviteler (PROJE.md 5.3; iç ekran tasarımı 13. madde 35): kullanıcıların açtığı buluşmalar. Tek filtre satırı (ilçe,
 * "Bu hafta", türler); en yakın tarihli aktivite büyük kartta ("tam yer katılınca görünür"), altında yaklaşanlar; en altta
 * ilk buluşma ipuçları. "+" (aktivite aç) yalnızca giriş yapmış 18 yaş ve üstü kullanıcıya.
 */
export default function ActivitiesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { user, profile } = useSession();
  const { location } = useUserLocation();
  const { list, failed, reload } = useActivities(location?.provinceCode, !!user);
  const names = useNeighbourhoodNames(list);
  const [district, setDistrict] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [week, setWeek] = useState(false);
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;
  const adult = canUseActivities(profile?.birthYear);

  const districts = useMemo(() => {
    const ids = [...new Set((list ?? []).map((a) => a.region.districtId))];
    return ids.map((id) => ({ id, name: repo.getDistrict(id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [list]);
  const kinds = useMemo(() => {
    const present = ACTIVITY_CATEGORIES.filter((k) => (list ?? []).some((a) => a.category === k));
    return present.map((k) => ({ id: k, name: t(`activities.categories.${k}`) }));
  }, [list, t]);
  const now = Date.now();
  const shown = (list ?? []).filter(
    (a) => (!district || a.region.districtId === district) && (!kind || a.category === kind) && (!week || new Date(a.startsAt).getTime() - now < WEEK_MS),
  );
  const featured = shown.find((a) => a.status === 'aktif');
  const rest = shown.filter((a) => a !== featured);
  const open = (a: Activity) => router.push({ pathname: '/activities/[id]', params: { id: a.id } });
  const placeOf = (a: Activity) => [names[a.region.neighbourhoodId], repo.getDistrict(a.region.districtId)?.name].filter(Boolean).join(', ');

  const header = (
    <HeroHeader
      title={t('activities.title')}
      subtitle={province ? t('activities.subtitle', { place: province }) : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/social'))}
      right={user && adult && location ? { icon: 'add', label: t('activities.create'), onPress: () => router.push('/activities/new') } : undefined}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />} showsVerticalScrollIndicator={false}>
        {!user ? (
          <>
            <AppText muted>{t('activities.intro')}</AppText>
            <FormMessage kind="info" text={t('activities.signIn')} />
          </>
        ) : !location ? (
          <>
            <StateMessage kind="empty" message={t('activities.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        ) : (
          <>
            {!adult ? <FormMessage kind="info" text={t('activities.adultsOnly')} /> : null}
            <FilterRow
              districts={districts}
              district={district}
              onDistrict={setDistrict}
              kinds={kinds}
              kind={kind}
              onKind={setKind}
              extra={<FilterChip label={t('activities.thisWeek')} icon="date-range" active={week} onPress={() => setWeek((v) => !v)} />}
            />
            {failed && !list?.length ? (
              <StateMessage kind="error" message={t('activities.loadError')} onRetry={reload} />
            ) : list === null ? (
              <StateMessage kind="loading" />
            ) : shown.length === 0 ? (
              <>
                <StateMessage kind="empty" message={t('activities.empty')} />
                {adult ? <AppButton title={t('activities.create')} onPress={() => router.push('/activities/new')} /> : null}
              </>
            ) : (
              <>
                {featured ? (
                  <FeaturedCard
                    kind="activities"
                    badge={new Date(featured.startsAt).toLocaleString(lang, { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                    title={featured.title}
                    meta={[placeOf(featured), t('activities.exactOnJoin'), t('activities.attendingOf', { count: featured.attendeeCount, capacity: featured.capacity }), t('activities.by', { name: featured.organizerName })].filter(Boolean).join(' · ')}
                    tag={featured.attendeeCount >= featured.capacity ? <Tag label={t('activities.full')} tone="muted" /> : <Tag label={t('activities.join')} tone="gold" />}
                    onPress={() => open(featured)}
                  />
                ) : null}
                {rest.length ? <SectionTitle title={t('activities.upcoming')} aside={province ? t('activities.countIn', { place: province, count: shown.length }) : undefined} /> : null}
                {rest.map((a) => <ActivityCard key={a.id} item={a} neighbourhood={names[a.region.neighbourhoodId]} onPress={() => open(a)} />)}
              </>
            )}
            <View style={[styles.tips, { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}>
              <MaterialIcons name="shield" size={20} color={c.primary} />
              <View style={styles.flex}>
                <AppText variant="label" style={{ color: c.textStrong }}>{t('activities.firstMeetTitle')}</AppText>
                <AppText variant="caption" style={{ color: c.text }}>{t('activities.firstMeetTips')}</AppText>
              </View>
            </View>
            <AppText variant="caption" muted>{t('activities.note')}</AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  tips: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
});
