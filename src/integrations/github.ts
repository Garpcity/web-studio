/**
 * GitHub-adapter. Samme mønster som innholdslaget i templaten: ett grensesnitt, byttbar implementasjon.
 * Krever GITHUB_TOKEN (fine-grained: Administration RW for opprettelse, Issues RW, Pull requests R, Contents R).
 */
export type GitHubConfig = {
  token: string;
  org: string;
  templateRepo: string;
  apiBase?: string;
};

export type RepoInfo = { fullName: string; htmlUrl: string; defaultBranch: string };
export type IssueInfo = { number: number; htmlUrl: string };
export type PullInfo = {
  number: number;
  htmlUrl: string;
  state: string;
  title: string;
  draft: boolean;
  headRef: string;
};

export interface GitHubAdapter {
  createRepoFromTemplate(
    name: string,
    description: string,
    isPrivate?: boolean,
  ): Promise<RepoInfo>;
  getRepo(name: string): Promise<RepoInfo | null>;
  createIssue(
    repo: string,
    title: string,
    body: string,
    labels: string[],
  ): Promise<IssueInfo>;
  listPulls(repo: string, state?: "open" | "closed" | "all"): Promise<PullInfo[]>;
  findPullForIssue(repo: string, issueNumber: number): Promise<PullInfo | null>;
  getFileText(repo: string, path: string, ref?: string): Promise<string | null>;
  dispatchWorkflow(
    repo: string,
    workflowFile: string,
    ref: string,
    inputs: Record<string, string>,
  ): Promise<void>;
}

export function createGitHubAdapter(
  cfg: Partial<GitHubConfig> = {},
  fetchImpl: typeof fetch = fetch,
): GitHubAdapter {
  const token = cfg.token ?? process.env.GITHUB_TOKEN;
  const org = cfg.org ?? process.env.GITHUB_ORG ?? "";
  const templateRepo =
    cfg.templateRepo ?? process.env.TEMPLATE_REPO ?? "web-standard-template";
  const base = cfg.apiBase ?? "https://api.github.com";
  if (!token) throw new Error("GITHUB_TOKEN mangler");
  if (!org) throw new Error("GITHUB_ORG mangler");

  const api = async <T>(
    path: string,
    init?: RequestInit & { raw?: boolean },
  ): Promise<T> => {
    const res = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: init?.raw
          ? "application/vnd.github.raw+json"
          : "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "web-studio",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    if (res.status === 404) return null as T;
    if (!res.ok) throw new Error(`GitHub ${res.status} ${path}: ${await res.text()}`);
    if (res.status === 204) return undefined as T;
    return (init?.raw ? await res.text() : await res.json()) as T;
  };

  const repoInfo = (r: {
    full_name: string;
    html_url: string;
    default_branch: string;
  }): RepoInfo => ({
    fullName: r.full_name,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch,
  });

  return {
    async createRepoFromTemplate(name, description, isPrivate = true) {
      const r = await api<{
        full_name: string;
        html_url: string;
        default_branch: string;
      }>(`/repos/${org}/${templateRepo}/generate`, {
        method: "POST",
        body: JSON.stringify({
          owner: org,
          name,
          description,
          private: isPrivate,
          include_all_branches: false,
        }),
      });
      return repoInfo(r);
    },
    async getRepo(name) {
      const r = await api<{
        full_name: string;
        html_url: string;
        default_branch: string;
      } | null>(`/repos/${org}/${name}`);
      return r ? repoInfo(r) : null;
    },
    async createIssue(repo, title, body, labels) {
      const r = await api<{ number: number; html_url: string }>(
        `/repos/${org}/${repo}/issues`,
        { method: "POST", body: JSON.stringify({ title, body, labels }) },
      );
      return { number: r.number, htmlUrl: r.html_url };
    },
    async listPulls(repo, state = "open") {
      const r = await api<
        {
          number: number;
          html_url: string;
          state: string;
          title: string;
          draft: boolean;
          head: { ref: string };
        }[]
      >(`/repos/${org}/${repo}/pulls?state=${state}&per_page=50`);
      return (r ?? []).map((p) => ({
        number: p.number,
        htmlUrl: p.html_url,
        state: p.state,
        title: p.title,
        draft: p.draft,
        headRef: p.head.ref,
      }));
    },
    async findPullForIssue(repo, issueNumber) {
      const pulls = await this.listPulls(repo, "all");
      return (
        pulls.find(
          (p) =>
            p.headRef.includes(`${issueNumber}`) || p.title.includes(`#${issueNumber}`),
        ) ?? null
      );
    },
    async getFileText(repo, path, ref) {
      return api<string | null>(
        `/repos/${org}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`,
        { raw: true },
      );
    },
    async dispatchWorkflow(repo, workflowFile, ref, inputs) {
      await api<void>(
        `/repos/${org}/${repo}/actions/workflows/${workflowFile}/dispatches`,
        { method: "POST", body: JSON.stringify({ ref, inputs }) },
      );
    },
  };
}
