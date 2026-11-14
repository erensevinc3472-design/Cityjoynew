import { useState } from 'react';
import { Modal, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SAVE_FOLDER_LIMITS } from '@cityjoy/shared/firebase';

import { useSaveFolders } from '@/lib/save-folders';
import { spacing } from '@/theme/tokens';
import { AppButton } from './app-button';
import { AppText } from './app-text';
import { FormMessage } from './form-message';
import { HeroHeader } from './hero-header';
import { OptionRow } from './option-row';
import { Screen } from './screen';
import { TextField } from './text-field';

/**
 * Kaydedilen gönderiyi klasöre koyma (Kaydettiklerim klasörleri): "Klasörsüz" ya da bir klasör seçilir; aynı yerden
 * yeni klasör açılır ve gönderi hemen oraya konur. Tam ekran seçim listesiyle aynı düzen.
 */
export function SaveFolderModal({ uid, visible, current, onPick, onClose }: { uid: string; visible: boolean; current: string | null; onPick(folder: string | null): Promise<void> | void; onClose(): void }) {
  const { t } = useTranslation();
  const { folders, full, create } = useSaveFolders(uid);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pick = async (folder: string | null) => {
    setBusy(true);
    setError(undefined);
    try {
      await onPick(folder);
      onClose();
    } catch {
      setError(t('explore.folders.error'));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const f = await create(name);
      setName('');
      await onPick(f.id);
      onClose();
    } catch {
      setError(t('explore.folders.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen header={<HeroHeader title={t('explore.folders.title')} onBack={onClose} />}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <OptionRow title={t('explore.folders.none')} selected={current === null} onPress={() => !busy && pick(null)} />
          {(folders ?? []).map((f) => (
            <OptionRow key={f.id} title={f.name} selected={current === f.id} onPress={() => !busy && pick(f.id)} />
          ))}
          {error ? <FormMessage kind="error" text={error} /> : null}
          {full ? (
            <AppText variant="caption" muted>{t('explore.folders.limit', { count: SAVE_FOLDER_LIMITS.count })}</AppText>
          ) : (
            <>
              <TextField label={t('explore.folders.newName')} value={name} onChangeText={setName} maxLength={SAVE_FOLDER_LIMITS.name} returnKeyType="done" onSubmitEditing={add} />
              <AppButton variant="secondary" title={t('explore.folders.create')} onPress={add} disabled={!name.trim() || busy} loading={busy} />
            </>
          )}
        </ScrollView>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
});
