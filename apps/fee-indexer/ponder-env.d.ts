/// <reference types="ponder/virtual" />

declare module "ponder:internal" {
  const config: typeof import("./ponder.config.ts");
  const schema: typeof import("./ponder.schema.ts");
}

declare module "ponder:schema" {
  export * from "./ponder.schema.ts";
}
