import { useEffect, useState, type ImgHTMLAttributes } from "react";

/** Revela elementos [data-reveal] quando entram na tela (com escalonamento via --i). */
export function useReveal(dep: unknown) {
  useEffect(() => {
    const root = document.querySelector(".view");
    if (!root) return;
    if (!("IntersectionObserver" in window)) { root.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
    const scan = () => root.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [dep]);
}

/** Expõe a rolagem como --sy (px) para efeitos de paralaxe em CSS. */
export function useScrollVar() {
  useEffect(() => {
    let raf = 0;
    const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; document.documentElement.style.setProperty("--sy", String(Math.min(window.scrollY, 1200))); }); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
}

/** Imagem com esqueleto cintilante e entrada suave ao carregar. */
export function Img({ className = "", ...p }: ImgHTMLAttributes<HTMLImageElement>) {
  const [ok, setOk] = useState(false);
  return <img {...p} className={`img-fade${ok ? " ok" : ""} ${className}`} onLoad={() => setOk(true)} ref={(el) => { if (el?.complete && el.naturalWidth) setOk(true); }} />;
}

/** Ponto dourado que "voa" do botão até o ícone do pedido. */
export function flyToCart(from: Element) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const targets = [...document.querySelectorAll<HTMLElement>("[data-cart-target]")].filter((t) => t.offsetParent !== null);
  const to = targets[0]?.getBoundingClientRect();
  if (!to) return;
  const a = from.getBoundingClientRect();
  const dot = document.createElement("i");
  dot.className = "fly-dot";
  document.body.appendChild(dot);
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = to.left + to.width / 2, y1 = to.top + to.height / 2;
  dot.animate([
    { transform: `translate(${x0}px,${y0}px) scale(1)`, opacity: 1 },
    { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 90}px) scale(1.25)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${x1}px,${y1}px) scale(.3)`, opacity: 0.2 },
  ], { duration: 650, easing: "cubic-bezier(.3,.6,.3,1)" }).onfinish = () => {
    dot.remove();
    targets[0].animate([{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 320 });
  };
}

export const letters = (text: string) => [...text].map((ch, i) => <span key={i} style={{ "--i": i } as React.CSSProperties}>{ch === " " ? " " : ch}</span>);
