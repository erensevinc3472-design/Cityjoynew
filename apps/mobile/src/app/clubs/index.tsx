import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CLUB_SPORTS, nextFixture, type Club, type ClubFixture } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { FilterRow, ListRow, ListSurface, SectionTitle, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository as repo } from '@/lib/locations';
import { communityRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Şehir Kulüpleri (PROJE.md 5.3; iç ekran tasarımı 13. madde 35). Üstte il yöneticisinin seçtiği "Şehrin kulübü":
 * takip et, sıradaki maç, bilet. Spor dalı süzgeci, altta ilin kulüpleri. Fikstürü kulüp yetkilisi ya da il yöneticisi
 * panelden girer; canlı skor yok. Kulüp başvurusu belge yüklemeyle (Blaze) gelecek.
 */
export default function ClubsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { location } = useUserLocation();
  const [list, setList] = useState<Club[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sport, setSport] = useState<string | null>(null);
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;

  const load = useCallback(() => {
    if (!location) return;
    setFailed(false);
    communityRepository.listClubs(location.provinceCode).then(setList, () => setFailed(true));
  }, [location]);
  useEffect(load, [load]);

  const featured = list?.find((x) => x.featured);
  const present = CLUB_SPORTS.filter((s) => list?.some((x) => x.sport === s));
  const rest = (list ?? []).filter((x) => x !== featured && (!sport || x.sport === sport));

  const header = (
    <HeroHeader
      title={t('clubs.title')}
      subtitle={province ? t('clubs.subtitle', { place: province }) : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/social'))}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} showsVerticalScrollIndicator={false}>
        {!location ? (
          <>
            <StateMessage kind="empty" message={t('clubs.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        ) : failed && !list ? (
          <StateMessage kind="error" message={t('clubs.loadError')} onRetry={load} />
        ) : !list ? (
          <StateMessage kind="loading" />
        ) : !list.length ? (
          <StateMessage kind="empty" message={t('clubs.empty')} />
        ) : (
          <>
            {featured ? <FeaturedClub club={featured} /> : null}
            {present.length > 1 ? <FilterRow kinds={present.map((s) => ({ id: s, name: t(`clubs.sports.${s}`) }))} kind={sport} onKind={setSport} /> : null}
            {rest.length ? (
              <>
                <SectionTitle title={t('clubs.all')} />
                <ListSurface>
                  {rest.map((x, n) => (
                    <ClubRow key={x.id} club={x} first={n === 0} />
                  ))}
                </ListSurface>
              </>
            ) : null}
          </>
        )}
        <View style={[styles.apply, { borderColor: c.accentBorder }]}>
          <MaterialIcons name="shield" size={20} color={c.accent} />
          <View style={styles.flex}>
            <AppText variant="label" style={{ color: c.textStrong }}>{t('clubs.applyTitle')}</AppText>
            <AppText variant="caption" muted>{t('clubs.applyText')}</AppText>
          </View>
          <Tag label={t('city.soon')} tone="muted" />
        </View>
      </ScrollView>
    </Screen>
  );
}

function useFixtureText() {
  const { t } = useTranslation();
  const { language } = useSettings();
  return (f: ClubFixture) => {
    const when = new Date(f.at).toLocaleString(language ?? 'tr', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `${f.home ? t('clubs.home') : t('clubs.away')} · ${f.opponent} · ${when}`;
  };
}

function Badge({ club, size = 44 }: { club: Club; size?: number }) {
  const c = useThemeColors();
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}>
      <AppText style={[styles.badgeText, { color: c.accent, fontSize: size * 0.34 }]}>{club.short}</AppText>
    </View>
  );
}

function FeaturedClub({ club }: { club: Club }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { user } = useSession();
  const fixture = nextFixture(club);
  const text = useFixtureText();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return setFollowing(false);
    communityRepository.isFollowing(club.id, user.uid).then(setFollowing, () => setFollowing(false));
  }, [club.id, user]);

  const toggle = async () => {
    if (!user || following === null) return;
    const next = !following;
    setFollowing(next);
    setFailed(false);
    try {
      await communityRepository.setFollow(club.id, user.uid, next);
    } catch {
      setFollowing(!next);
      setFailed(true);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.accentBorder }]}>
      <Tag label={t('clubs.cityClub')} />
      <View style={styles.head}>
        <Badge club={club} size={56} />
        <View style={styles.flex}>
          <AppText variant="subtitle">{club.name}</AppText>
          <AppText variant="caption" muted>
            {t(`clubs.sports.${club.sport}`)}
            {club.verified ? ` · ${t('clubs.verified')}` : ''}
          </AppText>
        </View>
      </View>
      {fixture ? (
        <View style={[styles.match, { backgroundColor: c.background }]}>
          <AppText variant="caption" muted>{t('clubs.nextMatch')}</AppText>
          <AppText variant="label" style={{ color: c.textStrong }}>{text(fixture)}</AppText>
          {fixture.venue ? <AppText variant="caption" muted>{fixture.venue}</AppText> : null}
        </View>
      ) : (
        <AppText variant="caption" muted>{t('clubs.noFixture')}</AppText>
      )}
      <View style={styles.actions}>
        {user ? (
          <View style={styles.flex}>
            <AppButton title={following ? t('clubs.following') : t('clubs.follow')} variant={following ? 'secondary' : 'primary'} onPress={toggle} disabled={following === null} />
          </View>
        ) : null}
        {fixture?.ticketUrl ? (
          <View style={styles.flex}>
            <AppButton title={t('clubs.ticket')} variant="secondary" onPress={() => Linking.openURL(fixture.ticketUrl!)} />
          </View>
        ) : null}
      </View>
      {!user ? <FormMessage kind="info" text={t('clubs.signIn')} /> : null}
      {failed ? <FormMessage kind="error" text={t('clubs.followError')} /> : null}
    </View>
  );
}

function ClubRow({ club, first }: { club: Club; first: boolean }) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const fixture = nextFixture(club);
  const text = useFixtureText();
  return (
    <ListRow
      first={first}
      leading={<Badge club={club} />}
      title={club.name}
      subtitle={fixture ? text(fixture) : t(`clubs.sports.${club.sport}`)}
      trailing={club.verified ? <MaterialIcons name="verified" size={18} color={c.success} accessibilityLabel={t('clubs.verified')} /> : undefined}
      onPress={club.website ? () => Linking.openURL(club.website!) : undefined}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, alignItems: 'stretch' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badgeText: { fontFamily: fonts.heading },
  match: { gap: 2, padding: spacing.sm, borderRadius: radius.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  apply: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
});
