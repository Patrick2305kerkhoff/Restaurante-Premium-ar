import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BellRing, Box, Clock, Heart, MapPin, Minus, Phone, Plus, QrCode, Receipt, Search, Sparkles, X } from "lucide-react";
import { backend } from "../lib/store.ts";
import { STATUS_LABEL, type Dish, type OrderStatus } from "../lib/types.ts";
import { asset, brl } from "../lib/util.ts";
import { useCustomer } from "./Shell.tsx";

const dims = (d: Dish) => `${fmt(d.widthCm)} × ${fmt(d.depthCm)} × ${fmt(d.heightCm)} cm`;
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function DemoTag() {
  const { restaurant } = useCustomer();
  return restaurant.demo ? <span className="demo-tag">Imagem demonstrativa</span> : null;
}

export function DishCard({ dish, wide }: { dish: Dish; wide?: boolean }) {
  const { restaurant, favorites, toggleFavorite, setQty, cart, toast } = useCustomer();
  const base = `/r/${restaurant.slug}`;
  const fav = favorites.includes(dish.id);
  const inCart = cart.find((l) => l.dishId === dish.id)?.qty ?? 0;
  return (
    <article className={`dish-card${wide ? " wide" : ""}`}>
      <Link to={`${base}/prato/${dish.id}`} className="dish-photo">
        {dish.photoUrl ? <img src={asset(dish.photoUrl)} alt={dish.name} loading="lazy" /> : <div className="photo-missing">Sem foto</div>}
        <DemoTag />
      </Link>
      <button className={`fav${fav ? " on" : ""}`} aria-label={fav ? `Remover ${dish.name} dos favoritos` : `Favoritar ${dish.name}`} onClick={() => toggleFavorite(dish.id)}>
        <Heart size={18} fill={fav ? "currentColor" : "none"} />
      </button>
      <div className="dish-body">
        <Link to={`${base}/prato/${dish.id}`}><h3>{dish.name}</h3></Link>
        <p>{dish.description}</p>
        <div className="dish-foot">
          <strong>{brl(dish.priceCents)}</strong>
          <div className="dish-actions">
            {dish.modelUrl && <Link className="chip" to={`${base}/ar/${dish.id}`}><Box size={15} /> Ver na mesa</Link>}
            <button className="chip solid" onClick={() => { setQty(dish.id, inCart + 1); toast(`${dish.name} adicionado ao pedido`); }} aria-label={`Adicionar ${dish.name} ao pedido`}>
              <Plus size={15} /> {inCart > 0 ? inCart : "Pedir"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function HomePage() {
  const { restaurant, dishes, categories, table } = useCustomer();
  const base = `/r/${restaurant.slug}`;
  const featured = dishes.filter((d) => d.featured).slice(0, 8);
  return (
    <div className="home">
      <section className="hero">
        {restaurant.coverUrl && <img className="hero-bg" src={asset(restaurant.coverUrl)} alt="" />}
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="eyebrow">{table ? `Bem-vindo · ${table.label}` : "Bem-vindo"}</span>
          <h1>{restaurant.name}</h1>
          <div className="rule" />
          <p>{restaurant.tagline}</p>
          <div className="hero-actions">
            <Link className="btn" to={`${base}/cardapio`}>Ver o cardápio</Link>
            {featured[0]?.modelUrl && <Link className="btn ghost" to={`${base}/ar/${featured[0].id}`}><Box size={17} /> Experimentar em AR</Link>}
          </div>
        </div>
      </section>

      <section className="section">
        <header className="section-head"><span className="eyebrow">Explore</span><h2>O cardápio</h2></header>
        <div className="cat-grid">
          {categories.map((c) => {
            const first = dishes.find((d) => d.categoryId === c.id);
            return (
              <Link key={c.id} to={`${base}/cardapio?c=${c.id}`} className="cat-tile">
                {first?.photoUrl && <img src={asset(first.photoUrl)} alt="" loading="lazy" />}
                <span>{c.name}</span>
                <small>{dishes.filter((d) => d.categoryId === c.id).length} itens</small>
              </Link>
            );
          })}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section">
          <header className="section-head"><span className="eyebrow"><Sparkles size={13} /> Assinaturas do chef</span><h2>Destaques da casa</h2></header>
          <div className="rail">{featured.map((d) => <DishCard key={d.id} dish={d} />)}</div>
        </section>
      )}

      <section className="section how">
        <header className="section-head"><span className="eyebrow">Realidade aumentada</span><h2>Veja o prato na sua mesa</h2></header>
        <ol className="steps">
          <li><b>1</b><div><h4>Escolha um prato</h4><p>Toque em “Ver na mesa” em qualquer item do cardápio.</p></div></li>
          <li><b>2</b><div><h4>Aponte para a mesa</h4><p>Mova o celular devagar até a superfície ser reconhecida.</p></div></li>
          <li><b>3</b><div><h4>Tamanho real</h4><p>O prato aparece ancorado na mesa, em escala 1:1. Caminhe ao redor e veja de todos os ângulos.</p></div></li>
        </ol>
      </section>
    </div>
  );
}

export function MenuPage() {
  const { categories, dishes } = useCustomer();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const active = params.get("c") ?? "todos";
  const term = q.trim().toLowerCase();
  const filtered = useMemo(() => dishes.filter((d) => {
    if (term) return [d.name, d.description, ...d.ingredients].join(" ").toLowerCase().includes(term);
    return active === "todos" || d.categoryId === active;
  }), [dishes, term, active]);
  const groups = categories.map((c) => ({ c, items: filtered.filter((d) => d.categoryId === c.id) })).filter((g) => g.items.length);
  return (
    <div className="page">
      <header className="page-head"><span className="eyebrow">À la carte</span><h1>Cardápio</h1></header>
      <label className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar prato ou ingrediente" aria-label="Buscar no cardápio" />
        {q && <button onClick={() => setQ("")} aria-label="Limpar busca"><X size={16} /></button>}
      </label>
      {!term && (
        <div className="pills" role="tablist">
          <button role="tab" aria-selected={active === "todos"} className={active === "todos" ? "on" : ""} onClick={() => setParams({})}>Todos</button>
          {categories.map((c) => <button role="tab" aria-selected={active === c.id} key={c.id} className={active === c.id ? "on" : ""} onClick={() => setParams({ c: c.id })}>{c.name}</button>)}
        </div>
      )}
      {groups.map(({ c, items }) => (
        <section key={c.id} className="menu-group">
          <h2>{c.name}<small>{items.length}</small></h2>
          <div className="dish-grid">{items.map((d) => <DishCard key={d.id} dish={d} />)}</div>
        </section>
      ))}
      {!groups.length && <div className="empty"><h2>Nada encontrado</h2><p>Tente outro termo de busca.</p></div>}
    </div>
  );
}

export function DishPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { restaurant, dishes, categories, favorites, toggleFavorite, setQty, cart, toast } = useCustomer();
  const dish = dishes.find((d) => d.id === id);
  const [qty, setLocalQty] = useState(1);
  if (!dish) return <div className="empty"><h2>Prato indisponível</h2><Link className="btn" to={`/r/${restaurant.slug}/cardapio`}>Voltar ao cardápio</Link></div>;
  const fav = favorites.includes(dish.id);
  const inCart = cart.find((l) => l.dishId === dish.id)?.qty ?? 0;
  return (
    <div className="dish-page">
      <div className="dish-hero">
        {dish.photoUrl && <img src={asset(dish.photoUrl)} alt={dish.name} />}
        <button className="round back" onClick={() => nav(-1)} aria-label="Voltar"><ArrowLeft size={20} /></button>
        <button className={`round favbtn${fav ? " on" : ""}`} onClick={() => toggleFavorite(dish.id)} aria-label="Favoritar"><Heart size={20} fill={fav ? "currentColor" : "none"} /></button>
        <DemoTag />
      </div>
      <div className="dish-detail">
        <span className="eyebrow">{categories.find((c) => c.id === dish.categoryId)?.name}</span>
        <h1>{dish.name}</h1>
        <div className="price">{brl(dish.priceCents)}</div>
        <p className="lead">{dish.description}</p>
        <h4>Ingredientes</h4>
        <ul className="ingredients">{dish.ingredients.map((i) => <li key={i}>{i}</li>)}</ul>
        <h4>Dimensões reais</h4>
        <div className="dims">
          <div><small>Largura</small><b>{fmt(dish.widthCm)} cm</b></div>
          <div><small>Profundidade</small><b>{fmt(dish.depthCm)} cm</b></div>
          <div><small>Altura</small><b>{fmt(dish.heightCm)} cm</b></div>
        </div>
        {dish.modelUrl && (
          <Link className="ar-cta" to={`/r/${restaurant.slug}/ar/${dish.id}`}>
            <Box size={22} />
            <div><b>Ver na minha mesa</b><small>Realidade aumentada em tamanho real · {dims(dish)}</small></div>
          </Link>
        )}
        <div className="buy">
          <div className="stepper">
            <button onClick={() => setLocalQty((n) => Math.max(1, n - 1))} aria-label="Diminuir"><Minus size={16} /></button>
            <span>{qty}</span>
            <button onClick={() => setLocalQty((n) => n + 1)} aria-label="Aumentar"><Plus size={16} /></button>
          </div>
          <button className="btn grow" onClick={() => { setQty(dish.id, inCart + qty); toast(`${qty} × ${dish.name} no pedido`); setLocalQty(1); }}>
            Adicionar · {brl(dish.priceCents * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FavoritesPage() {
  const { dishes, favorites, restaurant } = useCustomer();
  const list = dishes.filter((d) => favorites.includes(d.id));
  return (
    <div className="page">
      <header className="page-head"><span className="eyebrow">Sua seleção</span><h1>Favoritos</h1></header>
      {list.length ? <div className="dish-grid">{list.map((d) => <DishCard key={d.id} dish={d} />)}</div> : (
        <div className="empty"><Heart size={34} /><h2>Nenhum favorito ainda</h2><p>Toque no coração de um prato para guardá-lo aqui.</p><Link className="btn" to={`/r/${restaurant.slug}/cardapio`}>Explorar o cardápio</Link></div>
      )}
    </div>
  );
}

export function OrderPage() {
  const c = useCustomer();
  const { restaurant, dishes, cart, table } = c;
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, OrderStatus>>({});
  const ids = c.myOrders.map((o) => o.id).join(",");

  useEffect(() => {
    if (!ids) return;
    const load = () => backend.orderStatuses(ids.split(",")).then((rows) => setStatuses(Object.fromEntries(rows.map((r) => [r.id, r.status]))), () => {});
    load();
    const t = window.setInterval(load, 6000);
    return () => clearInterval(t);
  }, [ids]);

  const send = async () => {
    if (!table) return;
    setBusy(true);
    try {
      const order = await backend.placeOrder(restaurant.slug, table.token, cart);
      c.addOrder({ id: order.id, createdAt: order.createdAt, totalCents: order.totalCents, items: order.items.map((i) => ({ name: i.name, qty: i.qty })) });
      c.clearCart();
      c.toast("Pedido enviado à cozinha");
    } catch (e) { c.toast((e as Error).message); }
    setBusy(false);
  };
  const call = async (kind: "garcom" | "conta") => {
    if (!table) return c.toast("Leia o QR Code da mesa para chamar o atendimento");
    try { await backend.callService(restaurant.slug, table.token, kind); c.toast(kind === "garcom" ? "Garçom a caminho" : "A conta foi solicitada"); }
    catch (e) { c.toast((e as Error).message); }
  };
  const useDemoTable = async () => {
    const tables = await backend.list<import("../lib/types.ts").Table>("tables", restaurant.id).catch(() => []);
    if (tables[0]) { c.setTable(tables[0]); c.toast(`${tables[0].label} selecionada`); }
  };
  const consumed = c.myOrders.filter((o) => statuses[o.id] !== "cancelado").reduce((s, o) => s + o.totalCents, 0);

  return (
    <div className="page narrow">
      <header className="page-head"><span className="eyebrow">{table ? table.label : "Mesa não identificada"}</span><h1>Seu pedido</h1></header>

      {!table && (
        <div className="notice">
          <QrCode size={22} />
          <div><b>Leia o QR Code da sua mesa</b><p>O pedido é vinculado à mesa pelo QR Code. Aponte a câmera para o código sobre a mesa.</p>
            {restaurant.demo && <button className="link" onClick={useDemoTable}>Demonstração: usar a Mesa 1</button>}
          </div>
        </div>
      )}

      {cart.length > 0 ? (
        <section className="card">
          {cart.map((l) => {
            const d = dishes.find((x) => x.id === l.dishId)!;
            return (
              <div className="line" key={l.dishId}>
                {d.photoUrl && <img src={asset(d.photoUrl)} alt="" />}
                <div className="line-main">
                  <b>{d.name}</b><small>{brl(d.priceCents)}</small>
                  <input className="note" placeholder="Observação (ponto, sem cebola…)" value={l.note ?? ""} maxLength={200} onChange={(e) => c.setNote(l.dishId, e.target.value)} aria-label={`Observação para ${d.name}`} />
                </div>
                <div className="stepper sm">
                  <button onClick={() => c.setQty(l.dishId, l.qty - 1)} aria-label={`Remover um ${d.name}`}><Minus size={14} /></button>
                  <span>{l.qty}</span>
                  <button onClick={() => c.setQty(l.dishId, l.qty + 1)} aria-label={`Adicionar um ${d.name}`}><Plus size={14} /></button>
                </div>
              </div>
            );
          })}
          <div className="total"><span>Total</span><b>{brl(c.cartTotal)}</b></div>
          <button className="btn block" disabled={!table || busy} onClick={send}>{busy ? "Enviando…" : table ? "Enviar pedido à cozinha" : "Identifique a mesa para pedir"}</button>
        </section>
      ) : (
        <div className="empty small"><h2>Seu pedido está vazio</h2><Link className="btn" to={`/r/${restaurant.slug}/cardapio`}>Ver o cardápio</Link></div>
      )}

      <div className="service">
        <button onClick={() => call("garcom")}><BellRing size={20} /><span>Chamar garçom</span></button>
        <button onClick={() => call("conta")}><Receipt size={20} /><span>Pedir a conta</span></button>
      </div>

      {c.myOrders.length > 0 && (
        <section>
          <h2 className="sub">Pedidos desta mesa</h2>
          {c.myOrders.map((o) => {
            const st = statuses[o.id] ?? "novo";
            return (
              <div className="card order" key={o.id}>
                <header><span>{new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span><em className={`status ${st}`}>{STATUS_LABEL[st]}</em></header>
                <ul>{o.items.map((i, k) => <li key={k}>{i.qty} × {i.name}</li>)}</ul>
                <footer>{brl(o.totalCents)}</footer>
              </div>
            );
          })}
          <div className="total big"><span>Consumo da mesa</span><b>{brl(consumed)}</b></div>
        </section>
      )}
    </div>
  );
}

export function AboutPage() {
  const { restaurant } = useCustomer();
  return (
    <div className="page narrow about">
      <header className="page-head"><span className="eyebrow">A casa</span><h1>{restaurant.name}</h1></header>
      {restaurant.demo && restaurant.slug === "maison" && <figure><img src={asset("demo/salon.jpg")} alt="Salão do restaurante" /><figcaption>Imagem demonstrativa</figcaption></figure>}
      <p className="lead">{restaurant.about}</p>
      <ul className="facts">
        <li><MapPin size={18} /><span>{restaurant.address}</span></li>
        <li><Clock size={18} /><span>{restaurant.hours}</span></li>
        <li><Phone size={18} /><a href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}>{restaurant.phone}</a></li>
      </ul>
      {restaurant.demo && restaurant.slug === "maison" && <figure><img src={asset("demo/chef.jpg")} alt="Finalização de um prato" /><figcaption>Imagem demonstrativa</figcaption></figure>}
      {restaurant.demo && (
        <p className="fine">Restaurante fictício de demonstração. As fotografias são imagens demonstrativas; em cada estabelecimento contratante são usadas as fotos reais dos pratos.</p>
      )}
    </div>
  );
}
