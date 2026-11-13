import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { isPostListed, POST_CATEGORIES, type Post } from '@cityjoy/shared';
import { SAVE_FOLDER_LIMITS, type SavedEntry } from '@cityjoy/shared/firebase';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FeedTabs } from '@/components/feed-tabs';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { FilterChip, FilterRow } from '@/components/inner';
import { PostGrid } from '@/components/post-grid';
import { SaveFolderModal } from '@/components/save-folder-modal';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { clearRecent, RECENT_POSTS_MAX, useRecentPosts } from '@/lib/recent-posts';
import { useSaveFolders } from '@/lib/save-folders';
import { postRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { GUTTER, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Tab = 'kayitli' | 'son';

/**
 * Kaydettiklerim (Eren, 13 Kasım 2026): üçlü küçük ızgara; iki sekme:
 * - Kaydettiklerim: üstte klasörler (Tümü + kişinin klasörleri + Yeni klasör), altında kayıtlarda olan konular.
 *   Gönderiye uzun basınca klasöre taşınır. Seçili klasörün yanındaki kalem: adı değiştir / sil.
 * - Son gördüklerin: baktığı son 10 gönderi (yalnız telefonda), "Sıfırla" ile silinir.
 */
export default function SavedPostsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>('kayitli');
  const [list, setList] = useState<SavedEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [moving, setMoving] = useState<SavedEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const { folders, full, create, rename, remove } = useSaveFolders(user?.uid);
  const recent = useRecentPosts(user?.uid);

  const load = useCallback(() => {
    if (!user) return;
    setFailed(false);
    postRepository.listSavedEntries(user.uid).then((l) => setList(l.filter((e) => isPostListed(e.post))), () => setFailed(true));
  }, [user]);
  // Ayrıntıda "kaydetmeyi geri al" ya da klasör değişince dönüşte liste güncel olsun.
  useFocusEffect(load);

  const header = <HeroHeader title={t('explore.saved')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />;

  if (!user) {
    return (
      <Screen header={header}>
        <FormMessage kind="info" text={t('explore.signIn')} />
      </Screen>
    );
  }

  // Silinmiş klasörde kalan seçim "Tümü"ye döner.
  const activeFolder = folder && folders?.some((f) => f.id === folder) ? folder : null;
  const inFolder = list ? (activeFolder ? list.filter((e) => e.folder === activeFolder) : list) : null;
  const present = POST_CATEGORIES.filter((k) => inFolder?.some((e) => e.post.category === k));
  const shown: Post[] | null = inFolder ? inFolder.filter((e) => !category || e.post.category === category).map((e) => e.post) : null;
  const folderName = folders?.find((f) => f.id === activeFolder)?.name ?? '';

  const resetRecent = () =>
    Alert.alert(t('explore.recent.resetConfirm'), undefined, [
      { text: t('explore.folders.cancel'), style: 'cancel' },
      { text: t('explore.recent.reset'), style: 'destructive', onPress: () => clearRecent(user.uid) },
    ]);

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={tab === 'kayitli' ? <RefreshControl refreshing={false} onRefresh={load} /> : undefined} showsVerticalScrollIndicator={false}>
        <FeedTabs<Tab>
          label={t('explore.saved')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'kayitli', label: t('explore.saved') },
            { value: 'son', label: t('explore.recent.tab') },
          ]}
        />
        {tab === 'son' ? (
          <>
            <View style={styles.recentHead}>
              <AppText variant="caption" muted style={styles.flex}>{t('explore.recent.info', { count: RECENT_POSTS_MAX })}</AppText>
              {recent?.length ? (
                <Pressable accessibilityRole="button" onPress={resetRecent} hitSlop={8} style={({ pressed }) => [styles.reset, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
                  <MaterialIcons name="restart-alt" size={16} color={c.textStrong} />
                  <AppText style={[styles.resetText, { color: c.textStrong }]}>{t('explore.recent.reset')}</AppText>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.bleed}>
              <PostGrid list={recent} empty={t('explore.recent.empty')} />
            </View>
          </>
        ) : failed ? (
          <StateMessage kind="error" message={t('explore.loadError')} onRetry={load} />
        ) : list?.length === 0 && !folders?.length ? (
          <StateMessage kind="empty" message={t('explore.savedEmpty')} />
        ) : (
          <>
            {/* Klasörler */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderRow}>
              <FilterChip icon="bookmarks" label={t('explore.folders.all')} active={!activeFolder} onPress={() => setFolder(null)} />
              {(folders ?? []).map((f) => (
                <FilterChip key={f.id} icon="folder" label={f.name} active={activeFolder === f.id} onPress={() => setFolder(f.id)} />
              ))}
              {!full ? <FilterChip icon="create-new-folder" label={t('explore.folders.add')} active={false} onPress={() => setAdding(true)} /> : null}
            </ScrollView>
            {activeFolder ? (
              <View style={styles.folderHead}>
                <AppText variant="label" numberOfLines={1} style={styles.flex}>{folderName}</AppText>
                <Pressable accessibilityRole="button" accessibilityLabel={t('explore.folders.edit')} onPress={() => setEditing(true)} hitSlop={8} style={({ pressed }) => [styles.reset, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
                  <MaterialIcons name="edit" size={16} color={c.textStrong} />
                  <AppText style={[styles.resetText, { color: c.textStrong }]}>{t('explore.folders.edit')}</AppText>
                </Pressable>
              </View>
            ) : null}
            <FilterRow kinds={present.map((k) => ({ id: k, name: t(`explore.categories.${k}`) }))} kind={category} onKind={setCategory} />
            {list?.length ? <AppText variant="caption" muted>{t('explore.folders.hint')}</AppText> : null}
            <View style={styles.bleed}>
              <PostGrid
                list={shown}
                empty={activeFolder ? t('explore.folders.empty') : t('explore.savedEmpty')}
                longPressHint={t('explore.folders.title')}
                onLongPress={(p) => setMoving(list?.find((e) => e.post.id === p.id) ?? null)}
              />
            </View>
          </>
        )}
      </ScrollView>

      {moving ? (
        <SaveFolderModal
          uid={user.uid}
          visible
          current={moving.folder ?? null}
          onPick={async (f) => {
            await postRepository.setSavedFolder(user.uid, moving.post.id, f);
            setList((l) => l?.map((e) => (e.post.id === moving.post.id ? { post: e.post, ...(f ? { folder: f } : {}) } : e)) ?? l);
          }}
          onClose={() => setMoving(null)}
        />
      ) : null}
      <FolderNameModal
        visible={adding}
        title={t('explore.folders.add')}
        initial=""
        submit={t('explore.folders.create')}
        onSubmit={async (name) => {
          const f = await create(name);
          setFolder(f.id);
        }}
        onClose={() => setAdding(false)}
      />
      <FolderNameModal
        visible={editing && !!activeFolder}
        title={t('explore.folders.edit')}
        initial={folderName}
        submit={t('explore.folders.save')}
        onSubmit={(name) => rename(activeFolder!, name)}
        onDelete={() =>
          new Promise<void>((resolve, reject) =>
            Alert.alert(t('explore.folders.deleteConfirm'), undefined, [
              { text: t('explore.folders.cancel'), style: 'cancel', onPress: () => reject(new Error('cancel')) },
              {
                text: t('explore.folders.delete'),
                style: 'destructive',
                onPress: () =>
                  remove(activeFolder!).then(() => {
                    setList((l) => l?.map((e) => (e.folder === activeFolder ? { post: e.post } : e)) ?? l);
                    setFolder(null);
                    resolve();
                  }, reject),
              },
            ]),
          )
        }
        onClose={() => setEditing(false)}
      />
    </Screen>
  );
}

/** Klasör adı yazma (yeni klasör / adı değiştir + sil). */
function FolderNameModal({ visible, title, initial, submit, onSubmit, onDelete, onClose }: { visible: boolean; title: string; initial: string; submit: string; onSubmit(name: string): Promise<void>; onDelete?(): Promise<void>; onClose(): void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      onClose();
    } catch (e) {
      if ((e as Error)?.message !== 'cancel') setError(t('explore.folders.error'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => setName(initial)}>
      <Screen header={<HeroHeader title={title} onBack={onClose} />}>
        <ScrollView contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <TextField label={t('explore.folders.name')} value={name} onChangeText={setName} maxLength={SAVE_FOLDER_LIMITS.name} autoFocus returnKeyType="done" onSubmitEditing={() => name.trim() && run(() => onSubmit(name))} />
          {error ? <FormMessage kind="error" text={error} /> : null}
          <AppButton title={submit} onPress={() => run(() => onSubmit(name))} disabled={!name.trim() || busy} loading={busy} />
          {onDelete ? <AppButton variant="ghost" title={t('explore.folders.delete')} onPress={() => run(onDelete)} disabled={busy} /> : null}
        </ScrollView>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  // Izgara kenardan kenara (profildeki gibi).
  bleed: { marginHorizontal: -GUTTER },
  flex: { flex: 1 },
  folderRow: { gap: spacing.sm, paddingEnd: spacing.md },
  folderHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth },
  resetText: { fontSize: 13, lineHeight: 18 },
  modal: { gap: spacing.md, paddingBottom: spacing.xl },
});
