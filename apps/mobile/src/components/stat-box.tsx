import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useThemeColors } from '@/theme/use-theme';
import { fonts, radius } from '@/theme/tokens';

export interface StatItem {
  n: string;
  label: string;
  /** Verilirse hücre düğme olur (ör. Takipçi listesini açar). */
  onPress?: () => void;
  /** Ekran okuyucuya ne olacağını söyler. */
  hint?: string;
}

/**
 * Profil ve işletme sayfasındaki sayılar (Eren, 14 Kasım 2026): tek, yumuşak köşeli kutu; hücreler arasında ince
 * çizgi, böylece her sayının ayrı bir düğme olduğu anlaşılır. Dokunulabilen hücre basınca hafifçe solar.
 */
export function StatBox({ items }: { items: StatItem[] }) {
  const c = useThemeColors();
  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
      {items.map((x, i) => {
        const body = (
          <>
            <AppText style={[styles.n, { color: c.textStrong }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {x.n}
            </AppText>
            <AppText style={[styles.label, { color: c.textMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {x.label}
            </AppText>
          </>
        );
        return (
          <Fragment key={x.label}>
            {i > 0 ? <View style={[styles.line, { backgroundColor: c.border }]} /> : null}
            {x.onPress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${x.n} ${x.label}`}
                accessibilityHint={x.hint}
                onPress={x.onPress}
                style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.6 : 1 }]}>
                {body}
              </Pressable>
            ) : (
              <View style={styles.cell} accessible accessibilityLabel={`${x.n} ${x.label}`}>
                {body}
              </View>
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  cell: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  line: { width: StyleSheet.hairlineWidth * 2, marginVertical: 10 },
  n: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 23 },
  label: { fontSize: 12, lineHeight: 16 },
});
