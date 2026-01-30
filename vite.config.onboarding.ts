import { defineConfig } from "vite";
import path from "path";
import { sharedConfig, sharedBuildConfig } from "./vite.config";

export default defineConfig({
  ...sharedConfig,
  build: {
    ...sharedBuildConfig,
    outDir: "build",
    emptyOutDir: false, // Don't clear the build directory (other builds output here too)
    rollupOptions: {
      input: {
        onboarding: path.resolve(__dirname, "onboarding.html"),
      },
      output: {
        entryFileNames: "static/js/[name].js",
      },
    },
  },
});
