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
5. **On-demand transcription.** A dedicated Function App (`muttr-transcribe-us-east`) exposes `POST /api/transcribe-audio`, forwards base64 WAV/MP3 blobs to OpenRouter’s `google/gemini-2.0-flash-lite-001`, and hands the resulting transcript back to the UI for microphone-powered inputs.

---

## 📁 Project Files & Responsibilities

### `MuttrHop/`
Single Azure Function implementation shared by all hops.
- `function.json` – HTTP trigger binding for `POST /api/muttr`.
- `index.js` – Forward + return logic, OpenRouter call on the terminal forward hop, response shaping on the final return.

### `TranscribeAudio/`
Azure Function that powers microphone capture.
- `function.json` – HTTP trigger binding for `POST /api/transcribe-audio`.
- `index.js` – Validates base64 WAV/MP3 payloads, calls OpenRouter’s transcription-capable model, and returns the transcript to the UI.

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

- **2025-03-19** – Floated the seed microphone button over the main textarea, taught transcripts to overwrite the default seed copy instead of appending, mirrored the recording guidance toast on the update mic, and added a transcription system prompt that returns “no audio detected” whenever silence is captured.
- **2025-03-18** – Taught the microphone silence detector to auto-calibrate its threshold so quieter desktop mics keep recording instead of bailing out, fixing the “works on mobile, silent on PC” reports.

- **2025-03-17** – Added automatic microphone silence detection so recordings stop after three seconds of quiet, wired it into the OpenRouter transcription flow, and surfaced a toast reminding people they can wait for the auto-stop or click the mic again to end capture.
- **2025-03-16** – Extended the Azure deployment workflow so the `muttr-transcribe-us-east` Function App receives the same GitHub Pages + Cloudflare CORS allowlist, keeping microphone transcription calls working cross-origin.
- **2025-03-14** – Added microphone capture buttons for the seed and update inputs, wired them through a new US East `transcribe-audio` Azure Function that feeds OpenRouter’s `google/gemini-2.0-flash-lite-001`, and automatically injects the transcripts back into the appropriate fields while respecting the relay’s lock state.
- **2025-03-15** – Extended the Azure deployment workflow to provision + deploy the dedicated `muttr-transcribe-us-east` Function App, updated the UI to call its `/api/transcribe-audio` endpoint, and documented the new resource in the README + vibes.
- **2025-03-13** – Pointed the marketing CTA auto-fill buttons at the main relay seed input (instead of the update field) and
  removed the leftover "Launch the live relay" development copy from the landing page.
- **2025-03-12** – Normalized Azure hop names so telemetry entries like `us-east-hop` automatically map onto the `muttr-us-east`
  coordinate set, restoring the relay map markers and globe animation regardless of how each Function App labels itself.
- **2025-03-11** – Added a synthetic timing fallback for the Highcharts globe so the "Your Issues" orb still glides hop to hop
  even when the Azure hop log ships timestamps that collapse to zero, guaranteeing a visible animation on every lap.
- **2025-03-10** – Locked the relay map orb to a persistent Highcharts marker (no more disappearing "Your Issues" glow), wired
  every animation update to track the last known coordinates, and removed the outdated notice about the public entry hop above
  the Start Muttring controls.
- **2025-03-09** – Fixed the relay manifest to accumulate reverse-chronological rows with raw millisecond durations, renamed the column to “Relay Station,” and repaired the Highcharts orb animation by sanitizing hop names and replaying hop-to-hop deltas using exact timestamp differences (no artificial minimums).
- **2025-03-07** – Reworked the live relay UX so the seed textarea becomes the assistant output while runs are active, locks itself during loops, adds a renamed "Watch AI haul your burdens" map alongside it, introduces a full-width live hop manifest table, and softens the suggestion buttons.
- **2025-11-16** – Simplified the live relay header, retitled the CTAs to “Launch muttr,” wired pricing/deck buttons to auto-scroll into the relay with prefilled anti-sales-call gripes, and retitled the control button to “Start Muttring.”
- **2025-03-06** – Rebuilt the relay map animation so “Your Issues” glides along great-circle routes using actual hop-to-hop timing deltas, restored the dotted baseline route, and renamed the orb to match the new label.
- **2025-03-05** – Swapped the relay UI's Leaflet globe for a Highcharts-powered map with real-time great-circle orb animation keyed to hop timings so each lap replays with the actual per-leg durations.

- **2025-03-04** – Embedded the original relay UI at the bottom of `docs/index.html`, wired the “Launch the Relay” CTAs to scroll straight to it, and restored the Leaflet-powered map plus hop loop so the marketing page still delivers the working app.
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

