# visual-scene-engine

Pure TypeScript projection from versioned `FurnitureProjectState` and an accepted visual-asset catalog to a renderer-neutral `SceneDefinition` in millimetres. It owns coordinate alignment, visual asset lookup and the deterministic box fallback; it does not import Three.js, React or browser APIs.

Only assets accepted by `packages/visual-asset-library` may produce `kind: "glb"`. Missing, pending or rejected assets produce technical fallback geometry.

Axes: X along the wall, Y upward, Z into the room.
