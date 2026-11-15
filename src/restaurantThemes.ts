export type RestaurantTheme = {
  id: string;
  name: string;
  subtitle: string;
  logoUrl?: string;
  colors: { background: string; surface: string; text: string; accent: string };
  typography: { heading: string; body: string };
  borderRadius: string;
};

export const restaurantPresets: Record<"maison" | "lancheria", RestaurantTheme> = {
  maison: {
    id: "maison",
    name: "Maison",
    subtitle: "Gastronomie",
    colors: { background: "#11100f", surface: "#201d1a", text: "#f8f1e6", accent: "#c9a66b" },
    typography: { heading: "Georgia, serif", body: "Arial, sans-serif" },
    borderRadius: "8px"
  },
  lancheria: {
    id: "lancheria",
    name: "Lancheria Demo",
    subtitle: "Sabor de verdade",
    colors: { background: "#fffaf1", surface: "#ffffff", text: "#26221e", accent: "#c84b24" },
    typography: { heading: "Arial, sans-serif", body: "Arial, sans-serif" },
    borderRadius: "16px"
  }
};

export function themeVariables(theme: RestaurantTheme): Record<string, string> {
  return {
    "--restaurant-bg": theme.colors.background,
    "--restaurant-surface": theme.colors.surface,
    "--restaurant-text": theme.colors.text,
    "--restaurant-accent": theme.colors.accent,
    "--restaurant-heading-font": theme.typography.heading,
    "--restaurant-body-font": theme.typography.body,
    "--restaurant-radius": theme.borderRadius
  };
}

export function validateRestaurantTheme(theme: RestaurantTheme): boolean {
  const colors = Object.values(theme.colors);
  return Boolean(theme.id.trim() && theme.name.trim() && colors.every(value => /^#[0-9a-fA-F]{6}$/.test(value)));
}
