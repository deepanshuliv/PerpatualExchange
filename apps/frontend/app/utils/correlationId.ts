export function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (err) {
      console.log('[createCorrelationId] error', err);
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
