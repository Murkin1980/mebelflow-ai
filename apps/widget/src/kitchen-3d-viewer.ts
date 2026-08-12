import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { projectStateToScene, type SceneDefinition, type SceneModule, type VisualAssetRef } from "../../../packages/visual-scene-engine/src/index.js";
import type { FurnitureProjectState } from "../../../packages/project-state/src/index.js";

export type Kitchen3DViewer = {
  update(state: FurnitureProjectState, visualAssets?: Record<string, VisualAssetRef>): void;
  setSelectedModule(id?: string): void;
  dispose(): void;
};

const metres = (millimetres: number) => millimetres / 1000;
const disposeObject = (object: THREE.Object3D) => object.traverse(child => {
  if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments)) return;
  child.geometry.dispose();
  const materials = Array.isArray(child.material) ? child.material : [child.material];
  materials.forEach(material => material.dispose());
});

function projectionGrid(width: number, height: number, depth: number) {
  const group = new THREE.Group(); group.name = "projection-grid-100mm";
  const minor: number[] = []; const major: number[] = [];
  const add = (target: number[], from: [number, number, number], to: [number, number, number]) => target.push(...from, ...to);
  const lineTarget = (index: number) => index % 5 === 0 ? major : minor;
  for (let index = 0; index <= Math.round(width / .1); index += 1) { const x = Math.min(width, index * .1); add(lineTarget(index), [x, .003, 0], [x, .003, depth]); add(lineTarget(index), [x, 0, .003], [x, height, .003]); }
  for (let index = 0; index <= Math.round(depth / .1); index += 1) { const z = Math.min(depth, index * .1); add(lineTarget(index), [0, .003, z], [width, .003, z]); }
  for (let index = 0; index <= Math.round(height / .1); index += 1) { const y = Math.min(height, index * .1); add(lineTarget(index), [0, y, .003], [width, y, .003]); }
  const layer = (positions: number[], color: string, opacity: number) => { const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })); };
  group.add(layer(minor, "#8d72a5", .2), layer(major, "#6b3a8b", .4));
  return group;
}

export async function createKitchen3DViewer(input: {
  container: HTMLElement;
  state: FurnitureProjectState;
  visualAssets?: Record<string, VisualAssetRef>;
  selectedModuleId?: string;
  onModuleSelect?: (moduleId: string) => void;
  onError?: (error: unknown) => void;
}): Promise<Kitchen3DViewer> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f7f1e7");
  const camera = new THREE.PerspectiveCamera(38, 1, .01, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.domElement.className = "kitchen-3d-canvas";
  renderer.domElement.setAttribute("aria-label", "Интерактивный трёхмерный вид кухни. Перетаскивайте для вращения, используйте колесо или жест щипка для масштаба, правую кнопку мыши или два пальца для сдвига.");
  renderer.domElement.tabIndex = 0;
  input.container.replaceChildren(renderer.domElement);
  const emptyNote = document.createElement("div");
  emptyNote.className = "viewer-empty-note"; emptyNote.setAttribute("role", "status");
  emptyNote.innerHTML = "<strong>В проекте пока нет модулей</strong><span>Сетка имеет шаг 100 мм. В перспективе пустые секции показаны только как подсказка.</span>";
  const orbitBadge = document.createElement("div"); orbitBadge.className = "viewer-orbit-badge"; orbitBadge.setAttribute("aria-hidden", "true");
  orbitBadge.innerHTML = '<svg viewBox="0 0 32 32"><path d="M7 12a11 11 0 0 1 18-4l2-1-1 6-6-1 2-2a8 8 0 0 0-12 3M25 20a11 11 0 0 1-18 4l-2 1 1-6 6 1-2 2a8 8 0 0 0 12-3"/><path d="m11 14 5-3 5 3v6l-5 3-5-3zM16 11v6m-5-3 5 3 5-3"/></svg><span>Вращение</span>';
  const legend = document.createElement("div"); legend.className = "viewer-control-legend"; legend.setAttribute("role", "group"); legend.setAttribute("aria-label", "Управление трёхмерным видом");
  const rotateIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8a7 7 0 0 1 11-4l2-1v5h-5l2-2a5 5 0 0 0-8 3M17 12a7 7 0 0 1-11 4l-2 1v-5h5l-2 2a5 5 0 0 0 8-3"/></svg>';
  const zoomIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5"/><path d="m12 12 5 5M8 5v6M5 8h6"/></svg>';
  const panIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2v16M2 10h16M10 2 7 5m3-3 3 3M10 18l-3-3m3 3 3-3M2 10l3-3m-3 3 3 3M18 10l-3-3m3 3-3 3"/></svg>';
  legend.innerHTML = `<span>${rotateIcon}Тяните — вращение</span><span class="desktop-control">${zoomIcon}Колесо — масштаб</span><span class="touch-control">${zoomIcon}Щипок — масштаб</span><span class="desktop-control">${panIcon}Правая кнопка — сдвиг</span><span class="touch-control">${panIcon}2 пальца — сдвиг</span>`;
  const cursorHint = document.createElement("div"); cursorHint.className = "viewer-cursor-hint"; cursorHint.hidden = true; cursorHint.setAttribute("aria-hidden", "true"); cursorHint.textContent = "Тяните — вращение · колесо — масштаб · правая кнопка — сдвиг";
  input.container.append(emptyNote, orbitBadge, legend, cursorHint);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.dampingFactor = .08;
  controls.minDistance = 1.4;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * .49;
  const ambient = new THREE.AmbientLight(0xffffff, 1.7);
  const key = new THREE.DirectionalLight(0xfff4dc, 3.2); key.position.set(3, 5, 4);
  const fill = new THREE.DirectionalLight(0xdde8ff, 1.8); fill.position.set(-4, 3, 2);
  scene.add(ambient, key, fill);
  const dynamic = new THREE.Group(); scene.add(dynamic);
  const loader = new GLTFLoader();
  let selectedModuleId = input.selectedModuleId;
  let disposed = false;
  let generation = 0;

  function boxPart(module: SceneModule) {
    const group = new THREE.Group(); group.name = module.id; group.userData.moduleId = module.sourceModuleId;
    for (const part of module.parts) {
      const geometry = part.kind === "sink_bowl"
        ? new THREE.CylinderGeometry(metres(part.dimensionsMm.width) / 2, metres(part.dimensionsMm.width) / 2, metres(part.dimensionsMm.height), 32, 1, false, 0, Math.PI * 2)
        : part.kind === "faucet"
          ? new THREE.TorusGeometry(metres(part.dimensionsMm.height) / 3, metres(part.dimensionsMm.width) / 2, 12, 28, Math.PI)
          : new THREE.BoxGeometry(metres(part.dimensionsMm.width), metres(part.dimensionsMm.height), metres(part.dimensionsMm.depth));
      const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: .72, metalness: .02 });
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.moduleId = module.sourceModuleId;
      mesh.position.set(metres(part.position.x), metres(part.position.y), metres(part.position.z)); group.add(mesh);
      if (part.kind === "sink_bowl") { mesh.scale.z = part.dimensionsMm.depth / part.dimensionsMm.width; mesh.position.y -= metres(part.dimensionsMm.height) / 2; }
      if (part.kind === "faucet") { mesh.rotation.y = Math.PI / 2; mesh.position.y -= metres(part.dimensionsMm.height) / 6; }
    }
    return group;
  }

  function markSelection() {
    dynamic.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      const active = object.userData.moduleId === selectedModuleId;
      object.material.emissive.set(active ? "#7d4aa8" : "#000000"); object.material.emissiveIntensity = active ? .28 : 0;
    });
  }

  async function replaceWithGlb(module: SceneModule, fallback: THREE.Group, token: number) {
    if (!module.glbUrl || !module.glbScale) return;
    try {
      const gltf = await Promise.race([
        loader.loadAsync(module.glbUrl),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("GLB_LOAD_TIMEOUT")), 12_000)),
      ]);
      if (disposed || token !== generation || !fallback.parent) return;
      const asset = gltf.scene.clone(true); asset.scale.set(module.glbScale.x, module.glbScale.y, module.glbScale.z);
      asset.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(asset); const center = bounds.getCenter(new THREE.Vector3());
      asset.position.set(-center.x, -bounds.min.y, -center.z);
      const group = new THREE.Group(); group.name = module.id; group.userData.moduleId = module.sourceModuleId;
      group.position.set(metres(module.position.x), 0, metres(module.position.z));
      asset.traverse(object => { object.userData.moduleId = module.sourceModuleId; }); group.add(asset);
      dynamic.remove(fallback); disposeObject(fallback); dynamic.add(group); markSelection();
    } catch (error) { input.onError?.(error); }
  }

  function rebuild(definition: SceneDefinition) {
    generation += 1; const token = generation;
    for (const child of [...dynamic.children]) { dynamic.remove(child); disposeObject(child); }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(metres(definition.room.width + 1200), metres(definition.room.depth)), new THREE.MeshStandardMaterial({ color: "#e7ded0", roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(metres(definition.room.width) / 2, 0, metres(definition.room.depth) / 2 - .25); dynamic.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(metres(definition.room.width), metres(definition.room.height)), new THREE.MeshStandardMaterial({ color: "#f4eee5", roughness: 1 }));
    wall.position.set(metres(definition.room.width) / 2, metres(definition.room.height) / 2, -.015); dynamic.add(wall);
    dynamic.add(projectionGrid(metres(definition.room.width), metres(definition.room.height), metres(definition.room.depth)));
    for (const module of definition.modules) { const fallback = boxPart(module); dynamic.add(fallback); if (module.kind === "glb") void replaceWithGlb(module, fallback, token); }
    const width = metres(definition.room.width);
    const contentTop = metres(Math.max(758, ...definition.modules.map(module => module.position.y + module.dimensionsMm.height / 2)));
    const hasModules = definition.modules.length > 0;
    const targetY = hasModules ? Math.max(.7, contentTop / 2) : metres(definition.room.height) * .42;
    controls.target.set(width / 2, targetY, .25);
    camera.position.set(width * .68, targetY + .8, hasModules ? Math.max(2.6, width * .9, contentTop * 1.7) : Math.max(3.6, width * 1.2));
    emptyNote.hidden = hasModules;
    controls.update(); markSelection();
  }

  const resize = () => { const width = Math.max(1, input.container.clientWidth); const height = Math.max(1, input.container.clientHeight); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(input.container); resize();
  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
  let pointerStart: { id: number; x: number; y: number } | undefined; let hintFrame = 0;
  const select = (event: PointerEvent) => { if (event.button !== 0 || !pointerStart || pointerStart.id !== event.pointerId || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return; const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(dynamic.children, true).find(item => typeof item.object.userData.moduleId === "string"); if (hit) input.onModuleSelect?.(hit.object.userData.moduleId as string); };
  const moveHint = (event: PointerEvent) => { if (event.pointerType !== "mouse" || renderer.domElement.classList.contains("is-interacting")) return; const x = event.clientX; const y = event.clientY; cancelAnimationFrame(hintFrame); hintFrame = requestAnimationFrame(() => { const rect = input.container.getBoundingClientRect(); cursorHint.hidden = false; const left = Math.min(rect.width - 270, Math.max(8, x - rect.left + 12)); const top = Math.min(rect.height - 54, Math.max(8, y - rect.top + 12)); cursorHint.style.transform = `translate3d(${left}px,${top}px,0)`; }); };
  const hideHint = () => { cancelAnimationFrame(hintFrame); cursorHint.hidden = true; };
  const startInteraction = (event: PointerEvent) => { pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }; renderer.domElement.classList.add("is-interacting"); hideHint(); };
  const endInteraction = () => { pointerStart = undefined; renderer.domElement.classList.remove("is-interacting"); };
  renderer.domElement.addEventListener("pointerup", select);
  renderer.domElement.addEventListener("pointermove", moveHint); renderer.domElement.addEventListener("pointerleave", hideHint);
  renderer.domElement.addEventListener("pointerdown", startInteraction); renderer.domElement.addEventListener("pointerup", endInteraction); renderer.domElement.addEventListener("pointercancel", endInteraction);
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  rebuild(projectStateToScene(input.state, input.visualAssets));

  return {
    update(state, visualAssets = {}) { rebuild(projectStateToScene(state, visualAssets)); },
    setSelectedModule(id) { selectedModuleId = id; markSelection(); },
    dispose() { disposed = true; generation += 1; renderer.setAnimationLoop(null); renderer.domElement.removeEventListener("pointerup", select); renderer.domElement.removeEventListener("pointermove", moveHint); renderer.domElement.removeEventListener("pointerleave", hideHint); renderer.domElement.removeEventListener("pointerdown", startInteraction); renderer.domElement.removeEventListener("pointerup", endInteraction); renderer.domElement.removeEventListener("pointercancel", endInteraction); resizeObserver.disconnect(); controls.dispose(); disposeObject(dynamic); renderer.dispose(); renderer.domElement.remove(); emptyNote.remove(); orbitBadge.remove(); legend.remove(); cursorHint.remove(); },
  };
}
