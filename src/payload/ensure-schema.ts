import type { Payload } from "payload";

/**
 * Oppretter/oppdaterer databaseskjemaet ved oppstart når PAYLOAD_DB_PUSH=true.
 *
 * Payload pusher bare skjema selv når NODE_ENV !== "production". I Docker-bygg og i produksjon
 * (SQLite eller Postgres) finnes derfor ingen tabeller før noen lager dem. Denne hooken bruker samme
 * mekanisme (drizzle push) eksplisitt. Den er idempotent og kjører én gang per prosess.
 *
 * Grense: destruktive endringer (slette kolonner/tabeller) stopper pushen i stedet for å spørre
 * (ingen TTY). Slike endringer gjøres som Payload-migrasjoner og med PAYLOAD_DB_PUSH=false.
 */
export async function ensureSchema(payload: Payload): Promise<void> {
  if (process.env.PAYLOAD_DB_PUSH !== "true") return;
  const { pushDevSchema } = await import("@payloadcms/drizzle");
  // Ikke-interaktiv: prompts svarer "nei" uten TTY og pushDevSchema kaller process.exit(0).
  // Vi forhindrer det ved å midlertidig gjøre exit til en feil som fanges og logges.
  const realExit = process.exit;
  process.exit = ((code?: number) => {
    throw new Error(
      `Skjema-push avbrutt (exit ${code ?? 0}): destruktiv endring krever migrasjon.`,
    );
  }) as typeof process.exit;
  try {
    await pushDevSchema(payload.db as Parameters<typeof pushDevSchema>[0]);
    payload.logger.info("Databaseskjema er på plass (PAYLOAD_DB_PUSH).");
  } catch (e) {
    payload.logger.error({ err: e }, "Skjema-push feilet");
  } finally {
    process.exit = realExit;
  }
}
