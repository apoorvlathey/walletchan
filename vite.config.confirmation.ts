import { defineConfig } from "vite";
import path from "path";
import { sharedConfig, sharedBuildConfig } from "./vite.config";

export default defineConfig({
  ...sharedConfig,
  build: {
    ...sharedBuildConfig,
    outDir: "build",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        confirmation: path.resolve(__dirname, "confirmation.html"),
      },
      output: {
        entryFileNames: "static/js/[name].js",
      },
    },
  },
  publicDir: false,
});
