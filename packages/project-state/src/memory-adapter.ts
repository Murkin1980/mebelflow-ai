import type { SceneStoreAdapter } from "./adapter.js";
import { MAX_HISTORY } from "./limits.js";
import { type FurnitureModule, FurnitureModuleSchema } from "./schema.js";

export class MemorySceneStoreAdapter implements SceneStoreAdapter {
  private nodes = new Map<string, FurnitureModule>();
  private past: FurnitureModule[][] = [];
  private future: FurnitureModule[][] = [];
  private snapshot() {
    return structuredClone([...this.nodes.values()]);
  }
  private restore(nodes: FurnitureModule[]) {
    this.nodes = new Map(nodes.map((node) => [node.id, structuredClone(node)]));
  }
  private mutate(action: () => void) {
    const before = this.snapshot();
    action();
    this.past.push(before);
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
  }
  createNode(node: FurnitureModule) {
    const parsed = FurnitureModuleSchema.parse(node);
    if (this.nodes.has(parsed.id)) throw new Error("ID модуля уже существует.");
    this.mutate(() => this.nodes.set(parsed.id, structuredClone(parsed)));
  }
  updateNode(id: string, patch: Partial<FurnitureModule>) {
    const current = this.nodes.get(id);
    if (!current) throw new Error("Модуль не найден.");
    if (patch.id !== undefined && patch.id !== id) throw new Error("ID модуля нельзя изменить.");
    const next = FurnitureModuleSchema.parse({ ...current, ...patch, id });
    this.mutate(() => this.nodes.set(id, structuredClone(next)));
  }
  deleteNode(id: string) {
    if (!this.nodes.has(id)) throw new Error("Модуль не найден.");
    this.mutate(() => this.nodes.delete(id));
  }
  getNode(id: string) {
    const node = this.nodes.get(id);
    return node ? structuredClone(node) : undefined;
  }
  listNodes() {
    return this.snapshot();
  }
  undo() {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.unshift(this.snapshot());
    if (this.future.length > MAX_HISTORY) this.future.pop();
    this.restore(previous);
  }
  redo() {
    const next = this.future.shift();
    if (!next) return;
    this.past.push(this.snapshot());
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.restore(next);
  }
  serialize() {
    return JSON.stringify(this.listNodes());
  }
  static deserialize(json: string) {
    const nodes = FurnitureModuleSchema.array().parse(JSON.parse(json));
    const adapter = new MemorySceneStoreAdapter();
    adapter.restore(nodes);
    return adapter;
  }
}
