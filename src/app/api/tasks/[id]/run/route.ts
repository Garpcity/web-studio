import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { createGitHubAdapter } from "@/integrations/github";
import { hasKey } from "@/lib/auth";

/**
 * Kjører en AI-utviklingsoppgave: oppretter GitHub-issue med label `ai-task` i nettsidens repo.
 * Repoets workflow (.github/workflows/ai-task.yml) plukker den opp med valgt runner/modell og lager PR.
 * POST /api/tasks/:id/run med x-studio-key.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasKey(req, "STUDIO_API_KEY"))
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  const { id } = await ctx.params;
  const payload = await getPayload({ config });
  const task = await payload.findByID({ collection: "tasks", id, depth: 1 });
  if (!task) return NextResponse.json({ error: "Fant ikke oppgaven" }, { status: 404 });
  const site = typeof task.site === "object" ? task.site : null;
  if (!site?.repoUrl)
    return NextResponse.json(
      { error: "Nettsiden har ikke repo ennå (kjør provision først)" },
      { status: 400 },
    );

  const repoName = site.repoUrl.split("/").pop()!;
  const gh = createGitHubAdapter();
  const body = [
    task.description,
    "",
    "---",
    `Opprettet fra Studio. Oppgave-ID: ${task.id}. Nettside: ${site.name}.`,
    task.model ? `Modell: ${task.model}` : "",
    "Følg AGENTS.md. Kjør `pnpm check` før PR. Lever PR med preview-lenke og skriv antakelser øverst i PR-beskrivelsen.",
  ].join("\n");
  const issue = await gh.createIssue(repoName, task.title, body, [
    "ai-task",
    ...(task.model ? [`model:${task.model}`] : []),
  ]);
  await payload.update({
    collection: "tasks",
    id,
    data: { status: "running", issueUrl: issue.htmlUrl },
  });
  await payload.create({
    collection: "agent-runs",
    data: {
      task: task.id,
      runner: "github-actions",
      model: task.model ?? undefined,
      status: "queued",
      externalUrl: issue.htmlUrl,
    },
  });
  return NextResponse.json({ ok: true, issue: issue.htmlUrl });
}

/** GET: synkroniser status fra GitHub (PR funnet → review). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasKey(req, "STUDIO_API_KEY"))
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  const { id } = await ctx.params;
  const payload = await getPayload({ config });
  const task = await payload.findByID({ collection: "tasks", id, depth: 1 });
  const site = task && typeof task.site === "object" ? task.site : null;
  if (!task?.issueUrl || !site?.repoUrl)
    return NextResponse.json({ status: task?.status ?? "unknown" });
  const issueNumber = Number(task.issueUrl.split("/").pop());
  const gh = createGitHubAdapter();
  const pr = await gh.findPullForIssue(site.repoUrl.split("/").pop()!, issueNumber);
  if (pr && task.status === "running") {
    await payload.update({
      collection: "tasks",
      id,
      data: { status: "review", prUrl: pr.htmlUrl },
    });
    return NextResponse.json({ status: "review", pr: pr.htmlUrl });
  }
  return NextResponse.json({ status: task.status, pr: task.prUrl ?? null });
}
