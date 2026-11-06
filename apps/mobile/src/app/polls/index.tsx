import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { pollDaysLeft, pollOpen, pollPercents, type Poll } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { TranslatableText } from '@/components/translatable-text';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { SectionTitle, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { errorText } from '@/lib/limits';
import { locationRepository as repo } from '@/lib/locations';
import { communityRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Anketler (PROJE.md 5.3; iç ekran tasarımı 13. madde 35). İlindeki açık anketler: kalan gün, ilçe, hazırlayan, katılım;
 * seçenek seç, "Oyumu gönder". Oy gizlidir; sonuçlar oy verince ya da anket bitince görünür. Altta sonuçlanan anketler.
 * Oy için giriş ve doğrulanmış e-posta gerekir (telefon doğrulaması Blaze ile).
 */
export default function PollsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { location } = useUserLocation();
  const { user } = useSession();
  const [list, setList] = useState<Poll[] | null>(null);
  const [failed, setFailed] = useState(false);
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;

  const load = useCallback(() => {
    if (!location) return;
    setFailed(false);
    communityRepository.listPolls(location.provinceCode).then(setList, () => setFailed(true));
  }, [location]);
  useEffect(load, [load]);

  const now = new Date();
  const open = list?.filter((p) => pollOpen(p, now)) ?? [];
  const closed = list?.filter((p) => !pollOpen(p, now)) ?? [];
  const header = (
    <HeroHeader
      title={t('polls.title')}
      subtitle={province ? t('polls.subtitle', { place: province }) : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/social'))}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} showsVerticalScrollIndicator={false}>
        {!location ? (
          <>
            <StateMessage kind="empty" message={t('polls.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        ) : failed && !list ? (
          <StateMessage kind="error" message={t('polls.loadError')} onRetry={load} />
        ) : !list ? (
          <StateMessage kind="loading" />
        ) : (
          <>
            {!user ? <FormMessage kind="info" text={t('polls.signIn')} /> : !user.emailVerified ? <FormMessage kind="info" text={t('polls.verifyEmail')} /> : null}
            {open.length ? open.map((p) => <PollCard key={p.id} poll={p} onVoted={(next) => setList((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? l)} />) : <StateMessage kind="empty" message={t('polls.empty')} />}
            {closed.length ? (
              <>
                <SectionTitle title={t('polls.finished')} />
                {closed.map((p) => (
                  <PollCard key={p.id} poll={p} />
                ))}
              </>
            ) : null}
            <AppText variant="caption" muted>{t('polls.note')}</AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PollCard({ poll, onVoted }: { poll: Poll; onVoted?(next: Poll): void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { user } = useSession();
  const isOpen = pollOpen(poll);
  const [mine, setMine] = useState<string | null | undefined>(undefined);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!user) return setMine(null);
    communityRepository.myPollVote(poll.id, user.uid).then(setMine, () => setMine(null));
  }, [poll.id, user]);

  const showResults = !isOpen || !!mine;
  const pct = pollPercents(poll);
  const days = pollDaysLeft(poll);
  const district = poll.districtId ? repo.getDistrict(poll.districtId)?.name : undefined;
  const canVote = isOpen && !mine && !!user?.emailVerified;

  const send = async () => {
    if (!user || !pick) return;
    setBusy(true);
    setError(undefined);
    try {
      await communityRepository.votePoll(poll.id, user.uid, pick);
      setMine(pick);
      onVoted?.({ ...poll, counts: { ...poll.counts, [pick]: (poll.counts[pick] ?? 0) + 1 }, voteCount: poll.voteCount + 1 });
    } catch (e) {
      setError(errorText(t, e, 'polls.voteError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.tags}>
        <Tag label={isOpen ? (days ? t('polls.daysLeft', { count: days }) : t('polls.lastDay')) : t('polls.closed')} tone={isOpen ? 'green' : 'muted'} />
        {district ? <Tag label={district} tone="muted" /> : null}
      </View>
      <TranslatableText variant="subtitle" text={poll.question} />
      <AppText variant="caption" muted>
        {t('polls.by', { name: poll.sponsorName })} · {t('polls.voters', { count: poll.voteCount })}
      </AppText>
      <View style={styles.options}>
        {poll.options.map((o) => {
          const chosen = showResults ? mine === o.id : pick === o.id;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen, disabled: !canVote }}
              accessibilityLabel={showResults ? `${o.label}, %${pct[o.id] ?? 0}` : o.label}
              disabled={!canVote}
              onPress={() => setPick(o.id)}
              style={[styles.option, { borderColor: chosen ? c.accent : c.border, backgroundColor: c.background }]}>
              {showResults ? <View style={[styles.bar, { width: `${pct[o.id] ?? 0}%`, backgroundColor: chosen ? c.accentSoft : c.surfaceStrong }]} /> : null}
              {!showResults ? <MaterialIcons name={chosen ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={chosen ? c.accent : c.textMuted} /> : null}
              <AppText style={styles.optionText}>{o.label}</AppText>
              {showResults ? <AppText style={[styles.pct, { color: chosen ? c.accent : c.textMuted }]}>%{pct[o.id] ?? 0}</AppText> : null}
            </Pressable>
          );
        })}
      </View>
      {canVote ? <AppButton title={t('polls.send')} onPress={send} disabled={!pick} loading={busy} /> : null}
      {isOpen && !showResults ? <AppText variant="caption" muted>{t('polls.secret')}</AppText> : null}
      {mine ? <AppText variant="caption" muted>{t('polls.youVoted')}</AppText> : null}
      {error ? <FormMessage kind="error" text={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  tags: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  options: { gap: spacing.xs, marginVertical: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  bar: { position: 'absolute', start: 0, top: 0, bottom: 0 },
  optionText: { flex: 1 },
  pct: { fontFamily: fonts.bodySemi },
});
