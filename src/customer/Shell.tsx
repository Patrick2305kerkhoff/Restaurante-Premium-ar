import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { BookOpen, Heart, Home, Info, ShoppingBag } from "lucide-react";
import { backend } from "../lib/store.ts";
import type { Category, Dish, Restaurant, Table } from "../lib/types.ts";
import { asset, themeVars, useList, useStored } from "../lib/util.ts";
import { useReveal, useScrollVar } from "../lib/motion.tsx";

export type CartLine = { dishId: string; qty: number; note?: string };
export type MyOrder = { id: string; createdAt: string; totalCents: number; items: { name: string; qty: number }[] };

type Ctx = {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  favorites: string[];
  toggleFavorite: (id: string) => void;
  cart: CartLine[];
  setQty: (dishId: string, qty: number) => void;
  setNote: (dishId: string, note: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  table: Table | null;
  setTable: (t: Table | null) => void;
  myOrders: MyOrder[];
  addOrder: (o: MyOrder) => void;
  toast: (msg: string) => void;
};

const CustomerContext = createContext<Ctx | null>(null);
export const useCustomer = () => {
  const c = useContext(CustomerContext);
  if (!c) throw new Error("Fora do contexto do restaurante");
  return c;
};

export function Brand({ r, size = 22 }: { r: Restaurant; size?: number }) {
  return r.logoUrl ? (
    <img className="brand-logo" src={asset(r.logoUrl)} alt={r.name} style={{ height: size * 1.6 }} />
  ) : (
    <span className="brand-word" style={{ fontSize: size }}>{r.name}</span>
  );
}

export function CustomerShell() {
  const { slug = "" } = useParams();
  const restaurants = useList<Restaurant>("restaurants", undefined);
  const restaurant = restaurants.data.find((r) => r.slug === slug);
  const rid = restaurant?.id;
  const cats = useList<Category>("categories", rid);
  const dishes = useList<Dish>("dishes", rid);
  const [favorites, setFavorites] = useStored<string[]>(`mp:${slug}:fav`, []);
  const [cart, setCart] = useStored<CartLine[]>(`mp:${slug}:cart`, []);
  const [table, setTable] = useStored<Table | null>(`mp:${slug}:table`, null);
  const [myOrders, setMyOrders] = useStored<MyOrder[]>(`mp:${slug}:orders`, []);
  const [toastMsg, setToastMsg] = useState("");
  const loc = useLocation();
  useReveal(loc.pathname + (restaurant?.id ?? "") + dishes.data.length);
  useScrollVar();

  const toast = useCallback((m: string) => { setToastMsg(m); window.setTimeout(() => setToastMsg((c) => (c === m ? "" : c)), 2800); }, []);
  useEffect(() => { if (restaurant) document.title = `${restaurant.name} · Cardápio`; }, [restaurant]);

  const ctx = useMemo<Ctx | null>(() => {
    if (!restaurant) return null;
    const available = dishes.data.filter((d) => d.available);
    const byId = new Map(available.map((d) => [d.id, d]));
    const live = cart.filter((l) => byId.has(l.dishId));
    return {
      restaurant,
      categories: [...cats.data].sort((a, b) => a.sortOrder - b.sortOrder),
      dishes: [...available].sort((a, b) => a.sortOrder - b.sortOrder),
      favorites,
      toggleFavorite: (id) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])),
      cart: live,
      setQty: (dishId, qty) => setCart((c) => {
        const rest = c.filter((l) => l.dishId !== dishId);
        const cur = c.find((l) => l.dishId === dishId);
        return qty <= 0 ? rest : cur ? c.map((l) => (l.dishId === dishId ? { ...l, qty } : l)) : [...c, { dishId, qty }];
      }),
      setNote: (dishId, note) => setCart((c) => c.map((l) => (l.dishId === dishId ? { ...l, note } : l))),
      clearCart: () => setCart([]),
      cartCount: live.reduce((s, l) => s + l.qty, 0),
      cartTotal: live.reduce((s, l) => s + l.qty * (byId.get(l.dishId)?.priceCents ?? 0), 0),
      table, setTable,
      myOrders, addOrder: (o) => setMyOrders((m) => [o, ...m]),
      toast,
    };
  }, [restaurant, cats.data, dishes.data, favorites, cart, table, myOrders, setFavorites, setCart, setTable, setMyOrders, toast]);

  if (restaurants.loading || (restaurant && (cats.loading || dishes.loading))) return <div className="splash"><div className="spinner" /></div>;
  if (!ctx || !restaurant) return (
    <div className="splash"><div className="empty"><h2>Restaurante não encontrado</h2><p>Confira o endereço ou leia novamente o QR Code.</p><Link className="btn" to="/">Ir para a demonstração</Link></div></div>
  );

  const base = `/r/${slug}`;
  const tabs: [string, string, ReactNode, boolean?][] = [
    [base, "Início", <Home size={20} />, true],
    [`${base}/cardapio`, "Cardápio", <BookOpen size={20} />],
    [`${base}/favoritos`, "Favoritos", <Heart size={20} />],
    [`${base}/pedido`, "Pedido", <ShoppingBag size={20} />],
    [`${base}/sobre`, "A casa", <Info size={20} />],
  ];
  return (
    <CustomerContext.Provider value={ctx}>
      <div className="app" style={themeVars(restaurant.theme)}>
        <header className="topbar">
          <Link to={base} className="topbar-brand" aria-label={restaurant.name}><Brand r={restaurant} /></Link>
          <nav className="topnav" aria-label="Principal">
            {tabs.map(([to, label, , end]) => <NavLink key={to} to={to} end={end}>{label}{label === "Pedido" && <i data-cart-target="" className="cart-anchor">{ctx.cartCount > 0 && <b key={ctx.cartCount} className="badge">{ctx.cartCount}</b>}</i>}</NavLink>)}
          </nav>
          <span className="table-chip">{table ? table.label : "Sem mesa"}</span>
        </header>
        <main className="view" key={loc.pathname}><Outlet /></main>
        <nav className="tabbar" aria-label="Navegação">
          {tabs.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end}>
              <span className="tab-icon" {...(label === "Pedido" ? { "data-cart-target": "" } : {})}>{icon}{label === "Pedido" && ctx.cartCount > 0 && <b key={ctx.cartCount} className="badge">{ctx.cartCount}</b>}</span>
              <small>{label}</small>
            </NavLink>
          ))}
        </nav>
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </CustomerContext.Provider>
  );
}

/** Entrada pelo QR Code da mesa: identifica a mesa e segue para o cardápio. */
export function TableEntry() {
  const { slug = "", token = "" } = useParams();
  const nav = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    backend.tableByToken(slug, token).then((t) => {
      if (!t) return setError("Este QR Code não corresponde a uma mesa ativa.");
      localStorage.setItem(`mp:${slug}:table`, JSON.stringify(t));
      nav(`/r/${slug}`, { replace: true });
    }, (e: Error) => setError(e.message));
  }, [slug, token, nav]);
  if (error) return <div className="splash"><div className="empty"><h2>Mesa não identificada</h2><p>{error}</p><Link className="btn" to={`/r/${slug}`}>Ver o cardápio</Link></div></div>;
  return <div className="splash"><div className="spinner" /></div>;
}

export const HomeRedirect = () => <Navigate to="/r/maison" replace />;
