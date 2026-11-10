import { describe, expect, it, vi } from "vitest";
import { createGitHubAdapter } from "../src/integrations/github";
import { checkUrl } from "../src/integrations/health";
import { renderSiteConfig } from "../src/integrations/site-config";
import { hasKey } from "../src/lib/auth";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

describe("GitHub-adapter", () => {
  it("oppretter repo fra template med riktig kall", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.github.com/repos/Garpcity/web-standard-template/generate");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toMatchObject({ owner: "Garpcity", name: "site-kunde", private: true });
      return json({ full_name: "Garpcity/site-kunde", html_url: "https://github.com/Garpcity/site-kunde", default_branch: "main" });
    });
    const gh = createGitHubAdapter({ token: "t", org: "Garpcity", templateRepo: "web-standard-template" }, fetchMock as typeof fetch);
    const repo = await gh.createRepoFromTemplate("site-kunde", "Test");
    expect(repo.htmlUrl).toContain("site-kunde");
  });

  it("returnerer null ved 404", async () => {
    const gh = createGitHubAdapter({ token: "t", org: "o" }, (async () => new Response("", { status: 404 })) as typeof fetch);
    expect(await gh.getRepo("finnes-ikke")).toBeNull();
  });

  it("finner PR for issue via branchnavn", async () => {
    const gh = createGitHubAdapter({ token: "t", org: "o" }, (async () =>
      json([{ number: 9, html_url: "u", state: "open", title: "Fiks", draft: false, head: { ref: "ai-task/12-hero" } }])) as typeof fetch);
    expect((await gh.findPullForIssue("r", 12))?.number).toBe(9);
    expect(await gh.findPullForIssue("r", 99)).toBeNull();
  });

  it("feiler uten token", () => {
    expect(() => createGitHubAdapter({ org: "o", token: "" })).toThrow();
  });
});

describe("Helse", () => {
  it("rapporterer ok og responstid", async () => {
    const r = await checkUrl("https://example.test", (async () => new Response("ok")) as typeof fetch);
    expect(r.ok).toBe(true);
    expect(r.responseMs).toBeGreaterThanOrEqual(0);
  });
  it("fanger nettverksfeil", async () => {
    const r = await checkUrl("https://example.test", (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ECONNREFUSED");
  });
});

describe("site.config-generator", () => {
  it("skriver gyldig TypeScript med innstillingene", () => {
    const out = renderSiteConfig({ slug: "kunde", locale: "nb", articles: false, people: true, aiCrawlersAllow: false, analytics: "plausible" });
    expect(out).toContain('slug: "kunde"');
    expect(out).toContain("articles: false");
    expect(out).toContain("allow: false");
    expect(out).toContain('"plausible"');
  });
});

describe("Nøkkelsjekk", () => {
  it("godtar header og bearer, avviser feil", () => {
    process.env.TEST_KEY = "hemmelig";
    expect(hasKey(new Request("http://x", { headers: { "x-studio-key": "hemmelig" } }), "TEST_KEY")).toBe(true);
    expect(hasKey(new Request("http://x", { headers: { authorization: "Bearer hemmelig" } }), "TEST_KEY")).toBe(true);
    expect(hasKey(new Request("http://x", { headers: { "x-studio-key": "feil" } }), "TEST_KEY")).toBe(false);
    expect(hasKey(new Request("http://x"), "FINNES_IKKE")).toBe(false);
  });
});
