import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Gömülü video (YouTube / Vimeo). Oynatıcı, kendi sitesinden gelen bir sayfa içinde açılır; YouTube yönlendiren adres
 * istediği için sayfa uygulamanın adresiyle yüklenir. Video dışındaki bağlantılara gidilmez.
 */
export function VideoFrame({ src, title }: { src: string; title: string }) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${src}" title="${title.replace(/"/g, '&quot;')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
  return (
    <WebView
      source={{ html, baseUrl: 'https://cityjoy.app' }}
      style={styles.web}
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
      // Videonun dışına (ör. YouTube sitesine) gidilmez.
      onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('https://cityjoy.app') || r.url.startsWith('https://www.youtube-nocookie.com/') || r.url.startsWith('https://player.vimeo.com/')}
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({ web: { flex: 1, backgroundColor: '#000' } });
