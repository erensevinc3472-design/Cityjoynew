import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AdoptionSpecies } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { FilterChip, ListRow, ListSurface, RowIcon, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useAdoptions } from '@/lib/adoptions';
import { locationRepository as repo } from '@/lib/locations';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Filter = 'hepsi' | AdoptionSpecies | 'acil';
const FILTERS: Filter[] = ['hepsi', 'kedi', 'kopek', 'diger', 'acil'];

/** Yuva arayanların tamamı (Gönüllülük > "Tümünü gör"): türe ve acile göre süzülür. */
export default function AnimalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { location } = useUserLocation();
  const pc = location?.provinceCode;
  const { list: animals, failed } = useAdoptions(pc);
  const [filter, setFilter] = useState<Filter>('hepsi');
  const shown = (animals ?? []).filter((a) => filter === 'hepsi' || (filter === 'acil' ? a.urgent : a.species === filter));
  const district = (id?: string) => (id ? repo.getDistrict(id)?.name : undefined);

  return (
    <Screen header={<HeroHeader title={t('volunteer.animals')} subtitle={pc ? repo.getProvince(pc)?.name : undefined} onBack={() => (router.canGoBack() ? router.back() : router.replace('/volunteer'))} />}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => <FilterChip key={f} label={t(`volunteer.filter.${f}`)} active={filter === f} onPress={() => setFilter(f)} />)}
        </ScrollView>
        {failed ? <StateMessage kind="error" message={t('volunteer.loadError')} /> : animals === null ? <StateMessage kind="loading" /> : shown.length ? (
          <ListSurface>
            {shown.map((a, i) => (
              <ListRow
                key={a.id}
                first={i === 0}
                leading={<RowIcon icon="pets" tint={a.urgent ? c.danger : c.primary} />}
                title={a.name}
                subtitle={[t(`volunteer.species.${a.species}`), a.age, t(`volunteer.sex.${a.sex}`), district(a.region.districtId)].filter(Boolean).join(' · ')}
                trailing={a.urgent ? <Tag label={t('volunteer.urgent')} tone="red" /> : undefined}
                onPress={() => router.push({ pathname: '/volunteer/animal/[id]', params: { id: a.id } })}
              />
            ))}
          </ListSurface>
        ) : <AppText muted>{t('volunteer.noAnimals')}</AppText>}
        <View style={[styles.note, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="caption" muted>{t('volunteer.note')}</AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  filters: { gap: spacing.xs, paddingVertical: 2 },
  note: { padding: spacing.md, borderRadius: 12, borderWidth: 1 },
});
