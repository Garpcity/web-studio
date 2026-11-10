import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { checkUrl } from "@/integrations/health";
import { hasKey } from "@/lib/auth";

/**
 * Helse-sjekk av alle miljøer. Kalles av n8n eller cron hvert 5. minutt:
 * POST /api/health/run med x-studio-key. Skriver Metric (uptime, response_ms) og Alert ved feil.
 */
export async function POST(req: Request) {
  if (!hasKey(req, "STUDIO_API_KEY")) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  const payload = await getPayload({ config });
  const envs = await payload.find({ collection: "environments", limit: 500, depth: 0 });
  const results = [];
  for (const env of envs.docs) {
    const r = await checkUrl(env.url);
    const siteId = typeof env.site === "object" ? env.site.id : env.site;
    await payload.update({ collection: "environments", id: env.id, data: { healthy: r.ok, lastHealthAt: new Date().toISOString() } });
    await payload.create({ collection: "metrics", data: { site: siteId, metric: "uptime", value: r.ok ? 1 : 0, source: "studio-health", detail: r } });
    await payload.create({ collection: "metrics", data: { site: siteId, metric: "response_ms", value: r.responseMs, source: "studio-health" } });
    if (!r.ok) {
      const open = await payload.find({ collection: "alerts", where: { and: [{ site: { equals: siteId } }, { resolved: { equals: false } }, { title: { equals: `Nede: ${env.url}` } }] }, limit: 1 });
      if (!open.docs[0]) {
        await payload.create({ collection: "alerts", data: { title: `Nede: ${env.url}`, site: siteId, severity: env.kind === "production" ? "critical" : "warning", message: `${r.status} ${r.error ?? ""}`.trim() } });
      }
    }
    results.push(r);
  }
  return NextResponse.json({ ok: true, checked: results.length, down: results.filter((r) => !r.ok).length, results });
}
