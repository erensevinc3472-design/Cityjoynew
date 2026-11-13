import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { POST_LIMITS, SEARCH_LIMITS, type PublicProfile } from '@cityjoy/shared';

import { AvatarPhoto } from '@/components/avatar-photo';
import { AppText } from '@/components/app-text';
import { SearchField } from '@/components/search-field';
import { StateMessage } from '@/components/state-message';
import { searchPeople } from '@/lib/search';
import { useSession } from '@/lib/session';
import { useSocial } from '@/lib/social';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

export interface TaggedPerson {
  uid: string;
  displayName: string;
}

/**
 * Paylaşım formunda "Kişileri etiketle" (Eren, 13 Kasım 2026): seçilenler çip olarak durur, çarpıyla çıkarılır. Sunucu
 * her kişinin "Beni kim etiketleyebilir" ayarını denetler; izin vermeyen kişi sessizce eklenmez.
 */
export function TagPeople({ value, onChange, disabled }: { value: TaggedPerson[]; onChange(v: TaggedPerson[]): void; disabled?: boolean }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { user } = useSession();
  const { blocked } = useSocial();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<PublicProfile[] | null>(null);
  const full = value.length >= POST_LIMITS.tags;

  useEffect(() => {
    const h = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(h);
  }, [input]);
  useEffect(() => {
    if (query.length < SEARCH_LIMITS.minName) return setFound(null);
    let alive = true;
    setFound(null);
    searchPeople(query).then((l) => alive && setFound(l), () => alive && setFound([]));
    return () => {
      alive = false;
    };
  }, [query]);

  const chosen = new Set(value.map((x) => x.uid));
  const list = found?.filter((p) => p.uid !== user?.uid && !blocked.has(p.uid) && !chosen.has(p.uid)) ?? null;
  const pick = (p: PublicProfile) => {
    if (full) return;
    onChange([...value, { uid: p.uid, displayName: p.displayName }]);
    setInput('');
  };

  return (
    <View style={styles.block}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen((x) => !x)}
        style={({ pressed }) => [styles.head, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}>
        <MaterialIcons name="person-add-alt" size={20} color={c.accent} />
        <AppText style={[styles.grow, styles.title, { color: c.textStrong }]}>{t('explore.people.add')}</AppText>
        {value.length ? <AppText style={[styles.count, { color: c.accent }]}>{value.length}</AppText> : null}
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={c.textMuted} />
      </Pressable>
      {value.length ? (
        <View style={styles.chips}>
          {value.map((p) => (
            <Pressable
              key={p.uid}
              accessibilityRole="button"
              accessibilityLabel={t('explore.people.remove', { name: p.displayName })}
              disabled={disabled}
              onPress={() => onChange(value.filter((x) => x.uid !== p.uid))}
              hitSlop={4}
              style={({ pressed }) => [styles.chip, { backgroundColor: c.accentSoft, borderColor: c.accentBorder, opacity: pressed ? 0.7 : 1 }]}>
              <AppText style={[styles.chipText, { color: c.accent }]} numberOfLines={1}>{p.displayName}</AppText>
              <MaterialIcons name="close" size={15} color={c.accent} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {open ? (
        <View style={styles.block}>
          <AppText variant="caption" muted>{full ? t('explore.people.limit', { n: POST_LIMITS.tags }) : t('explore.people.hint')}</AppText>
          {full ? null : (
            <>
              <SearchField value={input} onChangeText={setInput} placeholder={t('editor.stickers.mentionPlaceholder')} />
              {query.length < SEARCH_LIMITS.minName ? null : list === null ? (
                <StateMessage kind="loading" />
              ) : list.length === 0 ? (
                <AppText variant="caption" muted>{t('search.noResults', { q: query })}</AppText>
              ) : (
                list.slice(0, 8).map((p) => (
                  <Pressable key={p.uid} accessibilityRole="button" onPress={() => pick(p)} style={({ pressed }) => [styles.person, { opacity: pressed ? 0.7 : 1 }]}>
                    <View style={[styles.face, { backgroundColor: c.surfaceStrong }]}>
                      <AppText style={[styles.initial, { color: c.accent }]}>{(p.displayName || '?').slice(0, 1).toLocaleUpperCase()}</AppText>
                      <AvatarPhoto photo={p.photo} size={34} />
                    </View>
                    <AppText numberOfLines={1} style={styles.grow}>{p.displayName}</AppText>
                    <MaterialIcons name="add-circle-outline" size={22} color={c.accent} />
                  </Pressable>
                ))
              )}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  grow: { flex: 1 },
  title: { fontFamily: fonts.bodySemi, fontSize: 15 },
  count: { fontFamily: fonts.bodySemi, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, maxWidth: 220, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, flexShrink: 1 },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  face: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontFamily: fonts.bodySemi, fontSize: 14 },
});
