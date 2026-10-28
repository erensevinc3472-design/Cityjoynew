import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BUSINESS_MANAGER_LIMIT,
  DEFAULT_MANAGER_PERMISSIONS,
  MANAGER_POST_MODES,
  SEARCH_LIMITS,
  type Business,
  type BusinessManager,
  type PublicProfile,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { SearchField } from '@/components/search-field';
import { searchPeople } from '@/lib/search';
import { businessRepository } from '@/lib/services';
import { useSocial } from '@/lib/social';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * İşletmem > Yetkililer (Eren, 28 Ekim 2026): sahibi en çok 3 kişiyi adıyla bulup atar ve izinlerini seçer.
 * Paylaşım: kapalı / benim onayımla (varsayılan) / doğrudan; bilgileri düzenleme; yorumlara cevap. Telefon yalnızca
 * sahibine bağlıdır. Kurallar aynı sınırları sunucuda denetler.
 */
export function BusinessManagers({ business, onSaved }: { business: Business; onSaved(managers: BusinessManager[]): void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { blocked } = useSocial();
  const [list, setList] = useState<BusinessManager[]>(business.managers);
  const [input, setInput] = useState('');
  const [found, setFound] = useState<PublicProfile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string }>();
  const full = list.length >= BUSINESS_MANAGER_LIMIT;
  const changed = JSON.stringify(list) !== JSON.stringify(business.managers);

  useEffect(() => {
    const q = input.trim();
    if (q.length < SEARCH_LIMITS.minName) return setFound(null);
    let alive = true;
    const h = setTimeout(() => {
      searchPeople(q).then((l) => alive && setFound(l), () => alive && setFound([]));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [input]);

  const add = (p: PublicProfile) => {
    if (full || list.some((m) => m.uid === p.uid)) return;
    setList([...list, { uid: p.uid, name: p.displayName, ...DEFAULT_MANAGER_PERMISSIONS }]);
    setInput('');
    setFound(null);
  };
  const patch = (uid: string, change: Partial<BusinessManager>) => setList(list.map((m) => (m.uid === uid ? { ...m, ...change } : m)));
  const save = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      await businessRepository.setManagers(business.id, list);
      onSaved(list);
      setMessage({ kind: 'info', text: t('business.managers.saved') });
    } catch {
      setMessage({ kind: 'error', text: t('business.saveError') });
    } finally {
      setBusy(false);
    }
  };

  const candidates = (found ?? []).filter((p) => p.uid !== business.ownerUid && !blocked.has(p.uid) && !list.some((m) => m.uid === p.uid));

  return (
    <View style={styles.wrap}>
      <AppText variant="label" accessibilityRole="header">{t('business.managers.title')}</AppText>
      <AppText variant="caption" muted>{t('business.managers.intro', { max: BUSINESS_MANAGER_LIMIT })}</AppText>

      {list.map((m) => (
        <View key={m.uid} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
              <AppText style={[styles.initial, { color: c.accent }]}>{m.name.slice(0, 1).toLocaleUpperCase()}</AppText>
            </View>
            <AppText style={[styles.grow, styles.name, { color: c.textStrong }]} numberOfLines={1}>{m.name}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={t('business.managers.remove', { name: m.name })} onPress={() => setList(list.filter((x) => x.uid !== m.uid))} hitSlop={8} style={styles.icon}>
              <MaterialIcons name="person-remove" size={22} color={c.danger} />
            </Pressable>
          </View>
          <AppText variant="caption" muted>{t('business.managers.postLabel')}</AppText>
          <Chips label={t('business.managers.postLabel')} value={m.post} onChange={(post) => patch(m.uid, { post })} options={MANAGER_POST_MODES.map((x) => ({ value: x, label: t(`business.managers.post.${x}`) }))} />
          <PermissionRow label={t('business.managers.edit')} value={m.edit} onChange={(edit) => patch(m.uid, { edit })} />
          <PermissionRow label={t('business.managers.reply')} value={m.reply} onChange={(reply) => patch(m.uid, { reply })} />
        </View>
      ))}

      {full ? (
        <AppText variant="caption" muted>{t('business.managers.full', { max: BUSINESS_MANAGER_LIMIT })}</AppText>
      ) : (
        <>
          <SearchField value={input} onChangeText={setInput} placeholder={t('business.managers.search')} />
          {candidates.map((p) => (
            <Pressable key={p.uid} accessibilityRole="button" accessibilityLabel={t('business.managers.add', { name: p.displayName })} onPress={() => add(p)} style={({ pressed }) => [styles.result, { borderColor: c.border, opacity: pressed ? 0.75 : 1 }]}>
              <AppText style={styles.grow} numberOfLines={1}>{p.displayName}</AppText>
              <MaterialIcons name="person-add-alt" size={20} color={c.accent} />
            </Pressable>
          ))}
          {found && !candidates.length ? <AppText variant="caption" muted>{t('search.noResults', { q: input.trim() })}</AppText> : null}
        </>
      )}

      {message ? <FormMessage kind={message.kind} text={message.text} /> : null}
      {changed ? <AppButton title={t('business.managers.save')} loading={busy} disabled={busy} onPress={save} /> : null}
    </View>
  );
}

function PermissionRow({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  const c = useThemeColors();
  return (
    <View style={styles.perm}>
      <AppText style={styles.grow}>{label}</AppText>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: c.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heading, fontSize: 15 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15 },
  grow: { flex: 1 },
  icon: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  perm: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1 },
});
