/**
 * Hazır yasaklı kelime listesi (Eren, 12 Kasım 2026: "küfür ve argo kutusunu sen doldur").
 * Veritabanında liste hiç kaydedilmemişse uygulama bunu kullanır; panelde kutu bununla dolu açılır, admin
 * istediğini silip ekleyerek kaydeder ve o andan itibaren kaydedilen liste geçerli olur.
 *
 * Eşleşme kuralı (word-filter.ts): 3 harf ve altı yalnızca tam sözcük olarak, 4 harf ve üstü sözcüğün başında
 * da yakalanır (ekli hâller). Bu yüzden masum sözcüklerin başı olabilecek kökler (ör. "şike" > "sike", "ananın")
 * listeye konmadı. ı/i farkı yok sayıldığı için "sık, sıkıcı, sıkıldım, sıktım" da korunur; İngilizce "got, pic",
 * Türkçe "cunta", ad olarak "Amina" da yakalanmaz. Yerine ekli hâlleri ya da iki sözcüklü ifade yazıldı. Harf
 * tekrarı ve rakamla yazım (yarrak, s1kt1r) normalleştirme ile yakalanır. Denemesi: default-banned-words.test.ts.
 */
export const DEFAULT_BANNED_WORDS: readonly string[] = [
  // Türkçe küfür
  'amk', 'amq', 'aq', 'aminakoyim', 'aminakoyayim', 'amına koyayım', 'amına koyim', 'amına koyarım',
  'amcık', 'amcik', 'amcığ',
  'siktir', 'hassiktir', 'siktirgit', 'sikeyim', 'sikerim', 'sikerler',
  'sikmek', 'sktr',
  'orospu', 'orspu', 'oruspu', 'oç', 'piçin', 'piçler', 'pezevenk', 'pezeveng', 'kahpe', 'kaltak', 'fahişe',
  'kevaşe', 'sürtük', 'kancık', 'gavat', 'yavşak', 'ibne', 'top çocuk',
  'yarrak', 'yarak', 'dalyarak', 'taşak', 'taşşak', 'götün', 'götüne', 'götünü', 'götveren', 'götlek',
  'ananı sikeyim', 'anasını sikeyim', 'bacını sikeyim', 'ananın amı', 'anasını satayım',
  'şerefsiz', 'şerefsizler', 'it oğlu it', 'köpek oğlu', 'gerizekalı', 'dangalak', 'hıyar herif', 'mal herif',
  // English
  'fuck', 'fck', 'fuk', 'motherfucker', 'shit', 'bitch', 'bastard', 'asshole', 'whore', 'slut', 'dickhead',
  'nigger', 'nigga', 'faggot',
  // Deutsch
  'scheiße', 'scheisse', 'arschloch', 'fotze', 'hurensohn', 'wichser', 'fick', 'schlampe', 'missgeburt',
  // العربية
  'كس', 'كسمك', 'كس امك', 'شرموطة', 'شرموط', 'منيوك', 'زب', 'قحبة', 'عاهرة', 'خول', 'ابن الكلب', 'ابن الشرموطة',
  // Русский
  'хуй', 'хуя', 'хуе', 'пизда', 'пизд', 'блядь', 'блять', 'бля', 'ебать', 'ебан', 'ёбан', 'еблан', 'сука', 'суки',
  'мудак', 'пидор', 'пидарас', 'залупа', 'шлюха',
];
