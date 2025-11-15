# 📢 muttr 🌎
### _A delightfully unhinged, around-the-world, stateless, LLM-telephone TODO vortex_

muttr is a hackathon-grade experiment where the "todo list" lives only as an HTTP payload hurtling around Earth. There is no database. There is no durable storage. Just a message that loops across continents, mutates in the hands of an LLM, and comes back for another lap.

---

## 💡 Core Vibe / Philosophy

- **No persistence.** The only source of truth is the payload currently in flight.
- **Always complete the circuit.** Every update must visit every hop before the UI reacts.
- **LLM as storage, network as clock.** OpenRouter provides the state; the global hop chain provides the beat.
- **Observability as art.** Each hop logs name, direction, delay, and timestamp so we can watch the todo list migrate.
- **Browsers stay dumb.** The UI just displays the latest assistant text and immediately launches the next lap.

---

## 🌐 Architecture Snapshot (2025-02-17)

The relay now runs on **Azure Functions** so each hop truly executes in the advertised region.

Forward path: `browser → muttr-us-east → muttr-brazil → muttr-uk → muttr-singapore → muttr-sydney`

Return path: `muttr-sydney → muttr-singapore → muttr-uk → muttr-brazil → muttr-us-east → browser`

Key mechanics:

1. **Identical code, different settings.** Every Function App hosts `MuttrHop/index.js`. App settings (`HOP_NAME`, `NEXT_HOP_URL`, `PREV_HOP_URL`, `DELAY_MS`) define each hop’s role.
2. **OpenRouter on the final forward hop.** Sydney alone holds `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` and converts the todo payload into a chat completion.
3. **Headers carry context.** `X-Hop-Chain`, `X-Hop-Log`, and `X-Direction` stitch the story together on both the forward and return legs.
4. **Return leg unwrap.** US East parses the OpenRouter JSON, extracts the assistant text, and responds to the browser with hop telemetry plus the raw model output.

---

## 📁 Project Files & Responsibilities

### `MuttrHop/`
Single Azure Function implementation shared by all hops.
- `function.json` – HTTP trigger binding for `POST /api/muttr`.
- `index.js` – Forward + return logic, OpenRouter call on the terminal forward hop, response shaping on the final return.

### `host.json`
Azure Functions host configuration (v2 runtime).

### `.github/workflows/deploy-muttr-hops.yml`
Matrix-driven GitHub Actions workflow that provisions resource group, storage account, and five Function Apps, configures per-hop settings, injects OpenRouter secrets on the terminal hop, and deploys code via `Azure/functions-action@v1`.

### `docs/index.html`
Static browser UI locked to the public first hop. Shows hop chain/log, assistant text, and raw OpenRouter JSON while automatically looping the payload.

### `src/worker.mjs` & `wrangler.toml`
Legacy Cloudflare Worker prototype retained for historical reference. No longer deployed.

---

## 🔐 Secrets & Configuration Checklist

- **Azure:** Service principal JSON stored as `AZURE_CREDENTIALS`. Resource group + storage account are created idempotently by the workflow (defaults: `muttr-rg`, `muttrfuncstorage123`).
- **OpenRouter:** API key stored as `OPENROUTER_API_KEY`. Only injected into the final forward hop.
- **DNS (optional):** Custom domains can CNAME to the `*.azurewebsites.net` hostnames if pretty URLs are desired.

---

## 🛠 Implementation Log

- **2025-03-02** – Added a technology showcase to `docs/index.html` that explains the global hop choreography (now with “so agentic, much wow” energy) and forced the hero modal to reappear on every visit for maximum theatrical pacing.
- **2025-03-03** – Restored the long-form, SaaS-grade marketing scroll in `docs/index.html`, softened the technology copy into vibe-rich, globe-trotting language (still featuring “so agentic, much wow”), and kept the modal firing on every visit.
- **2025-03-01** – Rebuilt `docs/index.html` into a marketing-forward landing page with a launch modal, blurred background treatment, long-form feature storytelling, and call-to-action flows for the muttr relay.
- **2025-02-28** – Removed the hop-level artificial delay so telemetry reflects true network latency, and upgraded the UI with a Leaflet-powered world map plus real-time orb animation that replays each completed lap.
- **2025-02-27** – Moved the system prompt definition out of the UI and into the Azure Function, refreshed the default concerns, and rebuilt the web client inputs to queue list updates with suggestion buttons.
- **2025-02-26** – Gated the Azure Functions deployment workflow behind path filters and pushed full OpenRouter prompt control into the UI with a dev-only system prompt editor plus a "modify the burden" injector.

- **2025-02-25** – Let the Azure deployment workflow run the US East hop first and then fan out to the remaining regions concurrently.
- **2025-02-24** – Derived the OpenRouter HTTP-Referer header from the executing host/protocol so each hop correctly self-identifies.
- **2025-02-23** – Sanitized hop log headers to JSON-encode the log entries so Azure Functions no longer attempts to send newline-delimited strings that Undici rejects.
- **2025-02-22** – Updated the deployment workflow to check existing Function App CORS origins before adding the GitHub Pages and Cloudflare hosts so repeated runs stay idempotent.
- **2025-02-22** – Fixed the Cloudflare Pages deployment to verify the custom domain on the correct project before creating it, keeping the step idempotent and aligned with the live site.
- **2025-02-21** – Locked the browser UI to the public US East entry hop, hid the endpoint selector, and taught the Azure deployment workflow to set CORS for the GitHub Pages and Cloudflare origins.
- **2025-02-20** – Moved the public UI to Cloudflare Pages with a dedicated GitHub Actions deployer, wired up the custom domain (muttr.materialmachinelearn.ing), and taught the static client to default to the public hop when served from that host.
- **2025-02-19** – Added universal CORS headers and explicit OPTIONS handling to the Azure Function hop so the GitHub Pages UI can call it without preflight failures.
- **2025-02-18** – Locked every Azure CLI call to the target subscription, serialized the deployment matrix so the US East hop provisions shared resources first, and updated the README to call out the sequencing behaviour.
- **2025-02-18** – Stabilized the Azure deployment workflow: pinned the resource group/storage account location, explicitly selected the subscription after login, and documented the new env vars in the README so multi-region deploys succeed.
- **2025-02-17** – Rebuilt the relay on Azure Functions: added `MuttrHop/`, `host.json`, replaced the Cloudflare deployment workflow with `deploy-muttr-hops.yml`, refreshed the README, and tuned the UI copy for the new endpoints.
- **2025-02-16** – Replaced a template literal in `src/worker.mjs` with string concatenation so Wrangler’s esbuild stopped tripping over "Hop failed" during deploy.
- **2025-02-16** – Fixed `wrangler.toml` environment variable sections to use proper TOML tables so GitHub Actions deployments parse cleanly.
- **2025-02-16** – Materialized `wrangler.toml` in-repo and pointed the README instructions at it so GitHub Actions deployments have a real config to consume.
- **2025-02-16** – Checked in the real `.github/workflows/cloudflare-relay-deploy.yml` so pushes to `main` automatically redeploy every Cloudflare hop.
- **2025-02-15** – Drafted the top-level `README.md` with Cloudflare deployment steps and a sample GitHub Actions workflow for continuous relay releases.
- **2025-02-14** – Added GitHub Pages static UI (`docs/index.html`) with configurable first-hop endpoint input and gave the Worker CORS superpowers so the static site can loop the relay across origins.

