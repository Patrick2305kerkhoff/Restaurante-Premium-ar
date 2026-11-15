import type { Category, Dish, ModelShape, Restaurant, Table, Theme } from "../lib/types.ts";

/**
 * Dados do restaurante demonstrativo. As fotografias em /public/demo são
 * IMAGENS DEMONSTRATIVAS geradas para apresentação comercial; em cada
 * restaurante contratante são substituídas pelas fotos reais dos pratos.
 */

export const MAISON_THEME: Theme = {
  background: "#0b0a09",
  surface: "#16130f",
  text: "#f4ecdf",
  accent: "#c9a45c",
  headingFont: "Cormorant Garamond",
  bodyFont: "Inter",
  radius: 14,
};

export const BRASA_THEME: Theme = {
  background: "#fbf6ee",
  surface: "#ffffff",
  text: "#231c16",
  accent: "#c2451e",
  headingFont: "Playfair Display",
  bodyFont: "Inter",
  radius: 20,
};

const NOW = "2026-11-15T12:00:00.000Z";

export const DEMO_RESTAURANTS: Restaurant[] = [
  {
    id: "maison",
    slug: "maison",
    name: "Maison",
    tagline: "Haute gastronomie · Realidade aumentada à mesa",
    logoUrl: null,
    coverUrl: "demo/cover.jpg",
    about:
      "Sob o comando do chef-patron, a Maison une a técnica clássica francesa a ingredientes brasileiros de pequenos produtores. Menu sazonal, adega com mais de 600 rótulos e serviço de salão à moda antiga — agora com o cardápio que você vê sobre a sua própria mesa antes de pedir.",
    address: "Alameda dos Jacarandás, 1200 — Jardins, São Paulo",
    phone: "+55 11 4000-1200",
    hours: "Terça a sábado · 19h às 00h — Domingo · 12h às 16h",
    theme: MAISON_THEME,
    demo: true,
    createdAt: NOW,
  },
  {
    id: "brasa",
    slug: "brasa",
    name: "Brasa & Co.",
    tagline: "Burgers de fogo e brasa",
    logoUrl: null,
    coverUrl: null,
    about:
      "Segundo restaurante demonstrativo: o mesmo motor white-label, com outra marca, outras cores, outro cardápio e dados totalmente isolados.",
    address: "Rua do Mercado, 88 — Centro",
    phone: "+55 11 4000-8800",
    hours: "Todos os dias · 18h às 23h30",
    theme: BRASA_THEME,
    demo: true,
    createdAt: NOW,
  },
];

const CATS: [string, string][] = [
  ["entradas", "Entradas"],
  ["principais", "Pratos principais"],
  ["carnes", "Carnes nobres"],
  ["mar", "Peixes e frutos do mar"],
  ["massas", "Massas e risotos"],
  ["sobremesas", "Sobremesas"],
  ["bebidas", "Vinhos e bebidas"],
  ["degustacao", "Menu degustação"],
];

export const DEMO_CATEGORIES: Category[] = [
  ...CATS.map(([id, name], i) => ({ id: `maison-${id}`, restaurantId: "maison", name, sortOrder: i })),
  { id: "brasa-burgers", restaurantId: "brasa", name: "Burgers & brasa", sortOrder: 0 },
  { id: "brasa-doces", restaurantId: "brasa", name: "Doces", sortOrder: 1 },
];

type Row = [id: string, cat: string, name: string, price: number, description: string, ingredients: string, shape: ModelShape, w: number, d: number, h: number, featured?: boolean];

const M: Row[] = [
  ["vieiras", "entradas", "Vieiras Seladas", 98, "Vieiras canadenses douradas na manteiga noisette sobre purê aveludado de couve-flor, finalizadas com caviar e ervas do jardim.", "Vieiras, couve-flor, manteiga noisette, caviar, cerefólio, flor de sal", "plate", 27, 27, 4, true],
  ["tartare-wagyu", "entradas", "Tartare de Wagyu", 112, "Wagyu cortado na ponta da faca, gema curada por 48 horas, alcaparras crocantes e mini brioches tostados na manteiga.", "Wagyu, gema curada, alcaparras, cebolete, mostarda Dijon, brioche", "plate", 26, 26, 5],
  ["foie-gras", "entradas", "Foie Gras au Torchon", 138, "Terrine de foie gras preparada à moda clássica, geleia de figo roxo e brioche da casa.", "Foie gras, figo, vinho Sauternes, brioche, flor de sal", "plate", 26, 26, 4],
  ["burrata", "entradas", "Burrata Trufada", 84, "Burrata cremosa de búfala com lâminas de trufa negra, tomates heirloom e pesto de pistache siciliano.", "Burrata de búfala, trufa negra, tomates heirloom, pistache, manjericão, azeite extra virgem", "plate", 25, 25, 6],
  ["carpaccio-polvo", "entradas", "Carpaccio de Polvo", 92, "Lâminas finíssimas de polvo cozido lentamente, gomos cítricos, azeite de ervas e pimenta-rosa.", "Polvo, laranja, limão-siciliano, azeite de ervas, pimenta-rosa, brotos", "plate", 27, 27, 2.5],

  ["magret", "principais", "Magret de Canard", 168, "Peito de pato maturado, pele crocante, molho de cereja negra e purê de batata-doce assada.", "Magret de pato, cereja negra, vinho do Porto, batata-doce, cenouras glaceadas", "plate", 28, 28, 5, true],
  ["cordeiro", "principais", "Carré de Cordeiro", 198, "Carré em crosta de ervas frescas, jus de vinho do Porto, purê de ervilhas e legumes baby assados.", "Carré de cordeiro, ervas frescas, mostarda, vinho do Porto, ervilha, legumes baby", "plate", 28, 28, 7],
  ["supreme", "principais", "Suprême de Frango Caipira", 142, "Frango caipira de pele dourada, cogumelos morilles e molho cremoso de vin jaune.", "Frango caipira, morilles, vin jaune, creme fresco, aspargos verdes", "plate", 28, 28, 6],
  ["ossobuco", "principais", "Ossobuco de Vitela", 176, "Vitela braseada por oito horas sobre polenta cremosa de mascarpone e gremolata fresca.", "Ossobuco de vitela, vinho tinto, polenta, mascarpone, salsa, limão", "plate", 28, 28, 7],

  ["wagyu-a5", "carnes", "Wagyu A5 Kagoshima", 480, "150 g do corte japonês mais marmorizado do mundo, selado na chapa de ferro, com wasabi fresco e flor de sal.", "Wagyu A5, flor de sal, wasabi fresco, shiitake", "plate", 27, 27, 4, true],
  ["rossini", "carnes", "Tournedos Rossini", 268, "Filé mignon sobre croûton de brioche, escalope de foie gras, trufa negra e molho Madeira.", "Filé mignon, foie gras, trufa negra, vinho Madeira, brioche", "plate", 28, 28, 8],
  ["ribeye", "carnes", "Ribeye Dry-Aged 45 dias", 298, "Ancho maturado a seco por 45 dias em câmara própria, alho assado e molho bordelaise.", "Ribeye dry-aged, alho, alecrim, vinho tinto, tutano", "plate", 30, 30, 5],
  ["picanha", "carnes", "Picanha Black Angus", 189, "Picanha de novilho Black Angus na brasa, chimichurri da casa e cebolas baby tostadas.", "Picanha Black Angus, sal grosso, chimichurri, cebola baby", "plate", 30, 30, 5],
  ["chateaubriand", "carnes", "Chateaubriand para dois", 420, "Coração do filé assado inteiro e trinchado à mesa, sauce béarnaise, pommes soufflées e vagens.", "Filé mignon, estragão, manteiga clarificada, gema, batata, vagem francesa", "plate", 34, 34, 7],

  ["lagosta", "mar", "Lagosta Thermidor", 320, "Lagosta gratinada na própria casca com creme de mostarda, conhaque e gruyère.", "Lagosta, conhaque, mostarda Dijon, creme fresco, gruyère, estragão", "plate", 30, 30, 8, true],
  ["robalo", "mar", "Robalo ao Beurre Blanc", 178, "Filé de robalo de pele crocante, beurre blanc de champagne, aspargos e ovas de truta.", "Robalo, champagne, manteiga, echalota, aspargos, ovas de truta", "plate", 28, 28, 5],
  ["salmao", "mar", "Salmão Mi-Cuit", 156, "Salmão cozido a baixa temperatura, laqueado em missô branco, bok choy e emulsão de dashi.", "Salmão, missô branco, bok choy, gergelim, dashi, shissô", "plate", 27, 27, 5],
  ["polvo", "mar", "Polvo Grelhado", 172, "Tentáculo de polvo na brasa, azeite de páprica defumada, batatas ao murro e aioli.", "Polvo, páprica defumada, batata bolinha, alho, salsa", "plate", 28, 28, 6],
  ["camaroes", "mar", "Camarões-Tigre", 198, "Camarões-tigre grelhados sobre bisque de crustáceos, funcho laminado e raspas de limão.", "Camarão-tigre, bisque de crustáceos, funcho, endro, limão-siciliano", "plate", 28, 28, 5],

  ["risoto-trufa", "massas", "Risoto de Trufa Negra", 186, "Arroz carnaroli cremoso finalizado com manteiga, parmesão 36 meses e lâminas de trufa negra.", "Arroz carnaroli, trufa negra, parmesão 36 meses, manteiga, vinho branco", "bowl", 26, 26, 5, true],
  ["tagliolini", "massas", "Tagliolini ao Lagostim", 178, "Massa fresca feita na casa, lagostins salteados, tomates confit e bisque.", "Tagliolini fresco, lagostim, tomate-cereja confit, bisque, manjericão", "bowl", 26, 26, 7],
  ["ravioli", "massas", "Ravioli de Búfala e Limão", 124, "Ravioli recheado de ricota de búfala e limão-siciliano na manteiga de sálvia.", "Massa fresca, ricota de búfala, limão-siciliano, sálvia, manteiga, parmesão", "plate", 27, 27, 4],
  ["risoto-milanese", "massas", "Risotto alla Milanese", 148, "Risoto dourado de açafrão com tutano assado e folha de ouro.", "Arroz carnaroli, açafrão, tutano, parmesão, vinho branco, folha de ouro", "bowl", 26, 26, 6],
  ["gnocchi", "massas", "Gnocchi ao Gorgonzola Dolce", 118, "Gnocchi de batata feito à mão, creme de gorgonzola dolce, nozes tostadas e pera.", "Batata, gorgonzola dolce, creme de leite fresco, nozes, pera, tomilho", "bowl", 25, 25, 5],

  ["souffle", "sobremesas", "Soufflé de Chocolate", 68, "Soufflé de chocolate 70% assado na hora, servido com sorvete de baunilha Bourbon.", "Chocolate 70%, ovos, açúcar, manteiga, baunilha Bourbon", "plate", 24, 24, 8, true],
  ["mille-feuille", "sobremesas", "Mille-Feuille de Baunilha", 62, "Massa folhada caramelizada, creme diplomata de baunilha de Madagascar e framboesas.", "Massa folhada, baunilha de Madagascar, creme, framboesa", "plate", 24, 24, 6],
  ["tarte-citron", "sobremesas", "Tarte au Citron Meringuée", 58, "Massa sablée, creme de limão-siciliano e merengue italiano maçaricado.", "Limão-siciliano, manteiga, ovos, merengue italiano, manjericão", "plate", 24, 24, 6],
  ["creme-brulee", "sobremesas", "Crème Brûlée de Cumaru", 54, "Creme perfumado com cumaru da Amazônia e casquinha de açúcar queimada na hora.", "Creme de leite fresco, gemas, cumaru, açúcar demerara", "plate", 24, 24, 4],
  ["esfera", "sobremesas", "Esfera de Chocolate e Ouro", 78, "Esfera de chocolate amargo com praliné de avelã, caramelo salgado e folha de ouro.", "Chocolate amargo, avelã, caramelo salgado, creme, folha de ouro 24k", "plate", 24, 24, 8],

  ["champagne", "bebidas", "Champagne Brut Réserve", 890, "Garrafa 750 ml. Perlage fino, notas de brioche e frutas brancas. Seleção da adega Maison.", "Chardonnay, Pinot Noir, Pinot Meunier — Champagne, França", "bottle", 8.8, 8.8, 31],
  ["bordeaux", "bebidas", "Bordeaux Grand Cru 2015", 1450, "Garrafa 750 ml. Corte bordalês de safra excepcional, taninos sedosos e final longo.", "Cabernet Sauvignon, Merlot, Cabernet Franc — Bordeaux, França", "bottle", 7.6, 7.6, 30],
  ["chablis", "bebidas", "Chablis Premier Cru", 620, "Garrafa 750 ml. Mineral e vibrante, parceiro ideal dos frutos do mar.", "Chardonnay — Borgonha, França", "bottle", 8.2, 8.2, 30],
  ["negroni", "bebidas", "Negroni Barrel-Aged", 58, "Envelhecido 60 dias em barrica de carvalho, servido sobre gelo cristalino.", "Gin, vermute rosso, bitter italiano, casca de laranja", "glass", 8.5, 8.5, 9],
  ["martini", "bebidas", "Dry Martini", 54, "Gin londrino e vermute seco, mexido e servido bem gelado com azeitonas sicilianas.", "Gin London Dry, vermute seco, azeitonas", "glass", 11.5, 11.5, 17],

  ["degustacao-maison", "degustacao", "Menu Maison · 7 tempos", 590, "A assinatura do chef em sete tempos, do amuse-bouche à sobremesa. Harmonização opcional com sete vinhos (+ R$ 380).", "Seleção sazonal do chef: vieira, foie gras, lagostim, wagyu, queijos, pré-sobremesa e sobremesa", "plate", 27, 27, 4, true],
  ["degustacao-mar", "degustacao", "Menu do Mar · 5 tempos", 480, "Cinco tempos dedicados aos frutos do mar frescos do dia.", "Ostra, vieira, lagosta, peixe do dia, sobremesa cítrica", "plate", 27, 27, 4],
  ["degustacao-jardim", "degustacao", "Menu Jardim · 5 tempos", 390, "Percurso vegetariano com hortaliças orgânicas colhidas pela manhã.", "Beterraba baby, cenoura heirloom, ervilha, rabanete, flores comestíveis", "plate", 27, 27, 4],
];

const TINTS: Record<string, [number, number, number]> = {
  champagne: [0.07, 0.13, 0.06],
  bordeaux: [0.04, 0.06, 0.04],
  chablis: [0.3, 0.38, 0.16],
  negroni: [0.62, 0.1, 0.06],
  martini: [0.86, 0.9, 0.84],
};
export const DEMO_TINTS = TINTS;

function toDish(restaurantId: string, r: Row, i: number): Dish {
  const [id, cat, name, price, description, ingredients, shape, w, d, h, featured] = r;
  const textured = shape === "plate" || shape === "bowl";
  return {
    id: `${restaurantId}-${id}`,
    restaurantId,
    categoryId: `${restaurantId}-${cat}`,
    name,
    description,
    ingredients: ingredients.split(", "),
    priceCents: Math.round(price * 100),
    available: true,
    featured: !!featured,
    photoUrl: `demo/${id}.jpg`,
    topPhotoUrl: textured ? `demo/${id}-top.jpg` : null,
    modelUrl: `demo/${id}.glb`,
    usdzUrl: null,
    shape,
    widthCm: w,
    depthCm: d,
    heightCm: h,
    sortOrder: i,
  };
}

const B: Row[] = [
  ["smash", "burgers", "Smash Duplo da Casa", 42, "Dois discos de carne prensados na chapa, cheddar inglês, picles e molho da casa no pão de batata.", "Blend bovino, cheddar, picles, cebola, pão de batata, fritas", "plate", 28, 28, 9, true],
  ["costela", "burgers", "Costela BBQ", 68, "Costela suína defumada por 10 horas, laqueada em barbecue de goiabada, com fritas rústicas.", "Costela suína, barbecue de goiabada, batata rústica, coleslaw", "plate", 30, 30, 6],
  ["brownie", "doces", "Brownie com Sorvete", 26, "Brownie de chocolate meio amargo servido quente com sorvete de creme e calda.", "Chocolate, nozes, manteiga, sorvete de creme", "plate", 22, 22, 6],
];

export const DEMO_DISHES: Dish[] = [...M.map((r, i) => toDish("maison", r, i)), ...B.map((r, i) => toDish("brasa", r, i))];

/** Manifesto usado pelo script de assets: id do arquivo, forma e dimensões. */
export const DEMO_MODEL_SPECS = [...M, ...B].map(([id, , , , , , shape, w, d, h]) => ({ id, shape, widthCm: w, depthCm: d, heightCm: h, tint: TINTS[id] }));

export const DEMO_TABLES: Table[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `maison-mesa-${i + 1}`,
    restaurantId: "maison",
    label: `Mesa ${i + 1}`,
    token: `mz${(i + 1).toString().padStart(2, "0")}${"k7q2x9c4h8w3"[i]}`,
    seats: i < 6 ? 2 : i < 10 ? 4 : 8,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `brasa-mesa-${i + 1}`,
    restaurantId: "brasa",
    label: `Mesa ${i + 1}`,
    token: `br${(i + 1).toString().padStart(2, "0")}${"p5t1n6"[i]}`,
    seats: 4,
  })),
];
