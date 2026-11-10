import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { z } from "zod";
import { hasKey } from "@/lib/auth";

/**
 * Loopen for AI-synlighet går gjennom Studio:
 *   GET  → n8n henter kjernespørsmål, domene, merkenavn og varslings-e-post for nettsiden
 *   POST → n8n leverer resultatet per spørsmål; Studio skriver ai_cited_rate/ai_mentioned_rate
 *          og oppretter én `content`-oppgave per spørsmål uten sitering (dedupliseres mot åpne).
 * Begge krever x-studio-key.
 */
/** Finn på slug eller numerisk id. */
async function findSite(key: string) {
  const payload = await getPayload({ config });
  const res = await payload.find({
    collection: "sites",
    where: /^\d+$/.test(key)
      ? { id: { equals: Number(key) } }
      : { slug: { equals: key } },
    limit: 1,
    depth: 1,
  });
  return { payload, site: res.docs[0] ?? null };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasKey(req, "STUDIO_API_KEY"))
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  const { id } = await ctx.params;
  const { site } = await findSite(id);
  if (!site) return NextResponse.json({ error: "Ukjent nettside" }, { status: 404 });
  const customer = typeof site.customer === "object" ? site.customer : null;
  const domain = site.productionUrl
    ? new URL(site.productionUrl).hostname.replace(/^www\./, "")
    : "";
  return NextResponse.json({
    siteSlug: site.slug,
    brand: customer?.name ?? site.name,
    domain,
    notifyEmail: customer?.contactEmail ?? null,
    questions: (site.coreQuestions ?? []).map((q: { question: string }) => q.question),
  });
}

const report = z.object({
  period: z.string().min(4), // f.eks. 2026-11
  engine: z.string().default("openai"),
  rows: z
    .array(
      z.object({
        question: z.string().min(1),
        cited: z.boolean(),
        mentioned: z.boolean(),
        citedUrls: z.array(z.string()).default([]),
        allSources: z.array(z.string()).default([]),
      }),
    )
    .min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasKey(req, "STUDIO_API_KEY"))
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = report.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Ugyldig body", issues: parsed.error.issues },
      { status: 400 },
    );
  const { payload, site } = await findSite(id);
  if (!site) return NextResponse.json({ error: "Ukjent nettside" }, { status: 404 });

  const { period, engine, rows } = parsed.data;
  const total = rows.length;
  const cited = rows.filter((r) => r.cited).length;
  const mentioned = rows.filter((r) => r.mentioned).length;
  const source = `n8n:${engine}`;
  await payload.create({
    collection: "metrics",
    data: {
      site: site.id,
      metric: "ai_cited_rate",
      value: cited / total,
      period,
      source,
      detail: { total, cited, rows },
    },
  });
  await payload.create({
    collection: "metrics",
    data: {
      site: site.id,
      metric: "ai_mentioned_rate",
      value: mentioned / total,
      period,
      source,
      detail: { total, mentioned },
    },
  });

  // Spørsmål uten sitering → innholdsoppgave. Én åpen per spørsmål.
  let created = 0;
  for (const row of rows.filter((r) => !r.cited)) {
    const title = `Innhold: «${row.question}»`;
    const open = await payload.find({
      collection: "tasks",
      where: {
        and: [
          { site: { equals: site.id } },
          { title: { equals: title } },
          { status: { not_in: ["done", "cancelled"] } },
        ],
      },
      limit: 1,
    });
    if (open.docs[0]) continue;
    await payload.create({
      collection: "tasks",
      data: {
        title,
        kind: "content",
        site: site.id,
        source: "monitoring",
        description: [
          `AI-motor (${engine}) siterte ikke ${site.name} på spørsmålet «${row.question}» i ${period}.`,
          row.mentioned ? "Merket nevnes, men uten kilde." : "Merket nevnes ikke.",
          row.allSources.length
            ? `Kilder som ble sitert i stedet:\n${row.allSources.map((u) => `- ${u}`).join("\n")}`
            : "",
          "",
          "Lag eller oppdater en artikkel som svarer direkte på spørsmålet (kort svar først, navngitt forfatter, kilder, oppdatert dato). Se docs/seo-playbook.md.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
    created++;
  }
  return NextResponse.json({
    ok: true,
    period,
    total,
    cited,
    mentioned,
    rate: cited / total,
    tasksCreated: created,
  });
}
