import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Adoption, CityEvent, VolunteerType } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { FilterChip, RowIcon, SectionTitle, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useAdoptions } from '@/lib/adoptions';
import { useEvents } from '@/lib/events';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Filter = 'hepsi' | VolunteerType;
const FILTERS: Filter[] = ['hepsi', 'hayvan', 'cevre', 'sosyal', 'afet', 'egitim'];
type IconName = keyof typeof MaterialIcons.glyphMap;
const TYPE_ICON: Record<VolunteerType, IconName> = { cevre: 'park', sosyal: 'groups', afet: 'health-and-safety', hayvan: 'pets', egitim: 'school' };

/**
 * Gönüllülük (önizleme S-Gonullu; Karar Eren 5 Kasım 2026): üstte tür düğmeleri (Tümü, Hayvan, Çevre, Sosyal, Afet,
 * Eğitim), "Yuva arayanlar" yan yana kartlar (Tümünü gör), "Gönüllü aranıyor" kartları (tür etiketi, doluluk çubuğu,
 * Katılıyorum). İlanı yalnızca belediye / kurum verir (Etkinlikler'de "Gönüllülük" türü); sahiplendirmeyi barınak ve
 * dernekler. Kullanıcı ilan vermez, uydurma sayı yok.
 */
export default function VolunteerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const { location } = useUserLocation();
  const pc = location?.provinceCode;
  const { list: events, failed: eventsFailed } = useEvents(pc);
  const { list: animals, failed: animalsFailed } = useAdoptions(pc);
  const [filter, setFilter] = useState<Filter>('hepsi');

  const jobs = (events ?? []).filter((e) => e.category === 'gonulluluk' && (filter === 'hepsi' || e.volunteerType === filter));
  const showAnimals = filter === 'hepsi' || filter === 'hayvan';
  const tint = (v?: VolunteerType) => (v === 'cevre' ? c.success : v === 'afet' ? c.danger : v === 'egitim' ? c.info : c.primary);
  const when = (e: CityEvent) => {
    const s = new Date(e.startsAt);
    const hours = Math.round((new Date(e.endsAt).getTime() - s.getTime()) / 3600000);
    const day = s.toLocaleString(language ?? 'tr', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    return hours > 0 && hours < 24 ? `${day} · ${t('volunteer.hours', { count: hours })}` : day;
  };

  return (
    <Screen header={<HeroHeader inline title={t('volunteer.title')} subtitle={pc ? repo.getProvince(pc)?.name : undefined} onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))} />}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => <FilterChip key={f} label={t(`volunteer.type.${f}`)} active={filter === f} onPress={() => setFilter(f)} />)}
        </ScrollView>

        {showAnimals ? (
          <>
            <SectionTitle title={t('volunteer.animals')} aside={animals?.length ? t('volunteer.seeAll') : undefined} onAside={animals?.length ? () => router.push('/volunteer/animals') : undefined} />
            {animalsFailed ? <StateMessage kind="error" message={t('volunteer.loadError')} /> : animals === null ? <StateMessage kind="loading" /> : animals.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.animals}>
                {animals.slice(0, 8).map((a) => <AnimalCard key={a.id} a={a} onPress={() => router.push({ pathname: '/volunteer/animal/[id]', params: { id: a.id } })} />)}
              </ScrollView>
            ) : <AppText muted>{t('volunteer.noAnimals')}</AppText>}
          </>
        ) : null}

        <SectionTitle title={t('volunteer.jobs')} aside={jobs.length ? t('volunteer.jobCount', { count: jobs.length }) : undefined} />
        {eventsFailed ? <StateMessage kind="error" message={t('volunteer.loadError')} /> : events === null ? <StateMessage kind="loading" /> : jobs.length ? (
          jobs.map((e) => {
            const full = e.capacity !== undefined && e.attendeeCount >= e.capacity;
            const cancelled = e.status === 'iptal';
            return (
              <View key={e.id} style={[styles.job, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })} style={styles.jobHead}>
                  <RowIcon icon={e.volunteerType ? TYPE_ICON[e.volunteerType] : 'volunteer-activism'} tint={tint(e.volunteerType)} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText style={[styles.jobTitle, { color: c.textStrong }]} numberOfLines={2}>{e.title}</AppText>
                    <AppText variant="caption" muted numberOfLines={2}>{[when(e), e.venueName].filter(Boolean).join(' · ')}</AppText>
                  </View>
                  {cancelled ? <Tag label={t('volunteer.cancelled')} tone="red" /> : e.volunteerType ? <Tag label={t(`volunteer.type.${e.volunteerType}`)} tone={e.volunteerType === 'cevre' ? 'green' : 'gold'} /> : null}
                </Pressable>
                {e.capacity ? (
                  <View style={styles.bar}>
                    <View style={[styles.track, { backgroundColor: c.border }]}>
                      <View style={{ width: `${Math.min(100, Math.round((e.attendeeCount / e.capacity) * 100))}%`, height: '100%', backgroundColor: c.success }} />
                    </View>
                    <AppText variant="caption" muted>{t('volunteer.seats', { count: e.attendeeCount, capacity: e.capacity })}</AppText>
                  </View>
                ) : null}
                {cancelled ? null : (
                  <AppButton title={full ? t('volunteer.full') : t('volunteer.join')} variant={full ? 'secondary' : undefined} onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })} />
                )}
              </View>
            );
          })
        ) : <AppText muted>{t('volunteer.noJobs')}</AppText>}

        <View style={[styles.note, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="caption" muted>{t('volunteer.byOrgs')}</AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Yuva arayan kartı: ilanlarda fotoğraf henüz yok, türe göre renkli alan ve simge (uydurma görsel yok). */
function AnimalCard({ a, onPress }: { a: Adoption; onPress(): void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const area = a.species === 'kedi' ? '#C9A27A' : a.species === 'kopek' ? '#8FB3A0' : '#B6A6CF';
  const district = a.region.districtId ? repo.getDistrict(a.region.districtId)?.name : undefined;
  const meta = [a.age, t(`volunteer.sex.${a.sex}`)].join(' · ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[a.name, meta, district, a.urgent ? t('volunteer.urgent') : null].filter(Boolean).join(', ')} onPress={onPress}
      style={({ pressed }) => [styles.animal, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.animalArt, { backgroundColor: `${area}40` }]}>
        <MaterialIcons name="pets" size={44} color={area} />
        {a.urgent ? <View style={styles.urgent}><Tag label={t('volunteer.urgent')} tone="red" /></View> : null}
      </View>
      <View style={styles.animalText}>
        <AppText style={[styles.animalName, { color: c.textStrong }]} numberOfLines={1}>{a.name}</AppText>
        <AppText variant="caption" muted numberOfLines={1}>{meta}</AppText>
        {district ? <AppText variant="caption" muted numberOfLines={1}>{district}</AppText> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  chips: { gap: spacing.xs, paddingVertical: 2 },
  animals: { gap: spacing.md },
  animal: { width: 150, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  animalArt: { height: 120, alignItems: 'center', justifyContent: 'center' },
  urgent: { position: 'absolute', top: 8, start: 8 },
  animalText: { padding: 10, gap: 3 },
  animalName: { fontFamily: fonts.heading, fontSize: 15 },
  job: { gap: 10, padding: 14, borderRadius: radius.xl, borderWidth: 1 },
  jobHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  jobTitle: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 9, overflow: 'hidden' },
  note: { padding: spacing.md, borderRadius: 12, borderWidth: 1 },
});
