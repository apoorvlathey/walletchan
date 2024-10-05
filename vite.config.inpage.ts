import { defineConfig } from "vite";
import path from "path";
import { sharedConfig, sharedBuildConfig } from "./vite.config";

export default defineConfig({
  ...sharedConfig,

  build: {
    ...sharedBuildConfig,
    outDir: "build/static/js",
    emptyOutDir: false,
    lib: {
      formats: ["iife"],
      entry: path.resolve(__dirname, "src/chrome/impersonator.ts"),
      name: "impersonator",
    },
    rollupOptions: {
      output: {
        entryFileNames: "inpage.js",
      },
    },
  },
  publicDir: false,
});
