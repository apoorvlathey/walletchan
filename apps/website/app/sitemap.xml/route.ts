import { NextRequest } from "next/server";
import routing from "../../routing.config.json";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase();
  const urls = host === routing.primaryHost
    ? [`https://${routing.primaryHost}`, `https://${routing.primaryHost}/roadmap`]
    : host === `compare.${routing.primaryHost}`
      ? [`https://compare.${routing.primaryHost}/`]
      : null;

  if (!urls) return new Response("Not found", { status: 404 });

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
