// app.json'daki ayarlar aynen kullanılır. Panel > Uygulama görünümü için yapılan web derlemesi (EXPO_PUBLIC_PANEL_PREVIEW=1)
// panelin içinde `/uygulama/` altından açılır; yalnızca o derlemede adres öneki eklenir.
module.exports = ({ config }) =>
  process.env.EXPO_PUBLIC_PANEL_PREVIEW === '1' ? { ...config, experiments: { ...config.experiments, baseUrl: '/uygulama' } } : config;
