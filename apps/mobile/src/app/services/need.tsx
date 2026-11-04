import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { findCategory, localized, NEED_SITUATIONS, type NeedSituation } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { ListRow, ListSurface, RowIcon } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useNeedMap } from '@/lib/needs';
import { useServiceCategories } from '@/lib/service-categories';
import { useSettings } from '@/lib/settings';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Diğer İhtiyaçlar > bir durum (13. madde 35): "Yeni taşındım" gibi bir kartın açtığı hizmetler. Her satır o hizmetin
 * işletme listesine (Çekici sayfası kalıbı) gider. Hangi hizmetlerin görüneceğini admin panelden belirler.
 */
export default function NeedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language, rtl } = useSettings();
  const lang = language ?? 'tr';
  const { id } = useLocalSearchParams<{ id: NeedSituation }>();
  const need: NeedSituation = NEED_SITUATIONS.includes(id) ? id : 'yeni-tasindim';
  const { all } = useServiceCategories();
  const map = useNeedMap(all);
  const list = map[need].map((x) => findCategory(all, x)).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <Screen header={<HeroHeader title={t(`needs.items.${need}.title`)} subtitle={t('needs.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/urgent'))} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText style={{ color: c.text }}>{t(`needs.items.${need}.intro`)}</AppText>
        {list.length ? (
          <ListSurface>
            {list.map((x, n) => (
              <ListRow
                key={x.id}
                first={n === 0}
                leading={<RowIcon icon={(x.icon in MaterialIcons.glyphMap ? x.icon : 'handyman') as IconName} tint={c.primary} />}
                title={localized(x.names, lang) ?? x.names.tr}
                trailing={<MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={20} color={c.textSoft} />}
                onPress={() => router.push({ pathname: '/services/[id]', params: { id: x.id } })}
              />
            ))}
          </ListSurface>
        ) : (
          <StateMessage kind="empty" message={t('needs.empty')} />
        )}
        <AppText variant="caption" muted>{t('needs.note')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
});
