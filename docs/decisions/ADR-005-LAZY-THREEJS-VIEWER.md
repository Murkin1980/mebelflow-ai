# ADR-005 — Lazy Three.js viewer after SVG-first pilot

## Status

Accepted for Stage 10 expansion on 2026-08-08 by explicit owner request.

## Context

The MVP deliberately used deterministic SVG and deferred full 3D until demand was demonstrated. The owner supplied `mebelflow_threejs_viewer_spec.md` and explicitly requested implementation. The production widget is vanilla TypeScript rather than React, and its startup budget must not absorb an optional WebGL runtime.

## Decision

- Preserve SVG as the default, accessible and failure-safe representation.
- Add a renderer-neutral `visual-scene-engine` that maps Project State millimetres to a deterministic scene definition without DOM, React or Three.js.
- Implement the first viewer in vanilla Three.js to avoid migrating the widget framework.
- Load Three.js, OrbitControls and GLTFLoader only after the user selects `3D-вид`; esbuild emits a separate chunk.
- Render parametric corpus/facade/countertop boxes by default. Resolve optional GLB assets through `metadata.visualAssetId` and a separate asset registry; keep the box visible if loading fails or times out.
- Keep geometry authority in Project State/Layout Engine. The viewer never edits dimensions or placement directly.

## Consequences

- Initial `app.js` remains approximately its previous size; the optional Three.js chunk is about 630 KB minified.
- WebGL failure cannot break the conversational flow or SVG views.
- A later stage may formalize visual assets in a versioned schema, add upper-row scene modules and production GLB assets.

