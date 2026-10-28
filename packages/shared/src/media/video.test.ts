import { describe, expect, it } from 'vitest';

import { videoEmbedUrl } from './video';

describe('videoEmbedUrl', () => {
  it('YouTube bağlantılarının hepsi çerezsiz gömme adresine döner', () => {
    const embed = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&modestbranding=1&autoplay=1';
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe(embed);
    expect(videoEmbedUrl(' https://youtu.be/dQw4w9WgXcQ?si=abc ')).toBe(embed);
    expect(videoEmbedUrl('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe(embed);
    expect(videoEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(embed);
  });

  it('Vimeo desteklenir; başka site, http ve bozuk kimlik null', () => {
    expect(videoEmbedUrl('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871?playsinline=1&autoplay=1&dnt=1');
    expect(videoEmbedUrl('https://ornek.com/tanitim.mp4')).toBeNull();
    expect(videoEmbedUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=<script>')).toBeNull();
    expect(videoEmbedUrl('nonsense')).toBeNull();
  });
});
