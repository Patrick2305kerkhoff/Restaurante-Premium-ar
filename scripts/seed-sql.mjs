// Gera supabase/seed.sql com os restaurantes demonstrativos (mesmos dados do modo local).
import { writeFile } from "node:fs/promises";
import { DEMO_CATEGORIES, DEMO_DISHES, DEMO_RESTAURANTS, DEMO_TABLES } from "../src/data/demo.ts";
const snake = (s) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const lit = (v) => v === null || v === undefined ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v)
  : Array.isArray(v) ? `array[${v.map(lit).join(",")}]::text[]` : typeof v === "object" ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;
const insert = (table, rows) => rows.map((r) => `insert into public.${table} (${Object.keys(r).map(snake).join(", ")}) values (${Object.values(r).map(lit).join(", ")}) on conflict (id) do nothing;`).join("\n");
const sql = ["-- Gerado por scripts/seed-sql.mjs. As URLs demo/... são relativas ao site publicado.",
  insert("restaurants", DEMO_RESTAURANTS), insert("categories", DEMO_CATEGORIES), insert("dishes", DEMO_DISHES), insert("dining_tables", DEMO_TABLES)].join("\n\n");
await writeFile(new URL("../supabase/seed.sql", import.meta.url), sql + "\n");
console.log("supabase/seed.sql gerado");
