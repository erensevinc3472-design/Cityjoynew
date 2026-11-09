// Bursa kaymakamlık ve valilik sitelerindeki birim sayfalarından (jandarma, nüfus, mal müdürlüğü, vergi, tapu, göç)
// ad, adres, telefon ve konumu okur. Sayfalardaki "koordinatlar.push({...})" bloğu kullanılır.
// Node bu sitelere bağlanamadığı için curl ile çekilir.
// Çalıştırma: npx vite-node scripts/bursa-kaymakamlik-birimler.ts  -> veri-denemesi/acikveri/kaymakamlik-birimler.json
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const get = (u: string) => { try { return execFileSync('curl', ['-s', '-L', '-m', '25', '-A', 'Mozilla/5.0', u], { encoding: 'utf8', maxBuffer: 2e7 }); } catch { return ''; } };
const slugs = ['buyukorhan','gemlik','gursu','harmancik','inegol','iznik','karacabey','keles','kestel','mudanya','mustafakemalpasa','nilufer','orhaneli','orhangazi','osmangazi','yenisehir','yildirim'];
const want = /jandarma|nufus|n%C3%BCfus|mal-mud|malmud|vergi|tapu|goc|g%C3%B6%C3%A7/i;
const out: any[] = [];
for (const s of [...slugs, 'bursa']) {
  const base = `https://www.${s}.gov.tr`;
  const home = get(base);
  const links = [...new Set([...home.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]!).filter((h) => want.test(h)))];
  for (const l of links) {
    const u = l.startsWith('//') ? 'https:' + l : l.startsWith('http') ? l : base + (l.startsWith('/') ? '' : '/') + l;
    if (!u.includes(`${s}.gov.tr`)) continue;
    const html = get(u);
    for (const m of html.matchAll(/koordinatlar\.push\(\{([^}]*)\}\)/g)) {
      const f = (k: string) => (m[1]!.match(new RegExp(k + ':\\s*"([^"]*)"')) ?? [])[1]?.trim() ?? '';
      out.push({ s, u, baslik: f('baslik'), adres: f('adres'), tel: f('tel'), lat: f('konumx'), lng: f('konumy') });
    }
  }
  console.log(s, links.length, 'bağlantı');
}
fs.mkdirSync('veri-denemesi/acikveri', { recursive: true });
fs.writeFileSync('veri-denemesi/acikveri/kaymakamlik-birimler.json', JSON.stringify(out, null, 1));
out.forEach((o) => console.log([o.s, o.baslik, o.adres.slice(0, 50), o.tel, o.lat, o.u.split('.gov.tr')[1]].join(' ║ ')));
