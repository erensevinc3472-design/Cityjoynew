/**
 * Boş liste (panel yenileme, Eren 12 Kasım 2026): "Henüz kayıt yok" yazısının altında, yetkisi varsa doğrudan
 * ekleme düğmesi çıkar; kullanıcı sayfanın tepesindeki düğmeyi aramak zorunda kalmaz.
 */
export function EmptyState({ text, actionLabel, onAction }: { text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="state empty-state">
      <p>{text}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
