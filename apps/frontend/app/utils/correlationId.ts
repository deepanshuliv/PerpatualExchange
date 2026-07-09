/** Works on LAN HTTP where crypto.randomUUID is unavailable outside secure contexts. */
export function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
