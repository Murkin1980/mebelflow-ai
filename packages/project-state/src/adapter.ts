import type { FurnitureModule } from "./schema.js";

/**
 * Низкоуровневый Pascal-совместимый CRUD-адаптер узлов сцены.
 *
 * Владелец доменного undo/redo — `ProjectHistory` (reducer в project-state и
 * `applyLayoutCommandToHistory` в layout-engine): widget и API работают только
 * через него, и только его стек участвует в доменном undo-потоке.
 *
 * Этот интерфейс — изолированный низкоуровневый слой (совместимость с
 * Pascal-style API, ARCHITECTURE.md §7). Его `undo()/redo()` действуют только
 * на прямые мутации через сам адаптер и НЕ связаны с доменной историей;
 * обе истории кэпируются одинаково (`MAX_HISTORY`), но остаются независимыми.
 */
export interface SceneStoreAdapter {
  createNode(node: FurnitureModule): void;
  updateNode(id: string, patch: Partial<FurnitureModule>): void;
  deleteNode(id: string): void;
  getNode(id: string): FurnitureModule | undefined;
  listNodes(): FurnitureModule[];
  undo(): void;
  redo(): void;
}
