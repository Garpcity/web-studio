import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { z } from "zod";
import { hasKey } from "@/lib/auth";

/**
 * n8n skriver målinger hit: POST /api/metrics/ingest med x-studio-key.
 * Body: { siteSlug, metrics: [{ metric, value, period?, detail? }], source }
 */
const body = z.object({
  siteSlug: z.string().min(1),
  source: z.string().default("n8n"),
  metrics: z
    .array(
      z.object({
        metric: z.string(),
        value: z.number(),
        period: z.string().optional(),
        detail: z.unknown().optional(),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  if (!hasKey(req, "STUDIO_API_KEY"))
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Ugyldig body", issues: parsed.error.issues },
      { status: 400 },
    );
  const payload = await getPayload({ config });
  const site = await payload.find({
    collection: "sites",
    where: { slug: { equals: parsed.data.siteSlug } },
    limit: 1,
  });
  if (!site.docs[0])
    return NextResponse.json({ error: "Ukjent nettside" }, { status: 404 });
  let written = 0;
  for (const m of parsed.data.metrics) {
    await payload.create({
      collection: "metrics",
      data: {
        site: site.docs[0].id,
        metric: m.metric as never,
        value: m.value,
        period: m.period,
        source: parsed.data.source,
        detail: m.detail as never,
      },
    });
    written++;
  }
  return NextResponse.json({ ok: true, written });
}
