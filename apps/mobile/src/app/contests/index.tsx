import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { type Contest } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { FeaturedCard, ListRow, ListSurface, RowIcon, SectionTitle, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository as repo } from '@/lib/locations';
import { communityRepository } from '@/lib/services';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Tarih "12 Kas" biçiminde. */
function shortDate(ymd: string, lang: string) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
}

/**
 * Yarışmalar (PROJE.md 5.3; iç ekran tasarımı 13. madde 35). Öne çıkan yarışma büyük kartta (ödüllü, katılım / oylama
 * açık), altta diğerleri ve sonuçlananlar. İlin yarışmaları ve bölge / Türkiye aşamaları birlikte gelir.
 */
export default function ContestsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const [list, setList] = useState<Contest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;

  const load = useCallback(() => {
    if (!location) return;
    setFailed(false);
    communityRepository.listContests(location.provinceCode).then(setList, () => setFailed(true));
  }, [location]);
  useEffect(load, [load]);

  const live = list?.filter((x) => x.status !== 'sonuc') ?? [];
  const done = list?.filter((x) => x.status === 'sonuc') ?? [];
  const [first, ...rest] = live;
  const open = (x: Contest) => router.push({ pathname: '/contests/[id]', params: { id: x.id } });
  const statusTag = (x: Contest) => (x.status === 'katilim' ? t('contests.joinOpen') : x.status === 'oylama' ? t('contests.voteOpen') : t('contests.results'));
  const until = (x: Contest) => t(x.status === 'katilim' ? 'contests.joinUntil' : 'contests.voteUntil', { date: shortDate(x.status === 'katilim' ? x.joinEndsOn : x.voteEndsOn, lang) });

  const header = (
    <HeroHeader
      title={t('contests.title')}
      subtitle={province ? t('contests.subtitle', { place: province }) : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/social'))}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} showsVerticalScrollIndicator={false}>
        {!location ? (
          <>
            <StateMessage kind="empty" message={t('contests.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        ) : failed && !list ? (
          <StateMessage kind="error" message={t('contests.loadError')} onRetry={load} />
        ) : !list ? (
          <StateMessage kind="loading" />
        ) : !list.length ? (
          <StateMessage kind="empty" message={t('contests.empty')} />
        ) : (
          <>
            {first ? (
              <FeaturedCard
                kind="contests"
                badge={[first.prize ? t('contests.prized') : null, statusTag(first)].filter(Boolean).join(' · ')}
                title={first.title}
                meta={`${until(first)} · ${t('contests.entrants', { count: first.entryCount })}`}
                tag={<Tag label={t(`contests.stages.${first.stage}`)} />}
                onPress={() => open(first)}
              />
            ) : null}
            {rest.length ? (
              <ListSurface>
                {rest.map((x, n) => (
                  <ListRow key={x.id} first={n === 0} leading={<RowIcon icon="emoji-events" tint={c.accent} />} title={x.title} subtitle={`${statusTag(x)} · ${until(x)}`} onPress={() => open(x)} />
                ))}
              </ListSurface>
            ) : null}
            {done.length ? (
              <>
                <SectionTitle title={t('contests.finished')} />
                <ListSurface>
                  {done.map((x, n) => (
                    <ListRow key={x.id} first={n === 0} leading={<RowIcon icon="military-tech" tint={c.textMuted} />} title={x.title} subtitle={t('contests.entrants', { count: x.entryCount })} onPress={() => open(x)} />
                  ))}
                </ListSurface>
              </>
            ) : null}
          </>
        )}
        <AppText variant="caption" muted>{t('contests.note')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
});
