import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { treeHtml, type TreeCommand, type TreeEvent } from './tree-html';

export type TreeSceneProps = {
  /** Arama kutusunun alt kenarı ve ağacın tepesinin inebileceği en üst nokta (sahnenin kendi koordinatında). */
  box: { x0: number; x1: number; y: number; minTop: number } | null;
  dim: boolean;
  paused: boolean;
  reduce: boolean;
  onEvent(e: TreeEvent): void;
  style?: StyleProp<ViewStyle>;
};

/** Telefonda ağaç sahnesi bir WebView içinde çizilir; dokunmalar alttaki uygulama parçalarına geçer. */
export function TreeScene({ box, dim, paused, reduce, onEvent, style }: TreeSceneProps) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => treeHtml(reduce), [reduce]);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const post = (m: TreeCommand) => ref.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(m))}}));true;`);
  useEffect(() => {
    if (ready && box) post({ type: 'box', ...box });
  }, [ready, box]);
  useEffect(() => {
    if (ready) post({ type: 'dim', on: dim });
  }, [ready, dim]);
  useEffect(() => {
    if (ready) post({ type: 'pause', on: paused });
  }, [ready, paused]);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: TreeEvent;
    try {
      m = JSON.parse(e.nativeEvent.data) as TreeEvent;
    } catch {
      return;
    }
    if (m.type === 'ready') setReady(true);
    onEventRef.current(m);
  };

  return (
    <View pointerEvents="none" style={[styles.wrap, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView
        // WebView sınıfının ref türü React 19 türleriyle uyuşmuyor; nesne doğru.
        ref={ref as never}
        source={{ html }}
        originWhitelist={['*']}
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        javaScriptEnabled
        style={[styles.web, { opacity: ready ? 1 : 0 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#062227', overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#062227' },
});
