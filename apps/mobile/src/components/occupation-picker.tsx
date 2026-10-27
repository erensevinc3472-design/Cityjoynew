import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { filterByName, occupationName, type LanguageCode, type Occupation } from '@cityjoy/shared';

import { occupationRepository } from '@/lib/services';
import { spacing } from '@/theme/tokens';
import { HeroHeader } from './hero-header';
import { OptionRow } from './option-row';
import { Screen } from './screen';
import { SearchField } from './search-field';
import { StateMessage } from './state-message';

/** Admin'in yönettiği meslek listesinden seçim (PROJE.md 3.1 madde 8). */
export function useOccupations(language: LanguageCode) {
  const [list, setList] = useState<Occupation[] | null>(null);
  useEffect(() => {
    occupationRepository.listActive().then(setList);
  }, []);
  return useMemo(() => list?.map((o) => ({ id: o.id, name: occupationName(o, language) })) ?? null, [list, language]);
}

interface Props {
  visible: boolean;
  options: { id: string; name: string }[] | null;
  selectedId?: string;
  onSelect(id: string): void;
  onClose(): void;
}

export function OccupationPicker({ visible, options, selectedId, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const rows = options ? filterByName(options, query) : null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen header={<HeroHeader title={t('profile.selectOccupation')} onBack={onClose} />}>
        <SearchField value={query} onChangeText={setQuery} placeholder={t('profile.searchOccupation')} />
        <FlatList
          data={rows ?? []}
          keyExtractor={(o) => o.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <OptionRow
              title={item.name}
              selected={item.id === selectedId}
              onPress={() => {
                onSelect(item.id);
                setQuery('');
                onClose();
              }}
            />
          )}
          ListEmptyComponent={rows === null ? <StateMessage kind="loading" /> : <StateMessage kind="empty" />}
        />
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingVertical: spacing.sm },
});
