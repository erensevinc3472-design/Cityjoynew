import { createElement } from 'react';

/** Web sürümünde gömülü video doğrudan iframe ile. */
export function VideoFrame({ src, title }: { src: string; title: string }) {
  return createElement('iframe', {
    src,
    title,
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    allowFullScreen: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    style: { border: 0, width: '100%', height: '100%', backgroundColor: '#000' },
  });
}
