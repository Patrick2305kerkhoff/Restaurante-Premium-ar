import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_CATEGORIES, DEMO_DISHES, DEMO_RESTAURANTS, DEMO_TABLES } from "../data/demo.ts";
import type { CallKind, Entity, Order, OrderItem, Restaurant, ServiceCall, Session, Table } from "./types.ts";

/**
 * Camada de dados com dois backends intercambiáveis:
 *  - "supabase": Postgres + Auth + Storage, com isolamento por RLS (produção);
 *  - "local": persistência no navegador, usada na demonstração quando as
 *    variáveis VITE_SUPABASE_* não estão configuradas.
 */
export interface Backend {
  readonly mode: "local" | "supabase";
  list<T>(entity: Entity, restaurantId?: string): Promise<T[]>;
  upsert<T extends { id: string }>(entity: Entity, row: T): Promise<T>;
  remove(entity: Entity, id: string): Promise<void>;
  upload(restaurantId: string, file: Blob, name: string): Promise<string>;
  tableByToken(slug: string, token: string): Promise<Table | null>;
  placeOrder(slug: string, token: string, items: { dishId: string; qty: number; note?: string }[]): Promise<Order>;
  callService(slug: string, token: string, kind: CallKind): Promise<void>;
  orderStatuses(ids: string[]): Promise<Pick<Order, "id" | "status">[]>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  session(): Promise<Session | null>;
}

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ------------------------------------------------------------------ local */

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export const memoryKV = (): KV => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

type Db = Record<Entity, { id: string; restaurantId?: string }[]>;
const DB_KEY = "maison-db-v4";
const SESSION_KEY = "maison-session";

/** Contas da demonstração local. Em produção a autenticação é do Supabase Auth. */
export const DEMO_ACCOUNTS: (Session & { password: string })[] = [
  { email: "admin@maison.demo", password: "maison2026", role: "platform", restaurantIds: "all" },
  { email: "gerente@brasa.demo", password: "brasa2026", role: "owner", restaurantIds: ["brasa"] },
];

const seed = (): Db => ({
  restaurants: structuredClone(DEMO_RESTAURANTS),
  categories: structuredClone(DEMO_CATEGORIES),
  dishes: structuredClone(DEMO_DISHES),
  tables: structuredClone(DEMO_TABLES),
  orders: [],
  calls: [],
});

export class LocalBackend implements Backend {
  readonly mode = "local" as const;
  constructor(private kv: KV) {}

  private read(): Db {
    const raw = this.kv.getItem(DB_KEY);
    if (raw) try { return JSON.parse(raw) as Db; } catch { /* base corrompida: recria */ }
    const db = seed();
    this.write(db);
    return db;
  }
  private write(db: Db) {
    try { this.kv.setItem(DB_KEY, JSON.stringify(db)); }
    catch { throw new Error("Armazenamento local cheio. No modo demonstração os arquivos ficam no navegador; conecte o Supabase para armazenamento ilimitado."); }
  }
  private current(): Session | null {
    const raw = this.kv.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  }
  /** Toda escrita administrativa exige sessão com acesso ao restaurante. */
  private assert(restaurantId: string | undefined, platformOnly = false) {
    const s = this.current();
    if (!s) throw new Error("Sessão expirada. Entre novamente.");
    if (s.restaurantIds === "all") return;
    if (platformOnly || !restaurantId || !s.restaurantIds.includes(restaurantId)) throw new Error("Sem permissão para este restaurante.");
  }

  async list<T>(entity: Entity, restaurantId?: string): Promise<T[]> {
    const rows = this.read()[entity];
    if (entity === "orders" || entity === "calls") this.assert(restaurantId);
    if (entity === "restaurants") return rows as T[];
    return rows.filter((r) => !restaurantId || r.restaurantId === restaurantId) as T[];
  }
  async upsert<T extends { id: string }>(entity: Entity, row: T): Promise<T> {
    const db = this.read();
    const rows = db[entity];
    const i = rows.findIndex((r) => r.id === row.id);
    const rid = entity === "restaurants" ? row.id : (row as { restaurantId?: string }).restaurantId;
    if (entity === "restaurants" && i < 0) this.assert(undefined, true);
    else this.assert(i >= 0 && entity !== "restaurants" ? rows[i].restaurantId : rid);
    if (entity !== "restaurants" && i >= 0 && rows[i].restaurantId !== rid) throw new Error("Um registro não pode mudar de restaurante.");
    if (i >= 0) rows[i] = row; else rows.push(row);
    this.write(db);
    return row;
  }
  async remove(entity: Entity, id: string): Promise<void> {
    const db = this.read();
    const row = db[entity].find((r) => r.id === id);
    if (!row) return;
    if (entity === "restaurants") {
      this.assert(undefined, true);
      for (const e of ["categories", "dishes", "tables", "orders", "calls"] as Entity[]) db[e] = db[e].filter((r) => r.restaurantId !== id);
    } else this.assert(row.restaurantId);
    db[entity] = db[entity].filter((r) => r.id !== id);
    this.write(db);
  }
  async upload(restaurantId: string, file: Blob): Promise<string> {
    this.assert(restaurantId);
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("Falha ao ler o arquivo"));
      fr.readAsDataURL(file);
    });
  }
  async tableByToken(slug: string, token: string): Promise<Table | null> {
    const db = this.read();
    const r = (db.restaurants as Restaurant[]).find((x) => x.slug === slug);
    return ((db.tables as Table[]).find((t) => t.restaurantId === r?.id && t.token === token)) ?? null;
  }
  async placeOrder(slug: string, token: string, items: { dishId: string; qty: number; note?: string }[]): Promise<Order> {
    const table = await this.tableByToken(slug, token);
    if (!table) throw new Error("Mesa não identificada. Leia o QR Code da mesa.");
    const db = this.read();
    const dishes = db.dishes as unknown as { id: string; restaurantId: string; name: string; priceCents: number; available: boolean }[];
    // Preços sempre recalculados a partir do cadastro, nunca do cliente.
    const lines: OrderItem[] = items.map((it) => {
      const d = dishes.find((x) => x.id === it.dishId && x.restaurantId === table.restaurantId);
      if (!d || !d.available) throw new Error("Um dos itens não está mais disponível.");
      const qty = Math.max(1, Math.min(50, Math.floor(it.qty)));
      return { dishId: d.id, name: d.name, qty, priceCents: d.priceCents, note: it.note?.slice(0, 200) };
    });
    if (!lines.length) throw new Error("Pedido vazio.");
    const order: Order = {
      id: uid(), restaurantId: table.restaurantId, tableId: table.id, tableLabel: table.label, items: lines,
      totalCents: lines.reduce((s, l) => s + l.qty * l.priceCents, 0), status: "novo", createdAt: new Date().toISOString(),
    };
    db.orders.push(order);
    this.write(db);
    return order;
  }
  async callService(slug: string, token: string, kind: CallKind): Promise<void> {
    const table = await this.tableByToken(slug, token);
    if (!table) throw new Error("Mesa não identificada. Leia o QR Code da mesa.");
    const db = this.read();
    const call: ServiceCall = { id: uid(), restaurantId: table.restaurantId, tableId: table.id, tableLabel: table.label, kind, resolved: false, createdAt: new Date().toISOString() };
    db.calls.push(call);
    this.write(db);
  }
  async orderStatuses(ids: string[]) {
    return (this.read().orders as Order[]).filter((o) => ids.includes(o.id)).map((o) => ({ id: o.id, status: o.status }));
  }
  async signIn(email: string, password: string): Promise<Session> {
    const acc = DEMO_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase() && a.password === password);
    if (!acc) throw new Error("E-mail ou senha incorretos.");
    const s: Session = { email: acc.email, role: acc.role, restaurantIds: acc.restaurantIds };
    this.kv.setItem(SESSION_KEY, JSON.stringify(s));
    return s;
  }
  async signOut() { this.kv.removeItem(SESSION_KEY); }
  async session() { return this.current(); }
  reset() { this.kv.removeItem(DB_KEY); }
}

/* --------------------------------------------------------------- supabase */

const TABLE: Record<Entity, string> = { restaurants: "restaurants", categories: "categories", dishes: "dishes", tables: "dining_tables", orders: "orders", calls: "service_calls" };
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const mapKeys = (o: Record<string, unknown>, f: (s: string) => string) => Object.fromEntries(Object.entries(o).map(([k, v]) => [f(k), v]));

export class SupabaseBackend implements Backend {
  readonly mode = "supabase" as const;
  constructor(private sb: SupabaseClient) {}
  private fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

  async list<T>(entity: Entity, restaurantId?: string): Promise<T[]> {
    let q = this.sb.from(TABLE[entity]).select("*");
    if (restaurantId && entity !== "restaurants") q = q.eq("restaurant_id", restaurantId);
    const { data, error } = await q.order(entity === "categories" || entity === "dishes" ? "sort_order" : entity === "tables" ? "label" : "created_at");
    this.fail(error);
    return (data ?? []).map((r) => mapKeys(r, camel)) as T[];
  }
  async upsert<T extends { id: string }>(entity: Entity, row: T): Promise<T> {
    const { data, error } = await this.sb.from(TABLE[entity]).upsert(mapKeys(row as Record<string, unknown>, snake)).select().single();
    this.fail(error);
    return mapKeys(data, camel) as T;
  }
  async remove(entity: Entity, id: string): Promise<void> {
    const { error } = await this.sb.from(TABLE[entity]).delete().eq("id", id);
    this.fail(error);
  }
  async upload(restaurantId: string, file: Blob, name: string): Promise<string> {
    const path = `${restaurantId}/${uid()}-${name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await this.sb.storage.from("assets").upload(path, file, { contentType: file.type || undefined, cacheControl: "31536000" });
    this.fail(error);
    return this.sb.storage.from("assets").getPublicUrl(path).data.publicUrl;
  }
  async tableByToken(slug: string, token: string): Promise<Table | null> {
    const { data, error } = await this.sb.rpc("table_by_token", { p_slug: slug, p_token: token });
    this.fail(error);
    const row = Array.isArray(data) ? data[0] : data;
    return row ? (mapKeys(row, camel) as Table) : null;
  }
  async placeOrder(slug: string, token: string, items: { dishId: string; qty: number; note?: string }[]): Promise<Order> {
    const { data, error } = await this.sb.rpc("place_order", { p_slug: slug, p_token: token, p_items: items.map((i) => ({ dish_id: i.dishId, qty: i.qty, note: i.note ?? null })) });
    this.fail(error);
    return mapKeys(data, camel) as Order;
  }
  async callService(slug: string, token: string, kind: CallKind): Promise<void> {
    const { error } = await this.sb.rpc("call_service", { p_slug: slug, p_token: token, p_kind: kind });
    this.fail(error);
  }
  async orderStatuses(ids: string[]) {
    if (!ids.length) return [];
    const { data, error } = await this.sb.rpc("order_statuses", { p_ids: ids });
    this.fail(error);
    return (data ?? []) as Pick<Order, "id" | "status">[];
  }
  private async toSession(email: string): Promise<Session> {
    const { data: admin } = await this.sb.rpc("is_platform_admin");
    if (admin) return { email, role: "platform", restaurantIds: "all" };
    const { data } = await this.sb.from("restaurant_members").select("restaurant_id");
    return { email, role: "owner", restaurantIds: (data ?? []).map((r) => r.restaurant_id as string) };
  }
  async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error("E-mail ou senha incorretos.");
    return this.toSession(data.user.email ?? email);
  }
  async signOut() { await this.sb.auth.signOut(); }
  async session() {
    const { data } = await this.sb.auth.getSession();
    return data.session ? this.toSession(data.session.user.email ?? "") : null;
  }
}

/* ---------------------------------------------------------------- escolha */

function create(): Backend {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
  if (url && key) return new SupabaseBackend(createClient(url, key));
  return new LocalBackend(typeof localStorage !== "undefined" ? localStorage : memoryKV());
}

export const backend: Backend = create();

/* Notificação simples para recarregar telas após mutações (e entre abas). */
const listeners = new Set<() => void>();
export const notify = () => listeners.forEach((l) => l());
export const subscribe = (l: () => void) => { listeners.add(l); return () => void listeners.delete(l); };
if (typeof window !== "undefined") window.addEventListener("storage", (e) => { if (e.key === DB_KEY) notify(); });
