import { defineConfig } from "vite";

const base = process.env.VITE_BASE_PATH ?? "/vr-snow/";

export default defineConfig({
  base,
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
