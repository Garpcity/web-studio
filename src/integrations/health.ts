/** Helse-sjekk uten eksterne avhengigheter: HTTP mot en URL, måler status og responstid. */
export type HealthResult = {
  url: string;
  ok: boolean;
  status: number;
  responseMs: number;
  error?: string;
};

export async function checkUrl(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10000,
): Promise<HealthResult> {
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "web-studio-health" },
    });
    clearTimeout(t);
    return { url, ok: res.ok, status: res.status, responseMs: Date.now() - started };
  } catch (e) {
    return {
      url,
      ok: false,
      status: 0,
      responseMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
