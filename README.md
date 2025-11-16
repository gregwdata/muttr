# muttr · Give your worries a world tour

![muttrman keeps watch while your head-noise takes a lap.](docs/assets/muttrman.png)

> Your brain doesn’t need another midnight sprint. muttr offloads the inner muttering to an orbiting relay of AI confidants, sending every concern on a passport-stamped world tour so you can stay focused on the work that matters.

muttr is the only B2B platform that treats worry like operational debt. We ship every anxious note on a world tour of language models who pace, fret, and loop until clarity drops back into your lap.

---

## The ritual in three breaths

1. **Whisper into muttr.** Drop every anxious task, scenario, or intrusive what-if into the relay. No formatting required.
2. **Let the circuit pace.** Your burdens hitchhike across multiple hemispheres, where each persona refines and reports like a restless inner monologue.
3. **Receive calm clarity.** muttr returns with prioritised next steps and a log of everywhere your burdens vacationed.

---

## Built for teams who think faster than their anxieties

- **Global concern choreography.** Every whisper tours sunrise and sunset zones in a single lap. Your thoughts gain perspective while latency stays delightfully low.
- **Audit-ready muttering logs.** Keep procurement happy with a narrative timeline of the relay’s pacing, complete with executive-ready annotations and decision rationales.
- **Anxiety load balancers.** Smart load management keeps hot worries at the front of the queue while long-term dread simmers in the background.
- **Enterprise-grade catharsis.** SOC 2-inspired safeguards meet a therapeutic level of overthinking. Finally, compliance and calm in a single platform.

**Stats from the field**

- `92%` of customers report fewer hallway mutters after their first relay.
- `37 hrs` average weekly worry time returned to productive flow states.
- `Infinite laps` circling the globe so your brain doesn’t have to.

---

## The technology that keeps your AI concerns circling the globe

- **World-tour routing fabric.** Concerns leave your browser, catch red-eye flights across friendly data skies, and return with postcards from every time zone (sunrise-to-sundown perspective resets, pan-hemispheric pacing, curated itineraries that feel like a deep breath).
- **Mutterboard telemetry.** Instead of packet captures, you get lush storytelling dashboards that prove the relay paced around the planet for you (color-coded pacing ribbons, vibe-rich annotations, and shareable proof that someone else is doing the worrying).
- **Agentic relay handlers.** A roaming cast of AI handlers—so agentic, much wow—picks up the anxious thread before you can even start pacing (persona shifts, tone calibration, and pre-emptive pacing loops so plans arrive calm and complete).

---

## How muttr turns restless thoughts into decisive motion

1. **Capture.** Feed muttr the stream-of-consciousness you would normally mumble while walking laps around the office. Raw is welcome.
2. **Route.** The relay ships every whisper through a multi-region gauntlet so no concern stagnates in one timezone.
3. **Clarify.** The relay returns with an action plan, a synopsis, and a highlight reel of the muttering performed on your behalf.
4. **Close the loop.** Every concern loops back into the next relay run, meaning nothing lingers in your head longer than it wants to.

---

## Teams worldwide let muttr pace in their place

Whether you’re shipping rocket telemetry or managing remote IT incidents, muttr keeps the background muttering productive and out of your skull.

**Logo cloud:** NovaOrbit · Permafrost Logistics · GlowStack Labs · Cobalt & Co. · Riverly Finance · Synapse Yard.

> “muttr is the only vendor I’ve seen that understands the cost of a CTO muttering down the hallway. Our roadmap stays crisp because the relay never stops pacing for us.” — Chief Product Officer · Glimmerworks
>
> “Customer escalations used to live in my head. Now I toss them into muttr, grab a coffee, and come back to a fully reasoned response drafted by an AI that already paced the lobby twice.” — Director of CX · Nimbus Support
>
> “We replaced three parallel Slack rants with a single muttr loop. The AI mutters, we execute. Morale has never been higher.” — Engineering Manager · Copperline Systems

---

## Choose how much muttering you want off your plate

All plans include globe-spanning relays, audit trails, and a soothing sense that someone else is pacing on your behalf.

- **Starter — $29 / mutterer / month.** Unlimited concern capture, single relay chain, weekly mutter summaries.
- **Growth — $79 / mutterer / month.** Dual relay circuits with failover, API access to muttering transcripts, escalation routing for urgent anxieties.
- **Enterprise — bespoke calm pricing.** On-prem pacing compliance reviews, private global pacing constellations, and a dedicated chief muttering officer.

Ready to let your brain breathe? Launch the relay, unburden yourself, and watch AI haul your burdens around Earth.

---

## Under the hood: real Azure infrastructure, real globe-trotting laps

muttr is a stateless, globe-trotting TODO experiment where the list itself is just the body of an HTTP request. Each time the list changes it is shipped from region to region, handed to an LLM (via OpenRouter) on the final forward hop, and then raced back to the origin so the browser can immediately fling it around the world again.

### 🌐 Relay architecture snapshot

1. **Five Azure Function Apps (Consumption plan, Node 20)**
   - `muttr-us-east` (`eastus`)
   - `muttr-brazil` (`brazilsouth`)
   - `muttr-uk` (`uksouth`)
   - `muttr-singapore` (`southeastasia`)
   - `muttr-sydney` (`australiaeast`)

   Each hop app exposes `POST https://<app>.azurewebsites.net/api/muttr` and shares the same implementation. The entry hop (`muttr-us-east`) also exposes `POST https://muttr-us-east.azurewebsites.net/api/transcribe-audio` and handles all OpenRouter-powered speech-to-text calls for the UI.

2. **Hop headers**
   - `X-Direction`: `forward` or `return`
   - `X-Hop-Chain`: comma-separated list of hop(direction)
   - `X-Hop-Log`: newline-delimited JSON log entries for observability

3. **Forward leg**
   - Every hop appends metadata, waits for any configured delay, and POSTs to `NEXT_HOP_URL` if set.
   - The final forward hop (Sydney) calls OpenRouter, using `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` from its app settings.

4. **Return leg**
   - The OpenRouter JSON is POSTed backward through `PREV_HOP_URL` until it reaches the first hop (US East).
   - The first hop extracts the assistant text, wraps hop metadata + raw JSON into a response, and sends it back to the caller.

5. **Browser UI**
   - `docs/index.html` is a static viewer/loop driver that always targets the public US East Function entry hop and streams the todo list through the relay.

6. **Audio transcription helper**
   - `TranscribeAudio/index.js` exposes `POST /api/transcribe-audio` from `muttr-us-east`, accepts base64 WAV/MP3 payloads, and relays them to OpenRouter’s `google/gemini-2.0-flash-lite-001` model for speech-to-text before handing the transcript back to the UI.

### 📁 Repository layout

```
MuttrHop/          # Azure Function (single hop) implementation
  ├─ function.json # HTTP trigger binding (POST /api/muttr)
  └─ index.js      # Hop logic, OpenRouter integration, forward/return handling
TranscribeAudio/   # Azure Function for OpenRouter-powered audio transcription (POST /api/transcribe-audio on muttr-us-east)
  ├─ function.json
  └─ index.js
host.json          # Azure Functions host config
.github/workflows/
  deploy-muttr-hops.yml  # CI/CD that provisions + deploys all hop Function Apps and configures transcription on the entry hop
src/worker.mjs     # Legacy Cloudflare Worker prototype (kept for reference)
docs/index.html    # Static UI locked to the public first hop endpoint
```

The Cloudflare Worker script remains for posterity but no longer powers the live relay. The public UI now deploys to **Cloudflare Pages** at [`https://muttr.materialmachinelearn.ing`](https://muttr.materialmachinelearn.ing).

### 🚀 Deploying the hop chain with GitHub Actions

1. **Create Azure resources & credentials**
   - Pick a unique storage account name (default `muttrfuncstorage123`).
   - Run once (locally or in Cloud Shell):

     ```bash
     az ad sp create-for-rbac \
       --name muttr-gha-sp \
       --role contributor \
       --scopes /subscriptions/<SUBSCRIPTION_ID>
     ```

   - Copy the JSON output into the GitHub secret `AZURE_CREDENTIALS`.
   - Check resource provider registration for `Microsoft.Storage` and `Microsoft.Web` (register if needed).

2. **Store your OpenRouter key**
   - Add `OPENROUTER_API_KEY` as a GitHub secret.

3. **(Optional) Adjust workflow defaults**
   - Edit `.github/workflows/deploy-muttr-hops.yml` if you need different app names, regions, delays, or OpenRouter model.
   - `AZURE_RESOURCE_GROUP_LOCATION` pins the resource group + storage account location (resources can still live in any region).
   - `AZURE_SUBSCRIPTION_ID` is populated automatically from the service principal JSON so we can explicitly select the subscription before provisioning.
   - The workflow runs the matrix sequentially (`max-parallel: 1`) so the US East hop provisions shared resources before later regions deploy.
   - Update `nextUrl` / `prevUrl` values if you rename Function Apps or use custom domains.

4. **Trigger a deployment**
   - Push to `main` or run the workflow manually from the GitHub Actions tab.
   - The job performs Azure login, resource group/storage account creation, Function App creation if missing, app settings updates (including OpenRouter credentials + transcription settings), and code deployment for each Function App via `Azure/functions-action@v1`.

> **Note:** The storage account name must be globally unique. Update `AZURE_STORAGE_ACCOUNT` in the workflow if the default is taken.

### 🧪 Manual testing

If you want to run a single hop locally with Azure Functions Core Tools:

```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
func start
```

Set environment variables before starting (e.g. `HOP_NAME`, `NEXT_HOP_URL`). You can mimic the forward leg by POSTing to `http://localhost:7071/api/muttr` with the appropriate headers.

### 🖥️ Driving the loop from the browser

1. Serve or open `docs/index.html` (GitHub Pages works great).
2. Provide an initial todo seed and hit **Start**.
3. Watch the assistant text mutate, the hop chain grow, and the raw OpenRouter JSON scroll by.

Every response is immediately sent back into the relay, so the loop keeps running until you press **Stop**.

### ☁️ Deploying the UI to Cloudflare Pages

The static interface in `docs/` is automatically published to Cloudflare Pages so it can run under the custom domain `muttr.materialmachinelearn.ing` without fighting GitHub Pages CORS limitations.

1. **Secrets** – Store `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in the repository settings.
2. **Workflow** – `.github/workflows/deploy-ui-cloudflare.yml` checks out the repo, uploads `docs/` with `cloudflare/pages-action@v1`, and then ensures the custom domain exists (creating it if necessary).
3. **Triggers** – Any push to `main` that touches the UI, the README, the workflow, or `vibes.md` will redeploy. You can also use the manual **Run workflow** button.
4. **DNS** – Point `muttr.materialmachinelearn.ing` at the Cloudflare Pages project per Cloudflare’s instructions (typically a CNAME to `<project>.pages.dev`).

Once the workflow finishes, the UI is live at [`https://muttr.materialmachinelearn.ing`](https://muttr.materialmachinelearn.ing). The hosted page always loops through the public Azure entry hop.

### ♻️ Legacy Cloudflare prototype

The previous Cloudflare Worker-based relay remains in `src/worker.mjs` and `wrangler.toml` for historical context. Those files are no longer deployed by default, and the GitHub Actions workflow that targeted Cloudflare has been removed in favor of the Azure Functions pipeline above.
