import { createContext, useContext, useEffect, useState, type FormEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, Building2, ClipboardList, ExternalLink, LayoutGrid, LogOut, Palette, QrCode, Tags, UtensilsCrossed } from "lucide-react";
import { backend, DEMO_ACCOUNTS, notify } from "../lib/store.ts";
import type { Restaurant, Session } from "../lib/types.ts";
import { useList, useStored } from "../lib/util.ts";

type AdminCtx = { session: Session; restaurant: Restaurant; restaurants: Restaurant[]; select: (id: string) => void; flash: (m: string, bad?: boolean) => void };
const Ctx = createContext<AdminCtx | null>(null);
export const useAdmin = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("Fora do painel");
  return c;
};

/** Executa uma mutação, avisa as telas e mostra o resultado. */
export function useAction() {
  const { flash } = useAdmin();
  return async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); notify(); if (ok) flash(ok); return true; }
    catch (e) { flash((e as Error).message, true); return false; }
  };
}

export function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { await backend.signIn(email, password); nav("/admin", { replace: true }); }
    catch (err) { setError((err as Error).message); }
    setBusy(false);
  };
  return (
    <div className="admin login">
      <form className="login-card" onSubmit={submit}>
        <span className="brand-word">Maison</span>
        <small className="eyebrow">Premium AR · Painel</small>
        <label>E-mail<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn block" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        {backend.mode === "local" && (
          <div className="demo-box">
            <b>Modo demonstração</b>
            <p>Os dados ficam salvos neste navegador. Contas de teste:</p>
            {DEMO_ACCOUNTS.map((a) => (
              <button type="button" key={a.email} onClick={() => { setEmail(a.email); setPassword(a.password); }}>
                {a.role === "platform" ? "Plataforma (todos os restaurantes)" : "Gerente (apenas Brasa & Co.)"}<small>{a.email} · {a.password}</small>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}

export function AdminShell() {
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const all = useList<Restaurant>("restaurants", undefined);
  const [rid, setRid] = useStored<string>("mp:admin:rid", "");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => { backend.session().then((s) => { if (!s) nav("/admin/login", { replace: true }); setSession(s); }); }, [nav]);
  if (!session || all.loading) return <div className="admin splash"><div className="spinner" /></div>;

  const restaurants = all.data.filter((r) => session.restaurantIds === "all" || session.restaurantIds.includes(r.id));
  const restaurant = restaurants.find((r) => r.id === rid) ?? restaurants[0];
  const flash = (text: string, bad?: boolean) => { setMsg({ text, bad }); window.setTimeout(() => setMsg(null), 3200); };
  const logout = async () => { await backend.signOut(); nav("/admin/login", { replace: true }); };

  if (!restaurant) return <div className="admin splash"><div className="empty"><h2>Nenhum restaurante vinculado a esta conta</h2><button className="btn" onClick={logout}>Sair</button></div></div>;

  const links = [
    ["/admin", "Indicadores", <BarChart3 size={18} />, true],
    ["/admin/pedidos", "Pedidos", <ClipboardList size={18} />],
    ["/admin/produtos", "Produtos e AR", <UtensilsCrossed size={18} />],
    ["/admin/categorias", "Categorias", <Tags size={18} />],
    ["/admin/mesas", "Mesas e QR Codes", <QrCode size={18} />],
    ["/admin/marca", "Identidade visual", <Palette size={18} />],
    ...(session.role === "platform" ? [["/admin/restaurantes", "Restaurantes", <Building2 size={18} />]] : []),
  ] as [string, string, JSX.Element, boolean?][];

  return (
    <Ctx.Provider value={{ session, restaurant, restaurants, select: setRid, flash }}>
      <div className="admin">
        <aside className="side">
          <div className="side-brand"><LayoutGrid size={18} /><div><b>Maison Premium AR</b><small>Painel administrativo</small></div></div>
          <label className="tenant">Restaurante
            <select value={restaurant.id} onChange={(e) => setRid(e.target.value)} aria-label="Restaurante ativo">
              {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <nav>{links.map(([to, label, icon, end]) => <NavLink key={to} to={to} end={end}>{icon}{label}</NavLink>)}</nav>
          <div className="side-foot">
            <a href={`#/r/${restaurant.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={16} />Abrir cardápio</a>
            <button onClick={logout}><LogOut size={16} />Sair · {session.email}</button>
            <small className={`mode ${backend.mode}`}>{backend.mode === "supabase" ? "Banco de dados: Supabase" : "Modo demonstração · dados neste navegador"}</small>
          </div>
        </aside>
        <main className="admin-main"><Outlet key={restaurant.id} /></main>
        {msg && <div className={`toast${msg.bad ? " bad" : ""}`} role="status">{msg.text}</div>}
      </div>
    </Ctx.Provider>
  );
}
