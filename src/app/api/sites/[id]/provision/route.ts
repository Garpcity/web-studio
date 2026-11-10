import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { createGitHubAdapter } from "@/integrations/github";
import { hasKey } from "@/lib/auth";

/**
 * Oppretter repo fra templaten for en nettside og lagrer repo-URL.
 * POST /api/sites/:id/provision med x-studio-key. Idempotent: finnes repoet, brukes det.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasKey(req, "STUDIO_API_KEY"))
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  const { id } = await ctx.params;
  const payload = await getPayload({ config });
  const site = await payload.findByID({ collection: "sites", id, depth: 1 });
  if (!site) return NextResponse.json({ error: "Fant ikke nettsiden" }, { status: 404 });

  const gh = createGitHubAdapter();
  const repoName = `site-${site.slug}`;
  const customer = typeof site.customer === "object" ? site.customer : null;
  await payload.update({ collection: "sites", id, data: { status: "provisioning" } });
  try {
    const repo =
      (await gh.getRepo(repoName)) ??
      (await gh.createRepoFromTemplate(
        repoName,
        `${site.name}${customer ? ` – ${customer.name}` : ""}. Bygget på web-standard-template.`,
      ));
    const pkg = await gh.getFileText(repoName, "package.json", repo.defaultBranch);
    const templateVersion = pkg
      ? (JSON.parse(pkg) as { version?: string }).version
      : undefined;
    const updated = await payload.update({
      collection: "sites",
      id,
      data: {
        repoUrl: repo.htmlUrl,
        templateVersion,
        status: "building",
        mcpUrl: site.productionUrl
          ? `${site.productionUrl.replace(/\/$/, "")}/api/mcp`
          : undefined,
      },
    });
    return NextResponse.json({ ok: true, repo: repo.htmlUrl, site: updated.slug });
  } catch (e) {
    await payload.update({ collection: "sites", id, data: { status: "planned" } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
