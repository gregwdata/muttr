# muttr

muttr is a stateless, globe-trotting todo experiment that bounces every update across a daisy chain of Cloudflare Workers before asking an OpenRouter-hosted LLM how to mutate the list next. The browser never stores anything locally—each loop pulls fresh instructions from the worker relay and immediately hurls them back into the planetary circuit.

## cloudfare configuration step-by-step

1. **Gather the prerequisites**
   - A Cloudflare account with a zone configured for the five hop subdomains (`us-east`, `brazil`, `uk`, `singapore`, `sydney`).
   - Wrangler 3+ installed locally and authenticated (`npx wrangler login`).
   - An OpenRouter API key; this is stored as a secret on the last hop.
   - (Optional) A GitHub Pages site pointing at `docs/` if you want a static UI that can target the first hop.

2. **Clone and inspect the repo**
   ```bash
   git clone https://github.com/YOUR-ORG/muttr.git
   cd muttr
   ```
   Review `src/worker.mjs` to understand the hop logic and ensure the HTML UI meets your needs.

3. **Review `wrangler.toml`**
   The repo now includes a ready-to-customize `wrangler.toml` that sets up each hop with the shared worker script. Open the file, swap `YOURDOMAIN.COM` for your zone, and adjust the `DELAY_MS` values or environment bindings as needed before deploying.

4. **Configure secrets and optional CORS**
   - Run `npx wrangler secret put OPENROUTER_API_KEY --env sydney` and paste your key. The Sydney hop is responsible for calling OpenRouter.
   - If you host the UI separately (for example via GitHub Pages), set `CORS_ALLOW_ORIGIN` on the first hop with `npx wrangler secret put CORS_ALLOW_ORIGIN --env us_east` and supply `*` or the origin of your static site.

5. **Deploy the hops in order**
   ```bash
   npx wrangler deploy --env us_east
   npx wrangler deploy --env brazil
   npx wrangler deploy --env uk
   npx wrangler deploy --env singapore
   npx wrangler deploy --env sydney
   ```
   Each command publishes the same Worker script with environment-specific bindings, building the forward and return relay chain.

6. **Smoke-test the full relay**
   - Hit `https://us-east.YOURDOMAIN.COM/` and start the loop from the built-in UI, or open `docs/index.html` locally and point it at the first hop.
   - Watch the hop log and assistant text to confirm the OpenRouter response flows all the way back.

## Automated deployment with GitHub Actions

Yes—you can wire up a GitHub Action that deploys each hop sequentially whenever you push to `main`. The example below (also committed at `.github/workflows/cloudflare-relay-deploy.yml`) assumes your repository has a `wrangler.toml` like the one above and that you have stored the OpenRouter key in your repo secrets as `OPENROUTER_API_KEY`. The Cloudflare API token must have “Edit Cloudflare Workers” permissions and be stored as `CLOUDFLARE_API_TOKEN`.

```yaml
name: Deploy Workers relay

on:
  push:
    branches: ["main"]
  workflow_dispatch: {}

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Wrangler
        run: npm install -g wrangler

      - name: Deploy us-east hop
        run: wrangler deploy --env us_east
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Deploy brazil hop
        run: wrangler deploy --env brazil
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Deploy uk hop
        run: wrangler deploy --env uk
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Deploy singapore hop
        run: wrangler deploy --env singapore
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Deploy sydney hop
        run: wrangler deploy --env sydney
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
```

Because the worker source is identical for each environment, serial deployment ensures that every hop stays in sync with the latest code and configuration. You can further optimize this job by matrixing environments or caching dependencies, but the above workflow is sufficient for a reliable continuous deployment pipeline.
