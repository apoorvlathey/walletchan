import { minify } from "terser";
import type { Plugin } from "vite";

/** Vite skips Terser for ES library output; this is a final executable, not a library. */
export function compactBackground(): Plugin {
  return {
    name: "compact-background-formatting",
    apply: "build",
    enforce: "post",
    async renderChunk(code, chunk, output) {
      if (output.format !== "es" || chunk.fileName !== "background.js") return null;
      const result = await minify(code, {
        module: true,
        compress: false,
        mangle: false,
        keep_classnames: true,
        keep_fnames: true,
        format: { comments: "some" },
        sourceMap: !!output.sourcemap,
      });
      if (!result.code) throw new Error("Background formatting produced no code");
      return {
        code: result.code,
        map: typeof result.map === "string"
          ? result.map
          : result.map ? JSON.stringify(result.map) : null,
      };
    },
  };
}
