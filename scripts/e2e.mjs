// Teste funcional de ponta a ponta + capturas REAIS do aplicativo em execução.
//   npm run build && npm run e2e            (usa `vite preview`)
//   E2E_URL=https://... npm run e2e         (testa uma publicação)
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.env.E2E_OUT ?? "docs/screenshots";
await mkdir(OUT, { recursive: true });
let server;
let base = process.env.E2E_URL;
if (!base) {
  server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], { stdio: "ignore" });
  base = "http://127.0.0.1:4173/";
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base)).ok) break; } catch { /* aguardando */ } await new Promise((r) => setTimeout(r, 250)); }
}
const chrome = ["/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(chrome && !process.env.CI ? { executablePath: chrome } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`); };
const errors = [];

try {
  /* ------------------------------------------------ cliente (celular) */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36" });
  ctx.setDefaultTimeout(15000);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const go = async (hash) => { await page.goto(`${base}#${hash}`); await page.waitForLoadState("networkidle"); };
  const shot = async (name, p = page) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${name}.png` }); };

  await go("/r/maison");
  await page.getByRole("heading", { name: "Maison", level: 1 }).waitFor();
  check("Home carrega com a marca do restaurante", true);
  await shot("01-home");
  await page.evaluate(() => window.scrollTo(0, 900)); await shot("02-home-categorias");

  await go("/r/maison/cardapio");
  const cards = await page.locator(".dish-card").count();
  check("Cardápio lista 30+ produtos", cards >= 30, `${cards} produtos`);
  const groups = await page.locator(".menu-group").count();
  check("Cardápio tem as 8 categorias", groups === 8, `${groups} categorias`);
  const broken = await page.evaluate(async () => {
    const urls = [...document.querySelectorAll(".dish-photo img")].map((i) => i.src);
    const ok = await Promise.all(urls.map((u) => fetch(u).then((r) => r.ok && (r.headers.get("content-type") || "").startsWith("image/"), () => false)));
    return ok.filter((x) => !x).length;
  });
  check("Todas as fotografias dos pratos carregam", broken === 0, `${broken} quebradas`);
  await shot("03-cardapio");

  await page.getByLabel("Buscar no cardápio").fill("trufa");
  const found = await page.locator(".dish-card").count();
  check("Busca por ingrediente filtra o cardápio", found > 0 && found < cards, `${found} resultados para "trufa"`);
  await shot("04-busca");

  await go("/r/maison/prato/maison-vieiras");
  await page.getByRole("heading", { name: "Vieiras Seladas" }).waitFor();
  check("Página do prato mostra ingredientes e dimensões", (await page.locator(".ingredients li").count()) >= 4 && (await page.locator(".dims b").first().innerText()).includes("27"));
  await page.getByRole("button", { name: "Favoritar" }).click();
  await shot("05-prato");

  await go("/r/maison/favoritos");
  check("Favoritos guarda o prato marcado", (await page.locator(".dish-card").count()) === 1);
  await shot("06-favoritos");

  await go("/r/maison/ar/maison-vieiras");
  const loaded = await page.waitForFunction(() => { const m = document.querySelector("model-viewer"); return m && m.loaded; }, null, { timeout: 30000 }).then(() => true, () => false);
  check("Modelo 3D (GLB) carrega no visualizador", loaded);
  const dimsM = await page.evaluate(() => { const d = document.querySelector("model-viewer").getDimensions(); return [d.x, d.y, d.z]; });
  check("Modelo está em escala real (27 cm de diâmetro)", Math.abs(dimsM[0] - 0.27) < 0.002 && Math.abs(dimsM[2] - 0.27) < 0.002, `${(dimsM[0] * 100).toFixed(1)} × ${(dimsM[2] * 100).toFixed(1)} × ${(dimsM[1] * 100).toFixed(1)} cm`);
  const arAttrs = await page.evaluate(() => { const m = document.querySelector("model-viewer"); return [m.getAttribute("ar-modes"), m.getAttribute("ar-scale"), m.getAttribute("ar-placement")].join("|"); });
  check("AR configurada: WebXR + Scene Viewer + Quick Look, escala fixa, superfície horizontal", arAttrs === "webxr scene-viewer quick-look|fixed|floor", arAttrs);
  await page.waitForTimeout(2500); await shot("07-ar-visualizador-3d");

  await go("/r/maison/mesa/mz01k");
  await page.getByText("Mesa 1").first().waitFor();
  check("QR Code da mesa identifica a Mesa 1", true);
  await go("/r/maison/cardapio");
  await page.getByRole("button", { name: "Adicionar Vieiras Seladas ao pedido" }).click();
  await page.getByRole("button", { name: "Adicionar Magret de Canard ao pedido" }).click();
  await page.getByRole("button", { name: "Adicionar Magret de Canard ao pedido" }).click();
  await go("/r/maison/pedido");
  const total = await page.locator(".total b").first().innerText();
  check("Carrinho soma corretamente (98 + 2×168 = R$ 434,00)", total.replace(/\s/g, " ").includes("434,00"), total);
  await page.getByLabel("Observação para Magret de Canard").fill("Ao ponto");
  await shot("08-carrinho");
  await page.getByRole("button", { name: "Enviar pedido à cozinha" }).click();
  await page.locator(".order").first().waitFor();
  check("Pedido enviado e vinculado à mesa", (await page.locator(".order .status").first().innerText()).toLowerCase() === "novo");
  await page.getByRole("button", { name: "Chamar garçom" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Pedir a conta" }).click();
  await shot("09-pedido-enviado");

  await go("/r/maison/sobre"); await shot("10-sobre");
  await go("/r/brasa");
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector(".app")).backgroundColor);
  check("White-label: segundo restaurante com outro tema", bg === "rgb(251, 246, 238)", bg);
  await shot("11-white-label-brasa");
  await go("/r/brasa/cardapio");
  check("White-label: cardápio isolado (3 produtos da Brasa)", (await page.locator(".dish-card").count()) === 3);
  await shot("12-white-label-brasa-cardapio");

  /* ------------------------------------------------------ desktop */
  const d = await ctx.browser().newContext({ viewport: { width: 1440, height: 900 }, storageState: await ctx.storageState() });
  d.setDefaultTimeout(15000);
  const dp = await d.newPage();
  dp.on("pageerror", (e) => errors.push(e.message));
  dp.on("dialog", (dlg) => dlg.accept());
  const dgo = async (hash) => { await dp.goto(`${base}#${hash}`); await dp.waitForLoadState("networkidle"); };
  await dgo("/r/maison"); await shot("13-desktop-home", dp);
  await dgo("/r/maison/cardapio"); await shot("14-desktop-cardapio", dp);
  await dgo("/r/maison/ar/maison-lagosta");
  await dp.waitForFunction(() => document.querySelector("model-viewer")?.loaded, null, { timeout: 30000 }).catch(() => {});
  await dp.locator(".qr-box img").waitFor();
  check("Desktop: AR oferece QR Code para abrir no celular", true);
  await dp.waitForTimeout(2500); await shot("15-desktop-ar", dp);

  /* -------------------------------------------------------- painel */
  await dgo("/admin");
  await dp.getByLabel("E-mail").waitFor();
  check("Painel exige autenticação", dp.url().includes("/admin/login"));
  await dp.getByLabel("E-mail").fill("admin@maison.demo"); await dp.getByLabel("Senha").fill("errada");
  await dp.getByRole("button", { name: "Entrar" }).click();
  check("Senha incorreta é rejeitada", await dp.getByRole("alert").isVisible());
  await shot("16-admin-login", dp);
  await dp.getByLabel("Senha").fill("maison2026");
  await dp.getByRole("button", { name: "Entrar" }).click();
  await dp.getByRole("heading", { name: "Indicadores" }).waitFor();
  const kpi = await dp.locator(".kpis div").first().innerText();
  check("Indicadores refletem o pedido feito pelo cliente", kpi.replace(/\s/g, " ").includes("434,00"), kpi.replace(/\n/g, " "));
  await shot("17-admin-indicadores", dp);

  await dgo("/admin/pedidos");
  await dp.locator(".ticket").first().waitFor();
  check("Pedido chega ao painel com mesa e observação", (await dp.locator(".ticket").first().innerText()).includes("Mesa 1") && (await dp.locator(".ticket em").first().innerText()).includes("Ao ponto"));
  check("Chamados de garçom e conta aparecem", (await dp.locator(".call").count()) === 2);
  await shot("18-admin-pedidos", dp);
  await dp.getByRole("button", { name: /Em preparo/ }).click();
  await dp.locator(".col.preparo .ticket").waitFor();
  check("Pedido avança para Em preparo", true);

  await dgo("/admin/produtos");
  check("Gestão de produtos lista o cardápio", (await dp.locator(".tr").count()) > 30);
  await shot("19-admin-produtos", dp);
  await dp.getByRole("button", { name: "Editar Vieiras Seladas" }).click();
  await shot("20-admin-produto-dados", dp);
  await dp.getByRole("button", { name: "Realidade aumentada" }).click();
  await dp.getByLabel("Largura (cm)").fill("32"); await dp.getByLabel("Profundidade (cm)").fill("32");
  await dp.getByRole("button", { name: /Gerar novamente/ }).click();
  await dp.locator(".ok-line").waitFor({ timeout: 20000 });
  const gen = await dp.locator(".ok-line").innerText();
  check("Cadastro AR gera novo GLB nas dimensões informadas (32 cm)", gen.includes("32.0 × 32.0"), gen);
  await dp.waitForFunction(() => document.querySelector(".ar-preview model-viewer")?.loaded, null, { timeout: 30000 }).catch(() => {});
  await dp.waitForTimeout(2000); await shot("21-admin-cadastro-ar", dp);
  await dp.getByRole("button", { name: "Salvar produto" }).click();
  await dp.locator(".modal").waitFor({ state: "detached" });

  await dp.getByLabel("Disponibilidade de Burrata Trufada").uncheck({ force: true });
  await dp.waitForTimeout(300);
  await dgo("/r/maison/cardapio");
  check("Produto pausado some do cardápio do cliente", (await dp.getByRole("heading", { name: "Burrata Trufada" }).count()) === 0);
  await dgo("/admin/categorias"); await shot("22-admin-categorias", dp);
  await dgo("/admin/mesas");
  await dp.locator(".qr-card img").first().waitFor();
  check("QR Codes das mesas são gerados", (await dp.locator(".qr-card img").count()) === 12);
  await shot("23-admin-mesas-qr", dp);

  await dgo("/admin/marca");
  await dp.getByRole("button", { name: "Hotel" }).click();
  await shot("24-admin-identidade-visual", dp);
  await dp.getByRole("button", { name: "Alta gastronomia" }).click();

  await dgo("/admin/restaurantes");
  await dp.getByLabel("Nome do novo restaurante").fill("Café Aurora");
  await dp.getByRole("button", { name: "Criar restaurante" }).click();
  await dp.getByText("#/r/cafe-aurora").waitFor();
  check("Plataforma cria novo restaurante (multi-tenant)", true);
  await shot("25-admin-restaurantes", dp);
  await dgo("/r/cafe-aurora");
  check("Novo restaurante já tem cardápio público próprio", await dp.getByRole("heading", { name: "Café Aurora", level: 1 }).isVisible());

  /* ---------------------------------------------------- isolamento */
  await dgo("/admin");
  await dp.getByRole("button", { name: /Sair/ }).click();
  await dp.getByLabel("E-mail").fill("gerente@brasa.demo"); await dp.getByLabel("Senha").fill("brasa2026");
  await dp.getByRole("button", { name: "Entrar" }).click();
  await dp.getByRole("heading", { name: "Indicadores" }).waitFor();
  const options = await dp.getByLabel("Restaurante ativo").locator("option").allInnerTexts();
  check("Isolamento: gerente da Brasa só enxerga a Brasa", options.length === 1 && options[0] === "Brasa & Co.", options.join(", "));
  check("Isolamento: gerente não vê o menu Restaurantes", (await dp.getByRole("link", { name: "Restaurantes" }).count()) === 0);
  await shot("26-admin-isolamento-gerente", dp);

  // No modo demonstração os dados vivem no navegador: o status é conferido no mesmo contexto do painel.
  await dp.setViewportSize({ width: 390, height: 844 });
  await dgo("/r/maison/pedido");
  await dp.locator(".order .status").first().waitFor();
  await dp.waitForTimeout(800);
  check("Cliente acompanha o status do pedido (Em preparo)", (await dp.locator(".order .status").first().innerText()).toLowerCase() === "em preparo");
  await shot("27-pedido-status-atualizado", dp);
  check("Nenhum erro de JavaScript durante o teste", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  check(`Execução interrompida: ${e.message.split("\n")[0]}`, false);
} finally {
  await browser.close();
  server?.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} verificações aprovadas`);
process.exit(failed ? 1 : 0);
