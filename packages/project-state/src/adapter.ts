import type { FurnitureModule } from "./schema.js";
export interface SceneStoreAdapter {
  createNode(node: FurnitureModule): void;
  updateNode(id: string, patch: Partial<FurnitureModule>): void;
  deleteNode(id: string): void;
  getNode(id: string): FurnitureModule | undefined;
  listNodes(): FurnitureModule[];
  undo(): void;
  redo(): void;
}
