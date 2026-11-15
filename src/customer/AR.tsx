import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Box, CheckCircle2, Move3d, Plus, Ruler, ScanLine, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import type { Dish } from "../lib/types.ts";
import { asset, brl } from "../lib/util.ts";
import { useCustomer } from "./Shell.tsx";

type MV = HTMLElement & { canActivateAR: boolean; activateAR: () => Promise<void> };
type ArState = "loading" | "ready" | "unsupported" | "scanning" | "placed" | "failed";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/**
 * Visualizador 3D + AR espacial.
 * Android: WebXR (hit-test, âncora na superfície) com fallback para o Scene Viewer (ARCore).
 * iOS: AR Quick Look (ARKit), com USDZ enviado ou convertido do GLB no aparelho.
 * ar-scale="fixed" trava a escala: 1 unidade do modelo = 1 metro no mundo real.
 */
export function ModelStage({ dish, onState, mvRef }: { dish: Dish; onState?: (s: ArState) => void; mvRef?: React.MutableRefObject<MV | null> }) {
  const ref = useRef<MV | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { import("@google/model-viewer").then(() => setReady(true)); }, []);
  useEffect(() => {
    const mv = ref.current;
    if (!mv || !ready) return;
    if (mvRef) mvRef.current = mv;
    const onLoad = () => onState?.(mv.canActivateAR ? "ready" : "unsupported");
    const onStatus = (e: Event) => {
      const s = (e as CustomEvent<{ status: string }>).detail.status;
      onState?.(s === "session-started" ? "scanning" : s === "object-placed" ? "placed" : s === "failed" ? "failed" : mv.canActivateAR ? "ready" : "unsupported");
    };
    const onError = () => onState?.("failed");
    mv.addEventListener("load", onLoad);
    mv.addEventListener("ar-status", onStatus);
    mv.addEventListener("error", onError);
    return () => { mv.removeEventListener("load", onLoad); mv.removeEventListener("ar-status", onStatus); mv.removeEventListener("error", onError); };
  }, [ready, onState, mvRef]);
  if (!ready) return <div className="stage-loading"><div className="spinner" /></div>;
  const tall = dish.shape === "bottle" || dish.shape === "glass";
  return (
    <model-viewer
      ref={ref as never}
      src={asset(dish.modelUrl)}
      {...(dish.usdzUrl ? { "ios-src": asset(dish.usdzUrl) } : {})}
      alt={`Modelo 3D de ${dish.name}`}
      ar=""
      ar-modes="webxr scene-viewer quick-look"
      ar-scale="fixed"
      ar-placement="floor"
      xr-environment=""
      camera-controls=""
      touch-action="pan-y"
      interaction-prompt="auto"
      shadow-intensity="1.1"
      shadow-softness="0.9"
      exposure="1.05"
      camera-orbit={tall ? "25deg 78deg auto" : "20deg 52deg auto"}
      min-camera-orbit="auto 5deg auto"
      max-camera-orbit="auto 89deg auto"
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <span slot="ar-button" />
      <div slot="progress-bar" />
    </model-viewer>
  );
}

export function ARPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { restaurant, dishes, setQty, cart, toast } = useCustomer();
  const dish = dishes.find((d) => d.id === id);
  const mv = useRef<MV | null>(null);
  const [state, setState] = useState<ArState>("loading");
  const [qr, setQr] = useState("");
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => { if (!mobile) QRCode.toDataURL(location.href, { margin: 1, width: 220, color: { dark: "#111111", light: "#ffffff" } }).then(setQr); }, [mobile, id]);

  if (!dish || !dish.modelUrl) return <div className="empty"><h2>Este prato ainda não tem modelo 3D</h2><Link className="btn" to={`/r/${restaurant.slug}/cardapio`}>Voltar ao cardápio</Link></div>;
  const inCart = cart.find((l) => l.dishId === dish.id)?.qty ?? 0;
  const start = () => mv.current?.activateAR().catch(() => setState("failed"));

  const hint: Record<ArState, string> = {
    loading: "Carregando o modelo 3D…",
    ready: "Arraste para girar. Toque em “Ver na minha mesa” e aponte a câmera para a mesa.",
    unsupported: mobile
      ? "Este aparelho ou navegador não oferece AR. Android: use o Chrome com Google Play Services para RA (ARCore). iPhone/iPad: use o Safari."
      : "A realidade aumentada funciona no celular. Leia o QR Code ao lado para abrir este prato no seu aparelho.",
    scanning: "Mova o celular devagar sobre a mesa até a superfície ser detectada.",
    placed: "Prato ancorado na mesa em tamanho real. Caminhe ao redor para ver outros ângulos.",
    failed: "Não foi possível iniciar a AR. Verifique a permissão da câmera e tente novamente.",
  };

  return (
    <div className="ar-page">
      <div className="ar-stage">
        <ModelStage dish={dish} onState={setState} mvRef={mv} />
        <button className="round back" onClick={() => nav(-1)} aria-label="Voltar"><ArrowLeft size={20} /></button>
        <span className="scale-tag"><Ruler size={14} /> Escala 1:1 · {fmt(dish.widthCm)} × {fmt(dish.depthCm)} × {fmt(dish.heightCm)} cm</span>
      </div>
      <div className="ar-panel">
        <span className="eyebrow">Realidade aumentada</span>
        <h1>{dish.name}</h1>
        <div className="price">{brl(dish.priceCents)}</div>
        <p className={`ar-hint ${state}`} role="status">
          {state === "placed" ? <CheckCircle2 size={18} /> : state === "scanning" ? <ScanLine size={18} /> : <Move3d size={18} />} {hint[state]}
        </p>
        <button className="btn block" disabled={state === "loading" || state === "unsupported"} onClick={start}><Box size={18} /> Ver na minha mesa</button>
        <button className="btn ghost block" onClick={() => { setQty(dish.id, inCart + 1); toast(`${dish.name} adicionado ao pedido`); }}><Plus size={17} /> Adicionar ao pedido</button>
        {!mobile && qr && (
          <div className="qr-box"><img src={qr} alt="QR Code para abrir no celular" /><div><b><Smartphone size={15} /> Abra no celular</b><p>Aponte a câmera do celular para o código e toque em “Ver na minha mesa”.</p></div></div>
        )}
        <details className="ar-info">
          <summary>Como funciona</summary>
          <p>O prato é um modelo 3D nas dimensões reais cadastradas pelo restaurante. O ARCore (Android) ou o ARKit (iPhone) detecta a superfície da mesa, ancora o modelo e mantém a posição enquanto você se move.</p>
          <p>{dish.shape === "plate" || dish.shape === "bowl" ? "A louça tem geometria real; a comida é representada pela fotografia de topo aplicada sobre o prato, com relevo suave." : "Modelo genérico da garrafa/taça nas dimensões reais."}</p>
        </details>
      </div>
    </div>
  );
}
