import QRCode from 'qrcode';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * QR kodu (siyah-beyaz; her iki temada da beyaz zemin, okunabilirlik için). Ek yerel paket gerektirmez:
 * kod matrisi `qrcode` ile hesaplanır, kareler View olarak çizilir.
 */
export function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const matrix = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const rows: boolean[][] = [];
    for (let y = 0; y < modules.size; y++) {
      rows.push(Array.from({ length: modules.size }, (_, x) => !!modules.get(x, y)));
    }
    return rows;
  }, [value]);
  const quiet = 2;
  const cell = Math.floor(size / (matrix.length + quiet * 2));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.box, { padding: cell * quiet }]}>
      {matrix.map((row, y) => (
        <View key={y} style={styles.row}>
          {row.map((on, x) => (
            <View key={x} style={{ width: cell, height: cell, backgroundColor: on ? '#000000' : '#FFFFFF' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFFFFF', alignSelf: 'center', borderRadius: 12, direction: 'ltr' },
  row: { flexDirection: 'row' },
});
