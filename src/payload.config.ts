import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { ensureSchema } from "./payload/ensure-schema";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import sharp from "sharp";
import { collections } from "./payload/collections";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL ?? "";
const db = databaseUrl.startsWith("postgres")
  ? postgresAdapter({
      pool: { connectionString: databaseUrl },
      // Skjemaet pushes ved oppstart også i produksjon (ingen migrasjonsfiler ennå). Når data blir
      // verdifulle: generer migrasjoner (`payload migrate:create`) og sett PAYLOAD_DB_PUSH=false.
      push: process.env.PAYLOAD_DB_PUSH !== "false",
    })
  : sqliteAdapter({ client: { url: databaseUrl || "file:./studio.db" }, push: true });

export default buildConfig({
  onInit: ensureSchema,
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
