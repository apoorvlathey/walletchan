// Export public chain metadata without importing extension runtime dependencies.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const sourcePath = fileURLToPath(
  new URL("../../extension/src/constants/chainRegistry.ts", import.meta.url),
);
const destination = fileURLToPath(
  new URL("../app/bunker-mode/chains.json", import.meta.url),
);
const ast = ts.createSourceFile(
  sourcePath,
  fs.readFileSync(sourcePath, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
let chains;
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(ast) === "MAINNET_CHAIN_REGISTRY"
  ) {
    let value = node.initializer;
    while (ts.isAsExpression(value) || ts.isSatisfiesExpression(value))
      value = value.expression;
    chains = value.elements.map((entry) => {
      const fields = Object.fromEntries(
        entry.properties
          .filter(ts.isPropertyAssignment)
          .map((p) => [p.name.getText(ast), p.initializer]),
      );
      const string = (key) => {
        if (!ts.isStringLiteral(fields[key]))
          throw new Error(`Expected literal ${key}`);
        return fields[key].text;
      };
      if (!ts.isNumericLiteral(fields.chainId))
        throw new Error("Expected literal chain ID");
      return {
        id: Number(fields.chainId.text),
        name: string("name"),
        icon: string("icon"),
        rpcUrls: [string("rpcUrl")],
        explorer: string("explorer"),
      };
    });
  }
  ts.forEachChild(node, visit);
}
visit(ast);
if (!chains?.length) throw new Error("No mainnets found");
const output = JSON.stringify(chains, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (fs.readFileSync(destination, "utf8") !== output)
    throw new Error(
      "Bunker chains are stale. Run node scripts/sync-bunker-chains.mjs",
    );
} else fs.writeFileSync(destination, output);
// Keep the website assets aligned with the registry's approved chain artwork.
for (const chain of chains) {
  const sourceIcon = fileURLToPath(
    new URL(`../../extension/public${chain.icon}`, import.meta.url),
  );
  const targetIcon = fileURLToPath(
    new URL(`../public${chain.icon}`, import.meta.url),
  );
  if (process.argv.includes("--check")) {
    if (
      !fs.existsSync(targetIcon) ||
      !fs.readFileSync(sourceIcon).equals(fs.readFileSync(targetIcon))
    )
      throw new Error(`Bunker icon is stale: ${chain.name}`);
  } else {
    fs.mkdirSync(
      fileURLToPath(new URL("../public/chainIcons", import.meta.url)),
      { recursive: true },
    );
    fs.copyFileSync(sourceIcon, targetIcon);
  }
}
console.log(
  `${chains.length} WalletChan mainnets ${process.argv.includes("--check") ? "verified" : "exported"}`,
);
