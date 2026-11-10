import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import sharp from "sharp";
import { collections } from "./payload/collections";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL ?? "";
const db = databaseUrl.startsWith("postgres")
  ? postgresAdapter({ pool: { connectionString: databaseUrl } })
  : sqliteAdapter({ client: { url: databaseUrl || "file:./studio.db" }, push: true });

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET ?? "dev-only-secret-change-me",
  serverURL: process.env.STUDIO_URL ?? "http://localhost:3100",
  admin: {
    user: "users",
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: " – Studio" },
  },
  collections,
  editor: lexicalEditor(),
  db,
  sharp,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  telemetry: false,
});
