import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getPayload } from "payload";
import config from "@payload-config";
import { hasKey } from "@/lib/auth";
import { createStudioMcp } from "@/mcp/server";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  if (!hasKey(req, "STUDIO_MCP_KEY")) return Response.json({ error: "Ikke autorisert" }, { status: 401 });
  const payload = await getPayload({ config });
  const server = createStudioMcp(payload, process.env.STUDIO_URL ?? "http://localhost:3100", process.env.STUDIO_API_KEY ?? "");
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    await transport.close().catch(() => {});
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
