import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdir, writeFile } from "node:fs/promises";

globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`; this.onloadend?.(); }); }
};

const out = "apps/widget/public/assets";
const exporter = new GLTFExporter();
const material = (color, metalness = .05, roughness = .65) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
const white = material("#e8e5de"), graphite = material("#282a2b", .35, .32), steel = material("#a8abad", .72, .25), glass = material("#202527", .25, .14);
const box = (group, name, size, position, mat = white) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); mesh.name = name; mesh.position.set(...position); group.add(mesh); return mesh; };
const cylinder = (group, name, radius, depth, position, rotation = [Math.PI / 2, 0, 0], mat = graphite, segments = 24) => { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), mat); mesh.name = name; mesh.position.set(...position); mesh.rotation.set(...rotation); group.add(mesh); return mesh; };
const root = name => { const group = new THREE.Group(); group.name = name; return group; };
const handle = (g, width, y, z) => box(g, "handle", [Math.min(.32, width * .55), .018, .022], [0, y, z], graphite);

function fridge() {
  const g = root("mf-fridge-600"); box(g, "body", [.6, 2, .65], [0, 1, 0]);
  box(g, "upper-door", [.576, 1.22, .024], [0, 1.35, .337], steel); box(g, "lower-door", [.576, .69, .024], [0, .38, .337], steel);
  box(g, "upper-handle", [.022, .46, .025], [.255, 1.2, .355], graphite); box(g, "lower-handle", [.022, .3, .025], [.255, .48, .355], graphite);
  return g;
}
function dishwasher(width) {
  const g = root(`mf-dishwasher-${Math.round(width * 1000)}`); box(g, "body", [width, .82, .56], [0, .41, 0], steel);
  box(g, "door", [width - .016, .72, .025], [0, .39, .292], white); box(g, "control-strip", [width - .035, .07, .03], [0, .75, .296], graphite); handle(g, width, .695, .318);
  for (let x = -.12; x <= .12; x += .08) cylinder(g, "control", .008, .008, [x, .752, .316], [Math.PI / 2, 0, 0], steel, 12);
  return g;
}
function ovenBase() {
  const g = root("mf-oven-base-600"); box(g, "cabinet", [.6, .72, .56], [0, .36, 0]);
  box(g, "oven-frame", [.56, .58, .035], [0, .41, .298], graphite); box(g, "oven-glass", [.47, .32, .012], [0, .36, .32], glass); box(g, "control-panel", [.47, .105, .015], [0, .625, .32], steel); handle(g, .6, .535, .34);
  cylinder(g, "dial-left", .027, .012, [-.15, .625, .34], [Math.PI / 2, 0, 0], graphite); cylinder(g, "dial-right", .027, .012, [.15, .625, .34], [Math.PI / 2, 0, 0], graphite);
  return g;
}
function washingMachine() {
  const g = root("mf-washing-machine-600"); box(g, "body", [.6, .82, .56], [0, .41, 0]); box(g, "front", [.57, .76, .025], [0, .4, .292], white);
  cylinder(g, "door-ring", .19, .035, [0, .36, .315], [Math.PI / 2, 0, 0], graphite, 40); cylinder(g, "door-glass", .145, .038, [0, .36, .334], [Math.PI / 2, 0, 0], glass, 40);
  box(g, "control-panel", [.54, .1, .018], [0, .725, .315], steel); cylinder(g, "dial", .032, .018, [.14, .725, .337], [Math.PI / 2, 0, 0], graphite);
  return g;
}
function tallOven() {
  const g = root("mf-oven-tall-600"); box(g, "cabinet", [.6, 2.2, .56], [0, 1.1, 0]);
  box(g, "oven-frame", [.56, .6, .035], [0, 1.02, .298], graphite); box(g, "oven-glass", [.47, .34, .012], [0, .97, .32], glass); handle(g, .6, 1.16, .34);
  box(g, "upper-door", [.56, .55, .025], [0, 1.82, .298], white); box(g, "lower-door", [.56, .48, .025], [0, .33, .298], white);
  return g;
}

const assets = [
  ["mf-fridge-600.glb", fridge()], ["mf-dishwasher-450.glb", dishwasher(.45)], ["mf-dishwasher-600.glb", dishwasher(.6)],
  ["mf-oven-base-600.glb", ovenBase()], ["mf-washing-machine-600.glb", washingMachine()], ["mf-oven-tall-600.glb", tallOven()],
];
await mkdir(out, { recursive: true });
for (const [filename, scene] of assets) {
  const data = await exporter.parseAsync(scene, { binary: true, onlyVisible: true });
  await writeFile(`${out}/${filename}`, Buffer.from(data));
  console.log(`${filename}: ${data.byteLength} bytes`);
}
