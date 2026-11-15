import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BellRing, Check, Download, Plus, Printer, Receipt, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { backend, uid } from "../lib/store.ts";
import { ORDER_FLOW, STATUS_LABEL, type Category, type Dish, type Order, type Restaurant, type ServiceCall, type Table, type Theme } from "../lib/types.ts";
import { asset, brl, slugify, tableUrl, themeVars, toJpeg, useList, validTheme } from "../lib/util.ts";
import { useAction, useAdmin } from "./Shell.tsx";

const Head = ({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) => (
  <header className="admin-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="head-actions">{children}</div></header>
);
const time = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/* ------------------------------------------------------------ indicadores */

export function DashboardPage() {
  const { restaurant } = useAdmin();
  const orders = useList<Order>("orders", restaurant.id, 8000).data;
  const calls = useList<ServiceCall>("calls", restaurant.id, 8000).data;
  const dishes = useList<Dish>("dishes", restaurant.id).data;
  const tables = useList<Table>("tables", restaurant.id).data;
  const [days, setDays] = useState(7);

  const m = useMemo(() => {
    const since = Date.now() - days * 864e5;
    const valid = orders.filter((o) => o.status !== "cancelado" && +new Date(o.createdAt) >= since);
    const revenue = valid.reduce((s, o) => s + o.totalCents, 0);
    const top = new Map<string, { qty: number; cents: number }>();
    for (const o of valid) for (const i of o.items) { const t = top.get(i.name) ?? { qty: 0, cents: 0 }; t.qty += i.qty; t.cents += i.qty * i.priceCents; top.set(i.name, t); }
    const perDay = Array.from({ length: Math.min(days, 14) }, (_, k) => {
      const d = new Date(Date.now() - (Math.min(days, 14) - 1 - k) * 864e5);
      const key = d.toDateString();
      return { label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), cents: valid.filter((o) => new Date(o.createdAt).toDateString() === key).reduce((s, o) => s + o.totalCents, 0) };
    });
    return { valid, revenue, ticket: valid.length ? revenue / valid.length : 0, top: [...top.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 6), perDay };
  }, [orders, days]);

  const exportCsv = () => {
    const rows = [["pedido", "data", "mesa", "status", "itens", "total"], ...m.valid.map((o) => [o.id, new Date(o.createdAt).toISOString(), o.tableLabel, o.status, o.items.map((i) => `${i.qty}x ${i.name}`).join(" | "), (o.totalCents / 100).toFixed(2)])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = `pedidos-${restaurant.slug}-${days}d.csv`;
    a.click();
  };
  const maxDay = Math.max(1, ...m.perDay.map((d) => d.cents));
  const maxTop = Math.max(1, ...m.top.map(([, t]) => t.qty));
  const withModel = dishes.filter((d) => d.modelUrl).length;

  return (
    <>
      <Head title="Indicadores" sub={restaurant.name}>
        <select value={days} onChange={(e) => setDays(+e.target.value)} aria-label="Período"><option value={1}>Hoje</option><option value={7}>7 dias</option><option value={30}>30 dias</option></select>
        <button className="btn sm ghost" onClick={exportCsv}><Download size={15} /> Relatório CSV</button>
      </Head>
      <div className="kpis">
        <div><small>Faturamento</small><b>{brl(m.revenue)}</b></div>
        <div><small>Pedidos</small><b>{m.valid.length}</b></div>
        <div><small>Ticket médio</small><b>{brl(m.ticket)}</b></div>
        <div><small>Em andamento</small><b>{orders.filter((o) => o.status === "novo" || o.status === "preparo" || o.status === "pronto").length}</b></div>
        <div><small>Chamados abertos</small><b>{calls.filter((c) => !c.resolved).length}</b></div>
        <div><small>Produtos com AR</small><b>{withModel}/{dishes.length}</b></div>
        <div><small>Mesas</small><b>{tables.length}</b></div>
      </div>
      <div className="panels">
        <section className="panel">
          <h2>Faturamento por dia</h2>
          <div className="bars">{m.perDay.map((d) => <div key={d.label} title={brl(d.cents)}><i style={{ height: `${(d.cents / maxDay) * 100}%` }} /><small>{d.label}</small></div>)}</div>
        </section>
        <section className="panel">
          <h2>Mais pedidos</h2>
          {m.top.length ? m.top.map(([name, t]) => (
            <div className="hbar" key={name}><span>{name}</span><div><i style={{ width: `${(t.qty / maxTop) * 100}%` }} /></div><b>{t.qty}</b></div>
          )) : <p className="muted">Ainda não há pedidos no período.</p>}
        </section>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- pedidos */

export function OrdersPage() {
  const { restaurant } = useAdmin();
  const run = useAction();
  const orders = useList<Order>("orders", restaurant.id, 5000);
  const calls = useList<ServiceCall>("calls", restaurant.id, 5000);
  const open = calls.data.filter((c) => !c.resolved).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const advance = (o: Order) => run(() => backend.upsert("orders", { ...o, status: ORDER_FLOW[ORDER_FLOW.indexOf(o.status) + 1] }));
  return (
    <>
      <Head title="Pedidos" sub="Atualiza automaticamente a cada 5 segundos" />
      {open.length > 0 && (
        <div className="calls">
          {open.map((c) => (
            <div key={c.id} className={`call ${c.kind}`}>
              {c.kind === "garcom" ? <BellRing size={18} /> : <Receipt size={18} />}
              <div><b>{c.tableLabel}</b><small>{c.kind === "garcom" ? "Chamou o garçom" : "Pediu a conta"} · {time(c.createdAt)}</small></div>
              <button className="btn sm" onClick={() => run(() => backend.upsert("calls", { ...c, resolved: true }), "Chamado atendido")}><Check size={15} /> Atendido</button>
            </div>
          ))}
        </div>
      )}
      <div className="board">
        {ORDER_FLOW.map((st) => {
          const list = orders.data.filter((o) => o.status === st).sort((a, b) => (st === "entregue" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt))).slice(0, st === "entregue" ? 12 : 99);
          return (
            <section key={st} className={`col ${st}`}>
              <h2>{STATUS_LABEL[st]} <small>{list.length}</small></h2>
              {list.map((o) => (
                <article key={o.id} className="ticket">
                  <header><b>{o.tableLabel}</b><small>{time(o.createdAt)}</small></header>
                  <ul>{o.items.map((i, k) => <li key={k}><b>{i.qty}×</b> {i.name}{i.note && <em>{i.note}</em>}</li>)}</ul>
                  <footer>
                    <span>{brl(o.totalCents)}</span>
                    {st !== "entregue" && <button className="btn sm" onClick={() => advance(o)}>{STATUS_LABEL[ORDER_FLOW[ORDER_FLOW.indexOf(st) + 1]]} →</button>}
                    {st === "novo" && <button className="icon" title="Cancelar pedido" onClick={() => run(() => backend.upsert("orders", { ...o, status: "cancelado" as const }), "Pedido cancelado")}><Trash2 size={15} /></button>}
                  </footer>
                </article>
              ))}
              {!list.length && <p className="muted">Nenhum pedido.</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------- categorias */

export function CategoriesPage() {
  const { restaurant } = useAdmin();
  const run = useAction();
  const cats = useList<Category>("categories", restaurant.id);
  const dishes = useList<Dish>("dishes", restaurant.id).data;
  const [name, setName] = useState("");
  const sorted = [...cats.data].sort((a, b) => a.sortOrder - b.sortOrder);
  const add = () => name.trim() && run(() => backend.upsert<Category>("categories", { id: uid(), restaurantId: restaurant.id, name: name.trim(), sortOrder: sorted.length }), "Categoria criada").then(() => setName(""));
  const move = (i: number, dir: -1 | 1) => {
    const a = sorted[i], b = sorted[i + dir];
    if (!b) return;
    run(async () => { await backend.upsert("categories", { ...a, sortOrder: b.sortOrder }); await backend.upsert("categories", { ...b, sortOrder: a.sortOrder }); });
  };
  return (
    <>
      <Head title="Categorias" sub="A ordem aqui é a ordem do cardápio" />
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" aria-label="Nome da nova categoria" />
        <button className="btn sm"><Plus size={15} /> Adicionar</button>
      </form>
      <div className="list">
        {sorted.map((c, i) => {
          const count = dishes.filter((d) => d.categoryId === c.id).length;
          return (
            <div className="row" key={c.id}>
              <input defaultValue={c.name} aria-label="Nome da categoria" onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && run(() => backend.upsert("categories", { ...c, name: e.target.value.trim() }), "Categoria renomeada")} />
              <small>{count} produto{count === 1 ? "" : "s"}</small>
              <button className="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp size={16} /></button>
              <button className="icon" onClick={() => move(i, 1)} disabled={i === sorted.length - 1} aria-label="Descer"><ArrowDown size={16} /></button>
              <button className="icon danger" disabled={count > 0} title={count ? "Mova ou exclua os produtos antes" : "Excluir"} onClick={() => run(() => backend.remove("categories", c.id), "Categoria excluída")} aria-label="Excluir"><Trash2 size={16} /></button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ mesas */

function QrCard({ r, t }: { r: Restaurant; t: Table }) {
  const [src, setSrc] = useState("");
  const url = tableUrl(r.slug, t.token);
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then(setSrc); }, [url]);
  return (
    <div className="qr-card">
      <b className="qr-brand">{r.name}</b>
      {src && <img src={src} alt={`QR Code da ${t.label}`} />}
      <strong>{t.label}</strong>
      <small>Aponte a câmera para ver o cardápio em realidade aumentada</small>
    </div>
  );
}

export function TablesPage() {
  const { restaurant } = useAdmin();
  const run = useAction();
  const tables = useList<Table>("tables", restaurant.id);
  const token = () => uid().replace(/-/g, "").slice(0, 10);
  const next = tables.data.length + 1;
  return (
    <>
      <Head title="Mesas e QR Codes" sub="Cada QR Code identifica a mesa e vincula os pedidos a ela">
        <button className="btn sm ghost" onClick={() => window.print()}><Printer size={15} /> Imprimir QR Codes</button>
        <button className="btn sm" onClick={() => run(() => backend.upsert<Table>("tables", { id: uid(), restaurantId: restaurant.id, label: `Mesa ${next}`, token: token(), seats: 4 }), "Mesa criada")}><Plus size={15} /> Nova mesa</button>
      </Head>
      <div className="qr-grid">
        {tables.data.map((t) => (
          <div className="qr-item" key={t.id}>
            <QrCard r={restaurant} t={t} />
            <div className="qr-tools no-print">
              <input defaultValue={t.label} aria-label="Nome da mesa" onBlur={(e) => e.target.value.trim() && e.target.value !== t.label && run(() => backend.upsert("tables", { ...t, label: e.target.value.trim() }), "Mesa renomeada")} />
              <a href={tableUrl(restaurant.slug, t.token)} target="_blank" rel="noreferrer">Abrir</a>
              <button className="icon" title="Gerar novo QR Code (invalida o anterior)" onClick={() => run(() => backend.upsert("tables", { ...t, token: token() }), "Novo QR Code gerado")}>↻</button>
              <button className="icon danger" onClick={() => run(() => backend.remove("tables", t.id), "Mesa excluída")} aria-label="Excluir mesa"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- identidade */

const FONTS_H = ["Cormorant Garamond", "Playfair Display", "Georgia", "Inter"];
const FONTS_B = ["Inter", "Georgia", "system-ui"];
const PRESETS: Record<string, Theme> = {
  "Alta gastronomia": { background: "#0b0a09", surface: "#16130f", text: "#f4ecdf", accent: "#c9a45c", headingFont: "Cormorant Garamond", bodyFont: "Inter", radius: 14 },
  "Bistrô claro": { background: "#f7f2ea", surface: "#ffffff", text: "#2a2420", accent: "#7a5c2e", headingFont: "Cormorant Garamond", bodyFont: "Inter", radius: 10 },
  "Hamburgueria": { background: "#fbf6ee", surface: "#ffffff", text: "#231c16", accent: "#c2451e", headingFont: "Playfair Display", bodyFont: "Inter", radius: 20 },
  "Cafeteria": { background: "#1c1512", surface: "#2a201b", text: "#f3e9dc", accent: "#d08b4c", headingFont: "Playfair Display", bodyFont: "Inter", radius: 18 },
  "Hotel": { background: "#0d1420", surface: "#162031", text: "#eef2f7", accent: "#b9c7dc", headingFont: "Cormorant Garamond", bodyFont: "Inter", radius: 8 },
};

export function BrandPage() {
  const { restaurant } = useAdmin();
  const run = useAction();
  const [r, setR] = useState(restaurant);
  const t = r.theme;
  const set = (p: Partial<Restaurant>) => setR((x) => ({ ...x, ...p }));
  const setT = (p: Partial<Theme>) => setR((x) => ({ ...x, theme: { ...x.theme, ...p } }));
  const upload = async (file: File | undefined, key: "logoUrl" | "coverUrl") => {
    if (!file) return;
    await run(async () => {
      const blob = key === "logoUrl" && file.type !== "image/jpeg" ? file : await toJpeg(file, key === "logoUrl" ? 480 : 1500);
      set({ [key]: await backend.upload(restaurant.id, blob, file.name) });
    });
  };
  const save = () => {
    if (!validTheme(t)) return run(async () => { throw new Error("Cores inválidas: use o formato #RRGGBB."); });
    return run(() => backend.upsert("restaurants", r), "Identidade visual salva");
  };
  return (
    <>
      <Head title="Identidade visual" sub="Logotipo, cores, tipografia e informações do estabelecimento"><button className="btn sm" onClick={save}>Salvar alterações</button></Head>
      <div className="brand-grid">
        <div className="form">
          <h2>Estabelecimento</h2>
          <label>Nome<input value={r.name} onChange={(e) => set({ name: e.target.value })} /></label>
          <label>Assinatura<input value={r.tagline} onChange={(e) => set({ tagline: e.target.value })} /></label>
          <label>Sobre<textarea rows={4} value={r.about} onChange={(e) => set({ about: e.target.value })} /></label>
          <label>Endereço<input value={r.address} onChange={(e) => set({ address: e.target.value })} /></label>
          <div className="two"><label>Telefone<input value={r.phone} onChange={(e) => set({ phone: e.target.value })} /></label><label>Horário<input value={r.hours} onChange={(e) => set({ hours: e.target.value })} /></label></div>
          <div className="two">
            <label>Logotipo<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={(e) => upload(e.target.files?.[0], "logoUrl")} />{r.logoUrl && <button type="button" className="link" onClick={() => set({ logoUrl: null })}>Remover logotipo</button>}</label>
            <label>Imagem de capa<input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0], "coverUrl")} />{r.coverUrl && <button type="button" className="link" onClick={() => set({ coverUrl: null })}>Remover capa</button>}</label>
          </div>
          <h2>Tema</h2>
          <div className="presets">{Object.entries(PRESETS).map(([n, p]) => <button key={n} type="button" onClick={() => setT(p)} style={{ background: p.background, color: p.text, borderColor: p.accent }}>{n}</button>)}</div>
          <div className="colors">
            {(["background", "surface", "text", "accent"] as const).map((k) => (
              <label key={k}>{{ background: "Fundo", surface: "Superfície", text: "Texto", accent: "Destaque" }[k]}
                <span><input type="color" value={t[k]} onChange={(e) => setT({ [k]: e.target.value })} /><input value={t[k]} onChange={(e) => setT({ [k]: e.target.value })} maxLength={7} /></span>
              </label>
            ))}
          </div>
          <div className="two">
            <label>Fonte dos títulos<select value={t.headingFont} onChange={(e) => setT({ headingFont: e.target.value })}>{FONTS_H.map((f) => <option key={f}>{f}</option>)}</select></label>
            <label>Fonte do texto<select value={t.bodyFont} onChange={(e) => setT({ bodyFont: e.target.value })}>{FONTS_B.map((f) => <option key={f}>{f}</option>)}</select></label>
          </div>
          <label>Arredondamento · {t.radius}px<input type="range" min={0} max={28} value={t.radius} onChange={(e) => setT({ radius: +e.target.value })} /></label>
        </div>
        <div className="preview-wrap">
          <small className="muted">Pré-visualização</small>
          <div className="preview app" style={themeVars(t)}>
            <div className="preview-hero">{r.coverUrl && <img src={asset(r.coverUrl)} alt="" />}<div>{r.logoUrl ? <img className="brand-logo" src={asset(r.logoUrl)} alt="" /> : <h3>{r.name || "Nome"}</h3>}<p>{r.tagline}</p></div></div>
            <div className="preview-card"><h4>Prato de exemplo</h4><p>Descrição do prato com os ingredientes principais.</p><div><strong>R$ 98,00</strong><span className="chip solid">Pedir</span></div></div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ restaurantes */

export function RestaurantsPage() {
  const { restaurants, restaurant, select, session } = useAdmin();
  const run = useAction();
  const [name, setName] = useState("");
  if (session.role !== "platform") return <p className="muted">Acesso restrito à administração da plataforma.</p>;
  const create = () => {
    const slug = slugify(name);
    if (!slug) return;
    if (restaurants.some((r) => r.slug === slug)) return run(async () => { throw new Error("Já existe um restaurante com este endereço."); });
    const id = uid();
    return run(async () => {
      await backend.upsert<Restaurant>("restaurants", { id, slug, name: name.trim(), tagline: "Cardápio interativo", logoUrl: null, coverUrl: null, about: "", address: "", phone: "", hours: "", theme: PRESETS["Alta gastronomia"], demo: false, createdAt: new Date().toISOString() });
      await backend.upsert<Category>("categories", { id: uid(), restaurantId: id, name: "Pratos", sortOrder: 0 });
      await backend.upsert<Table>("tables", { id: uid(), restaurantId: id, label: "Mesa 1", token: uid().replace(/-/g, "").slice(0, 10), seats: 4 });
      select(id); setName("");
    }, "Restaurante criado");
  };
  return (
    <>
      <Head title="Restaurantes" sub="Cada estabelecimento tem marca, cardápio, mesas e pedidos isolados" />
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do novo restaurante" aria-label="Nome do novo restaurante" />
        <button className="btn sm"><Plus size={15} /> Criar restaurante</button>
      </form>
      <div className="list">
        {restaurants.map((r) => (
          <div className="row" key={r.id}>
            <span className="swatch" style={{ background: r.theme.background, borderColor: r.theme.accent }} />
            <div className="grow"><b>{r.name}</b><small>#/r/{r.slug}{r.demo ? " · demonstração" : ""}</small></div>
            <a href={`#/r/${r.slug}`} target="_blank" rel="noreferrer">Cardápio</a>
            <button className="btn sm ghost" disabled={r.id === restaurant.id} onClick={() => select(r.id)}>{r.id === restaurant.id ? "Ativo" : "Gerenciar"}</button>
            <button className="icon danger" disabled={restaurants.length <= 1} onClick={() => confirm(`Excluir ${r.name} e todos os seus dados?`) && run(() => backend.remove("restaurants", r.id), "Restaurante excluído")} aria-label={`Excluir ${r.name}`}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </>
  );
}
