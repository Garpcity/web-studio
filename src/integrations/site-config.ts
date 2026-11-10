/**
 * Genererer site.config.ts fra Studios innstillinger på en Site. Dette er filen Studio skriver
 * til repoet som PR når innstillinger endres (modulen «Innstillinger»).
 */
export type SiteSettingsInput = {
  slug: string;
  locale: string;
  articles: boolean;
  people: boolean;
  aiCrawlersAllow: boolean;
  analytics: "plausible" | "umami" | "none";
};

export function renderSiteConfig(s: SiteSettingsInput): string {
  return `/**
 * site.config.ts – grunnstrukturen for denne nettsiden.
 * Generert av Studio ${new Date().toISOString().slice(0, 10)}. Endre i Studio, ikke her.
 */
export const siteConfig = {
  slug: ${JSON.stringify(s.slug)},
  locale: ${JSON.stringify(s.locale)} as const,
  locales: [${JSON.stringify(s.locale)}] as const,
  contentTypes: { articles: ${s.articles}, people: ${s.people}, categories: ${s.articles} },
  enabledBlocks: [
    "hero", "text", "textImage", "cardGrid", "people", "latestArticles", "gallery", "quote", "faq",
    "contactForm", "embed", "cta", "stats", "model3d",
  ] as const,
  aiCrawlers: {
    allow: ${s.aiCrawlersAllow},
    agents: ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "Bingbot", "Applebot-Extended", "CCBot"],
  },
  integrations: { analytics: ${JSON.stringify(s.analytics)} as "plausible" | "umami" | "none", forms: "webhook" as const },
  editor: { puck: true },
} as const;

export type SiteConfig = typeof siteConfig;
export type BlockName = (typeof siteConfig.enabledBlocks)[number];
`;
}
