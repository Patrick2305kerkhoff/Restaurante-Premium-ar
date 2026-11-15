import { useEffect, useRef, useState } from "react";
import { Box, Check, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { ModelStage } from "../customer/AR.tsx";
import { buildGlb, glbBounds } from "../lib/glb.ts";
import { backend, uid } from "../lib/store.ts";
import type { Category, Dish, ModelShape } from "../lib/types.ts";
import { asset, toJpeg, useList } from "../lib/util.ts";
import { useAction, useAdmin } from "./Shell.tsx";

const SHAPES: [ModelShape, string][] = [["plate", "Prato"], ["bowl", "Bowl / prato fundo"], ["bottle", "Garrafa"], ["glass", "Taça / copo"]];

export function ProductsPage() {
  const { restaurant } = useAdmin();
  const run = useAction();
  const dishes = useList<Dish>("dishes", restaurant.id);
  const cats = useList<Category>("categories", restaurant.id);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<Dish | null>(null);
  const sortedCats = [...cats.data].sort((a, b) => a.sortOrder - b.sortOrder);
  const list = dishes.data
    .filter((d) => (!cat || d.categoryId === cat) && d.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sortedCats.findIndex((c) => c.id === a.categoryId) - sortedCats.findIndex((c) => c.id === b.categoryId) || a.sortOrder - b.sortOrder);
  const blank = (): Dish => ({
    id: uid(), restaurantId: restaurant.id, categoryId: cat || sortedCats[0]?.id || "", name: "", description: "", ingredients: [], priceCents: 0,
    available: true, featured: false, photoUrl: null, topPhotoUrl: null, modelUrl: null, usdzUrl: null, shape: "plate", widthCm: 27, depthCm: 27, heightCm: 4, sortOrder: dishes.data.length,
  });
  return (
    <>
      <header className="admin-head">
        <div><h1>Produtos e AR</h1><p>{dishes.data.length} produtos · {dishes.data.filter((d) => d.modelUrl).length} com realidade aumentada</p></div>
        <div className="head-actions"><button className="btn sm" disabled={!sortedCats.length} onClick={() => setEditing(blank())}><Plus size={15} /> Novo produto</button></div>
      </header>
      <div className="filters">
        <label className="search"><Search size={16} /><input placeholder="Buscar produto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar produto" /></label>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>{sortedCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div className="table">
        <div className="tr th"><span>Produto</span><span>Categoria</span><span>Preço</span><span>Dimensões</span><span>AR</span><span>Disponível</span><span /></div>
        {list.map((d) => (
          <div className="tr" key={d.id}>
            <span className="prod">{d.photoUrl ? <img src={asset(d.photoUrl)} alt="" loading="lazy" /> : <i />}<b>{d.name}</b></span>
            <span>{cats.data.find((c) => c.id === d.categoryId)?.name ?? "—"}</span>
            <span>
              <input className="price-input" type="number" step="0.01" min="0" defaultValue={(d.priceCents / 100).toFixed(2)} aria-label={`Preço de ${d.name}`}
                onBlur={(e) => { const v = Math.round(parseFloat(e.target.value) * 100); if (Number.isFinite(v) && v >= 0 && v !== d.priceCents) run(() => backend.upsert("dishes", { ...d, priceCents: v }), "Preço atualizado"); }} />
            </span>
            <span>{d.widthCm} × {d.depthCm} × {d.heightCm} cm</span>
            <span>{d.modelUrl ? <em className="ok"><Box size={14} /> 3D</em> : <em className="no">Sem modelo</em>}</span>
            <span><label className="switch"><input type="checkbox" checked={d.available} onChange={(e) => run(() => backend.upsert("dishes", { ...d, available: e.target.checked }), e.target.checked ? "Produto disponível" : "Produto pausado")} aria-label={`Disponibilidade de ${d.name}`} /><i /></label></span>
            <span className="row-actions">
              <button className="icon" onClick={() => setEditing(d)} aria-label={`Editar ${d.name}`}><Pencil size={16} /></button>
              <button className="icon danger" onClick={() => confirm(`Excluir ${d.name}?`) && run(() => backend.remove("dishes", d.id), "Produto excluído")} aria-label={`Excluir ${d.name}`}><Trash2 size={16} /></button>
            </span>
          </div>
        ))}
        {!list.length && <p className="muted pad">Nenhum produto encontrado.</p>}
      </div>
      {editing && <DishEditor dish={editing} categories={sortedCats} onClose={() => setEditing(null)} />}
    </>
  );
}

function DishEditor({ dish, categories, onClose }: { dish: Dish; categories: Category[]; onClose: () => void }) {
  const { restaurant } = useAdmin();
  const run = useAction();
  const [d, setD] = useState(dish);
  const [tab, setTab] = useState<"dados" | "ar">("dados");
  const [busy, setBusy] = useState("");
  const [topFile, setTopFile] = useState<Blob | null>(null);
  const [crop, setCrop] = useState({ zoom: 1, x: 0, y: 0 });
  const [info, setInfo] = useState("");
  const [ing, setIng] = useState(dish.ingredients.join(", "));
  const canvas = useRef<HTMLCanvasElement>(null);
  const set = (p: Partial<Dish>) => setD((x) => ({ ...x, ...p }));
  const textured = d.shape === "plate" || d.shape === "bowl";

  // Pré-visualização do recorte circular: o prato deve tocar a borda do círculo.
  useEffect(() => {
    if (!topFile || !canvas.current) return;
    let live = true;
    toJpeg(topFile, 320, crop).then(createImageBitmap).then((bmp) => {
      if (!live || !canvas.current) return;
      const ctx = canvas.current.getContext("2d")!;
      ctx.clearRect(0, 0, 320, 320);
      ctx.drawImage(bmp, 0, 0);
      ctx.fillStyle = "rgba(0,0,0,.6)";
      ctx.beginPath(); ctx.rect(0, 0, 320, 320); ctx.arc(160, 160, 158, 0, Math.PI * 2, true); ctx.fill();
      ctx.strokeStyle = "#c9a45c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(160, 160, 158, 0, Math.PI * 2); ctx.stroke();
    });
    return () => { live = false; };
  }, [topFile, crop]);

  const task = async (label: string, fn: () => Promise<void>) => { setBusy(label); await run(fn); setBusy(""); };

  const uploadPhoto = (file?: File) => file && task("Enviando foto…", async () => set({ photoUrl: await backend.upload(restaurant.id, await toJpeg(file, 1200), "foto.jpg") }));

  const generate = () => task("Gerando modelo 3D…", async () => {
    let texture: Uint8Array | undefined;
    let topPhotoUrl = d.topPhotoUrl;
    if (textured) {
      const source = topFile ?? (d.topPhotoUrl ? await (await fetch(asset(d.topPhotoUrl))).blob() : null);
      if (!source) throw new Error("Envie a foto de topo do prato para gerar o modelo.");
      const jpg = await toJpeg(source, 768, topFile ? crop : { zoom: 1, x: 0, y: 0 });
      texture = new Uint8Array(await jpg.arrayBuffer());
      if (topFile) topPhotoUrl = await backend.upload(restaurant.id, jpg, "topo.jpg");
    }
    const glb = buildGlb({ shape: d.shape, widthCm: d.widthCm, depthCm: d.depthCm, heightCm: d.heightCm, texture });
    const b = glbBounds(glb);
    const modelUrl = await backend.upload(restaurant.id, new Blob([glb as BlobPart], { type: "model/gltf-binary" }), "modelo.glb");
    set({ modelUrl, topPhotoUrl, usdzUrl: null });
    setTopFile(null);
    setInfo(`Modelo gerado: ${(b.width * 100).toFixed(1)} × ${(b.depth * 100).toFixed(1)} × ${(b.height * 100).toFixed(1)} cm · ${(glb.byteLength / 1024).toFixed(0)} KB`);
  });

  const uploadModel = (file: File | undefined, key: "modelUrl" | "usdzUrl") => file && task("Enviando modelo…", async () => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (key === "modelUrl" && ext !== "glb") throw new Error("Envie um arquivo .glb (glTF binário).");
    if (key === "usdzUrl" && ext !== "usdz") throw new Error("Envie um arquivo .usdz.");
    const type = key === "modelUrl" ? "model/gltf-binary" : "model/vnd.usdz+zip";
    set({ [key]: await backend.upload(restaurant.id, new Blob([await file.arrayBuffer()], { type }), file.name) });
    setInfo("Modelo enviado. Confira a escala na pré-visualização: 1 unidade do arquivo deve ser 1 metro.");
  });

  const save = async () => {
    if (!d.name.trim()) return run(async () => { throw new Error("Informe o nome do produto."); });
    if (!(d.widthCm > 0 && d.depthCm > 0 && d.heightCm > 0)) return run(async () => { throw new Error("Informe as dimensões em centímetros."); });
    if (await run(() => backend.upsert("dishes", { ...d, name: d.name.trim(), ingredients: ing.split(",").map((s) => s.trim()).filter(Boolean) }), "Produto salvo")) onClose();
  };
  const num = (v: string) => Math.max(0, parseFloat(v.replace(",", ".")) || 0);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Editar produto">
      <div className="modal-card">
        <header><h2>{dish.name || "Novo produto"}</h2><button className="icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
        <div className="tabs"><button className={tab === "dados" ? "on" : ""} onClick={() => setTab("dados")}>Dados</button><button className={tab === "ar" ? "on" : ""} onClick={() => setTab("ar")}>Realidade aumentada</button></div>
        {tab === "dados" ? (
          <div className="form modal-body">
            <div className="photo-field">
              {d.photoUrl ? <img src={asset(d.photoUrl)} alt="" /> : <div className="photo-missing">Sem foto</div>}
              <label className="btn sm ghost"><Upload size={15} /> Enviar fotografia<input hidden type="file" accept="image/*" onChange={(e) => uploadPhoto(e.target.files?.[0])} /></label>
            </div>
            <label>Nome<input value={d.name} onChange={(e) => set({ name: e.target.value })} /></label>
            <div className="two">
              <label>Categoria<select value={d.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>Preço (R$)<input type="number" step="0.01" min="0" value={d.priceCents / 100} onChange={(e) => set({ priceCents: Math.round(num(e.target.value) * 100) })} /></label>
            </div>
            <label>Descrição<textarea rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} /></label>
            <label>Ingredientes (separados por vírgula)<input value={ing} onChange={(e) => setIng(e.target.value)} /></label>
            <div className="two checks">
              <label><input type="checkbox" checked={d.available} onChange={(e) => set({ available: e.target.checked })} /> Disponível</label>
              <label><input type="checkbox" checked={d.featured} onChange={(e) => set({ featured: e.target.checked })} /> Destaque da casa</label>
            </div>
          </div>
        ) : (
          <div className="modal-body ar-editor">
            <div className="form">
              <div className="steps-mini"><b>1</b> Forma e dimensões reais</div>
              <label>Forma<select value={d.shape} onChange={(e) => set({ shape: e.target.value as ModelShape })}>{SHAPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <div className="three">
                <label>Largura (cm)<input type="number" step="0.1" min="1" value={d.widthCm} onChange={(e) => set({ widthCm: num(e.target.value) })} /></label>
                <label>Profundidade (cm)<input type="number" step="0.1" min="1" value={d.depthCm} onChange={(e) => set({ depthCm: num(e.target.value) })} /></label>
                <label>Altura (cm)<input type="number" step="0.1" min="0.5" value={d.heightCm} onChange={(e) => set({ heightCm: num(e.target.value) })} /></label>
              </div>
              {textured && (
                <>
                  <div className="steps-mini"><b>2</b> Foto de topo do prato</div>
                  <p className="help">Fotografe o prato exatamente de cima, inteiro e com luz uniforme. Ajuste até a borda do prato encostar no círculo.</p>
                  <label className="btn sm ghost"><Upload size={15} /> Escolher foto de topo<input hidden type="file" accept="image/*" onChange={(e) => { setTopFile(e.target.files?.[0] ?? null); setCrop({ zoom: 1, x: 0, y: 0 }); }} /></label>
                  {topFile && (
                    <div className="cropper">
                      <canvas ref={canvas} width={320} height={320} />
                      <div>
                        <label>Zoom<input type="range" min={1} max={2.5} step={0.01} value={crop.zoom} onChange={(e) => setCrop({ ...crop, zoom: +e.target.value })} /></label>
                        <label>Horizontal<input type="range" min={-0.6} max={0.6} step={0.005} value={crop.x} onChange={(e) => setCrop({ ...crop, x: +e.target.value })} /></label>
                        <label>Vertical<input type="range" min={-0.6} max={0.6} step={0.005} value={crop.y} onChange={(e) => setCrop({ ...crop, y: +e.target.value })} /></label>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="steps-mini"><b>{textured ? 3 : 2}</b> Gerar o modelo em escala real</div>
              <button className="btn sm" disabled={!!busy} onClick={generate}><Box size={15} /> {d.modelUrl ? "Gerar novamente" : "Gerar modelo 3D"}</button>
              {info && <p className="ok-line"><Check size={15} /> {info}</p>}
              <details className="limits" open={!d.modelUrl}>
                <summary>Limitações e alternativa profissional</summary>
                <p>Uma única fotografia não contém profundidade: não é possível reconstruir o volume real da comida a partir dela. O modelo gerado aqui tem a geometria real da louça nas medidas informadas e usa a foto de topo como superfície, com relevo suave. É AR espacial verdadeira (ancorada na mesa, em escala 1:1), mas vista de lado a comida parece baixa.</p>
                <p>Para volume fiel, capture o prato por fotogrametria (20 a 40 fotos ao redor, ou o modo Object Capture do iPhone / apps como Polycam e RealityScan), exporte em <b>GLB</b> (e opcionalmente <b>USDZ</b>) com unidade em metros e envie abaixo.</p>
                <div className="two">
                  <label className="btn sm ghost"><Upload size={15} /> Enviar .glb<input hidden type="file" accept=".glb,model/gltf-binary" onChange={(e) => uploadModel(e.target.files?.[0], "modelUrl")} /></label>
                  <label className="btn sm ghost"><Upload size={15} /> Enviar .usdz (iOS)<input hidden type="file" accept=".usdz" onChange={(e) => uploadModel(e.target.files?.[0], "usdzUrl")} /></label>
                </div>
              </details>
              {d.modelUrl && <button className="link danger" onClick={() => { set({ modelUrl: null, usdzUrl: null }); setInfo(""); }}>Remover modelo 3D</button>}
            </div>
            <div className="ar-preview">
              {d.modelUrl ? <ModelStage key={d.modelUrl} dish={d} /> : <div className="photo-missing">O modelo 3D aparece aqui</div>}
              <small>{d.widthCm} × {d.depthCm} × {d.heightCm} cm · arraste para girar</small>
            </div>
          </div>
        )}
        <footer>
          <span className="muted">{busy}</span>
          <button className="btn sm ghost" onClick={onClose}>Cancelar</button>
          <button className="btn sm" disabled={!!busy} onClick={save}>Salvar produto</button>
        </footer>
      </div>
    </div>
  );
}
