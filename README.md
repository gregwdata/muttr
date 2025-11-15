# muttr

muttr is a stateless, globe-trotting TODO experiment where the list itself is just the body of an HTTP request. Each time the list changes it is shipped from region to region, handed to an LLM (via OpenRouter) on the final forward hop, and then raced back to the origin so the browser can immediately fling it around the world again.

This repo now ships a real around-the-world relay implemented with **Azure Functions**. Every hop runs the same code (`MuttrHop/index.js`), but Function App configuration tells it whether to forward the payload onward, call OpenRouter, or finish the return leg. A GitHub Actions workflow provisions and deploys five Function Apps so the payload actually travels East US → Brazil South → UK South → Southeast Asia → Australia East and back.

---

## 🌐 Architecture

1. **Five Azure Function Apps (Consumption plan, Node 20)**
   - `muttr-us-east` (`eastus`)
   - `muttr-brazil` (`brazilsouth`)
   - `muttr-uk` (`uksouth`)
   - `muttr-singapore` (`southeastasia`)
   - `muttr-sydney` (`australiaeast`)

   Each app exposes `POST https://<app>.azurewebsites.net/api/muttr` and shares the same implementation.

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
   - `docs/index.html` is a static viewer/loop driver. Point it at the US East Function endpoint and it will stream the todo list through the relay forever.

---

## 📁 Repository layout

```
MuttrHop/          # Azure Function (single hop) implementation
  ├─ function.json # HTTP trigger binding (POST /api/muttr)
  └─ index.js      # Hop logic, OpenRouter integration, forward/return handling
host.json          # Azure Functions host config
.github/workflows/
  deploy-muttr-hops.yml  # CI/CD that provisions + deploys all Function Apps
src/worker.mjs     # Legacy Cloudflare Worker prototype (kept for reference)
docs/index.html    # Static UI that can target the first hop endpoint
```

The Cloudflare Worker script is still present for posterity but no longer powers the live relay.

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

2. **Store your OpenRouter key**
   - Add `OPENROUTER_API_KEY` as a GitHub secret.

3. **(Optional) Adjust workflow defaults**
   - Edit `.github/workflows/deploy-muttr-hops.yml` if you need different app names, regions, delays, or OpenRouter model.
   - `AZURE_RESOURCE_GROUP_LOCATION` pins the resource group + storage account location (resources can still live in any region).
   - `AZURE_SUBSCRIPTION_ID` is populated automatically from the service principal JSON so we can explicitly select the subscription before provisioning.
   - The matrix defines the full hop chain. Update `nextUrl` / `prevUrl` values if you rename Function Apps or use custom domains.

4. **Trigger a deployment**
   - Push to `main` or run the workflow manually from the GitHub Actions tab.
   - The job performs:
     - Azure login via the service principal.
     - Resource group creation (idempotent, uses `AZURE_RESOURCE_GROUP_LOCATION`).
     - Storage account creation (only on the first matrix iteration, also in `AZURE_RESOURCE_GROUP_LOCATION`).
     - Function App creation if missing.
     - App settings updates for hop wiring + OpenRouter credentials on the final hop.
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
2. Paste the first hop endpoint (e.g. `https://muttr-us-east.azurewebsites.net/api/muttr`).
3. Provide an initial todo seed and hit **Start**.
4. Watch the assistant text mutate, the hop chain grow, and the raw OpenRouter JSON scroll by.

Every response is immediately sent back into the relay, so the loop keeps running until you press **Stop**.

---

## ♻️ Legacy Cloudflare prototype

The previous Cloudflare Worker-based relay remains in `src/worker.mjs` and `wrangler.toml` for historical context. Those files are no longer deployed by default, and the GitHub Actions workflow that targeted Cloudflare has been removed in favor of the Azure Functions pipeline above.

