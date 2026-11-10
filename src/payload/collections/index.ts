/**
 * Studios datamodell. Studio eier ingen data som finnes et annet sted – det speiler og lenker:
 * koden er i Git, innholdet i CMS-et, flytene i n8n, målingene hos kildene.
 */
import type { Access, CollectionConfig } from "payload";

export const roles = ["owner", "developer", "customer"] as const;
type User =
  | {
      role?: (typeof roles)[number];
      customer?: number | string | { id: number | string };
    }
  | null
  | undefined;

const role = (u: User) => u?.role ?? "customer";
const customerId = (u: User) =>
  typeof u?.customer === "object" && u?.customer ? u.customer.id : u?.customer;

export const isOwner: Access = ({ req }) => role(req.user as User) === "owner";
export const isStaff: Access = ({ req }) =>
  ["owner", "developer"].includes(role(req.user as User));
/** Kunder ser kun egne rader (filtrert på `customer`). */
export const staffOrOwnCustomer: Access = ({ req }) => {
  const u = req.user as User;
  if (!u) return false;
  if (["owner", "developer"].includes(role(u))) return true;
  const id = customerId(u);
  return id ? { customer: { equals: id } } : false;
};

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: { useAsTitle: "email", group: "System" },
  access: { read: isStaff, create: isOwner, update: isOwner, delete: isOwner },
  fields: [
    { name: "name", type: "text" },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "developer",
      options: roles.map((r) => ({ label: r, value: r })),
    },
    {
      name: "customer",
      type: "relationship",
      relationTo: "customers",
      admin: { condition: (d) => d.role === "customer" },
    },
  ],
};

export const Customers: CollectionConfig = {
  slug: "customers",
  labels: { singular: "Kunde", plural: "Kunder" },
  admin: {
    useAsTitle: "name",
    group: "Kunder og nettsider",
    defaultColumns: ["name", "orgNumber", "status"],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isOwner },
  fields: [
    { name: "name", type: "text", required: true, label: "Navn" },
    { name: "slug", type: "text", required: true, unique: true },
    { name: "orgNumber", type: "text", label: "Org.nr." },
    { name: "contactName", type: "text", label: "Kontaktperson" },
    { name: "contactEmail", type: "email", label: "E-post" },
    {
      name: "status",
      type: "select",
      defaultValue: "active",
      options: ["lead", "active", "paused", "ended"].map((v) => ({ label: v, value: v })),
    },
    { name: "notes", type: "textarea", label: "Notater" },
  ],
};

export const Sites: CollectionConfig = {
  slug: "sites",
  labels: { singular: "Nettside", plural: "Nettsider" },
  admin: {
    useAsTitle: "name",
    group: "Kunder og nettsider",
    defaultColumns: ["name", "customer", "cms", "status", "templateVersion"],
  },
  access: { read: staffOrOwnCustomer, create: isStaff, update: isStaff, delete: isOwner },
  fields: [
    { name: "name", type: "text", required: true, label: "Navn" },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "Teknisk navn; brukes som repo-navn" },
    },
    {
      name: "customer",
      type: "relationship",
      relationTo: "customers",
      required: true,
      label: "Kunde",
    },
    {
      name: "cms",
      type: "select",
      required: true,
      defaultValue: "payload",
      options: ["mock", "wordpress", "payload"].map((v) => ({ label: v, value: v })),
    },
    { name: "repoUrl", type: "text", label: "Git-repo", admin: { readOnly: true } },
    {
      name: "templateVersion",
      type: "text",
      label: "Templateversjon",
      admin: { readOnly: true },
    },
    { name: "productionUrl", type: "text", label: "Produksjons-URL" },
    { name: "previewUrl", type: "text", label: "Preview-URL" },
    { name: "cmsAdminUrl", type: "text", label: "CMS-admin" },
    { name: "n8nUrl", type: "text", label: "n8n-prosjekt" },
    { name: "mcpUrl", type: "text", label: "MCP-endepunkt", admin: { readOnly: true } },
    {
      name: "status",
      type: "select",
      defaultValue: "planned",
      options: ["planned", "provisioning", "building", "live", "paused", "archived"].map(
        (v) => ({ label: v, value: v }),
      ),
      admin: { position: "sidebar" },
    },
    {
      name: "settings",
      type: "group",
      label: "Grunnstruktur (skrives til site.config.ts som PR)",
      fields: [
        {
          name: "locale",
          type: "select",
          defaultValue: "nb-NO",
          options: ["nb-NO", "nn-NO", "en-GB"].map((v) => ({ label: v, value: v })),
        },
        { name: "articles", type: "checkbox", defaultValue: true, label: "Artikler på" },
        { name: "people", type: "checkbox", defaultValue: true, label: "Personer på" },
        {
          name: "aiCrawlersAllow",
          type: "checkbox",
          defaultValue: true,
          label: "AI-crawlere slippes inn",
        },
        {
          name: "analytics",
          type: "select",
          defaultValue: "plausible",
          options: ["plausible", "umami", "none"].map((v) => ({ label: v, value: v })),
        },
      ],
    },
    {
      name: "coreQuestions",
      type: "array",
      label: "Kjernespørsmål (AI-synlighet)",
      fields: [{ name: "question", type: "text", required: true }],
    },
    { name: "notes", type: "textarea" },
  ],
};

export const Environments: CollectionConfig = {
  slug: "environments",
  labels: { singular: "Miljø", plural: "Miljøer" },
  admin: { useAsTitle: "url", group: "Kunder og nettsider" },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isOwner },
  fields: [
    { name: "site", type: "relationship", relationTo: "sites", required: true },
    {
      name: "kind",
      type: "select",
      required: true,
      options: ["production", "staging", "preview"].map((v) => ({ label: v, value: v })),
    },
    { name: "url", type: "text", required: true },
    {
      name: "host",
      type: "select",
      defaultValue: "servetheworld",
      options: ["servetheworld", "vercel", "other"].map((v) => ({ label: v, value: v })),
    },
    { name: "coolifyAppId", type: "text", label: "Coolify app-ID" },
    { name: "lastDeployAt", type: "date", admin: { readOnly: true } },
    { name: "lastHealthAt", type: "date", admin: { readOnly: true } },
    { name: "healthy", type: "checkbox", admin: { readOnly: true } },
  ],
};

export const Tasks: CollectionConfig = {
  slug: "tasks",
  labels: { singular: "Oppgave", plural: "Oppgaver" },
  admin: {
    useAsTitle: "title",
    group: "Arbeid",
    defaultColumns: ["title", "site", "kind", "status", "updatedAt"],
  },
  access: { read: staffOrOwnCustomer, create: isStaff, update: isStaff, delete: isOwner },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "site", type: "relationship", relationTo: "sites", required: true },
    {
      name: "customer",
      type: "relationship",
      relationTo: "customers",
      admin: { description: "Settes automatisk fra nettsiden" },
    },
    {
      name: "kind",
      type: "select",
      required: true,
      defaultValue: "ai-dev",
      options: [
        { label: "AI-utvikling (kode → PR)", value: "ai-dev" },
        { label: "Innhold (til kunde/agent)", value: "content" },
        { label: "Drift", value: "ops" },
        { label: "Manuell", value: "manual" },
      ],
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      label: "Oppgavetekst (sendes til agenten)",
    },
    {
      name: "model",
      type: "text",
      label: "Modell (valgfri, f.eks. claude-sonnet, gpt-5)",
    },
    {
      name: "status",
      type: "select",
      defaultValue: "todo",
      options: ["todo", "running", "review", "done", "failed", "cancelled"].map((v) => ({
        label: v,
        value: v,
      })),
      admin: { position: "sidebar" },
    },
    { name: "issueUrl", type: "text", label: "GitHub-issue", admin: { readOnly: true } },
    { name: "prUrl", type: "text", label: "Pull request", admin: { readOnly: true } },
    { name: "previewUrl", type: "text", label: "Preview", admin: { readOnly: true } },
    {
      name: "source",
      type: "select",
      defaultValue: "manual",
      options: ["manual", "monitoring", "customer", "mcp"].map((v) => ({
        label: v,
        value: v,
      })),
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (data?.site && !data.customer) {
          const site = await req.payload.findByID({
            collection: "sites",
            id: data.site,
            depth: 0,
          });
          data.customer = site?.customer;
        }
        return data;
      },
    ],
  },
};

export const AgentRuns: CollectionConfig = {
  slug: "agent-runs",
  labels: { singular: "Agentkjøring", plural: "Agentkjøringer" },
  admin: {
    useAsTitle: "id",
    group: "Arbeid",
    defaultColumns: ["task", "runner", "status", "costUsd", "createdAt"],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isOwner },
  fields: [
    { name: "task", type: "relationship", relationTo: "tasks", required: true },
    {
      name: "runner",
      type: "text",
      required: true,
      label: "Runner (github-actions, local, …)",
    },
    { name: "model", type: "text" },
    {
      name: "status",
      type: "select",
      defaultValue: "queued",
      options: ["queued", "running", "succeeded", "failed"].map((v) => ({
        label: v,
        value: v,
      })),
    },
    { name: "externalUrl", type: "text", label: "Logg/kjøring" },
    { name: "costUsd", type: "number", label: "Kostnad (USD)" },
    { name: "durationSec", type: "number" },
    { name: "summary", type: "textarea" },
  ],
};

export const Metrics: CollectionConfig = {
  slug: "metrics",
  labels: { singular: "Måling", plural: "Målinger" },
  admin: {
    useAsTitle: "metric",
    group: "Overvåking",
    defaultColumns: ["site", "metric", "value", "period", "createdAt"],
  },
  access: { read: staffOrOwnCustomer, create: isStaff, update: isOwner, delete: isOwner },
  fields: [
    { name: "site", type: "relationship", relationTo: "sites", required: true },
    { name: "customer", type: "relationship", relationTo: "customers" },
    {
      name: "metric",
      type: "select",
      required: true,
      options: [
        "uptime",
        "response_ms",
        "lighthouse_performance",
        "lighthouse_accessibility",
        "lighthouse_seo",
        "gsc_clicks",
        "gsc_impressions",
        "gsc_position",
        "crux_lcp_ms",
        "crux_inp_ms",
        "crux_cls",
        "ai_cited_rate",
        "ai_mentioned_rate",
        "visitors",
        "form_submissions",
        "ai_pr_autoapproved_rate",
        "hours_to_launch",
      ].map((v) => ({ label: v, value: v })),
    },
    { name: "value", type: "number", required: true },
    { name: "period", type: "text", label: "Periode (f.eks. 2026-W46, 2026-11)" },
    { name: "source", type: "text", label: "Kilde (n8n, studio-health, ci …)" },
    { name: "detail", type: "json" },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (data?.site && !data.customer) {
          const site = await req.payload.findByID({
            collection: "sites",
            id: data.site,
            depth: 0,
          });
          data.customer = site?.customer;
        }
        return data;
      },
    ],
  },
};

export const Alerts: CollectionConfig = {
  slug: "alerts",
  labels: { singular: "Varsel", plural: "Varsler" },
  admin: {
    useAsTitle: "title",
    group: "Overvåking",
    defaultColumns: ["title", "site", "severity", "resolved", "createdAt"],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isOwner },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "site", type: "relationship", relationTo: "sites", required: true },
    {
      name: "severity",
      type: "select",
      defaultValue: "warning",
      options: ["info", "warning", "critical"].map((v) => ({ label: v, value: v })),
    },
    { name: "message", type: "textarea" },
    { name: "resolved", type: "checkbox", defaultValue: false },
    {
      name: "task",
      type: "relationship",
      relationTo: "tasks",
      label: "Oppgave opprettet",
    },
  ],
};

export const collections = [
  Users,
  Customers,
  Sites,
  Environments,
  Tasks,
  AgentRuns,
  Metrics,
  Alerts,
];
