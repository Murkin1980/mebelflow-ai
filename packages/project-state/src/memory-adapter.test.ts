import{describe,expect,it}from"vitest";import{createModule}from"./catalog.js";import{MemorySceneStoreAdapter}from"./memory-adapter.js";
describe("MemorySceneStoreAdapter",()=>{
 it("creates a node",()=>{const a=new MemorySceneStoreAdapter();a.createNode(createModule("a","sink_cabinet",600));expect(a.getNode("a")?.type).toBe("sink_cabinet")});
 it("rejects duplicate ids",()=>{const a=new MemorySceneStoreAdapter();const n=createModule("a","sink_cabinet",600);a.createNode(n);expect(()=>a.createNode(n)).toThrow()});
 it("updates a node",()=>{const a=new MemorySceneStoreAdapter();a.createNode(createModule("a","sink_cabinet",600));a.updateNode("a",{width:800});expect(a.getNode("a")?.width).toBe(800)});
 it("preserves metadata",()=>{const a=new MemorySceneStoreAdapter();a.createNode({...createModule("a","base_cabinet_drawers",600),metadata:{drawerCount:3}});expect(a.getNode("a")?.metadata).toEqual({drawerCount:3})});
 it("rejects id mutation",()=>{const a=new MemorySceneStoreAdapter();a.createNode(createModule("a","sink_cabinet",600));expect(()=>a.updateNode("a",{id:"b"})).toThrow()});
 it("deletes a node",()=>{const a=new MemorySceneStoreAdapter();a.createNode(createModule("a","sink_cabinet",600));a.deleteNode("a");expect(a.getNode("a")).toBeUndefined()});
 it("undoes mutation",()=>{const a=new MemorySceneStoreAdapter();a.createNode(createModule("a","sink_cabinet",600));a.undo();expect(a.listNodes()).toHaveLength(0)});
 it("redoes mutation",()=>{const a=new MemorySceneStoreAdapter();a.createNode(createModule("a","sink_cabinet",600));a.undo();a.redo();expect(a.listNodes()).toHaveLength(1)});
 it("serializes and restores",()=>{const a=new MemorySceneStoreAdapter();a.createNode(createModule("a","sink_cabinet",600));const b=MemorySceneStoreAdapter.deserialize(a.serialize());expect(b.listNodes()).toEqual(a.listNodes())});
 it("returns defensive copies",()=>{const a=new MemorySceneStoreAdapter();a.createNode(createModule("a","sink_cabinet",600));const n=a.getNode("a");if(n)n.width=1000;expect(a.getNode("a")?.width).toBe(600)});
 it("rejects corrupted serialization",()=>expect(()=>MemorySceneStoreAdapter.deserialize('[{"bad":true}]')).toThrow());
});
