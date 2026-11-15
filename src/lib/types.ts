export type Theme = {
  background: string;
  surface: string;
  text: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
  radius: number;
};

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  coverUrl: string | null;
  about: string;
  address: string;
  phone: string;
  hours: string;
  theme: Theme;
  demo: boolean;
  createdAt: string;
};

export type Category = {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
};

/** Forma física usada para gerar o modelo 3D em escala real. */
export type ModelShape = "plate" | "bowl" | "bottle" | "glass";

export type Dish = {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  ingredients: string[];
  priceCents: number;
  available: boolean;
  featured: boolean;
  photoUrl: string | null;
  /** Foto vista de cima, recortada no prato, usada como textura do modelo 3D. */
  topPhotoUrl: string | null;
  /** Modelo GLB (Android/WebXR/Scene Viewer). */
  modelUrl: string | null;
  /** Modelo USDZ opcional (iOS Quick Look). Sem ele, é convertido no aparelho. */
  usdzUrl: string | null;
  shape: ModelShape;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  sortOrder: number;
};

export type Table = {
  id: string;
  restaurantId: string;
  label: string;
  token: string;
  seats: number;
};

export type OrderStatus = "novo" | "preparo" | "pronto" | "entregue" | "cancelado";

export type OrderItem = { dishId: string; name: string; qty: number; priceCents: number; note?: string };

export type Order = {
  id: string;
  restaurantId: string;
  tableId: string;
  tableLabel: string;
  items: OrderItem[];
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
};

export type CallKind = "garcom" | "conta";

export type ServiceCall = {
  id: string;
  restaurantId: string;
  tableId: string;
  tableLabel: string;
  kind: CallKind;
  resolved: boolean;
  createdAt: string;
};

export type Session = { email: string; role: "platform" | "owner"; restaurantIds: string[] | "all" };

export type Entity = "restaurants" | "categories" | "dishes" | "tables" | "orders" | "calls";

export const ORDER_FLOW: OrderStatus[] = ["novo", "preparo", "pronto", "entregue"];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  novo: "Novo",
  preparo: "Em preparo",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
