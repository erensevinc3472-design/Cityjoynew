import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CONTEST_LIMITS, validateEntry, type Contest, type ContestEntry, type EntryError } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { TranslatableText } from '@/components/translatable-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { ListRow, ListSurface, SectionTitle, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { errorText } from '@/lib/limits';
import { communityRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const shortDate = (ymd: string, lang: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short' });

const STAGES = ['il', 'bolge', 'turkiye'] as const;

/**
 * Yarışma sayfası (13. madde 35): aşamalar (1. İl, 2. Bölge, 3. Türkiye), son tarih ve katılımcı sayısı, "Katıl"
 * (görünen ad, video bağlantısı, kısa not, şartname onayı; ekip onaylar), öne çıkanlar sıralaması ve oy, oy kuralları,
 * şartname. Oy için giriş ve doğrulanmış e-posta; yarışmacı başına tek oy, kendine oy yok.
 */
export default function ContestScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Contest | null | undefined>(undefined);
  const [entries, setEntries] = useState<ContestEntry[] | null>(null);
  const [mine, setMine] = useState<ContestEntry | null>(null);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [showTerms, setShowTerms] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    communityRepository.getContest(id).then(setItem, () => setItem(null));
    communityRepository.listEntries(id).then(setEntries, () => setEntries([]));
  }, [id]);
  useEffect(() => {
    if (!user) return;
    communityRepository.myEntry(id, user.uid).then(setMine, () => setMine(null));
    communityRepository.myContestVotes(id, user.uid).then(setVoted, () => undefined);
  }, [id, user]);

  const header = <HeroHeader title={t('contests.one')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/contests'))} />;
  if (!item) {
    return (
      <Screen header={header}>
        {item === undefined ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('contests.gone')} />}
      </Screen>
    );
  }

  const stageIndex = STAGES.indexOf(item.stage);
  const canVote = item.status === 'oylama' && !!user?.emailVerified;
  const vote = async (e: ContestEntry) => {
    if (!user) return;
    setError(undefined);
    try {
      await communityRepository.voteEntry(item.id, e.id, user.uid);
      setVoted((s) => new Set(s).add(e.id));
      setEntries((l) => l?.map((x) => (x.id === e.id ? { ...x, voteCount: x.voteCount + 1 } : x)).sort((a, b) => b.voteCount - a.voteCount) ?? l);
    } catch (err) {
      setError(errorText(t, err, 'contests.voteError'));
    }
  };

  return (
    <Screen header={header}>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.tags}>
          {item.prize ? <Tag label={t('contests.prized')} /> : null}
          <Tag label={item.status === 'katilim' ? t('contests.joinOpen') : item.status === 'oylama' ? t('contests.voteOpen') : t('contests.results')} tone={item.status === 'sonuc' ? 'muted' : 'green'} />
        </View>
        <AppText variant="title">{item.title}</AppText>
        <TranslatableText text={item.description} />
        {item.prize ? <AppText variant="label" style={{ color: c.accent }}>{t('contests.prize', { prize: item.prize })}</AppText> : null}

        <View style={styles.stages}>
          {STAGES.slice(0, item.stageCount).map((s, n) => (
            <View key={s} style={[styles.stage, { borderColor: n === stageIndex ? c.accent : c.border, backgroundColor: n === stageIndex ? c.accentSoft : c.surface }]}>
              <AppText style={[styles.stageNo, { color: n === stageIndex ? c.accent : c.textMuted }]}>{n + 1}</AppText>
              <AppText variant="caption" style={{ color: n === stageIndex ? c.textStrong : c.textMuted }}>{t(`contests.stages.${s}`)}</AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption" muted>
          {t('contests.joinUntil', { date: shortDate(item.joinEndsOn, lang) })} · {t('contests.voteUntil', { date: shortDate(item.voteEndsOn, lang) })} · {t('contests.entrants', { count: item.entryCount })}
        </AppText>

        {mine ? (
          <FormMessage kind="info" text={t(`contests.entry.${mine.status}`)} />
        ) : item.status === 'katilim' ? (
          !user ? (
            <FormMessage kind="info" text={t('contests.signIn')} />
          ) : !user.emailVerified ? (
            <FormMessage kind="info" text={t('contests.verifyEmail')} />
          ) : joining ? (
            <JoinForm contest={item} onDone={(e) => (setMine(e), setJoining(false))} onCancel={() => setJoining(false)} />
          ) : (
            <AppButton title={t('contests.join')} onPress={() => setJoining(true)} />
          )
        ) : null}
        <AppButton title={showTerms ? t('contests.hideTerms') : t('contests.terms')} variant="secondary" onPress={() => setShowTerms((x) => !x)} />
        {showTerms ? (
          <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
            <AppText variant="caption">{item.terms}</AppText>
          </View>
        ) : null}

        <SectionTitle title={item.status === 'sonuc' ? t('contests.ranking') : t('contests.leaders')} />
        {entries === null ? (
          <StateMessage kind="loading" />
        ) : !entries.length ? (
          <StateMessage kind="empty" message={t('contests.noEntries')} />
        ) : (
          <ListSurface>
            {entries.map((e, n) => (
              <ListRow
                key={e.id}
                first={n === 0}
                leading={<AppText style={[styles.rank, { color: n < 3 ? c.accent : c.textMuted }]}>{n + 1}</AppText>}
                title={e.displayName}
                subtitle={t('contests.votes', { count: e.voteCount })}
                onPress={() => Linking.openURL(e.mediaUrl)}
                trailing={
                  canVote && e.id !== user?.uid ? (
                    voted.has(e.id) ? <Tag label={t('contests.voted')} tone="green" /> : <AppButton title={t('contests.vote')} variant="ghost" onPress={() => vote(e)} />
                  ) : undefined
                }
              />
            ))}
          </ListSurface>
        )}
        {item.status === 'oylama' && !user?.emailVerified ? <FormMessage kind="info" text={user ? t('contests.verifyEmail') : t('contests.signIn')} /> : null}
        {error ? <FormMessage kind="error" text={error} /> : null}
        <View style={[styles.box, { backgroundColor: c.notice, borderColor: c.noticeBorder }]}>
          <AppText variant="label" style={{ color: c.textStrong }}>{t('contests.rulesTitle')}</AppText>
          <AppText variant="caption">{t('contests.rules')}</AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

function JoinForm({ contest, onDone, onCancel }: { contest: Contest; onDone(e: ContestEntry): void; onCancel(): void }) {
  const { t } = useTranslation();
  const { user, profile } = useSession();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<EntryError[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string>();
  const err = (k: EntryError) => (errors.includes(k) ? t(`contests.errors.${k}`) : undefined);

  const submit = async () => {
    const e = validateEntry({ displayName: name, mediaUrl: url, note, accepted });
    setErrors(e);
    if (e.length || !user) return;
    setBusy(true);
    setFailed(undefined);
    try {
      await communityRepository.join(contest.id, user.uid, { displayName: name, mediaUrl: url, note });
      onDone({ id: user.uid, contestId: contest.id, displayName: name.trim(), mediaUrl: url.trim(), status: 'bekliyor', voteCount: 0, createdAt: new Date().toISOString() });
    } catch {
      setFailed(t('contests.joinError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <TextField label={t('contests.fields.name')} value={name} onChangeText={setName} maxLength={CONTEST_LIMITS.name[1]} error={err('name')} />
      <TextField label={t('contests.fields.url')} value={url} onChangeText={setUrl} maxLength={CONTEST_LIMITS.url} autoCapitalize="none" keyboardType="url" error={err('url')} hint={t('contests.fields.urlHint')} />
      <TextField label={t('contests.fields.note')} value={note} onChangeText={setNote} maxLength={CONTEST_LIMITS.note} multiline error={err('note')} />
      <CheckboxRow checked={accepted} onToggle={() => setAccepted((x) => !x)} label={t('contests.fields.accept')} />
      {err('terms') ? <FormMessage kind="error" text={err('terms')!} /> : null}
      {failed ? <FormMessage kind="error" text={failed} /> : null}
      <AppButton title={t('contests.send')} onPress={submit} loading={busy} />
      <AppButton title={t('contests.cancel')} variant="ghost" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  tags: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  stages: { flexDirection: 'row', gap: spacing.xs },
  stage: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  stageNo: { fontFamily: fonts.heading, fontSize: 18 },
  box: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  rank: { width: 28, textAlign: 'center', fontFamily: fonts.heading, fontSize: 18 },
  form: { gap: spacing.sm },
});
