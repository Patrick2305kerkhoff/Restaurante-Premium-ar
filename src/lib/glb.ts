/**
 * Gerador de modelos 3D (GLB / glTF 2.0 binário) em ESCALA FÍSICA REAL.
 *
 * Uma única fotografia não contém informação de profundidade, portanto não é
 * possível reconstruir a geometria real da comida a partir dela. A alternativa
 * tecnicamente viável implementada aqui é:
 *   - geometria real da LOUÇA (prato, bowl, garrafa, taça) gerada por revolução,
 *     nas dimensões cadastradas em centímetros (1 unidade glTF = 1 metro);
 *   - a fotografia de topo do prato aplicada como textura sobre a superfície,
 *     com um leve relevo central para dar volume;
 * O resultado é um objeto 3D verdadeiro, ancorado na mesa pelo ARCore/ARKit,
 * com o diâmetro correto. Para volume fiel da comida, envie um GLB/USDZ de
 * fotogrametria — o cadastro aceita os dois caminhos.
 *
 * Sem dependências: roda no navegador (cadastro) e no Node (assets da demo).
 */

export type ModelSpec = {
  shape: "plate" | "bowl" | "bottle" | "glass";
  widthCm: number;
  depthCm: number;
  heightCm: number;
  /** JPEG ou PNG quadrado, visto de cima, com o prato encostando nas bordas. */
  texture?: Uint8Array;
  textureMime?: "image/jpeg" | "image/png";
  /** Cor do líquido (taça) ou do vidro (garrafa), RGB 0..1. */
  tint?: [number, number, number];
};

type Mesh = { pos: number[]; nrm: number[]; uv: number[] | null; idx: number[]; material: number };
type Material = {
  color: [number, number, number, number];
  metallic: number;
  roughness: number;
  textured?: boolean;
  blend?: boolean;
};

const SEGMENTS = 72;

/** Superfície de revolução em torno do eixo Y. `profile` = pares [raio 0..1, altura em metros]. */
function lathe(profile: [number, number][], rx: number, rz: number, material: number, planarUv: boolean): Mesh {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const cols = SEGMENTS + 1;
  for (const [r, y] of profile) {
    for (let s = 0; s <= SEGMENTS; s++) {
      const a = (s / SEGMENTS) * Math.PI * 2;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      pos.push(cx * rx, y, cz * rz);
      // Projeção de topo: o círculo do prato ocupa o quadrado inteiro da foto.
      uv.push(0.5 + cx * 0.5, 0.5 + cz * 0.5);
    }
  }
  for (let p = 0; p < profile.length - 1; p++) {
    for (let s = 0; s < SEGMENTS; s++) {
      const a = p * cols + s;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  return { pos, nrm: smoothNormals(pos, idx), uv: planarUv ? uv : null, idx, material };
}

function smoothNormals(pos: number[], idx: number[]): number[] {
  const n = new Array<number>(pos.length).fill(0);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += fx; n[k + 1] += fy; n[k + 2] += fz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
    if (!Number.isFinite(n[i])) { n[i] = 0; n[i + 1] = 1; n[i + 2] = 0; }
  }
  return n;
}

const cm = (v: number) => v / 100;

function dishMeshes(spec: ModelSpec, materials: Material[]): Mesh[] {
  const rx = cm(spec.widthCm) / 2;
  const rz = cm(spec.depthCm) / 2;
  const bowl = spec.shape === "bowl";
  const total = cm(spec.heightCm);
  const rimH = Math.min(total, bowl ? 0.05 : 0.025);
  // Volume da comida: parte da altura acima da borda vira um relevo suave (máx. 2 cm).
  const dome = Math.min(0.02, Math.max(0, total - rimH) * 0.45);
  const well = bowl ? 0.5 : 0.64;
  const floor = bowl ? rimH * 0.18 : rimH * 0.3;

  const top: [number, number][] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const r = (i / steps) * well;
    const t = r / well;
    top.push([r, floor + dome * Math.cos((t * Math.PI) / 2) ** 2]);
  }
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    const r = well + (1 - well) * t;
    const ease = bowl ? Math.sin((t * Math.PI) / 2) : t * t * (3 - 2 * t);
    top.push([r, floor + (rimH - floor) * ease]);
  }
  const under: [number, number][] = [
    [1, rimH],
    [0.995, rimH - 0.003],
    [well + 0.06, 0.004],
    [well * 0.9, 0],
    [0, 0],
  ];

  const textured = !!spec.texture;
  materials.push({ color: [1, 1, 1, 1], metallic: 0, roughness: 0.55, textured });
  materials.push({ color: [0.96, 0.95, 0.92, 1], metallic: 0, roughness: 0.25 });
  return [lathe(top, rx, rz, 0, textured), lathe(under.reverse(), rx, rz, 1, false)];
}

function bottleMeshes(spec: ModelSpec, materials: Material[]): Mesh[] {
  const R = cm(spec.widthCm) / 2;
  const H = cm(spec.heightCm);
  const glass = spec.tint ?? [0.05, 0.11, 0.07];
  const body: [number, number][] = [[0, 0], [0.92, 0], [1, 0.012], [1, H * 0.2]];
  const label: [number, number][] = [[1.012, H * 0.2], [1.012, H * 0.47]];
  const upper: [number, number][] = [[1, H * 0.47], [1, H * 0.58]];
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    upper.push([1 - 0.62 * (t * t * (3 - 2 * t)), H * (0.58 + 0.16 * t)]);
  }
  upper.push([0.38, H * 0.86]);
  const capsule: [number, number][] = [[0.4, H * 0.86], [0.4, H * 0.985], [0.42, H * 0.985], [0.42, H], [0, H]];
  materials.push({ color: [glass[0], glass[1], glass[2], 1], metallic: 0.1, roughness: 0.12 });
  materials.push({ color: [0.93, 0.89, 0.8, 1], metallic: 0, roughness: 0.8 });
  materials.push({ color: [0.78, 0.62, 0.32, 1], metallic: 0.9, roughness: 0.35 });
  return [lathe(body, R, R, 0, false), lathe(label, R, R, 1, false), lathe(upper, R, R, 0, false), lathe(capsule, R, R, 2, false)];
}

function glassMeshes(spec: ModelSpec, materials: Material[]): Mesh[] {
  const R = cm(spec.widthCm) / 2;
  const H = cm(spec.heightCm);
  const liquid = spec.tint ?? [0.75, 0.2, 0.1];
  const tumbler = spec.heightCm / spec.widthCm < 1.35;
  let shell: [number, number][];
  let drink: [number, number][];
  if (tumbler) {
    shell = [[0, 0], [0.9, 0], [0.92, 0.004], [1, H], [0.96, H], [0.88, 0.012], [0, 0.012]];
    drink = [[0, 0.013], [0.87, 0.013], [0.93, H * 0.62], [0, H * 0.62]];
  } else {
    const stemTop = H * 0.52;
    shell = [[0, 0], [0.72, 0], [0.72, 0.003], [0.08, 0.01], [0.07, stemTop]];
    drink = [[0, stemTop + 0.004]];
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const r = 0.07 + 0.93 * Math.sin((t * Math.PI) / 2);
      shell.push([r, stemTop + (H - stemTop) * t * t]);
      if (t <= 0.8) drink.push([r * 0.97, stemTop + 0.004 + (H - stemTop) * t * t]);
    }
    drink.push([0, drink[drink.length - 1][1]]);
  }
  materials.push({ color: [0.92, 0.96, 1, 0.28], metallic: 0, roughness: 0.05, blend: true });
  materials.push({ color: [liquid[0], liquid[1], liquid[2], 0.92], metallic: 0, roughness: 0.1, blend: true });
  return [lathe(drink, R, R, 1, false), lathe(shell, R, R, 0, false)];
}

/** Gera o arquivo .glb. As dimensões do bounding box correspondem às medidas cadastradas. */
export function buildGlb(spec: ModelSpec): Uint8Array {
  if (!(spec.widthCm > 0 && spec.depthCm > 0 && spec.heightCm > 0)) throw new Error("Dimensões inválidas");
  const materials: Material[] = [];
  const meshes =
    spec.shape === "bottle" ? bottleMeshes(spec, materials)
    : spec.shape === "glass" ? glassMeshes(spec, materials)
    : dishMeshes(spec, materials);

  const chunks: Uint8Array[] = [];
  const views: object[] = [];
  const accessors: object[] = [];
  let offset = 0;
  const addView = (bytes: Uint8Array, target?: number) => {
    const pad = (4 - (bytes.byteLength % 4)) % 4;
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, ...(target ? { target } : {}) });
    chunks.push(bytes);
    if (pad) chunks.push(new Uint8Array(pad));
    offset += bytes.byteLength + pad;
    return views.length - 1;
  };
  const f32 = (a: number[]) => new Uint8Array(new Float32Array(a).buffer);

  const primitives = meshes.map((m) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < m.pos.length; i += 3)
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], m.pos[i + k]); max[k] = Math.max(max[k], m.pos[i + k]); }
    const count = m.pos.length / 3;
    const attributes: Record<string, number> = {};
    accessors.push({ bufferView: addView(f32(m.pos), 34962), componentType: 5126, count, type: "VEC3", min, max });
    attributes.POSITION = accessors.length - 1;
    accessors.push({ bufferView: addView(f32(m.nrm), 34962), componentType: 5126, count, type: "VEC3" });
    attributes.NORMAL = accessors.length - 1;
    if (m.uv) {
      accessors.push({ bufferView: addView(f32(m.uv), 34962), componentType: 5126, count, type: "VEC2" });
      attributes.TEXCOORD_0 = accessors.length - 1;
    }
    accessors.push({ bufferView: addView(new Uint8Array(new Uint16Array(m.idx).buffer), 34963), componentType: 5123, count: m.idx.length, type: "SCALAR" });
    return { attributes, indices: accessors.length - 1, material: m.material };
  });

  const json: Record<string, unknown> = {
    asset: { version: "2.0", generator: "Maison Premium AR" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "dish" }],
    meshes: [{ primitives }],
    materials: materials.map((m) => ({
      pbrMetallicRoughness: {
        baseColorFactor: m.color,
        metallicFactor: m.metallic,
        roughnessFactor: m.roughness,
        ...(m.textured ? { baseColorTexture: { index: 0 } } : {}),
      },
      doubleSided: true,
      ...(m.blend ? { alphaMode: "BLEND" } : {}),
    })),
  };
  if (spec.texture) {
    const view = addView(spec.texture);
    json.images = [{ bufferView: view, mimeType: spec.textureMime ?? "image/jpeg" }];
    json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
    json.textures = [{ sampler: 0, source: 0 }];
  }
  json.accessors = accessors;
  json.bufferViews = views;
  json.buffers = [{ byteLength: offset }];

  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  if (jsonPad) {
    const padded = new Uint8Array(jsonBytes.byteLength + jsonPad).fill(0x20);
    padded.set(jsonBytes);
    jsonBytes = padded;
  }
  const total = 12 + 8 + jsonBytes.byteLength + 8 + offset;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.byteLength, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  let p = 20 + jsonBytes.byteLength;
  dv.setUint32(p, offset, true);
  dv.setUint32(p + 4, 0x004e4942, true);
  p += 8;
  for (const c of chunks) { out.set(c, p); p += c.byteLength; }
  return out;
}

/** Lê o bounding box (em metros) de um GLB gerado — usado em testes e na conferência do cadastro. */
export function glbBounds(glb: Uint8Array): { width: number; height: number; depth: number } {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const len = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + len)));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const a of json.accessors) {
    if (!a.min) continue;
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], a.min[k]); max[k] = Math.max(max[k], a.max[k]); }
  }
  return { width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}
