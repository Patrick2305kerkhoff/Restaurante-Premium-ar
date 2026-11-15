import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { backend, subscribe } from "./store.ts";
import type { Entity, Theme } from "./types.ts";

export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Resolve caminhos de assets do repositório (demo/...) e mantém URLs absolutas/data. */
export const asset = (url: string | null | undefined) =>
  !url ? "" : /^(https?:|data:|blob:)/.test(url) ? url : new URL(url, document.baseURI).href;

export const HEX = /^#[0-9a-fA-F]{6}$/;
export const validTheme = (t: Theme) => [t.background, t.surface, t.text, t.accent].every((c) => HEX.test(c)) && t.radius >= 0 && t.radius <= 32;

export function themeVars(t: Theme): CSSProperties {
  return {
    "--bg": t.background, "--surface": t.surface, "--text": t.text, "--accent": t.accent,
    "--radius": `${t.radius}px`, "--font-h": `"${t.headingFont}", Georgia, serif`, "--font-b": `"${t.bodyFont}", system-ui, sans-serif`,
  } as CSSProperties;
}

export const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const tableUrl = (slug: string, token: string) => `${location.origin}${location.pathname}#/r/${slug}/mesa/${token}`;

/** Lista uma entidade e recarrega após mutações, entre abas e (opcionalmente) por intervalo. */
export function useList<T>(entity: Entity, restaurantId: string | undefined, pollMs = 0) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    if (entity !== "restaurants" && !restaurantId) return;
    backend.list<T>(entity, restaurantId).then((d) => { setData(d); setError(""); }, (e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [entity, restaurantId]);
  useEffect(() => {
    load();
    const off = subscribe(load);
    const t = pollMs ? window.setInterval(load, pollMs) : 0;
    return () => { off(); if (t) clearInterval(t); };
  }, [load, pollMs]);
  return { data, loading, error, reload: load };
}

/** Estado persistido no aparelho do cliente (carrinho, favoritos, mesa, pedidos). */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  const k = useRef(key);
  useEffect(() => { try { localStorage.setItem(k.current, JSON.stringify(value)); } catch { /* sem armazenamento */ } }, [value]);
  return [value, setValue] as const;
}

/** Redimensiona/recorta uma imagem no navegador e devolve um JPEG. */
export async function toJpeg(file: Blob, size: number, crop?: { zoom: number; x: number; y: number }): Promise<Blob> {
  const img = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  if (crop) {
    canvas.width = canvas.height = size;
    const side = Math.min(img.width, img.height) / crop.zoom;
    const cx = img.width / 2 + crop.x * img.width / 2, cy = img.height / 2 + crop.y * img.height / 2;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
  } else {
    const k = Math.min(1, size / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * k); canvas.height = Math.round(img.height * k);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao processar imagem"))), "image/jpeg", 0.84));
}
