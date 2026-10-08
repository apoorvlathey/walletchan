import { type ChainResult, type Verdict, cardCopy, topNonceChains } from "./model";
import { mascotLayers } from "./mascotLayers";
import { palette } from "../home-v2/design";
import type { Identity } from "./rpc";
import { blo } from "blo";
export type CardData = {
  identity: Identity;
  results: ChainResult[];
  verdict: Verdict;
  checkedAt: string;
  anonymous: boolean;
};
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => resolve(null), 3000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = src;
  });
}
export async function renderCard(data: CardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable in this browser.");
  const { identity, verdict, results, anonymous } = data;
  // Use the website's actual font faces in both the preview and downloaded PNG.
  await Promise.all([
    document.fonts.load("80px BunkerAnton"),
    document.fonts.load("24px BunkerOutfit"),
    document.fonts.load('16px "JetBrains Mono"'),
  ]);
  const ranked = topNonceChains(results);
  const chainIcons = await Promise.all(ranked.map((r) => loadImage(r.chain.icon)));
  const stripIcons = ranked.length
    ? []
    : await Promise.all(results.map((r) => loadImage(r.chain.icon)));
  const [avatar, ...mascot] = await Promise.all([
    !anonymous && identity.avatar
      ? loadImage(identity.avatar)
      : Promise.resolve(null),
    ...mascotLayers(verdict).map(loadImage),
  ]);
  if (mascot.some((layer) => !layer))
    throw new Error("Could not load the mascot. Please retry.");
  const blockie = avatar
    ? null
    : await loadImage(
        blo(
          anonymous
            ? "0x0000000000000000000000000000000000000000"
            : identity.address,
        ),
      );
  const W = 1200;
  const H = 630;
  const L = 64; // left reading edge
  const R = 696; // end of the text column
  const PANEL = 752; // start of the character panel
  const CX = PANEL + (W - PANEL) / 2;
  const copy = cardCopy(verdict, results);
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color: string,
    family = "BunkerOutfit",
    weight = 500,
  ) => {
    ctx.font = `${weight} ${size}px "${family}", sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
    return ctx.measureText(value).width;
  };
  const fit = (value: string, max: number) => {
    let out = value;
    while (out.length > 1 && ctx.measureText(out).width > max)
      out = out.slice(0, -2) + "…";
    return out;
  };

  ctx.fillStyle = palette.ink;
  ctx.fillRect(0, 0, W, H);
  // Feather the panel edge into the text column without changing its quiet tint.
  const [tint, opacity] = verdict === "clean" || verdict === "contract"
    ? ["74,222,128", 0.09] as const
    : verdict === "active" ? ["248,113,113", 0.10] as const
      : ["255,255,255", 0.04] as const;
  const blendStart = PANEL - 56;
  const panelFill = ctx.createLinearGradient(blendStart, 0, PANEL + 72, 0);
  panelFill.addColorStop(0, `rgba(${tint},0)`);
  panelFill.addColorStop(1, `rgba(${tint},${opacity})`);
  ctx.fillStyle = panelFill;
  ctx.fillRect(blendStart, 0, W - blendStart, H);

  // Identity, upper left.
  ctx.save();
  ctx.beginPath();
  if (avatar) ctx.arc(L + 28, 80, 28, 0, Math.PI * 2);
  else ctx.roundRect(L, 52, 56, 56, 8);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, L, 52, 56, 56);
  else if (blockie) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(blockie, L, 52, 56, 56);
  }
  ctx.restore();
  const short = (head: number, tail: number) =>
    `${identity.address.slice(0, head)}…${identity.address.slice(-tail)}`;
  if (anonymous) text("Identity hidden", L + 76, 89, 28, palette.white);
  else if (identity.name) {
    ctx.font = '500 30px "BunkerOutfit"';
    text(fit(identity.name, R - L - 76), L + 76, 78, 30, palette.white);
    text(short(6, 4), L + 76, 106, 18, palette.muted, "JetBrains Mono");
  } else text(short(8, 6), L + 76, 89, 24, palette.white, "JetBrains Mono");

  // Verdict.
  text(copy.lines[0], L - 3, 232, 96, palette.white, "BunkerAnton", 400);
  text(copy.lines[1], L - 3, 326, 96, copy.color, "BunkerAnton", 400);
  ctx.font = '500 24px "BunkerOutfit"';
  text(fit(copy.caption, R - L), L, 370, 24, palette.white);

  // Personal leaderboard: the address's own top chains by signer nonce.
  const trophy = (x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 32, size / 32);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(8, 2); ctx.lineTo(24, 2); ctx.lineTo(24, 9);
    ctx.bezierCurveTo(24, 15, 20, 19, 16, 19);
    ctx.bezierCurveTo(12, 19, 8, 15, 8, 9);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, 5); ctx.lineTo(3.5, 5); ctx.lineTo(3.5, 8);
    ctx.quadraticCurveTo(3.5, 13, 9, 14);
    ctx.moveTo(24, 5); ctx.lineTo(28.5, 5); ctx.lineTo(28.5, 8);
    ctx.quadraticCurveTo(28.5, 13, 23, 14);
    ctx.stroke();
    ctx.fillRect(14.5, 18, 3, 6);
    ctx.beginPath(); ctx.roundRect(9, 24, 14, 6, 1.5); ctx.fill();
    ctx.restore();
  };
  const chainIcon = (icon: HTMLImageElement | null, id: number, x: number, y: number, size: number) => {
    if (!icon) return;
    if (id === 4326) {
      ctx.fillStyle = palette.white;
      ctx.beginPath(); ctx.roundRect(x - 1, y - 1, size + 2, size + 2, 4); ctx.fill();
    }
    ctx.drawImage(icon, x, y, size, size);
  };
  if (ranked.length) {
    const medals = ["#e4b75c", "#c4cbd4", "#c08c68"];
    ranked.forEach((result, index) => {
      const top = 398 + index * 46;
      ctx.fillStyle = palette.line;
      ctx.fillRect(L, top, R - L, 1);
      const mid = top + 23;
      trophy(L, mid - 15, 30, medals[index]);
      chainIcon(chainIcons[index], result.chain.id, L + 46, mid - 11, 22);
      text(result.chain.name, L + 80, mid + 8, 22, palette.white);
      // Exact bigint value; shrink rather than round when it is very long.
      const nonce = BigInt(result.nonce!).toLocaleString("en-US");
      let size = index === 0 ? 28 : 24;
      ctx.font = `500 ${size}px "JetBrains Mono"`;
      while (ctx.measureText(nonce).width > R - L - 330 && size > 12) {
        size--;
        ctx.font = `500 ${size}px "JetBrains Mono"`;
      }
      ctx.textAlign = "right";
      const value = text(nonce, R, mid + size * 0.36, size, medals[index], "JetBrains Mono");
      text("Nonce", R - value - 10, mid + 7, 18, palette.muted);
      ctx.textAlign = "left";
    });
  } else {
    // No ranks: show the coverage itself, dimming chains that did not answer.
    const answered = results.filter((r) => r.status !== "error").length;
    text(answered === results.length ? `All ${results.length} chains checked`
      : `${answered} of ${results.length} chains answered`, L, 428, 20, palette.muted);
    const step = Math.min(32, (R - L - 22) / Math.max(1, results.length - 1));
    results.forEach((result, index) => {
      ctx.save();
      if (result.status === "error") ctx.globalAlpha = 0.2;
      chainIcon(stripIcons[index], result.chain.id, L + index * step, 448, 22);
      ctx.restore();
    });
  }

  // Footer stays quiet: wordmark, then the URL people need to try it.
  const mark = text("WALLETCHAN", L, 590, 24, palette.white, "BunkerAnton", 400);
  text("walletchan.com/bunker-mode", L + mark + 16, 589, 20, palette.muted);
  ctx.textAlign = "right";
  text(new Date(data.checkedAt).toISOString().slice(0, 10), R, 588, 14, palette.faint, "JetBrains Mono");
  ctx.textAlign = "left";

  // Character panel: title, its verdict stamp, then the mascot standing on the bottom edge.
  ctx.textAlign = "center";
  text("BUNKER MODE", CX, 104, 64, palette.white, "BunkerAnton", 400);
  ctx.textAlign = "left";
  ctx.save();
  ctx.beginPath(); ctx.rect(PANEL, 0, W - PANEL, H); ctx.clip();
  for (const layer of mascot)
    if (layer) ctx.drawImage(layer, CX - 210, H - 420, 420, 420);
  ctx.restore();
  ctx.save();
  ctx.translate(CX, 158);
  ctx.rotate(-0.045);
  ctx.font = '400 32px "BunkerAnton"';
  ctx.letterSpacing = "2px";
  const stampW = ctx.measureText(copy.status).width + 30;
  ctx.fillStyle = palette.ink;
  ctx.strokeStyle = copy.color;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-stampW / 2, -26, stampW, 52, 6); ctx.fill(); ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = copy.color;
  ctx.fillText(copy.status, 1, 13);
  ctx.restore();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not create your card.")),
      "image/png",
    ),
  );
}
