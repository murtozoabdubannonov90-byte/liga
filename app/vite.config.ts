import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
/* legacy: eski telefonlar (Android 6–9 dagi yangilanmagan WebView, iOS 11–13) va eski kompyuter brauzerlari uchun
   alohida ES5 to'plam + polifillar. Ularsiz bunday qurilmalarda ilova bo'sh oq ekran bo'lib qolardi. */
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    legacy({
      targets: ["chrome >= 61", "android >= 6", "safari >= 11", "ios >= 11", "edge >= 79", "firefox >= 60", "samsung >= 8"],
      modernPolyfills: true,
    }),
  ],
  build: { outDir: "dist", assetsDir: "assets", sourcemap: false, chunkSizeWarningLimit: 1500 },
  server: { port: 5173 },
});
