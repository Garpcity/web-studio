/** Enkel nøkkelsjekk for interne endepunkter (cron, n8n, MCP). */
export function hasKey(req: Request, envName: string): boolean {
  const expected = process.env[envName];
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  return req.headers.get("x-studio-key") === expected || bearer === expected;
}
