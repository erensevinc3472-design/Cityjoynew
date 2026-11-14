import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Açık klavyenin yüksekliği (iPhone). Ekranın altındaki yazı kutusu (mesaj yazma) klavyenin üstünde kalsın diye.
 * React Native'in KeyboardAvoidingView'i üstteki başlığı hesaba katmadığı için kutu başlık kadar klavyenin altında
 * kalıyordu (Eren, 13 Kasım 2026). Android'de pencere klavyeye göre kendisi küçülür, burada 0 döner.
 */
export function useKeyboardHeight(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}
