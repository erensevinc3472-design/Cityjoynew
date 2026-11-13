import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  authorNameOf,
  DEFAULT_LIMITS,
  isProBusiness,
  isVerifiedBusiness,
  ltr,
  POST_CATEGORIES,
  isPostTopic,
  mediaEditTexts,
  POST_LIMITS,
  POST_TARGETS,
  postModeFor,
  validatePost,
  type Business,
  type MediaEdit,
  type PostCategory,
  type PostError,
  type PostTarget,
} from '@cityjoy/shared';
import { deletePhotos, PhotoTooLargeError, uploadPostPhotos, uploadPostVideo, VideoTooLargeError, type PreparedPhoto, type PreparedVideo } from '@cityjoy/shared/firebase';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { MediaEditor, type EditorMedia, type EditorResult } from '@/components/editor/media-editor';
import { MediaOverlay } from '@/components/media-overlay';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { useBannedWordCheck } from '@/lib/banned-words';
import { storage } from '@/lib/firebase';
import { PhotoPermissionError, pickPhotos, pickVideo, VideoFileTooLargeError, VideoTooLongError } from '@/lib/photos';
import { formatDuration } from '@/components/post-video';
import { locationRepository } from '@/lib/locations';
import { forgetFeeds } from '@/lib/posts';
import { forgetSearches } from '@/lib/search';
import { businessRepository, postRepository, socialRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useUserLocation } from '@/lib/user-location';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { errorText } from '@/lib/limits';

/**
 * Gönderi paylaş (PROJE.md 5.5): yazı ve/veya en çok dört fotoğraf, kategori ve "Nerede paylaşırsın?" (bir ya da birden çok hedef). Gönderi kayıtlı
 * mahalleyle paylaşılır. Emlak ilanı Keşfet'te verilemez; taziyeyi yalnızca yakını paylaşır (beyan).
 * İşletmesi olan ya da paylaşım izni olan yetkili "Kimin adına?" sorusunda işletmeyi seçer: gönderi işletmenin adı ve
 * konumuyla paylaşılır; yetkilinin izni "onayla" ise sahibi onaylayana kadar akışta görünmez.
 * Fotoğraflar telefonda küçültülür, önce gönderinin kimliğiyle yüklenir, sonra gönderi kaydedilir; kayıt olmazsa silinir.
 */
export default function NewPostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile } = useSession();
  const { location } = useUserLocation();
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [photoNote, setPhotoNote] = useState<string | false>(false);
  const [video, setVideo] = useState<PreparedVideo | null>(null);
  // Paylaşım düzenleyicisi (Karar Eren, 13 Kasım 2026): seçilen medya önce düzenleyicide açılır; yazı, çıkartma ve çizimler
  // medya sırasına göre burada durur ve gönderiyle kaydedilir.
  const [edits, setEdits] = useState<(MediaEdit | null)[]>([]);
  const [editor, setEditor] = useState<{ media: EditorMedia; edits: (MediaEdit | null)[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<PostCategory>('genel');
  // Keşfet'te hangi sekmedeyken + düğmesine basıldıysa o hedef seçili gelir; kişi istediği yerleri işaretler.
  const { target, as } = useLocalSearchParams<{ target?: string; as?: string }>();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [author, setAuthor] = useState<string>(as ?? 'me');
  useEffect(() => {
    if (!user) return;
    Promise.all([businessRepository.listMine(user.uid).catch(() => []), businessRepository.listManaged(user.uid).catch(() => [])]).then(([mine, managed]) => {
      // İşletme adına paylaşım yalnızca doğrulanmış işletmede (Karar Eren, 7 Kasım).
      const list = [...mine, ...managed].filter((b) => b.status === 'yayinda' && isVerifiedBusiness(b) && postModeFor(b, user.uid));
      setBusinesses(list);
      // Bağlantıdaki işletme adına paylaşılamıyorsa kişinin kendi adına döner.
      setAuthor((a) => (a === 'me' || list.some((b) => b.id === a) ? a : 'me'));
    });
  }, [user]);
  // Yayıncı rozeti olan kişi kendi adına paylaşırken Haberler'i de seçebilir (Eren, 13 Kasım 2026; asıl denetim kurallarda).
  const [publisher, setPublisher] = useState(false);
  const [news, setNews] = useState(false);
  useEffect(() => {
    if (!user) return;
    socialRepository.getProfile(user.uid).then((p) => setPublisher(p?.publisher === true)).catch(() => {});
  }, [user]);
  const [targets, setTargets] = useState<PostTarget[]>([POST_TARGETS.includes(target as PostTarget) ? (target as PostTarget) : 'mahallem']);
  const [relative, setRelative] = useState(false);
  const [frames, setFrames] = useState(false);
  const [errors, setErrors] = useState<(PostError | 'relative' | 'banned')[]>([]);
  const hasBanned = useBannedWordCheck();
  const [failed, setFailed] = useState<string | false>(false);
  const [busy, setBusy] = useState(false);

  const biz = author === 'me' ? null : businesses.find((b) => b.id === author) ?? null;
  const provinceCode = biz ? biz.location.provinceCode : location?.provinceCode;
  const provinceName = (provinceCode && locationRepository.getProvince(provinceCode)?.name) || '';
  const districtId = biz ? biz.location.districtId : location?.districtId;
  const place = [districtId ? locationRepository.getDistrict(districtId)?.name : '', provinceName].filter(Boolean).join(', ');
  if (author !== 'me' && !biz) {
    return (
      <FormScreen title={t('explore.newPost')}>
        <StateMessage kind="loading" />
      </FormScreen>
    );
  }
  if (!user || !profile || (author === 'me' && (!location?.districtId || !location.neighbourhoodId))) {
    return (
      <FormScreen title={t('explore.newPost')}>
        <FormMessage kind="info" text={!user ? t('explore.signIn') : t('explore.needNeighbourhood')} />
        {user ? <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} /> : null}
        {businesses.length ? <AuthorPicker businesses={businesses} value={author} onChange={setAuthor} /> : null}
      </FormScreen>
    );
  }
  const mode = biz ? postModeFor(biz, user.uid) : null;
  // İşletme adına paylaşım işletmenin konumuyla yapılır; mahallesi seçilmemişse önce seçilmeli.
  const bizNoHood = !!biz && !biz.location.neighbourhoodId;
  // Ücretsiz işletme toplam gönderi sınırına ulaştı mı (asıl denetim sunucuda).
  const bizFull = !!biz && !isProBusiness(biz) && biz.postCount >= DEFAULT_LIMITS.isletmeGonderiToplam;

  const toggle = (x: PostTarget) => setTargets((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x]));
  // Gündem konuları (haber, ekonomi, spor...) yalnızca Genel seçiliyken; Genel kalkınca tür "Genel"e döner.
  const toNews = news && publisher && !biz;
  const withTopics = targets.includes('genel') || toNews;
  useEffect(() => {
    if (!withTopics && isPostTopic(category)) setCategory('genel');
  }, [withTopics, category]);

  const submit = async () => {
    if (bizNoHood || bizFull) return;
    const region = biz
      ? { provinceCode: biz.location.provinceCode, districtId: biz.location.districtId, neighbourhoodId: biz.location.neighbourhoodId! }
      : { provinceCode: location!.provinceCode, districtId: location!.districtId!, neighbourhoodId: location!.neighbourhoodId! };
    const input = { text, category, targets, region, photos: photos.map((p) => ({ path: '', url: '', width: p.width, height: p.height })), ...(video ? { video: { path: '', url: '', width: video.width, height: video.height, durationSec: video.durationSec } } : {}), ...(edits.some(Boolean) ? { edits } : {}), frames: frames && !!photos.length && targets.includes('genel'), ...(toNews ? { news: true } : {}) };
    const errs: (PostError | 'relative' | 'banned')[] = [
      ...validatePost(input),
      ...(category === 'taziye' && !relative ? ['relative' as const] : []),
      // Medyanın üstündeki yazılar ve etiketler de yasaklı kelime süzgecinden geçer.
      ...(hasBanned(text) || mediaEditTexts(edits).some((x) => hasBanned(x)) ? ['banned' as const] : []),
    ];
    setErrors(errs);
    setFailed(false);
    if (errs.length) return;
    setBusy(true);
    let uploaded: Awaited<ReturnType<typeof uploadPostPhotos>> = [];
    let uploadedVideo: Awaited<ReturnType<typeof uploadPostVideo>> | null = null;
    let stage: 'upload' | 'save' = 'upload';
    try {
      const newId = postRepository.newId();
      if (photos.length) {
        setUploading(true);
        uploaded = await uploadPostPhotos(storage, user.uid, newId, photos);
        setUploading(false);
      } else if (video) {
        setUploading(true);
        uploadedVideo = await uploadPostVideo(storage, user.uid, newId, video);
        setUploading(false);
      }
      stage = 'save';
      const id = await postRepository.create(
        user.uid,
        authorNameOf(profile.displayName),
        { ...input, photos: uploaded, ...(uploadedVideo ? { video: uploadedVideo } : {}) },
        biz ? { business: { id: biz.id, name: biz.name }, pending: mode === 'onayla' } : undefined,
        newId,
      );
      forgetFeeds();
      forgetSearches();
      // Onay bekleyen paylaşım akışta görünmez: işletme sayfasında "onay bekliyor" olarak durur.
      if (biz && mode === 'onayla') router.replace({ pathname: '/business/[id]', params: { id: biz.id } });
      else router.replace({ pathname: '/explore/[id]', params: { id } });
    } catch (e) {
      if (uploaded.length) await deletePhotos(storage, uploaded);
      if (uploadedVideo) await deletePhotos(storage, [uploadedVideo]);
      setFailed(
        e instanceof PhotoTooLargeError
          ? t('explore.photos.tooLarge')
          : e instanceof VideoTooLargeError
            ? t('explore.video.tooLarge')
          : stage === 'upload' && (photos.length || video)
            ? t('explore.photos.uploadError')
            : errorText(t, e, 'explore.saveError'),
      );
    } finally {
      setUploading(false);
      setBusy(false);
    }
  };

  const addPhotos = async () => {
    setPhotoNote(false);
    try {
      const more = await pickPhotos(POST_LIMITS.photos - photos.length);
      // Seçilenler hemen eklenmez: önce düzenleyici açılır, "İleri" deyince forma gelir.
      if (more.length) {
        const all = [...photos, ...more].slice(0, POST_LIMITS.photos);
        setEditor({ media: { kind: 'photo', photos: all }, edits: all.map((_, i) => edits[i] ?? null) });
      }
    } catch (e) {
      setPhotoNote(e instanceof PhotoPermissionError ? t('explore.photos.permission') : t('explore.photos.uploadError'));
    }
  };

  const addVideo = async () => {
    setPhotoNote(false);
    try {
      const v = await pickVideo();
      if (v) setEditor({ media: { kind: 'video', video: v }, edits: [] });
    } catch (e) {
      setPhotoNote(
        e instanceof PhotoPermissionError
          ? t('explore.photos.permission')
          : e instanceof VideoTooLongError
            ? t('explore.video.tooLong', { max: POST_LIMITS.videoSeconds })
            : e instanceof VideoFileTooLargeError
              ? t('explore.video.tooLarge')
              : t('explore.photos.uploadError'),
      );
    }
  };

  const editorDone = (r: EditorResult) => {
    setEditor(null);
    if (r.media.kind === 'video') {
      setPhotos([]);
      setVideo(r.media.video);
    } else {
      setVideo(null);
      setPhotos(r.media.photos);
    }
    setEdits(r.edits);
  };
  const openEditor = () => setEditor(video ? { media: { kind: 'video', video }, edits } : { media: { kind: 'photo', photos }, edits: photos.map((_, i) => edits[i] ?? null) });

  const err = (k: PostError | 'relative') => (errors.includes(k) ? t(`explore.errors.${k}`) : undefined);

  return (
    <FormScreen title={t('explore.newPost')} subtitle={t('explore.newIntro', { name: ltr(biz ? biz.name : authorNameOf(profile.displayName)) })}>
      {businesses.length ? <AuthorPicker businesses={businesses} value={author} onChange={setAuthor} /> : null}
      {bizNoHood ? (
        <>
          <FormMessage kind="info" text={t('explore.business.needHood')} />
          <AppButton variant="secondary" title={t('explore.business.setHood')} onPress={() => router.push({ pathname: '/business/edit', params: { id: biz!.id } })} />
        </>
      ) : null}
      {bizFull ? <FormMessage kind="error" text={t('business.tiers.postLimit', { count: DEFAULT_LIMITS.isletmeGonderiToplam })} /> : null}
      {mode === 'onayla' ? <FormMessage kind="info" text={t('explore.business.pendingNote', { name: biz!.name })} /> : null}
      <TextField label={t('explore.fields.text')} value={text} onChangeText={setText} maxLength={POST_LIMITS.text[1]} multiline error={err('text')} hint={t('explore.fields.textHint')} />
      {video ? (
        <VideoPicked video={video} edit={edits[0]} onEdit={openEditor} onRemove={() => (setVideo(null), setEdits([]))} disabled={busy} />
      ) : (
        <PhotoPicker photos={photos} edits={edits} onEdit={openEditor} onAdd={addPhotos} onAddVideo={photos.length ? undefined : addVideo} onRemove={(i) => (setPhotos((cur) => cur.filter((_, k) => k !== i)), setEdits((cur) => cur.filter((_, k) => k !== i)))} disabled={busy} />
      )}
      {err('video') ? <FormMessage kind="error" text={err('video')!} /> : null}
      {photoNote ? <FormMessage kind="error" text={photoNote} /> : null}
      {errors.includes('photos') ? <FormMessage kind="error" text={t('explore.errors.photos')} /> : null}
      {errors.includes('realEstate') ? <FormMessage kind="error" text={t('explore.errors.realEstate')} /> : null}
      {errors.includes('banned') ? <FormMessage kind="error" text={t('explore.errors.banned')} /> : null}
      <View style={styles.block}>
        <AppText variant="label">{t('explore.fields.category')}</AppText>
        <Chips<PostCategory> label={t('explore.fields.category')} value={category} onChange={setCategory} options={POST_CATEGORIES.filter((c) => (!biz || c !== 'taziye') && (withTopics || !isPostTopic(c))).map((c) => ({ value: c, label: t(`explore.categories.${c}`) }))} />
      </View>
      {category === 'taziye' ? (
        <>
          <CheckboxRow checked={relative} onToggle={() => setRelative((x) => !x)} label={t('explore.fields.relative')} />
          {err('relative') ? <FormMessage kind="error" text={err('relative')!} /> : null}
        </>
      ) : null}
      <View style={styles.block}>
        <AppText variant="label">{t('explore.fields.where')}</AppText>
        {POST_TARGETS.map((x) => (
          <CheckboxRow key={x} checked={targets.includes(x)} onToggle={() => toggle(x)} label={`${t(`explore.targets.${x}`)}: ${t(`explore.tabHints.${x}`)}`} />
        ))}
        {publisher && !biz ? (
          <CheckboxRow checked={news} onToggle={() => setNews((x) => !x)} label={`${t('explore.targets.haberler')}: ${t('explore.tabHints.haberler', { place: provinceName })}`} />
        ) : null}
        {err('targets') ? <FormMessage kind="error" text={err('targets')!} /> : null}
        {targets.includes('mahallem') ? <AppText variant="caption" muted>{t('explore.fields.mahallemNote')}</AppText> : null}
      </View>
      {photos.length && targets.includes('genel') ? (
        <View style={styles.block}>
          <CheckboxRow checked={frames} onToggle={() => setFrames((x) => !x)} label={t('explore.fields.frames', { name: provinceName })} />
          <AppText variant="caption" muted>{t('explore.fields.framesHint')}</AppText>
        </View>
      ) : null}
      <AppText variant="caption" muted>{t('explore.rules')}</AppText>
      {failed ? <FormMessage kind="error" text={failed} /> : null}
      {uploading ? <AppText variant="caption" muted>{t('explore.photos.uploading')}</AppText> : null}
      <AppButton title={mode === 'onayla' ? t('explore.business.sendForApproval') : t('explore.publish')} onPress={submit} loading={busy} disabled={busy || bizNoHood} />
      {editor ? <MediaEditor media={editor.media} edits={editor.edits} place={place} provinceCode={provinceCode} onDone={editorDone} onCancel={() => setEditor(null)} /> : null}
    </FormScreen>
  );
}

/** Kimin adına: kendim ya da paylaşım iznim olan işletmeler. */
function AuthorPicker({ businesses, value, onChange }: { businesses: Business[]; value: string; onChange(v: string): void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.block}>
      <AppText variant="label">{t('explore.business.who')}</AppText>
      <Chips<string> label={t('explore.business.who')} value={value} onChange={onChange} options={[{ value: 'me', label: t('explore.business.me') }, ...businesses.map((b) => ({ value: b.id, label: b.name }))]} />
    </View>
  );
}

/** Seçilen video: süresi ve kaldır düğmesi (fotoğrafla birlikte olmaz). */
function VideoPicked({ video, edit, onEdit, onRemove, disabled }: { video: PreparedVideo; edit?: MediaEdit | null; onEdit(): void; onRemove(): void; disabled: boolean }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  return (
    <View style={styles.block}>
      <View style={styles.thumbs}>
        <View style={[styles.thumb, styles.videoThumb]} accessible accessibilityLabel={t('explore.video.selected', { duration: formatDuration(video.durationSec) })}>
          {video.coverUri ? <Image source={{ uri: video.coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <MaterialIcons name="videocam" size={26} color="#FFFFFF" />}
          <MediaOverlay edit={edit} frameW={76} frameH={76} mediaW={video.width} mediaH={video.height} fit="cover" />
          <AppText style={styles.videoTime}>{formatDuration(edit?.trimStart !== undefined ? (edit.trimEnd ?? video.durationSec) - edit.trimStart : video.durationSec)}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={t('explore.video.remove')} disabled={disabled} onPress={onRemove} hitSlop={10} style={styles.remove}>
            <MaterialIcons name="close" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
        <EditButton onPress={onEdit} disabled={disabled} />
      </View>
      <AppText variant="caption" style={{ color: c.textMuted }}>{t('explore.video.note', { max: POST_LIMITS.videoSeconds })}</AppText>
    </View>
  );
}

/** Seçilen fotoğrafların küçük önizlemeleri (her birinde kaldır düğmesi), "Fotoğraf ekle" ve fotoğraf yokken "Video ekle". */
function PhotoPicker({ photos, edits, onEdit, onAdd, onAddVideo, onRemove, disabled }: { photos: PreparedPhoto[]; edits: readonly (MediaEdit | null)[]; onEdit(): void; onAdd(): void; onAddVideo?(): void; onRemove(i: number): void; disabled: boolean }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  return (
    <View style={styles.block}>
      <View style={styles.thumbs}>
        {photos.map((p, i) => (
          <View key={p.uri} style={[styles.thumb, { backgroundColor: c.surfaceStrong }]}>
            <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={t('explore.photos.label', { n: i + 1, total: photos.length })} />
            <MediaOverlay edit={edits[i]} frameW={76} frameH={76} mediaW={p.width} mediaH={p.height} fit="cover" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('explore.photos.remove')} (${i + 1})`}
              disabled={disabled}
              onPress={() => onRemove(i)}
              hitSlop={10}
              style={styles.remove}>
              <MaterialIcons name="close" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}
        {photos.length ? <EditButton onPress={onEdit} disabled={disabled} /> : null}
        {photos.length < POST_LIMITS.photos ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('explore.photos.add')}
            disabled={disabled}
            onPress={onAdd}
            style={({ pressed }) => [styles.thumb, styles.add, { borderColor: c.accent, opacity: pressed ? 0.7 : 1 }]}>
            <MaterialIcons name="add-a-photo" size={24} color={c.accent} />
            <AppText style={[styles.addText, { color: c.accent }]}>{t('explore.photos.add')}</AppText>
          </Pressable>
        ) : null}
        {onAddVideo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('explore.video.add')}
            disabled={disabled}
            onPress={onAddVideo}
            style={({ pressed }) => [styles.thumb, styles.add, { borderColor: c.accent, opacity: pressed ? 0.7 : 1 }]}>
            <MaterialIcons name="video-call" size={24} color={c.accent} />
            <AppText style={[styles.addText, { color: c.accent }]}>{t('explore.video.add')}</AppText>
          </Pressable>
        ) : null}
      </View>
      <AppText variant="caption" muted>
        {photos.length ? `${t('explore.photos.count', { count: photos.length })} · ` : ''}
        {t('explore.photos.note')}
      </AppText>
    </View>
  );
}

/** Düzenleyiciyi yeniden açar (yazı, çıkartma, çizim, kırpma). */
function EditButton({ onPress, disabled }: { onPress(): void; disabled: boolean }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('editor.edit')}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.thumb, styles.add, { borderColor: c.accent, borderStyle: 'solid', opacity: pressed ? 0.7 : 1 }]}>
      <MaterialIcons name="auto-fix-high" size={24} color={c.accent} />
      <AppText style={[styles.addText, { color: c.accent }]}>{t('editor.edit')}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 76, height: 76, borderRadius: radius.md, overflow: 'hidden' },
  remove: { position: 'absolute', top: 4, end: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4 },
  addText: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  videoThumb: { backgroundColor: '#0B1F24', alignItems: 'center', justifyContent: 'center', gap: 2 },
  videoTime: { color: '#FFFFFF', fontSize: 12, lineHeight: 16 },
});
