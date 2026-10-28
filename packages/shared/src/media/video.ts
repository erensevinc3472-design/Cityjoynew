/**
 * Bir video bağlantısını uygulama içinde oynatılabilen gömme adresine çevirir (tanıtım videosu, 13. madde 29).
 * YouTube (izle, kısa, youtu.be, embed) ve Vimeo desteklenir; YouTube çerez bırakmayan adresle açılır (KVKK).
 * Tanınmayan bağlantı için null: uygulama onu tarayıcıda açar.
 */
export function videoEmbedUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  const id = (s: string | null | undefined) => (s && /^[A-Za-z0-9_-]{6,20}$/.test(s) ? s : null);
  let yt: string | null = null;
  if (host === 'youtu.be') yt = id(u.pathname.slice(1).split('/')[0]);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [first, second] = u.pathname.split('/').filter(Boolean);
    yt = first === 'watch' ? id(u.searchParams.get('v')) : first === 'shorts' || first === 'embed' || first === 'live' ? id(second) : null;
  }
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?playsinline=1&rel=0&modestbranding=1&autoplay=1`;
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const vid = u.pathname.split('/').filter(Boolean).find((p) => /^\d{5,12}$/.test(p));
    if (vid) return `https://player.vimeo.com/video/${vid}?playsinline=1&autoplay=1&dnt=1`;
  }
  return null;
}
