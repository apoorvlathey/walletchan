import { BuildOptions, defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tsconfigPaths from "vite-tsconfig-paths";

export const sharedConfig = {
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [
    react(),
    tsconfigPaths(),
    nodePolyfills({
      exclude: ["console"],
    }),
  ],
};

export const sharedBuildConfig: BuildOptions = {
  minify: "terser",
  terserOptions: {
    keep_classnames: true,
    keep_fnames: true,
  },
};
export default defineConfig({
  ...sharedConfig,
  build: {
    ...sharedBuildConfig,
    outDir: "build",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "static/js/[name].js",
      },
    },
  },
  server: {
    port: 3000,
    hmr: {
      host: "localhost",
    },
    origin: `http://localhost:3000`,

    // fs: {
    //   strict: false,
    // },
  },
});
