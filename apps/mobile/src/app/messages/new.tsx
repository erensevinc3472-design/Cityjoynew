import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SEARCH_LIMITS, type PublicProfile } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { StateMessage } from '@/components/state-message';
import { searchPeople } from '@/lib/search';
import { socialRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSocial } from '@/lib/social';
import { fonts, MIN_TOUCH, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const FOLLOWING_SHOWN = 30;

/**
 * Yeni mesaj (Mesajlar > sağ üst): kişi ara ya da takip ettiklerinden seç; seçince sohbet açılır. Takipleşmediğin
 * kişiye giden ilk mesaj karşı tarafa istek olarak düşer (PROJE.md 5.11). Engellediklerin listede yok.
 */
export default function NewMessageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useSession();
  const { following, blocked } = useSocial();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<PublicProfile[] | null>(null);
  const [friends, setFriends] = useState<PublicProfile[] | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(h);
  }, [input]);

  const searching = query.length >= SEARCH_LIMITS.minName;
  useEffect(() => {
    if (!searching) return setFound(null);
    let alive = true;
    setFound(null);
    searchPeople(query).then((l) => alive && setFound(l), () => alive && setFound([]));
    return () => {
      alive = false;
    };
  }, [query, searching]);

  useEffect(() => {
    if (following === null) return;
    Promise.all(following.slice(0, FOLLOWING_SHOWN).map((u) => socialRepository.getProfile(u).catch(() => null))).then((l) =>
      setFriends(l.filter((p): p is PublicProfile => !!p)),
    );
  }, [following]);

  const list = (searching ? found : friends)?.filter((p) => p.uid !== user?.uid && !blocked.has(p.uid)) ?? null;
  const header = <HeroHeader title={t('messages.newMessage')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/messages'))} />;

  return (
    <Screen header={header}>
      <SearchField value={input} onChangeText={setInput} placeholder={t('messages.searchPeople')} autoFocus />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!searching ? <AppText variant="label" accessibilityRole="header">{t('messages.followingTitle')}</AppText> : null}
        {list === null ? (
          <StateMessage kind="loading" />
        ) : list.length === 0 ? (
          <StateMessage kind="empty" message={searching ? t('search.noResults', { q: query }) : t('messages.noFollowing')} />
        ) : (
          list.map((p) => (
            <Pressable
              key={p.uid}
              accessibilityRole="button"
              accessibilityLabel={t('messages.writeTo', { name: p.displayName })}
              onPress={() => router.replace({ pathname: '/messages/[uid]', params: { uid: p.uid } })}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
              <View style={[styles.ring, { borderColor: c.accent }]}>
                <View style={[styles.avatar, { backgroundColor: c.surfaceStrong }]}>
                  <AppText style={[styles.initial, { color: c.accent }]}>{(p.displayName || '?').slice(0, 1).toLocaleUpperCase()}</AppText>
                </View>
              </View>
              <View style={styles.grow}>
                <AppText numberOfLines={1} style={[styles.name, { color: c.textStrong }]}>{p.displayName}</AppText>
                {p.bio && !p.isPrivate ? <AppText numberOfLines={1} variant="caption" muted>{p.bio}</AppText> : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xs, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH + 8 },
  ring: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heading, fontSize: 16 },
  grow: { flex: 1 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15 },
});
