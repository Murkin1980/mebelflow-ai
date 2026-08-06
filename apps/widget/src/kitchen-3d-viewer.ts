import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { projectStateToScene, type SceneModule, type VisualAssetRef } from "../../../packages/visual-scene-engine/src/index.js";
import type { FurnitureProjectState } from "../../../packages/project-state/src/schema.js";

export type Kitchen3DViewerOptions = {
  projectState: FurnitureProjectState;
  visualAssets?: Record<string, VisualAssetRef>;
  selectedModuleId?: string | null;
  onModuleSelect?: (moduleId: string) => void;
};

const MM = 0.001;
const SELECTED = 0xc79a3b;

export class Kitchen3DViewer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
  private readonly controls: OrbitControls;
  private readonly content = new THREE.Group();
  private readonly loader = new GLTFLoader();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private options: Kitchen3DViewerOptions;
  private selectedModuleId: string | null;
  private disposed = false;

  constructor(private readonly container: HTMLElement, options: Kitchen3DViewerOptions) {
    this.options = options;
    this.selectedModuleId = options.selectedModuleId ?? null;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    this.renderer.domElement.setAttribute("aria-label", "Интерактивный трёхмерный вид предварительной кухни");
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.tabIndex = 0;
    this.container.replaceChildren(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xfff7ff);
    this.scene.add(this.content);

    this.camera.position.set(4.2, 2.8, 4.6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 12;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.target.set(1.5, 1, 0.2);

    this.scene.add(new THREE.HemisphereLight(0xfffbf3, 0x6d6172, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffe2b0, 1.25);
    fill.position.set(-4, 2, 2);
    this.scene.add(fill);

    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.rebuild();
    this.resize();
    this.animate();
  }

  update(options: Kitchen3DViewerOptions) {
    this.options = options;
    this.selectedModuleId = options.selectedModuleId ?? this.selectedModuleId;
    this.rebuild();
  }

  select(moduleId: string | null, focus = false) {
    this.selectedModuleId = moduleId;
    this.applySelection();
    if (focus && moduleId) this.focusModule(moduleId);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.controls.dispose();
    this.clearContent();
    this.renderer.dispose();
    this.container.replaceChildren();
  }

  private animate = () => {
    if (this.disposed) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private rebuild() {
    this.clearContent();
    const definition = projectStateToScene(this.options.projectState, this.options.visualAssets ?? {});
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(definition.floor.width * MM, definition.floor.depth * MM),
      new THREE.MeshStandardMaterial({ color: 0xf3e7d1, roughness: 0.92 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(definition.wall.width * MM / 2, 0, definition.floor.depth * MM / 2 - 0.35);
    floor.userData.nonSelectable = true;
    this.content.add(floor);
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(definition.wall.width * MM, definition.wall.height * MM),
      new THREE.MeshStandardMaterial({ color: 0xf7f1e8, roughness: 1, side: THREE.DoubleSide }),
    );
    wall.position.set(definition.wall.width * MM / 2, definition.wall.height * MM / 2, -0.015);
    wall.userData.nonSelectable = true;
    this.content.add(wall);

    for (const module of definition.modules) {
      if (module.kind === "glb" && module.glbUrl && module.assetDimensionsMm) this.addGlb(module);
      else this.content.add(this.createParametricModule(module));
    }
    this.applySelection();
    const centerX = definition.wall.width * MM / 2;
    this.controls.target.set(centerX, Math.min(1.15, definition.wall.height * MM / 2), 0.2);
    if (this.camera.position.x === 4.2) this.camera.position.set(centerX + 3.2, 2.5, 4.2);
  }

  private createParametricModule(module: SceneModule) {
    const group = new THREE.Group();
    group.name = module.id;
    group.userData.moduleId = module.sourceModuleId;
    group.position.set(module.position.x * MM, module.position.y * MM, module.position.z * MM);
    const { width, depth, height } = module.dimensionsMm;
    const carcass = new THREE.Mesh(
      new THREE.BoxGeometry(width * MM, height * MM, depth * MM),
      new THREE.MeshStandardMaterial({ color: module.colors.carcass, roughness: 0.72 }),
    );
    carcass.userData.moduleId = module.sourceModuleId;
    group.add(carcass);
    const facadeGap = width >= 700 ? 0.012 : 0.006;
    const facade = new THREE.Mesh(
      new THREE.BoxGeometry(width * MM - facadeGap, height * MM - 0.018, 0.018),
      new THREE.MeshStandardMaterial({ color: module.colors.facade, roughness: 0.58 }),
    );
    facade.position.z = depth * MM / 2 + 0.011;
    facade.userData.moduleId = module.sourceModuleId;
    group.add(facade);
    if (module.row === "lower" && !module.moduleType.includes("tall") && module.moduleType !== "fridge") {
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(width * MM + 0.01, 0.04, depth * MM + 0.035),
        new THREE.MeshStandardMaterial({ color: module.colors.countertop, roughness: 0.48 }),
      );
      top.position.y = height * MM / 2 + 0.02;
      top.userData.moduleId = module.sourceModuleId;
      group.add(top);
    }
    return group;
  }

  private addGlb(module: SceneModule) {
    const fallbackTimer = window.setTimeout(() => {
      if (!this.content.getObjectByName(module.id)) this.content.add(this.createParametricModule(module));
    }, 8_000);
    this.loader.load(module.glbUrl!, gltf => {
      window.clearTimeout(fallbackTimer);
      if (this.disposed) return;
      const root = gltf.scene;
      root.name = module.id;
      root.userData.moduleId = module.sourceModuleId;
      const asset = module.assetDimensionsMm!;
      root.scale.set(module.dimensionsMm.width / asset.width, module.dimensionsMm.height / asset.height, module.dimensionsMm.depth / asset.depth);
      root.scale.multiplyScalar(MM);
      const bounds = new THREE.Box3().setFromObject(root);
      const center = bounds.getCenter(new THREE.Vector3());
      root.position.set(module.position.x * MM - center.x, -bounds.min.y, module.position.z * MM - center.z);
      root.traverse(child => { child.userData.moduleId = module.sourceModuleId; });
      this.content.add(root);
      this.applySelection();
    }, undefined, error => {
      window.clearTimeout(fallbackTimer);
      console.warn("MebelFlow 3D: GLB asset unavailable, using parametric fallback.", error);
      if (!this.disposed && !this.content.getObjectByName(module.id)) this.content.add(this.createParametricModule(module));
    });
  }

  private applySelection() {
    this.content.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const selected = object.userData.moduleId === this.selectedModuleId;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (material.userData.baseEmissive === undefined) material.userData.baseEmissive = material.emissive.getHex();
        material.emissive.setHex(selected ? SELECTED : material.userData.baseEmissive as number);
        material.emissiveIntensity = selected ? 0.28 : 0;
      }
    });
  }

  private focusModule(moduleId: string) {
    let target: THREE.Object3D | undefined;
    this.content.traverse(item => { if (!target && item.userData.moduleId === moduleId) target = item; });
    if (!target) return;
    const center = new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());
    this.controls.target.copy(center);
  }

  private onPointerUp = (event: PointerEvent) => {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.content.children, true).find(item => item.object.userData.moduleId);
    const moduleId = hit?.object.userData.moduleId as string | undefined;
    if (!moduleId) return;
    this.select(moduleId);
    this.options.onModuleSelect?.(moduleId);
  };

  private clearContent() {
    this.content.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    });
    this.content.clear();
  }
}
