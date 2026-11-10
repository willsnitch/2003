// Lossless meshopt packing of a model (the angel, 2026-11-05). Needs the meshoptimizer npm package (MIT): run it from a folder where `npm install meshoptimizer@0.22.0` was done:
//   node meshopt-pack.mjs assets/models/source/angel.glb assets/models/angel.glb
// Lossless meshopt packing of a glb's vertex and index buffers (EXT_meshopt_compression, no filters, no quantizing).
import fs from 'fs';
import { MeshoptEncoder } from 'meshoptimizer/meshopt_encoder.module.js';
import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder.module.js';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const [src, dst] = process.argv.slice(2);
const d = fs.readFileSync(src);
const L = d.readUInt32LE(12), j = JSON.parse(d.subarray(20, 20 + L).toString()), bin = d.subarray(20 + L + 8, 20 + L + 8 + d.readUInt32LE(20 + L));
const plan = new Map(); // bufferView -> {mode, stride, count}
for (const m of j.meshes) for (const p of m.primitives) {
  for (const a of Object.values(p.attributes)) { const ac = j.accessors[a]; const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[ac.type] * (ac.componentType === 5126 || ac.componentType === 5125 ? 4 : ac.componentType === 5123 || ac.componentType === 5122 ? 2 : 1); plan.set(ac.bufferView, { mode: 'ATTRIBUTES', stride: j.bufferViews[ac.bufferView].byteStride ?? n, acc: ac }); }
  if (p.indices != null) { const ac = j.accessors[p.indices]; plan.set(ac.bufferView, { mode: 'INDICES', stride: ac.componentType === 5125 ? 4 : 2, acc: ac }); }
}
for (const [bv, p] of plan) { const v = j.bufferViews[bv]; p.count = v.byteLength / p.stride; if (!Number.isInteger(p.count) || p.stride % 4 && p.mode === 'ATTRIBUTES') throw new Error('odd view ' + bv); }
const parts = []; let off = 0; const pad = () => { while (off % 4) { parts.push(Buffer.alloc(1)); off++; } };
const fallback = { byteLength: 0 }; let fbOff = 0;
const views = j.bufferViews.map((v, i) => {
  const raw = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  pad();
  if (!plan.has(i)) { parts.push(raw); const nv = { ...v, buffer: 0, byteOffset: off }; off += raw.length; return nv; }
  const p = plan.get(i), bytes = new Uint8Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
  const enc = p.mode === 'ATTRIBUTES' ? MeshoptEncoder.encodeVertexBuffer(bytes, p.count, p.stride) : MeshoptEncoder.encodeIndexSequence(p.stride === 4 ? new Uint32Array(bytes.buffer) : new Uint16Array(bytes.buffer), p.count, p.stride);
  // exact? decode and compare
  const back = new Uint8Array(p.count * p.stride);
  MeshoptDecoder.decodeGltfBuffer(back, p.count, p.stride, enc, p.mode, 'NONE');
  if (Buffer.compare(Buffer.from(back), Buffer.from(bytes)) !== 0) throw new Error('not exact: view ' + i);
  parts.push(Buffer.from(enc));
  const ext = { buffer: 0, byteOffset: off, byteLength: enc.length, byteStride: p.stride, count: p.count, mode: p.mode };
  off += enc.length;
  fbOff = Math.ceil(fbOff / 4) * 4;
  const nv = { buffer: 1, byteOffset: fbOff, byteLength: v.byteLength, ...(v.byteStride ? { byteStride: v.byteStride } : {}), ...(v.target ? { target: v.target } : {}), extensions: { EXT_meshopt_compression: ext } };
  fbOff += v.byteLength;
  console.log('view', i, p.mode, v.byteLength, '->', enc.length);
  return nv;
});
pad();
const body = Buffer.concat(parts);
j.bufferViews = views;
j.buffers = [{ byteLength: body.length }, { byteLength: fbOff, extensions: { EXT_meshopt_compression: { fallback: true } } }];
j.extensionsUsed = [...new Set([...(j.extensionsUsed ?? []), 'EXT_meshopt_compression'])];
j.extensionsRequired = [...new Set([...(j.extensionsRequired ?? []), 'EXT_meshopt_compression'])];
let json = Buffer.from(JSON.stringify(j)); while (json.length % 4) json = Buffer.concat([json, Buffer.from(' ')]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + body.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
fs.writeFileSync(dst, Buffer.concat([head, ch(json.length, 0x4e4f534a), json, ch(body.length, 0x004e4942), body]));
console.log(src.split('/').pop(), d.length, '->', fs.statSync(dst).size);
