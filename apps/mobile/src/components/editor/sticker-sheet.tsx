import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MEDIA_EDIT_LIMITS, SEARCH_LIMITS, type PublicProfile, type StickerKind } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { STICKER_ICON } from '@/components/media-overlay';
import { searchPeople } from '@/lib/search';
import { useSession } from '@/lib/session';
import { useWeather } from '@/lib/weather';
import { fonts } from '@/theme/tokens';
import { ED, Sheet, SheetLabel, TextButton } from './ui';

export interface StickerPick {
  type: StickerKind;
  label: string;
  uid?: string;
}

/** Emojiler ve aramada eşleşen anahtar sözcükler (beş dilde kısa). */
const EMOJIS: readonly [string, string][] = [
  ['😍', 'aşk love liebe حب любовь kalp'],
  ['😂', 'gül laugh lachen ضحك смех komik'],
  ['🔥', 'ateş fire feuer نار огонь'],
  ['❤️', 'kalp heart herz قلب сердце'],
  ['👏', 'alkış clap applaus تصفيق аплодисменты'],
  ['🎉', 'kutlama party feier احتفال праздник'],
  ['🌙', 'ay gece moon night mond قمر луна'],
  ['☀️', 'güneş sun sonne شمس солнце'],
  ['🕌', 'cami mosque moschee مسجد мечеть'],
  ['⛰️', 'dağ mountain berg جبل гора'],
  ['☕', 'kahve çay coffee kaffee قهوة кофе'],
  ['🍽️', 'yemek food essen طعام еда'],
  ['⚽', 'futbol maç football fußball كرة футбол'],
  ['🎵', 'müzik music musik موسيقى музыка'],
  ['📍', 'konum yer place ort مكان место'],
  ['🌳', 'ağaç doğa tree baum شجرة дерево'],
  ['🚗', 'araba car auto سيارة машина'],
  ['🛍️', 'alışveriş shopping einkaufen تسوق покупки'],
  ['😎', 'havalı cool سعيد крутой'],
  ['🥰', 'sevgi love liebe حب любовь'],
  ['😊', 'mutlu happy glücklich سعيد счастье'],
  ['🙏', 'dua teşekkür thanks danke شكرا спасибо'],
  ['👍', 'tamam like gut جيد хорошо'],
  ['✨', 'parıltı sparkle glitzer بريق блеск'],
  ['🌊', 'deniz sea meer بحر море'],
  ['🏖️', 'plaj beach strand شاطئ пляж'],
  ['🌸', 'çiçek flower blume زهرة цветок'],
  ['🍂', 'sonbahar autumn herbst خريف осень'],
  ['❄️', 'kar snow schnee ثلج снег'],
  ['☔', 'yağmur rain regen مطر дождь'],
  ['🎂', 'doğum günü birthday geburtstag عيد день рождения'],
  ['📸', 'fotoğraf photo foto صورة фото'],
  ['🏛️', 'tarih müze history museum تاريخ музей'],
  ['🧿', 'nazar evil eye عين сглаз'],
  ['🇹🇷', 'türkiye turkey türkei تركيا турция bayrak'],
  ['💯', 'yüz tam hundred hundert مائة сто'],
];

const quick = (type: StickerKind, label: string) => ({ type, label });

/**
 * Çıkartmalar (taslak ekran 4): Konum (paylaşanın ilçesi), Bahset (@kişi, dokununca profili açılır), saat, hava (bizim
 * hava dosyamızdan; ek istek yok), tarih, #etiket ve emojiler. Arama hem bu düğmeleri hem emojileri süzer.
 */
export function StickerSheet({ place, provinceCode, onPick, onClose }: { place: string; provinceCode?: string; onPick(s: StickerPick): void; onClose(): void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { file } = useWeather(provinceCode);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'grid' | 'etiket' | 'bahset'>('grid');

  const now = new Date();
  const time = now.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' });
  const items = [
    place ? quick('konum', place) : null,
    { type: 'bahset' as const, label: t('editor.stickers.bahset') },
    quick('saat', time),
    file ? quick('hava', `${Math.round(file.now.temp)}°`) : null,
    quick('tarih', date),
    { type: 'etiket' as const, label: t('editor.stickers.etiket') },
  ].filter((x): x is { type: StickerKind; label: string } => !!x);

  const needle = q.trim().toLocaleLowerCase(i18n.language);
  const shownItems = needle ? items.filter((x) => `${x.label} ${t(`editor.stickers.${x.type}`)}`.toLocaleLowerCase(i18n.language).includes(needle)) : items;
  const shownEmojis = needle ? EMOJIS.filter(([e, k]) => k.includes(needle) || e === needle) : EMOJIS;

  const tapItem = (x: { type: StickerKind; label: string }) => {
    if (x.type === 'etiket' || x.type === 'bahset') return setMode(x.type);
    onPick(x);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop]}>
      <Pressable style={styles.flex} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('editor.close')} />
      <Sheet style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        {mode === 'etiket' ? (
          <TagInput onBack={() => setMode('grid')} onDone={(label) => onPick({ type: 'etiket', label })} />
        ) : mode === 'bahset' ? (
          <MentionSearch onBack={() => setMode('grid')} onPick={(p) => onPick({ type: 'bahset', label: `@${p.displayName}`.slice(0, MEDIA_EDIT_LIMITS.label), uid: p.uid })} />
        ) : (
          <>
            <View style={styles.search}>
              <MaterialIcons name="search" size={20} color={ED.muted} />
              <TextInput value={q} onChangeText={setQ} placeholder={t('editor.stickers.search')} placeholderTextColor={ED.muted} style={styles.searchInput} accessibilityLabel={t('editor.stickers.search')} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
              <View style={styles.grid}>
                {shownItems.map((x) => (
                  <Pressable key={x.type} accessibilityRole="button" accessibilityLabel={`${t(`editor.stickers.${x.type}`)}: ${x.label}`} onPress={() => tapItem(x)} style={({ pressed }) => [styles.quick, { opacity: pressed ? 0.7 : 1 }]}>
                    <MaterialIcons name={STICKER_ICON[x.type]!} size={18} color={ED.gold} />
                    <AppText numberOfLines={1} style={styles.quickText}>{x.label}</AppText>
                  </Pressable>
                ))}
              </View>
              <SheetLabel>{t('editor.stickers.emoji')}</SheetLabel>
              <View style={styles.emojis}>
                {shownEmojis.map(([e]) => (
                  <Pressable key={e} accessibilityRole="button" accessibilityLabel={e} onPress={() => onPick({ type: 'emoji', label: e })} style={({ pressed }) => [styles.emoji, { opacity: pressed ? 0.6 : 1 }]}>
                    <AppText style={styles.emojiText}>{e}</AppText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </>
        )}
      </Sheet>
    </View>
  );
}

/** #etiket: harf, rakam ve alt çizgi; boşluklar atılır. */
function TagInput({ onBack, onDone }: { onBack(): void; onDone(label: string): void }) {
  const { t } = useTranslation();
  const [v, setV] = useState('');
  const clean = v.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, MEDIA_EDIT_LIMITS.label - 1);
  return (
    <View style={styles.sub}>
      <View style={styles.subHead}>
        <TextButton title={t('editor.back')} onPress={onBack} />
        <TextButton title={t('editor.add')} onPress={() => clean && onDone(`#${clean}`)} />
      </View>
      <View style={styles.search}>
        <AppText style={styles.hash}>#</AppText>
        <TextInput value={clean} onChangeText={setV} autoFocus autoCapitalize="none" placeholder={t('editor.stickers.tagPlaceholder')} placeholderTextColor={ED.muted} style={styles.searchInput} onSubmitEditing={() => clean && onDone(`#${clean}`)} accessibilityLabel={t('editor.stickers.etiket')} />
      </View>
    </View>
  );
}

/** Bahset: adla kişi arama (Ara > Kişiler ile aynı); seçilen kişinin profili çıkartmaya dokununca açılır. */
function MentionSearch({ onBack, onPick }: { onBack(): void; onPick(p: PublicProfile): void }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const [v, setV] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<PublicProfile[] | null>(null);
  useEffect(() => {
    const h = setTimeout(() => setQuery(v.trim()), 350);
    return () => clearTimeout(h);
  }, [v]);
  useEffect(() => {
    if (query.length < SEARCH_LIMITS.minName) return setFound(null);
    let alive = true;
    setFound(null);
    searchPeople(query).then((l) => alive && setFound(l), () => alive && setFound([]));
    return () => {
      alive = false;
    };
  }, [query]);
  const list = found?.filter((p) => p.uid !== user?.uid) ?? null;
  return (
    <View style={styles.sub}>
      <View style={styles.subHead}>
        <TextButton title={t('editor.back')} onPress={onBack} />
      </View>
      <View style={styles.search}>
        <MaterialIcons name="alternate-email" size={20} color={ED.muted} />
        <TextInput value={v} onChangeText={setV} autoFocus placeholder={t('editor.stickers.mentionPlaceholder')} placeholderTextColor={ED.muted} style={styles.searchInput} accessibilityLabel={t('editor.stickers.bahset')} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.people}>
        {query.length < SEARCH_LIMITS.minName ? null : list === null ? (
          <ActivityIndicator color={ED.gold} style={{ marginTop: 12 }} />
        ) : list.length === 0 ? (
          <AppText style={styles.none}>{t('search.noResults', { q: query })}</AppText>
        ) : (
          list.map((p) => (
            <Pressable key={p.uid} accessibilityRole="button" onPress={() => onPick(p)} style={({ pressed }) => [styles.person, { opacity: pressed ? 0.7 : 1 }]}>
              <View style={styles.initial}>
                <AppText style={styles.initialText}>{(p.displayName || '?').slice(0, 1).toLocaleUpperCase()}</AppText>
              </View>
              <AppText numberOfLines={1} style={styles.personName}>{p.displayName}</AppText>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { zIndex: 20, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  sheet: { maxHeight: '62%' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ED.chip, borderRadius: 14, paddingHorizontal: 12, minHeight: 46 },
  searchInput: { flex: 1, color: ED.text, fontFamily: fonts.body, fontSize: 16, paddingVertical: 10 },
  scroll: { gap: 12, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: ED.line, backgroundColor: ED.chip, flexBasis: '31%', flexGrow: 1 },
  quickText: { color: ED.text, fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18, flexShrink: 1 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap' },
  emoji: { width: '16.66%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 32, lineHeight: 40 },
  sub: { gap: 10, minHeight: 260 },
  subHead: { flexDirection: 'row', justifyContent: 'space-between' },
  hash: { color: ED.gold, fontFamily: fonts.heading, fontSize: 18 },
  people: { maxHeight: 260 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  initial: { width: 36, height: 36, borderRadius: 18, backgroundColor: ED.chip, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: ED.gold, fontFamily: fonts.heading, fontSize: 15 },
  personName: { color: ED.text, fontFamily: fonts.bodySemi, fontSize: 15, flex: 1 },
  none: { color: ED.muted, marginTop: 12, textAlign: 'center' },
});
