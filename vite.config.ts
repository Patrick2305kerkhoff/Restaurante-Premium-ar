import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base relativa + HashRouter: o mesmo build funciona em Vercel, GitHub Pages ou qualquer host estático.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
