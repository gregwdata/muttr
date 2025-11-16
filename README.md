# muttr

muttr is a stateless, globe-trotting TODO experiment where the list itself is just the body of an HTTP request. Each time the list changes it is shipped from region to region, handed to an LLM (via OpenRouter) on the final forward hop, and then raced back to the origin so the browser can immediately fling it around the world again.

This repo now ships a real around-the-world relay implemented with **Azure Functions**. Every hop runs the same code (`MuttrHop/index.js`), but Function App configuration tells it whether to forward the payload onward, call OpenRouter, or finish the return leg. A GitHub Actions workflow provisions and deploys five Function Apps so the payload actually travels East US → Brazil South → UK South → Southeast Asia → Australia East and back.

---

## 🌐 Architecture

1. **Six Azure Function Apps (Consumption plan, Node 20)**
   - `muttr-us-east` (`eastus`)
   - `muttr-brazil` (`brazilsouth`)
   - `muttr-uk` (`uksouth`)
   - `muttr-singapore` (`southeastasia`)
   - `muttr-sydney` (`australiaeast`)
   - `muttr-transcribe-us-east` (`eastus`)

   Each hop app exposes `POST https://<app>.azurewebsites.net/api/muttr` and shares the same implementation. The dedicated transcribe app exposes `POST https://muttr-transcribe-us-east.azurewebsites.net/api/transcribe-audio` and handles all OpenRouter-powered speech-to-text calls for the UI.

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
   - `docs/index.html` is a static viewer/loop driver that always targets the public US East Function entry hop and streams the todo list through the relay forever.

6. **Audio transcription helper (dedicated US East Function App)**
   - `TranscribeAudio/index.js` exposes `POST /api/transcribe-audio`, accepts base64 WAV/MP3 payloads, and relays them to OpenRouter’s `google/gemini-2.0-flash-lite-001` model for speech-to-text before handing the transcript back to the UI.

---

## 📁 Repository layout

```
MuttrHop/          # Azure Function (single hop) implementation
  ├─ function.json # HTTP trigger binding (POST /api/muttr)
  └─ index.js      # Hop logic, OpenRouter integration, forward/return handling
TranscribeAudio/   # Azure Function for OpenRouter-powered audio transcription (POST /api/transcribe-audio)
  ├─ function.json
  └─ index.js
host.json          # Azure Functions host config
.github/workflows/
  deploy-muttr-hops.yml  # CI/CD that provisions + deploys all hop Function Apps and the dedicated transcribe Function App
src/worker.mjs     # Legacy Cloudflare Worker prototype (kept for reference)
docs/index.html    # Static UI locked to the public first hop endpoint
```

The Cloudflare Worker script is still present for posterity but no longer powers the live relay. The public UI now deploys to **Cloudflare Pages** at [`https://muttr.materialmachinelearn.ing`](https://muttr.materialmachinelearn.ing), which simply hosts the static client in `docs/`.

---

## 🚀 Deploying the hop chain with GitHub Actions

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
   - Check resource provider registration for Microsoft.Storage

         az provider show --namespace Microsoft.Storage --query registrationState --output tsv
         
         
      If it returns e.g. “NotRegistered” then you need to register:
         
         az provider register --namespace Microsoft.Storage
      Then wait for registration to complete (may take a few minutes).
   - Repeat the above step for `Microsoft.Web`

2. **Store your OpenRouter key**
   - Add `OPENROUTER_API_KEY` as a GitHub secret.

3. **(Optional) Adjust workflow defaults**
   - Edit `.github/workflows/deploy-muttr-hops.yml` if you need different app names, regions, delays, or OpenRouter model.
   - `AZURE_RESOURCE_GROUP_LOCATION` pins the resource group + storage account location (resources can still live in any region).
   - `AZURE_SUBSCRIPTION_ID` is populated automatically from the service principal JSON so we can explicitly select the subscription before provisioning.
   - The workflow runs the matrix sequentially (`max-parallel: 1`) so the US East hop provisions shared resources before later regions deploy.
   - The matrix defines the full hop chain. Update `nextUrl` / `prevUrl` values if you rename Function Apps or use custom domains.

4. **Trigger a deployment**
   - Push to `main` or run the workflow manually from the GitHub Actions tab.
   - The job performs:
     - Azure login via the service principal.
     - Resource group creation (idempotent, uses `AZURE_RESOURCE_GROUP_LOCATION`).
     - Storage account creation (only on the first matrix iteration, also in `AZURE_RESOURCE_GROUP_LOCATION`).
     - Function App creation if missing.
     - App settings updates for hop wiring + OpenRouter credentials on the final hop.
     - Provisioning + deployment of the dedicated `muttr-transcribe-us-east` Function App with the transcription code and OpenRouter credentials.
     - Code deployment for each Function App via `Azure/functions-action@v1`.

> **Note:** The storage account name must be globally unique. Update `AZURE_STORAGE_ACCOUNT` in the workflow if the default is taken.

---

## 🧪 Manual testing

If you want to run a single hop locally with Azure Functions Core Tools:

```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
func start
```

Set environment variables before starting (e.g. `HOP_NAME`, `NEXT_HOP_URL`). You can mimic the forward leg by POSTing to `http://localhost:7071/api/muttr` with the appropriate headers.

---

## 🖥️ Driving the loop from the browser

1. Serve or open `docs/index.html` (GitHub Pages works great).
2. Provide an initial todo seed and hit **Start**.
3. Watch the assistant text mutate, the hop chain grow, and the raw OpenRouter JSON scroll by.

Every response is immediately sent back into the relay, so the loop keeps running until you press **Stop**.

---

## ☁️ Deploying the UI to Cloudflare Pages

The static interface in `docs/` is automatically published to Cloudflare Pages so it can run under the custom domain `muttr.materialmachinelearn.ing` without fighting GitHub Pages CORS limitations.

1. **Secrets** – Store `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in the repository settings. The token needs permission to manage Pages projects and custom domains for the target account.
2. **Workflow** – `.github/workflows/deploy-ui-cloudflare.yml` checks out the repo, uploads `docs/` with `cloudflare/pages-action@v1`, and then ensures the custom domain exists (creating it if necessary).
3. **Triggers** – Any push to `main` that touches the UI, the README, the workflow, or `vibes.md` will redeploy. You can also use the manual **Run workflow** button.
4. **DNS** – Point `muttr.materialmachinelearn.ing` at the Cloudflare Pages project per Cloudflare’s instructions (typically a CNAME to `<project>.pages.dev`). The workflow call to the Cloudflare API keeps the association in sync.

Once the workflow finishes, the UI is live at [`https://muttr.materialmachinelearn.ing`](https://muttr.materialmachinelearn.ing). The hosted page always loops through the public Azure entry hop.

---

## ♻️ Legacy Cloudflare prototype

The previous Cloudflare Worker-based relay remains in `src/worker.mjs` and `wrangler.toml` for historical context. Those files are no longer deployed by default, and the GitHub Actions workflow that targeted Cloudflare has been removed in favor of the Azure Functions pipeline above.

