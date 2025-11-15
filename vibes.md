

# 📢 muttr 🌎 
### _A delightfully unhinged, around-the-world, stateless, LLM-telephone TODO vortex_

muttr is a hackathon-grade experimental web app where a "todo list" has **no storage** and **no persistence**.  
Instead, the entire state lives inside a single **LLM message** that is:

1. sent **around the world**, hop by hop,
2. handed off to an LLM (via OpenRouter),
3. returned through the *same chain in reverse*,
4. handed back to the browser,
5. and then immediately sent again.

Each lap mutates the todo list slightly, like a game of telephone with the planet as the relay system.

The project is intentionally chaotic, intentionally stateless, and intentionally fun.

---

## 💡 Core Vibe / Philosophy

- **No database. No localStorage. No files. No memory.**
  The only source of truth is the **message payload currently bouncing around Earth**.

- **Every update triggers a complete forward-and-back traversal.**  
  All state is rederived from the LLM each cycle.

- **The LLM is the storage. The network is the clock. The hops are the chaos.**

- **Every hop logs its Cloudflare colo, country, ASN, & direction.**  
  This creates a beautiful end-to-end trace of the todo list’s global pilgrimage.

- **The browser is a dumb terminal.**
  It just displays the latest mutated LLM response and sends it back into the void.

---

## ✅ Working Agreements & Rituals

- **Always consult this `vibes.md` before touching code.**
- **Always update this `vibes.md` after touching code** so the global relay team shares the same headspace.

---

## 🌐 Architecture Summary

muttr relies on a chain of **five Cloudflare Worker environments**, each deployed on a different subdomain:

us-east → brazil → uk → singapore → sydney

The message travels:

FORWARD:
browser → us-east → brazil → uk → singapore → sydney
RETURN:
sydney → singapore → uk → brazil → us-east → browser

- **The final forward hop (Sydney)** calls **OpenRouter** with the todo-text payload.
- The **LLM response JSON** then becomes the payload for the **return leg**.
- **us-east**, the first hop, receives the final return and responds to the browser with:
  - `assistant_text` extracted from the LLM response  
  - the full hop chain  
  - the full hop log  
  - the raw LLM JSON

The browser then **feeds the assistant text directly into another POST**, forming a self-sustaining loop.

---

## 📁 Project Files & Responsibilities

### `src/worker.mjs`
This single Worker script powers **all** environments (us-east, brazil, uk, singapore, sydney).

It implements:

#### 1. **The front-end web UI**
Served at `GET /`.  
Includes:
- text area for initial todo seed  
- Start/Stop controls  
- live iteration count  
- live hop chain display  
- pretty-printed assistant text  
- raw JSON debug output  
- loop logic that re-sends the assistant text as the new payload

#### 2. **Forward Hop Logic**
- Reads the incoming body
- Appends hop-chain and hop-log metadata
- Adds optional artificial delay  
- Forwards body to `NEXT_HOP_URL`

#### 3. **Last Forward Hop (Sydney)**
- Detects it has no `NEXT_HOP_URL`
- Invokes **OpenRouter**:
  ```json
  { "model": ..., "messages": [{ "role": "user", "content": <body> }] }

	•	Extracts the raw JSON from the LLM
	•	Begins return leg by POSTing the JSON to PREV_HOP_URL with direction "return"

4. Return Hop Logic
	•	For all intermediate hops: simply forwards the LLM JSON backward
	•	For the first hop (us-east):
	•	Extracts the assistant message text
	•	Packages:
	•	assistant_text
	•	hop_chain
	•	hop_log
	•	full LLM JSON
	•	Returns this to the browser

### `docs/index.html`
Static GitHub Pages build of the browser UI. Mirrors the Worker-served interface but prompts you to enter the first-hop endpoint (absolute or relative) before launching the loop.

When running from GitHub Pages:

- Point GitHub Pages at the `/docs` folder on the `main` branch.
- Set the Cloudflare Worker environment variable `CORS_ALLOW_ORIGIN` (e.g. `*`, your Pages origin, or `request-origin`) so the first hop will satisfy the cross-origin `OPTIONS` + `POST` dance.
- Paste the public first-hop URL (e.g. `https://us-east.example.com/api/hop`) into the field on every load—no storage, only vibes.

⸻

🗺️ wrangler.toml

Defines 5 Worker environments, each with:
	•	HOP_NAME
	•	NEXT_HOP_URL (except final hop)
	•	PREV_HOP_URL (except first hop)
	•	optional DELAY_MS (latency flavor)
	•	OPENROUTER_MODEL (only on final forward hop)

Cloudflare DNS has 5 proxied subdomains:

us-east.example.com
brazil.example.com
uk.example.com
singapore.example.com
sydney.example.com

Each subdomain routes to its corresponding Worker environment.

⸻

🔐 Secrets

Only the sydney environment needs the OpenRouter API key:

wrangler secret put OPENROUTER_API_KEY --env sydney

The Worker reads it as env.OPENROUTER_API_KEY.

⸻

🔁 Browser Loop Logic Summary

Pseudocode from vibes perspective:

current = seed_text
while (running):
    response = POST("/api/route", body=current)
    show(response.assistant_text)
    show(response.hop_chain)
    current = response.assistant_text  // "state"
    sleep(800ms)

State is never stored.
State is whatever the LLM said last lap.

We are willingly surrendering our app to a global-scale hallucination engine.

⸻

🌀 Why This Exists
	•	Because hackathons deserve art.
	•	Because distributed systems should sometimes be stupid for fun.
	•	Because the world deserves a TODO list that circumnavigates the planet every 1.6 seconds.
	•	Because we can.

⸻

🚀 Quick Start
	1.	Deploy all 5 envs with wrangler deploy --env <name>
	2.	Visit:

https://us-east.YOURDOMAIN.COM/


	3.	Enter a seed todo list
	4.	Hit Start vortex
	5.	Watch it mutate forever as it travels around Earth and through an LLM


concept for src/worker.mjs

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---- 1. Serve the web UI ----
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(
        `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Unhinged Global TODO Vortex</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    textarea { width: 100%; min-height: 100px; }
    pre { background: #f3f3f3; padding: 1rem; white-space: pre-wrap; word-break: break-word; max-height: 250px; overflow-y: auto; }
    button { padding: 0.4rem 0.9rem; margin-right: 0.5rem; }
    .meta { font-size: 0.9rem; color: #555; margin-top: 0.5rem; }
    .row { margin-bottom: 1rem; }
    #status { font-weight: 600; }
  </style>
</head>
<body>
  <h1>Unhinged Around-the-World TODO List</h1>
  <p>
    The "todo list" lives only inside an LLM message that is sent around the world to an LLM
    and then back again — on repeat. No database, no local storage. Pure chaos.
  </p>

  <div class="row">
    <label for="seed"><strong>Initial TODO seed text:</strong></label><br>
    <textarea id="seed" placeholder="- Buy milk
- Fix warp drive
- Refactor the forge analytics pipeline"></textarea>
  </div>

  <div class="row">
    <button id="start">Start vortex</button>
    <button id="stop" disabled>Stop vortex</button>
    <span id="status">Idle</span>
  </div>

  <div class="row meta">
    <div>Iterations: <span id="iters">0</span></div>
    <div>Last hop chain: <span id="hop-chain">(none)</span></div>
  </div>

  <h2>Current LLM TODO text</h2>
  <pre id="assistant-text">(none yet)</pre>

  <h2>Last raw JSON snapshot (debug)</h2>
  <pre id="raw-json">(none yet)</pre>

  <script>
    const startBtn = document.getElementById("start");
    const stopBtn = document.getElementById("stop");
    const seedEl = document.getElementById("seed");
    const statusEl = document.getElementById("status");
    const itersEl = document.getElementById("iters");
    const hopChainEl = document.getElementById("hop-chain");
    const assistantTextEl = document.getElementById("assistant-text");
    const rawJsonEl = document.getElementById("raw-json");

    let running = false;
    let iteration = 0;
    let currentPayload = "";

    async function runOneCycle() {
      if (!running) return;

      iteration += 1;
      itersEl.textContent = iteration.toString();
      statusEl.textContent = "Sending iteration " + iteration + "...";

      try {
        const resp = await fetch("/api/route", {
          method: "POST",
          headers: {
            "Content-Type": "text/plain"
          },
          body: currentPayload
        });

        const hopChain = resp.headers.get("X-Hop-Chain") || "(missing)";
        hopChainEl.textContent = hopChain;

        const text = await resp.text();
        rawJsonEl.textContent = text;

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          assistantTextEl.textContent = "Could not parse JSON: " + e;
          statusEl.textContent = "Error; stopping.";
          running = false;
          startBtn.disabled = false;
          stopBtn.disabled = true;
          return;
        }

        const assistant = data.assistant_text || "(no assistant_text found)";
        assistantTextEl.textContent = assistant;

        // This is the "ephemeral storage" trick:
        // use the assistant's text as the next payload.
        currentPayload = assistant;

        statusEl.textContent = "Completed iteration " + iteration;

        // Schedule next cycle with a short pause so the browser doesn't melt
        if (running) {
          setTimeout(runOneCycle, 800);
        }
      } catch (err) {
        statusEl.textContent = "Network error; stopping. " + err;
        running = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
      }
    }

    startBtn.addEventListener("click", () => {
      if (running) return;
      const seed = seedEl.value.trim();
      currentPayload = seed || "You are an unhinged TODO list. Rewrite and repeat these items however you like.";
      running = true;
      iteration = 0;
      itersEl.textContent = "0";
      startBtn.disabled = true;
      stopBtn.disabled = false;
      statusEl.textContent = "Starting...";
      runOneCycle();
    });

    stopBtn.addEventListener("click", () => {
      running = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      statusEl.textContent = "Stopped";
    });
  </script>
</body>
</html>`,
        { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    // ---- 2. Hop logic (forward + return with OpenRouter at last forward hop) ----

    const hopName = env.HOP_NAME || "unknown-hop";
    const delayMs = env.DELAY_MS ? parseInt(env.DELAY_MS, 10) || 0 : 0;
    const nextHop = env.NEXT_HOP_URL || null;
    const prevHop = env.PREV_HOP_URL || null;

    const direction = request.headers.get("X-Direction") || "forward";
    const rawBody = await request.text(); // body lives here for this hop

    const hopsSoFar = request.headers.get("X-Hop-Chain");
    const hopLabel = `${hopName}(${direction})`;
    const newChain = hopsSoFar ? `${hopsSoFar},${hopLabel}` : hopLabel;

    const prevLog = request.headers.get("X-Hop-Log") || "";
    const cf = request.cf || {};

    const currentHopLogLine = JSON.stringify({
      hop: hopName,
      direction,
      path: url.pathname,
      colo: cf.colo || null,
      country: cf.country || null,
      asn: cf.asn || null,
      delay_ms: delayMs,
      chain: newChain,
      timestamp: new Date().toISOString(),
    });

    const newLog = prevLog
      ? `${prevLog}\n${currentHopLogLine}`
      : currentHopLogLine;

    console.log(currentHopLogLine);

    const baseHeaders = new Headers(request.headers);
    baseHeaders.set("X-Hop-Chain", newChain);
    baseHeaders.set("X-Hop-Log", newLog);
    baseHeaders.set("X-Direction", direction);

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    async function callHop(urlStr, newDirection, bodyStr) {
      const hopHeaders = new Headers(baseHeaders);
      if (newDirection) {
        hopHeaders.set("X-Direction", newDirection);
      }
      const downstreamReq = new Request(urlStr + url.pathname + url.search, {
        method: request.method, // should be POST
        headers: hopHeaders,
        body: bodyStr,
        redirect: "manual",
      });
      return fetch(downstreamReq);
    }

    // ---------- FORWARD PHASE ----------
    if (direction === "forward") {
      if (nextHop) {
        // Middle hops: just pass the body onward
        return callHop(nextHop, "forward", rawBody);
      }

      // Last forward hop (e.g. Sydney)
      const userMessage = rawBody || "You are a chaotic todo-list game of telephone. Repeat and possibly mutate these items.";

      const apiKey = env.OPENROUTER_API_KEY;
      const model = env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

      if (!apiKey) {
        return new Response(
          "OpenRouter API key not configured on this environment.",
          { status: 500 }
        );
      }

      const openRouterReqBody = {
        model,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      };

      const openRouterResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://YOURDOMAIN.COM",
          "X-Title": "Unhinged Global TODO Vortex"
        },
        body: JSON.stringify(openRouterReqBody),
      });

      const openRouterText = await openRouterResp.text();

      if (prevHop) {
        // Start return leg, carrying LLM JSON as body
        return callHop(prevHop, "return", openRouterText);
      }

      // Edge case: single hop only
      const outHeaders = new Headers({
        "content-type": "application/json; charset=utf-8",
      });
      outHeaders.set("X-Hop-Chain", newChain);
      outHeaders.set("X-Hop-Log", newLog);
      return new Response(openRouterText, { status: 200, headers: outHeaders });
    }

    // ---------- RETURN PHASE ----------
    if (direction === "return") {
      const llmResponseBody = rawBody;

      if (prevHop) {
        // Still returning; keep passing along the LLM JSON
        return callHop(prevHop, "return", llmResponseBody);
      }

      // No PREV_HOP_URL: back at FIRST hop → answer the browser.
      let parsed;
      try {
        parsed = JSON.parse(llmResponseBody);
      } catch {
        parsed = { raw: llmResponseBody };
      }

      // Extract assistant text as nicely as we can
      let assistantText = "(no assistant message found)";
      try {
        const choice = parsed.choices && parsed.choices[0];
        if (choice && choice.message && choice.message.content) {
          // Some APIs use plain string, some use array of parts
          if (typeof choice.message.content === "string") {
            assistantText = choice.message.content;
          } else if (Array.isArray(choice.message.content)) {
            assistantText = choice.message.content
              .map(part => (typeof part === "string" ? part : part.text || ""))
              .join("");
          }
        }
      } catch (e) {
        assistantText = "(error extracting assistant text: " + e + ")";
      }

      const responseBody = JSON.stringify(
        {
          phase: "completed-there-and-back",
          hop_chain: newChain,
          hop_log: newLog.split("\n").map((line) => {
            try { return JSON.parse(line); } catch { return { raw: line }; }
          }),
          assistant_text: assistantText,
          openrouter_response: parsed,
        },
        null,
        2
      );

      const outHeaders = new Headers({
        "content-type": "application/json; charset=utf-8",
      });
      outHeaders.set("X-Hop-Chain", newChain);
      outHeaders.set("X-Hop-Log", newLog);

      return new Response(responseBody, {
        status: 200,
        headers: outHeaders,
      });
    }

    return new Response("Invalid direction state", { status: 500 });
  },
};

concept for wrangler.toml

name = "global-hop"
main = "src/worker.mjs"
compatibility_date = "2024-11-01"

[env.us_east]
vars = {
  HOP_NAME = "us-east-hop",
  NEXT_HOP_URL = "https://brazil.YOURDOMAIN.COM",
  DELAY_MS = "100"
}
routes = ["us-east.YOURDOMAIN.COM/*"]

[env.brazil]
vars = {
  HOP_NAME = "brazil-hop",
  NEXT_HOP_URL = "https://uk.YOURDOMAIN.COM",
  PREV_HOP_URL = "https://us-east.YOURDOMAIN.COM",
  DELAY_MS = "150"
}
routes = ["brazil.YOURDOMAIN.COM/*"]

[env.uk]
vars = {
  HOP_NAME = "uk-hop",
  NEXT_HOP_URL = "https://singapore.YOURDOMAIN.COM",
  PREV_HOP_URL = "https://brazil.YOURDOMAIN.COM",
  DELAY_MS = "200"
}
routes = ["uk.YOURDOMAIN.COM/*"]

[env.singapore]
vars = {
  HOP_NAME = "singapore-hop",
  NEXT_HOP_URL = "https://sydney.YOURDOMAIN.COM",
  PREV_HOP_URL = "https://uk.YOURDOMAIN.COM",
  DELAY_MS = "300"
}
routes = ["singapore.YOURDOMAIN.COM/*"]

[env.sydney]
vars = {
  HOP_NAME = "sydney-hop",
  PREV_HOP_URL = "https://singapore.YOURDOMAIN.COM",
  DELAY_MS = "400",
  OPENROUTER_MODEL = "openai/gpt-4o-mini"
}
routes = ["sydney.YOURDOMAIN.COM/*"]

deployment:

wrangler deploy --env us_east
wrangler deploy --env brazil
wrangler deploy --env uk
wrangler deploy --env singapore
wrangler deploy --env sydney

---

## 🛠 Implementation Log

- **2025-02-14** – Added GitHub Pages static UI (`docs/index.html`) with configurable first-hop endpoint input and gave the Worker CORS superpowers (`CORS_ALLOW_ORIGIN`) so the static site can loop the relay across origins.
- **2025-11-14** – Bootstrapped the unified `src/worker.mjs` Cloudflare Worker implementing the relay API, global hop logging, OpenRouter integration, and the browser UI loop described above.
- **2025-02-15** – Drafted the top-level `README.md` with Cloudflare deployment steps and a sample GitHub Actions workflow for continuous relay releases.
- **2025-02-16** – Checked in the real `.github/workflows/cloudflare-relay-deploy.yml` so pushes to `main` can automatically redeploy every Cloudflare hop.
- **2025-02-16** – Materialized `wrangler.toml` in-repo and pointed the README instructions at it so GitHub Actions deployments have a real config to consume.
