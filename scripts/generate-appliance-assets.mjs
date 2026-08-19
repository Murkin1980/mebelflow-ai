import { mkdir, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

const out = "apps/widget/public/assets";
const exporter = new GLTFExporter();
const material = (color, metalness = 0.05, roughness = 0.65) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });
const white = material("#e8e5de"),
  graphite = material("#282a2b", 0.35, 0.32),
  steel = material("#a8abad", 0.72, 0.25),
  glass = material("#202527", 0.25, 0.14);
const box = (group, name, size, position, mat = white) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
};
const cylinder = (
  group,
  name,
  radius,
  depth,
  position,
  rotation = [Math.PI / 2, 0, 0],
  mat = graphite,
  segments = 24,
) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
};
const root = (name) => {
  const group = new THREE.Group();
  group.name = name;
  return group;
};
const handle = (g, width, y, z) => box(g, "handle", [Math.min(0.32, width * 0.55), 0.018, 0.022], [0, y, z], graphite);

function fridge() {
  const g = root("mf-fridge-600");
  box(g, "body", [0.6, 2, 0.65], [0, 1, 0]);
  box(g, "upper-door", [0.576, 1.22, 0.024], [0, 1.35, 0.337], steel);
  box(g, "lower-door", [0.576, 0.69, 0.024], [0, 0.38, 0.337], steel);
  box(g, "upper-handle", [0.022, 0.46, 0.025], [0.255, 1.2, 0.355], graphite);
  box(g, "lower-handle", [0.022, 0.3, 0.025], [0.255, 0.48, 0.355], graphite);
  return g;
}
function dishwasher(width) {
  const g = root(`mf-dishwasher-${Math.round(width * 1000)}`);
  box(g, "body", [width, 0.82, 0.56], [0, 0.41, 0], steel);
  box(g, "door", [width - 0.016, 0.72, 0.025], [0, 0.39, 0.292], white);
  box(g, "control-strip", [width - 0.035, 0.07, 0.03], [0, 0.75, 0.296], graphite);
  handle(g, width, 0.695, 0.318);
  for (let x = -0.12; x <= 0.12; x += 0.08)
    cylinder(g, "control", 0.008, 0.008, [x, 0.752, 0.316], [Math.PI / 2, 0, 0], steel, 12);
  return g;
}
function ovenBase() {
  const g = root("mf-oven-base-600");
  box(g, "cabinet", [0.6, 0.72, 0.56], [0, 0.36, 0]);
  box(g, "oven-frame", [0.56, 0.58, 0.035], [0, 0.41, 0.298], graphite);
  box(g, "oven-glass", [0.47, 0.32, 0.012], [0, 0.36, 0.32], glass);
  box(g, "control-panel", [0.47, 0.105, 0.015], [0, 0.625, 0.32], steel);
  handle(g, 0.6, 0.535, 0.34);
  cylinder(g, "dial-left", 0.027, 0.012, [-0.15, 0.625, 0.34], [Math.PI / 2, 0, 0], graphite);
  cylinder(g, "dial-right", 0.027, 0.012, [0.15, 0.625, 0.34], [Math.PI / 2, 0, 0], graphite);
  return g;
}
function washingMachine() {
  const g = root("mf-washing-machine-600");
  box(g, "body", [0.6, 0.82, 0.56], [0, 0.41, 0]);
  box(g, "front", [0.57, 0.76, 0.025], [0, 0.4, 0.292], white);
  cylinder(g, "door-ring", 0.19, 0.035, [0, 0.36, 0.315], [Math.PI / 2, 0, 0], graphite, 40);
  cylinder(g, "door-glass", 0.145, 0.038, [0, 0.36, 0.334], [Math.PI / 2, 0, 0], glass, 40);
  box(g, "control-panel", [0.54, 0.1, 0.018], [0, 0.725, 0.315], steel);
  cylinder(g, "dial", 0.032, 0.018, [0.14, 0.725, 0.337], [Math.PI / 2, 0, 0], graphite);
  return g;
}
function tallOven() {
  const g = root("mf-oven-tall-600");
  box(g, "cabinet", [0.6, 2.2, 0.56], [0, 1.1, 0]);
  box(g, "oven-frame", [0.56, 0.6, 0.035], [0, 1.02, 0.298], graphite);
  box(g, "oven-glass", [0.47, 0.34, 0.012], [0, 0.97, 0.32], glass);
  handle(g, 0.6, 1.16, 0.34);
  box(g, "upper-door", [0.56, 0.55, 0.025], [0, 1.82, 0.298], white);
  box(g, "lower-door", [0.56, 0.48, 0.025], [0, 0.33, 0.298], white);
  return g;
}

const assets = [
  ["mf-fridge-600.glb", fridge()],
  ["mf-dishwasher-450.glb", dishwasher(0.45)],
  ["mf-dishwasher-600.glb", dishwasher(0.6)],
  ["mf-oven-base-600.glb", ovenBase()],
  ["mf-washing-machine-600.glb", washingMachine()],
  ["mf-oven-tall-600.glb", tallOven()],
];
await mkdir(out, { recursive: true });
for (const [filename, scene] of assets) {
  const data = await exporter.parseAsync(scene, { binary: true, onlyVisible: true });
  await writeFile(`${out}/${filename}`, Buffer.from(data));
  console.log(`${filename}: ${data.byteLength} bytes`);
}
