# AGENTS.md – Web Studio

Dette er kontrollrommet for nettsider bygget på `web-standard-template`. Les README.md for datamodell og endepunkter.

## Regler

- Språk i UI, feltnavn (labels) og kommentarer: norsk bokmål. Kode og identifikatorer: engelsk.
- Payload-samlingene i `src/payload/collections/index.ts` er sannheten for datamodellen. Endre der, aldri i generert `payload-types.ts`.
- Tilgang: `isOwner` / `isStaff` / `staffOrOwnCustomer`. En kunde skal aldri se andre kunders data. Test det når du endrer access.
- Integrasjoner i `src/integrations/` er rene funksjoner med injiserbar `fetch` så de kan testes uten nett. GitHub-adapteret bruker bare REST, ingen SDK.
- Interne endepunkter beskyttes med `hasKey(req, "STUDIO_API_KEY")`. Ingen åpne skrive-endepunkter.
- Ingen eksterne CDN-er eller fonter. Alt selvhostet.
- Kjør `pnpm check` før commit. Nye integrasjoner får tester i `tests/`.
- Ikke bygg innholdsredigering i Studio. Det bor i nettsidens CMS/Puck.
- n8n eier dataflyt (Search Console, CrUX, AI-synlighet). Studio mottar via `/api/metrics/ingest`.

## Kommandoer

```bash
pnpm dev            # port 3100
pnpm check          # typecheck + vitest
pnpm build
```
