import { NextRequest } from "next/server";
import routing from "../../routing.config.json";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase();
  const sitemapHost = host === routing.primaryHost || host === `compare.${routing.primaryHost}`
    ? host
    : null;

  // Let crawlers read existing noindex directives on internal tools.
  // Other hosts must not advertise a different host's sitemap.
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /api/\n${sitemapHost ? `\nSitemap: https://${sitemapHost}/sitemap.xml\n` : ""}`,
    { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
