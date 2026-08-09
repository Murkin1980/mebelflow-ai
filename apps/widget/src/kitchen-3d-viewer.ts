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
  if (!(child instanceof THREE.Mesh)) return;
  child.geometry.dispose();
  const materials = Array.isArray(child.material) ? child.material : [child.material];
  materials.forEach(material => material.dispose());
});

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
  renderer.domElement.setAttribute("aria-label", "Интерактивный трёхмерный вид кухни. Перетаскивайте для вращения, используйте колесо или жест щипка для масштаба.");
  renderer.domElement.tabIndex = 0;
  input.container.replaceChildren(renderer.domElement);

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
      const geometry = new THREE.BoxGeometry(metres(part.dimensionsMm.width), metres(part.dimensionsMm.height), metres(part.dimensionsMm.depth));
      const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: .72, metalness: .02 });
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.moduleId = module.sourceModuleId;
      mesh.position.set(metres(part.position.x), metres(part.position.y), metres(part.position.z)); group.add(mesh);
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
    for (const module of definition.modules) { const fallback = boxPart(module); dynamic.add(fallback); if (module.kind === "glb") void replaceWithGlb(module, fallback, token); }
    const width = metres(definition.room.width);
    const contentTop = metres(Math.max(758, ...definition.modules.map(module => module.position.y + module.dimensionsMm.height / 2)));
    const targetY = Math.max(.7, contentTop / 2);
    controls.target.set(width / 2, targetY, .25);
    camera.position.set(width * .68, targetY + .8, Math.max(2.6, width * .9, contentTop * 1.7));
    controls.update(); markSelection();
  }

  const resize = () => { const width = Math.max(1, input.container.clientWidth); const height = Math.max(1, input.container.clientHeight); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(input.container); resize();
  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
  const select = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(dynamic.children, true).find(item => typeof item.object.userData.moduleId === "string"); if (hit) input.onModuleSelect?.(hit.object.userData.moduleId as string); };
  renderer.domElement.addEventListener("pointerup", select);
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  rebuild(projectStateToScene(input.state, input.visualAssets));

  return {
    update(state, visualAssets = {}) { rebuild(projectStateToScene(state, visualAssets)); },
    setSelectedModule(id) { selectedModuleId = id; markSelection(); },
    dispose() { disposed = true; generation += 1; renderer.setAnimationLoop(null); renderer.domElement.removeEventListener("pointerup", select); resizeObserver.disconnect(); controls.dispose(); disposeObject(dynamic); renderer.dispose(); renderer.domElement.remove(); },
  };
}
