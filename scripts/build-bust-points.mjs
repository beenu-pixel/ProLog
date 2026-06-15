// Generator chmury punktów-skorupy popiersia Marka Aureliusza.
//
// Wczytuje wysokopoligonowy skan STL (CC0, Creazilla #73323), normalizuje
// orientację i skalę, po czym RÓWNOMIERNIE próbkuje POWIERZCHNIĘ (a nie wnętrze)
// przez MeshSurfaceSampler. Zapisuje kompaktowy plik binarny:
//   [uint32 count][float32 pos x,y,z * count][float32 nrm x,y,z * count]
// Pozycje + normalne pozwalają w przeglądarce zrobić skorupę z poprawnym
// przesłanianiem. Mesh NIE trafia do bundla — wozimy tylko punkty (~MB).
//
// Uruchom: node scripts/build-bust-points.mjs <input.stl> [count]

import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

const input = process.argv[2];
const COUNT = Number(process.argv[3] || 60000);
const OUT = "public/marcus-points.bin";

if (!input) {
  console.error("Użycie: node scripts/build-bust-points.mjs <input.stl> [count]");
  process.exit(1);
}

const buf = readFileSync(input);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const geo = new STLLoader().parse(ab);
geo.computeVertexNormals();

// Orientacja: skany do druku są zwykle Z-up. Jeśli oś Z jest najwyższa,
// obracamy o -90° wokół X, by popiersie stało pionowo (Y-up).
geo.computeBoundingBox();
let size = new THREE.Vector3();
geo.boundingBox.getSize(size);
if (size.z > size.y) {
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
}

// Wyśrodkowanie i skala do wysokości 2 jednostek.
geo.computeBoundingBox();
const center = new THREE.Vector3();
geo.boundingBox.getCenter(center);
geo.translate(-center.x, -center.y, -center.z);
geo.computeBoundingBox();
geo.boundingBox.getSize(size);
const scale = 2 / size.y;
geo.scale(scale, scale, scale);

const mesh = new THREE.Mesh(geo);
const sampler = new MeshSurfaceSampler(mesh).build();

const pos = new Float32Array(COUNT * 3);
const nrm = new Float32Array(COUNT * 3);
const p = new THREE.Vector3();
const n = new THREE.Vector3();
for (let i = 0; i < COUNT; i++) {
  sampler.sample(p, n);
  pos[i * 3] = p.x;
  pos[i * 3 + 1] = p.y;
  pos[i * 3 + 2] = p.z;
  nrm[i * 3] = n.x;
  nrm[i * 3 + 1] = n.y;
  nrm[i * 3 + 2] = n.z;
}

const header = new Uint32Array([COUNT]);
const out = Buffer.concat([
  Buffer.from(header.buffer),
  Buffer.from(pos.buffer),
  Buffer.from(nrm.buffer),
]);
writeFileSync(OUT, out);
console.log(
  `Zapisano ${OUT}: ${COUNT} punktów, ${(out.length / 1024 / 1024).toFixed(2)} MB`
);
