# Web Studio

Administrasjonsverktøyet over [web-standard-template](https://github.com/Garpcity/web-standard-template). Her oppretter du kunder og nettsider, sender AI-utviklingsoppgaver, og følger helse, trafikk og AI-synlighet. Studio er uavhengig: innhold redigeres i nettsidens eget CMS/Puck, dataflyt bor i n8n, kode bor i GitHub. Studio er kontrollrommet som knytter det sammen.

## Oppsett

```bash
pnpm install
cp .env.example .env            # fyll PAYLOAD_SECRET, STUDIO_API_KEY, STUDIO_MCP_KEY, GITHUB_TOKEN
pnpm dev                        # http://localhost:3100/admin (SQLite opprettes automatisk)
curl -X POST localhost:3100/api/seed -H "x-payload-secret: $PAYLOAD_SECRET"   # owner-bruker + AD.Moment
```

Produksjon: `DATABASE_URL=postgres://…` bytter til Postgres automatisk. Kjør som Docker-container (samme mønster som templaten) på ServeTheWorld/Coolify.

## Datamodell

| Samling | Hva |
|---|---|
| Users | owner (oss), developer, customer (ser bare egen kunde) |
| Customers | kunde med org.nr og kontakt |
| Sites | nettside: CMS-valg, repo, miljø-URL-er, innstillinger (locale, artikler, AI-crawlere, analytics), kjernespørsmål for AI-synlighet |
| Environments | production/preview/staging med host, helse og siste sjekk |
| Tasks | ai-dev / content / ops / manual – går todo → running → review → done |
| AgentRuns | hver kjøring av en agent (runner, modell, lenke, logg) |
| Metrics | tidsserie: uptime, response_ms, lighthouse_*, gsc_*, crux_*, ai_cited_rate, ai_mentions … |
| Alerts | varsler med alvorlighet, løses manuelt |

## Endepunkter (alle krever `x-studio-key: $STUDIO_API_KEY`)

| Endepunkt | Gjør |
|---|---|
| `POST /api/sites/:id/provision` | oppretter `site-<slug>` fra templaten i GitHub, lagrer repo-URL og templateversjon |
| `POST /api/tasks/:id/run` | lager issue med label `ai-task` i repoet → `ai-task.yml` kjører agent → PR |
| `GET /api/tasks/:id/run` | synkroniserer status (PR funnet → review) |
| `POST /api/health/run` | sjekker alle miljøer, skriver uptime/response_ms, lager varsel ved nedetid. Kall fra n8n/cron hvert 5. min |
| `POST /api/metrics/ingest` | n8n skriver målinger: `{ siteSlug, source, metrics:[{metric,value,period?,detail?}] }` |
| `GET/POST /api/sites/:slug/visibility` | n8n henter kjernespørsmål; leverer måling → `ai_cited_rate` + automatiske `content`-oppgaver per spørsmål uten sitering |
| `POST /api/seed` | seed (krever `x-payload-secret`) |
| `/api/mcp` | Studios MCP (`x-studio-key: $STUDIO_MCP_KEY`): `get_status`, `create_site`, `create_task`, `run_task`, `list_alerts` |

## AI-utviklingsløpet

1. Opprett Task i Studio (eller via MCP) med beskrivelse og eventuelt modell.
2. `run` → issue i nettsidens repo. Templatens `.github/workflows/ai-task.yml` kjører runneren satt i repo-variabel `AI_RUNNER` (`claude-code`, `codex`, `aider`) med nøkkel fra secrets.
3. Agenten følger `AGENTS.md`, `pnpm check` er port, PR opprettes som utkast med preview fra CI.
4. Mennesket vurderer PR-en (status `review` i Studio), merger → deploy.

LLM-agnostisk: runner og modell velges per repo/oppgave, Studio bryr seg bare om issue → PR.

## Utvikling

```bash
pnpm check     # typecheck + tester
```
