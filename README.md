# CityJoy

Türkiye geneli şehir yaşamı uygulaması (mobil uygulama + yönetim paneli).

- `PROJE.md`: projenin planı ve kararları
- `CLAUDE.md`: Claude Code çalışma notları

## Klasörler

| Klasör | İçerik |
|---|---|
| `apps/mobile` | Mobil uygulama (React Native + Expo, TypeScript) |
| `apps/panel` | Web yönetim paneli (React + Vite); menü yetkiye göre değişir |
| `packages/shared` | Ortak parçalar: 5 dilin metinleri, il/ilçe/mahalle verisi, yetki yapısı, veri yapıları |

## Çalıştırma

```sh
npm install          # bir kez
npm run mobile       # geliştirme sunucusu (telefonda Expo Go ile açılır)
npm run panel        # yönetim paneli (geliştirme modunda örnek hesaplarla giriş)
npm test             # testler
npm run typecheck    # tür kontrolü
```

## Konum verisi

`packages/shared/data/locations` PTT posta kodu listesinden üretilir (81 il, 973 ilçe, 73.305 mahalle/köy).
Yenilemek için `npm run locations:build`. Mahalleler il başına ayrı dosyadır; uygulama yalnızca seçilen ili
veri havuzundan indirir ve telefonda saklar (`EXPO_PUBLIC_LOCATIONS_BASE_URL`).
