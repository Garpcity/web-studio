/**
 * Studios egen MCP-server: styr Studio fra din egen agent.
 * create_site, get_status, run_task, list_alerts, create_task.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Payload } from "payload";
import { z } from "zod";

const text = (d: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(d, null, 2) }] });

export function createStudioMcp(payload: Payload, studioUrl: string, apiKey: string): McpServer {
  const server = new McpServer({ name: "web-studio", version: "1.0.0" });
  const internal = (path: string, method = "POST") =>
    fetch(`${studioUrl}${path}`, { method, headers: { "x-studio-key": apiKey } }).then((r) => r.json());

  server.registerTool(
    "get_status",
    { title: "Status", description: "Oversikt: nettsider med status, åpne varsler, oppgaver under arbeid.", inputSchema: { siteSlug: z.string().optional() } },
    async ({ siteSlug }) => {
      const sites = await payload.find({ collection: "sites", where: siteSlug ? { slug: { equals: siteSlug } } : undefined, limit: 100, depth: 1 });
      const alerts = await payload.find({ collection: "alerts", where: { resolved: { equals: false } }, limit: 50, depth: 0 });
      const tasks = await payload.find({ collection: "tasks", where: { status: { in: ["running", "review"] } }, limit: 50, depth: 0 });
      return text({
        sites: sites.docs.map((s) => ({ slug: s.slug, name: s.name, status: s.status, cms: s.cms, repo: s.repoUrl, production: s.productionUrl, templateVersion: s.templateVersion })),
        openAlerts: alerts.docs.map((a) => ({ title: a.title, severity: a.severity, site: a.site })),
        activeTasks: tasks.docs.map((t) => ({ id: t.id, title: t.title, status: t.status, pr: t.prUrl })),
      });
    },
  );

  server.registerTool(
    "create_site",
    {
      title: "Opprett nettside",
      description: "Registrerer en nettside for en kunde og oppretter repo fra templaten.",
      inputSchema: { customerSlug: z.string(), name: z.string(), slug: z.string().regex(/^[a-z0-9-]+$/), cms: z.enum(["mock", "wordpress", "payload"]).default("payload") },
    },
    async ({ customerSlug, name, slug, cms }) => {
      const customer = await payload.find({ collection: "customers", where: { slug: { equals: customerSlug } }, limit: 1 });
      if (!customer.docs[0]) return text({ error: `Ukjent kunde ${customerSlug}` });
      const site = await payload.create({ collection: "sites", data: { name, slug, cms, customer: customer.docs[0].id } });
      const res = await internal(`/api/sites/${site.id}/provision`);
      return text({ siteId: site.id, ...res });
    },
  );

  server.registerTool(
    "create_task",
    {
      title: "Opprett oppgave",
      description: "Lager en oppgave på en nettside (AI-utvikling som standard) uten å kjøre den.",
      inputSchema: { siteSlug: z.string(), title: z.string(), description: z.string(), kind: z.enum(["ai-dev", "content", "ops", "manual"]).default("ai-dev"), model: z.string().optional() },
    },
    async ({ siteSlug, title, description, kind, model }) => {
      const site = await payload.find({ collection: "sites", where: { slug: { equals: siteSlug } }, limit: 1 });
      if (!site.docs[0]) return text({ error: `Ukjent nettside ${siteSlug}` });
      const task = await payload.create({ collection: "tasks", data: { title, description, kind, model, site: site.docs[0].id, source: "mcp" } });
      return text({ taskId: task.id, status: task.status });
    },
  );

  server.registerTool(
    "run_task",
    { title: "Kjør oppgave", description: "Sender en AI-utviklingsoppgave til nettsidens repo (issue → agent → PR).", inputSchema: { taskId: z.string() } },
    async ({ taskId }) => text(await internal(`/api/tasks/${taskId}/run`)),
  );

  server.registerTool(
    "list_alerts",
    { title: "Åpne varsler", description: "Alle uløste varsler.", inputSchema: {} },
    async () => {
      const alerts = await payload.find({ collection: "alerts", where: { resolved: { equals: false } }, limit: 100, depth: 1 });
      return text(alerts.docs.map((a) => ({ id: a.id, title: a.title, severity: a.severity, site: typeof a.site === "object" ? a.site.slug : a.site, created: a.createdAt })));
    },
  );

  return server;
}
