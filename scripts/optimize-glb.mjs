// Normaliza um GLB vindo de fotogrametria ou de imagem→3D para uso em AR:
// apoia a base em y=0, centraliza, escala para as dimensões reais (metros)
// e reduz as texturas. Uso: node scripts/optimize-glb.mjs entrada.glb saida.glb larguraCm [profCm]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, getBounds, mergeDocuments, prune, simplify, unpartition, weld } from "@gltf-transform/functions";
import { buildGlb } from "../src/lib/glb.ts";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

export async function optimizeGlb(input, { widthCm, depthCm = widthCm, textureSize = 1024, maxTriangles = 40000, liftCm = 0, returnDoc = false }) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = typeof input === "string" ? await io.read(input) : await io.readBinary(input);
  const scene = doc.getRoot().listScenes()[0];
  await MeshoptSimplifier.ready;
  const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3, 0);
  await doc.transform(dedup(), flatten(), weld(), ...(tris > maxTriangles ? [simplify({ simplifier: MeshoptSimplifier, ratio: maxTriangles / tris, error: 0.002 })] : []), prune());

  const b = getBounds(scene);
  const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  // escala uniforme: o maior lado horizontal passa a medir o maior lado cadastrado
  const k = (Math.max(widthCm, depthCm) / 100) / Math.max(size[0], size[2]);
  const root = doc.createNode("escala-real").setScale([k, k, k]).setTranslation([-(b.min[0] + b.max[0]) / 2 * k, -b.min[1] * k + liftCm / 100, -(b.min[2] + b.max[2]) / 2 * k]);
  for (const child of scene.listChildren()) { scene.removeChild(child); root.addChild(child); }
  scene.addChild(root);

  for (const tex of doc.getRoot().listTextures()) {
    const img = tex.getImage();
    if (!img) continue;
    const isNormal = tex.listParents().some((p) => p.propertyType === "Material" && p.getNormalTexture() === tex);
    const out = await sharp(img).resize(textureSize, textureSize, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: isNormal ? 92 : 84, mozjpeg: true }).toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType("image/jpeg");
  }
  if (returnDoc) return { doc };
  const nb = getBounds(scene);
  return { glb: await io.writeBinary(doc), size: [nb.max[0] - nb.min[0], nb.max[1] - nb.min[1], nb.max[2] - nb.min[2]] };
}

/**
 * Modelo híbrido: louça procedural perfeita nas medidas reais + comida em 3D com volume.
 * `foodFrac` = fração do diâmetro da louça ocupada pela comida.
 */
export async function hybridDish(foodInput, { shape = "plate", widthCm, depthCm = widthCm, foodFrac = shape === "bowl" ? 0.5 : 0.62, textureSize = 1024 }) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const rimCm = shape === "bowl" ? 5 : 2.5;
  const floorCm = shape === "bowl" ? rimCm * 0.18 : rimCm * 0.3;
  const plate = await io.readBinary(buildGlb({ shape, widthCm, depthCm, heightCm: rimCm }));
  const side = Math.min(widthCm, depthCm) * foodFrac;
  const { doc: food } = await optimizeGlb(foodInput, { widthCm: side, textureSize, liftCm: floorCm - 0.15, returnDoc: true });
  mergeDocuments(plate, food);
  const root = plate.getRoot();
  const [main, extra] = root.listScenes();
  for (const n of extra.listChildren()) { extra.removeChild(n); main.addChild(n); }
  extra.dispose();
  root.setDefaultScene(main);
  await plate.transform(unpartition(), prune());
  const b = getBounds(main);
  return { glb: await io.writeBinary(plate), size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , src, dst, w, d] = process.argv;
  const { writeFile } = await import("node:fs/promises");
  const { glb, size } = await optimizeGlb(src, { widthCm: +w, depthCm: +(d ?? w) });
  await writeFile(dst, glb);
  console.log(`${dst}: ${(glb.byteLength / 1048576).toFixed(2)} MB — ${size.map((v) => (v * 100).toFixed(1)).join(" × ")} cm (L × A × P)`);
}
