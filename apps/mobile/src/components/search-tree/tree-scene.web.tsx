import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { treeHtml, type TreeCommand, type TreeEvent } from './tree-html';
import type { TreeSceneProps } from './tree-scene';

/** Web sürümünde ağaç sahnesi aynı sayfayla bir iframe içinde çizilir. */
export function TreeScene({ box, dim, paused, reduce, onEvent, style }: TreeSceneProps) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => treeHtml(reduce), [reduce]);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const post = (m: TreeCommand) => ref.current?.contentWindow?.postMessage({ cityjoyTree: m }, '*');
  useEffect(() => {
    if (ready && box) post({ type: 'box', ...box });
  }, [ready, box]);
  useEffect(() => {
    if (ready) post({ type: 'dim', on: dim });
  }, [ready, dim]);
  useEffect(() => {
    if (ready) post({ type: 'pause', on: paused });
  }, [ready, paused]);

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const m = (e.data as { cityjoyTree?: TreeEvent } | null)?.cityjoyTree;
      if (!m) return;
      if (m.type === 'ready') setReady(true);
      onEventRef.current(m);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  return (
    <View pointerEvents="none" style={[styles.wrap, style]} aria-hidden>
      {createElement('iframe', {
        ref,
        srcDoc: html,
        title: '',
        tabIndex: -1,
        'aria-hidden': true,
        style: { border: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none', opacity: ready ? 1 : 0, transition: 'opacity .3s ease', backgroundColor: '#001A1F' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#001A1F', overflow: 'hidden' },
});
