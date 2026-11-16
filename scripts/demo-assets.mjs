// Baixa as imagens demonstrativas, otimiza, recorta a vista de topo no prato
// e gera os modelos GLB em escala real. Executado pelo workflow "Demo assets".
//   node scripts/demo-assets.mjs            (baixa do manifesto)
//   node scripts/demo-assets.mjs --models   (só regenera os GLB a partir do que já existe)
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import sharp from "sharp";
import { buildGlb, glbBounds } from "../src/lib/glb.ts";
import { DEMO_MODEL_SPECS } from "../src/data/demo.ts";
import { hybridDish } from "./optimize-glb.mjs";

const OUT = new URL("../public/demo/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("./demo-sources.json", import.meta.url), "utf8"));
const modelsOnly = process.argv.includes("--models");
const ROOT = manifest.base.replace(/\d{8}_$/, "");
const WIDE = new Set(["cover", "salon", "chef"]);
await mkdir(OUT, { recursive: true });
const exists = (u) => access(u).then(() => true, () => false);

/** Encontra o prato (claro) sobre o fundo preto e devolve o quadrado que o contém. */
async function plateSquare(buf) {
  const size = 256;
  const { data } = await sharp(buf).resize(size, size, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let x0 = size, x1 = 0, y0 = size, y1 = 0;
  const cols = new Array(size).fill(0), rows = new Array(size).fill(0);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y * size + x] > 70) { cols[x]++; rows[y]++; }
  for (let i = 0; i < size; i++) {
    if (cols[i] > size * 0.04) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); }
    if (rows[i] > size * 0.04) { y0 = Math.min(y0, i); y1 = Math.max(y1, i); }
  }
  if (x1 <= x0 || y1 <= y0) return null;
  const side = Math.max(x1 - x0, y1 - y0) + 2;
  return { cx: (x0 + x1 + 1) / 2 / size, cy: (y0 + y1 + 1) / 2 / size, side: Math.min(1, side / size) };
}

let failed = 0;
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
// Fotos cinematográficas em ângulo (4:5) usadas no cardápio e na página do prato.
if (!modelsOnly) {
  for (const [id, key] of Object.entries(manifest.heroes ?? {})) {
    const out = new URL(`${id}-hero.jpg`, OUT);
    if (await exists(out)) continue;
    try {
      const res = await fetch(`${ROOT}${key}.png`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 1080, withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toFile(out.pathname);
      console.log(`★ ${id}-hero`);
    } catch (e) { failed++; console.error(`✗ ${id}-hero: ${e.message}`); }
  }
}
// Modelos com volume real: comida em 3D (imagem→3D) sobre a louça procedural em escala.
const food3d = manifest.food3d ?? {};
if (!modelsOnly) {
  for (const [id, key] of Object.entries(food3d)) {
    const spec = DEMO_MODEL_SPECS.find((s) => s.id === id);
    const stamp = new URL(`${id}.3d`, OUT);
    if (!spec || ((await exists(stamp)) && (await readFile(stamp, "utf8")) === key)) continue;
    try {
      const res = await fetch(`${ROOT}${key}.glb`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { glb, size } = await hybridDish(new Uint8Array(await res.arrayBuffer()), spec);
      await writeFile(new URL(`${id}.glb`, OUT), glb);
      await writeFile(stamp, key);
      console.log(`⬢ ${id}.glb (3D) ${(glb.byteLength / 1048576).toFixed(2)} MB — ${size.map((v) => (v * 100).toFixed(1)).join(" × ")} cm`);
    } catch (e) { failed++; console.error(`✗ ${id} 3D: ${e.message}`); }
  }
}
// Experimentos de imagem→3D: baixados sem alteração para avaliação.
if (!modelsOnly) {
  await mkdir(new URL("lab/", OUT), { recursive: true });
  for (const [name, key] of Object.entries(manifest.lab ?? {})) {
    const out = new URL(`lab/${name}`, OUT);
    if (await exists(out)) continue;
    const res = await fetch(`${ROOT}${key}`);
    if (!res.ok) { console.error(`✗ lab/${name}: HTTP ${res.status}`); continue; }
    const buf = new Uint8Array(await res.arrayBuffer());
    await writeFile(out, buf);
    const b = glbBounds(buf);
    console.log(`⬡ lab/${name} ${(buf.byteLength / 1048576).toFixed(1)} MB — caixa ${b.width.toFixed(3)} × ${b.depth.toFixed(3)} × ${b.height.toFixed(3)}`);
  }
}
if (!modelsOnly && only !== "heroes") {
  for (const [id, key] of Object.entries(manifest.images)) {
    try {
      const res = await fetch(`${manifest.base}${key}.png`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata();
      await sharp(buf).resize({ width: WIDE.has(id) ? 1500 : 1000, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(new URL(`${id}.jpg`, OUT).pathname);
      const spec = DEMO_MODEL_SPECS.find((s) => s.id === id);
      if (spec && (spec.shape === "plate" || spec.shape === "bowl")) {
        const sq = (await plateSquare(buf)) ?? { cx: 0.5, cy: 0.5, side: 0.9 };
        const side = Math.round(sq.side * meta.width);
        const left = Math.max(0, Math.min(meta.width - side, Math.round(sq.cx * meta.width - side / 2)));
        const top = Math.max(0, Math.min(meta.height - side, Math.round(sq.cy * meta.height - side / 2)));
        await sharp(buf).extract({ left, top, width: side, height: side }).resize(768, 768).jpeg({ quality: 82, mozjpeg: true }).toFile(new URL(`${id}-top.jpg`, OUT).pathname);
        console.log(`✓ ${id} (prato ${Math.round(sq.side * 100)}% do quadro)`);
      } else console.log(`✓ ${id}`);
    } catch (e) { failed++; console.error(`✗ ${id}: ${e.message}`); }
  }
}

for (const spec of only === "heroes" ? [] : DEMO_MODEL_SPECS.filter((s) => !food3d[s.id])) {
  const top = new URL(`${spec.id}-top.jpg`, OUT);
  const textured = spec.shape === "plate" || spec.shape === "bowl";
  const texture = textured && (await exists(top)) ? new Uint8Array(await readFile(top)) : undefined;
  if (textured && !texture) { console.warn(`· ${spec.id}: sem foto de topo, modelo não gerado`); continue; }
  const glb = buildGlb({ ...spec, texture });
  const b = glbBounds(glb);
  await writeFile(new URL(`${spec.id}.glb`, OUT), glb);
  console.log(`◆ ${spec.id}.glb ${(glb.byteLength / 1024).toFixed(0)} KB — ${(b.width * 100).toFixed(1)} × ${(b.depth * 100).toFixed(1)} × ${(b.height * 100).toFixed(1)} cm`);
}
if (failed) { console.error(`${failed} imagem(ns) falharam`); process.exit(1); }
