import { describe, expect, it } from "vitest";
import { DEMO_CATEGORIES, DEMO_DISHES, DEMO_MODEL_SPECS } from "../src/data/demo.ts";
import { buildGlb, glbBounds } from "../src/lib/glb.ts";
import { LocalBackend, memoryKV } from "../src/lib/store.ts";
import type { Dish, Order, Restaurant } from "../src/lib/types.ts";

describe("cardápio demonstrativo", () => {
  const maison = DEMO_DISHES.filter((d) => d.restaurantId === "maison");
  it("tem 30+ produtos nas 8 categorias exigidas", () => {
    expect(maison.length).toBeGreaterThanOrEqual(30);
    const cats = DEMO_CATEGORIES.filter((c) => c.restaurantId === "maison");
    expect(cats).toHaveLength(8);
    for (const c of cats) expect(maison.some((d) => d.categoryId === c.id)).toBe(true);
  });
  it("todo produto tem foto, descrição, ingredientes, preço, dimensões e modelo AR", () => {
    for (const d of maison) {
      expect(d.photoUrl && d.modelUrl && d.description.length > 20).toBeTruthy();
      expect(d.ingredients.length).toBeGreaterThan(0);
      expect(d.priceCents).toBeGreaterThan(0);
      expect(d.widthCm * d.depthCm * d.heightCm).toBeGreaterThan(0);
    }
  });
});

describe("gerador GLB em escala real", () => {
  it.each(DEMO_MODEL_SPECS)("$id: bounding box igual às dimensões cadastradas", (spec) => {
    const glb = buildGlb({ ...spec, texture: spec.shape === "plate" || spec.shape === "bowl" ? new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) : undefined });
    const b = glbBounds(glb);
    expect(b.width).toBeCloseTo(spec.widthCm / 100, 3);
    expect(b.depth).toBeCloseTo(spec.depthCm / 100, 3);
    expect(b.height).toBeLessThanOrEqual(spec.heightCm / 100 + 1e-6);
    if (spec.shape === "bottle" || spec.shape === "glass") expect(b.height).toBeCloseTo(spec.heightCm / 100, 3);
  });
  it("produz um contêiner glTF 2.0 binário válido", () => {
    const glb = buildGlb({ shape: "plate", widthCm: 30, depthCm: 22, heightCm: 4 });
    const dv = new DataView(glb.buffer);
    expect(dv.getUint32(0, true)).toBe(0x46546c67);
    expect(dv.getUint32(4, true)).toBe(2);
    expect(dv.getUint32(8, true)).toBe(glb.byteLength);
    expect(glb.byteLength % 4).toBe(0);
    const b = glbBounds(glb);
    expect(b.width).toBeCloseTo(0.3, 3);
    expect(b.depth).toBeCloseTo(0.22, 3);
  });
  it("rejeita dimensões inválidas", () => {
    expect(() => buildGlb({ shape: "plate", widthCm: 0, depthCm: 10, heightCm: 2 })).toThrow();
  });
});

describe("backend local: pedidos e isolamento entre restaurantes", () => {
  const fresh = () => new LocalBackend(memoryKV());
  it("recalcula o preço a partir do cadastro e vincula o pedido à mesa", async () => {
    const b = fresh();
    const order = await b.placeOrder("maison", "mz01k", [{ dishId: "maison-vieiras", qty: 1 }, { dishId: "maison-magret", qty: 2 }]);
    expect(order.totalCents).toBe(9800 + 2 * 16800);
    expect(order.tableLabel).toBe("Mesa 1");
    expect(order.restaurantId).toBe("maison");
  });
  it("recusa token de mesa inválido e prato de outro restaurante", async () => {
    const b = fresh();
    await expect(b.placeOrder("maison", "nao-existe", [{ dishId: "maison-vieiras", qty: 1 }])).rejects.toThrow();
    await expect(b.placeOrder("maison", "mz01k", [{ dishId: "brasa-smash", qty: 1 }])).rejects.toThrow();
    await expect(b.placeOrder("brasa", "mz01k", [{ dishId: "brasa-smash", qty: 1 }])).rejects.toThrow();
  });
  it("exige sessão para ler pedidos e para qualquer escrita", async () => {
    const b = fresh();
    await expect(b.list<Order>("orders", "maison")).rejects.toThrow();
    const dish = (await b.list<Dish>("dishes", "maison"))[0];
    await expect(b.upsert("dishes", { ...dish, priceCents: 1 })).rejects.toThrow();
  });
  it("gerente de um restaurante não lê nem altera dados de outro", async () => {
    const b = fresh();
    await b.placeOrder("maison", "mz01k", [{ dishId: "maison-vieiras", qty: 1 }]);
    await b.signIn("gerente@brasa.demo", "brasa2026");
    await expect(b.list<Order>("orders", "maison")).rejects.toThrow(/permissão/);
    const maisonDish = (await b.list<Dish>("dishes", "maison"))[0];
    await expect(b.upsert("dishes", { ...maisonDish, priceCents: 1 })).rejects.toThrow(/permissão/);
    await expect(b.remove("dishes", maisonDish.id)).rejects.toThrow(/permissão/);
    const own = (await b.list<Dish>("dishes", "brasa"))[0];
    await expect(b.upsert("dishes", { ...own, restaurantId: "maison" })).rejects.toThrow();
    await expect(b.upsert("dishes", { ...own, priceCents: 4500 })).resolves.toMatchObject({ priceCents: 4500 });
    const r = (await b.list<Restaurant>("restaurants"))[0];
    await expect(b.upsert("restaurants", { ...r, id: "novo", slug: "novo" })).rejects.toThrow();
    await expect(b.remove("restaurants", "maison")).rejects.toThrow();
  });
  it("administrador da plataforma gerencia todos e a exclusão remove os dados do restaurante", async () => {
    const b = fresh();
    await b.signIn("admin@maison.demo", "maison2026");
    await b.remove("restaurants", "brasa");
    expect(await b.list<Dish>("dishes", "brasa")).toHaveLength(0);
    expect((await b.list<Dish>("dishes", "maison")).length).toBeGreaterThan(30);
  });
  it("rejeita credenciais incorretas", async () => {
    await expect(fresh().signIn("admin@maison.demo", "x")).rejects.toThrow();
  });
});
