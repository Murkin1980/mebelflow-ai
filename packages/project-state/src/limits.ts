/**
 * Лимиты истории и данных проекта.
 *
 * Кэпы защищают от неограниченного роста памяти и размера сохраняемого
 * состояния (localStorage в widget, Firestore-строки в API) в длинных
 * сессиях и при undo-ветвлении.
 */

/** Максимум сохраняемых снапшотов в past/future (undo/redo). */
export const MAX_HISTORY = 100;

/**
 * Максимум commandId, хранимых для идемпотентности
 * (historyMeta.appliedCommandIds / ProjectHistory.processedCommandIds).
 *
 * Гарантия: повторная команда отбрасывается, если её commandId среди
 * последних MAX_APPLIED_COMMAND_IDS применённых команд сессии.
 */
export const MAX_APPLIED_COMMAND_IDS = 500;

/** Максимум сериализованного metadata модуля (байт) — защита от раздувания состояния LLM-контентом. */
export const MAX_METADATA_BYTES = 8192;

/** Новейший элемент — в конце. Оставляем последние MAX_HISTORY. */
export function capPast<T>(items: T[]): T[] {
  return items.length > MAX_HISTORY ? items.slice(items.length - MAX_HISTORY) : items;
}

/** Новейший элемент — в начале. Оставляем первые MAX_HISTORY. */
export function capFuture<T>(items: T[]): T[] {
  return items.length > MAX_HISTORY ? items.slice(0, MAX_HISTORY) : items;
}

/** Добавляет commandId в хвост списка и обрезает до MAX_APPLIED_COMMAND_IDS. */
export function capAppliedCommandIds(ids: string[], commandId: string): string[] {
  const next = [...ids, commandId];
  return next.length > MAX_APPLIED_COMMAND_IDS ? next.slice(next.length - MAX_APPLIED_COMMAND_IDS) : next;
}
